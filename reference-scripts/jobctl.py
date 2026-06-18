#!/usr/bin/env python3
"""
jobctl.py  v1.0 — Bảng công việc (job board) điều phối Cowork <-> Claude CLI.

Hai runtime KHÔNG gọi trực tiếp nhau; chúng phối hợp qua THƯ MỤC CHUNG:
  output/_jobs/<ma_kcb>.json   : 1 HSBA = 1 job (status, owner, stage, concepts...)
  output/_jobs/JOBS.md         : bảng người-đọc (tự render)
  output/_jobs/_grounding_queue.json : hàng đợi khái niệm cần Cowork grounding

Vòng đời job:
  queued → parsing → ocr → analyzing → needs_grounding → ready → done   (hoặc error)

Phân vai mặc định:
  CLI    : parse, ocr, analyzing, sinh DOCX → set done. Khi gặp khái niệm chưa có
           grounding-cache → `need-grounding` (job sang needs_grounding + đẩy vào queue).
  COWORK : `groundq` lấy khái niệm pending → grounding (MCP) → ghi grounding-cache →
           `resolve-grounding` (job đủ grounding → ready). Có thể chạy tự động bằng scheduled task.

Lệnh:
  init   --pdf-dir input [--batch B]      Tạo job cho mỗi PDF (nếu chưa có)
  list   [--status S] [--owner O]         Liệt kê job
  board                                    Render + in JOBS.md
  show   <job>                             Chi tiết 1 job
  claim  <job> --owner cli|cowork          Nhận job
  set    <job> --status S [--stage T] [--owner O] [--note "..."] [--docx P] [--json P]
  need-grounding <job> --concepts "a;b"    Job cần grounding + đẩy concepts vào queue
  groundq [--open]                         In khái niệm đang chờ grounding (cho Cowork)
  resolve-grounding --concepts "a;b"       Đánh dấu concepts đã grounded → job đủ thì ready
  next   --owner cli|cowork                In job kế tiếp nên làm của bên đó
"""
import sys, os, json, argparse, glob, tempfile, unicodedata, re
from pathlib import Path
from datetime import datetime

ACTIVE = ["queued", "parsing", "ocr", "analyzing", "needs_grounding", "ready"]
NEXT_FOR = {  # owner -> các status họ nên xử lý
    "cli":    ["queued", "parsing", "ocr", "analyzing", "ready"],
    "cowork": ["needs_grounding"],
}


def now():
    return datetime.now().isoformat(timespec="seconds")


def norm(s):
    s = (s or "").strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").replace("đ", "d")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]+", " ", s)).strip()


def jobs_dir(project):
    d = Path(project) / "output" / "_jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _atomic_write(path: Path, data):
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, str(path))


def load_job(d, job):
    p = d / f"{job}.json"
    if not p.exists():
        # linh hoạt: khớp job_id chứa chuỗi (vd mã ngắn 5 số) hoặc prefix
        files = [c for c in d.glob("*.json") if not c.name.startswith("_")]
        cand = [c for c in files if c.stem == job] \
            or [c for c in files if job in c.stem] \
            or ([c for c in files if c.stem.endswith(job)] if job.isdigit() else [])
        if len(cand) == 1:
            p = cand[0]
    if not p.exists():
        return None, None
    return p, json.loads(p.read_text(encoding="utf-8"))


def save_job(p, j):
    j["updated_at"] = now()
    _atomic_write(p, j)


def all_jobs(d):
    out = []
    for p in sorted(d.glob("*.json")):
        if p.name.startswith("_"):
            continue
        try:
            out.append((p, json.loads(p.read_text(encoding="utf-8"))))
        except Exception:
            pass
    return out


def queue_path(d):
    return d / "_grounding_queue.json"


def load_queue(d):
    p = queue_path(d)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return {"pending": {}, "resolved": {}}  # key=norm concept -> {concept, jobs:[], added_at}


def save_queue(d, q):
    _atomic_write(queue_path(d), q)


def render_board(d):
    rows = all_jobs(d)
    counts = {}
    for _, j in rows:
        counts[j["status"]] = counts.get(j["status"], 0) + 1
    md = [f"# JOBS — bảng điều phối HSBA  (cập nhật {now()})", "",
          "Tổng: " + " · ".join(f"{k}={v}" for k, v in sorted(counts.items())) or "(trống)", "",
          "| Job (mã KCB) | Họ tên | Status | Owner | Stage | Concepts cần | Ghi chú |",
          "|---|---|---|---|---|---|---|"]
    for _, j in rows:
        md.append(f"| {j['job_id']} | {j.get('ho_ten','')[:22]} | {j['status']} | {j.get('owner','')} | "
                  f"{j.get('stage','')} | {', '.join(j.get('concepts_missing',[]))[:40]} | {j.get('note','')[:40]} |")
    q = load_queue(d)
    if q.get("pending"):
        md += ["", "## Hàng đợi grounding (Cowork xử lý)"]
        for k, v in q["pending"].items():
            md.append(f"- **{v['concept']}** ← job: {', '.join(v['jobs'])}")
    txt = "\n".join(md)
    _atomic_write(d / "JOBS.md", txt) if False else (d / "JOBS.md").write_text(txt, encoding="utf-8")
    return txt, counts


# ── commands ─────────────────────────────────────────────────────────────────

# Tiền tố mã KCB của TTYT Thủy Nguyên (mã đầy đủ 10 số = "26000" + 5 số cuối in trên tên file)
HOSP_PREFIX = "26000"


def derive_id_and_name(base):
    """Tái tạo mã KCB đầy đủ + họ tên từ tên file (3 dạng: '2600062416 TEN', 'Tên-67043-Khoa', 'Tên_Khoa')."""
    stem = os.path.splitext(base)[0]
    full = re.search(r"\b(\d{10})\b", stem)            # đã có mã đầy đủ
    if full:
        ma = full.group(1)
    else:
        short = re.search(r"(\d{5})", stem)            # mã ngắn 5 số → ghép prefix viện
        ma = (HOSP_PREFIX + short.group(1)) if short else stem
    # họ tên: bỏ phần số + khoa viết tắt sau dấu - / _
    name = re.sub(r"[\-_].*$", "", re.sub(r"\d+", "", stem)).strip(" -_")
    name = re.sub(r"\s+", " ", name)
    return ma, name


def cmd_init(a, d):
    created = 0
    pats = []
    for ext in ("*.pdf", "*.PDF"):
        pats += glob.glob(str(Path(a.pdf_dir) / ext))
    for pdf in sorted(set(pats)):
        base = os.path.basename(pdf)
        job_id, ho_ten = derive_id_and_name(base)
        p = d / f"{job_id}.json"
        if p.exists():
            continue
        _atomic_write(p, {
            "job_id": job_id, "pdf": base, "ho_ten": ho_ten, "batch": a.batch or "",
            "status": "queued", "owner": "", "stage": "",
            "concepts_needed": [], "concepts_missing": [],
            "outputs": {"json": "", "docx": ""}, "note": "",
            "created_at": now(), "updated_at": now(),
            "history": [{"t": now(), "ev": "created"}],
        })
        created += 1
    render_board(d)
    print(f"✅ init: tạo {created} job mới (bỏ qua job đã có). Tổng job: {len(all_jobs(d))}")


def cmd_list(a, d):
    for _, j in all_jobs(d):
        if a.status and j["status"] != a.status:
            continue
        if a.owner and j.get("owner") != a.owner:
            continue
        print(f"{j['job_id']:14s} {j['status']:16s} owner={j.get('owner',''):6s} {j.get('note','')[:50]}")


def cmd_board(a, d):
    txt, counts = render_board(d)
    print(txt)


def cmd_show(a, d):
    p, j = load_job(d, a.job)
    if not j:
        print("Không thấy job:", a.job); sys.exit(1)
    print(json.dumps(j, ensure_ascii=False, indent=2))


def cmd_claim(a, d):
    p, j = load_job(d, a.job)
    if not j: print("Không thấy job:", a.job); sys.exit(1)
    j["owner"] = a.owner
    j["history"].append({"t": now(), "ev": f"claim:{a.owner}"})
    save_job(p, j); render_board(d)
    print(f"✅ {j['job_id']} → owner={a.owner}")


def cmd_set(a, d):
    p, j = load_job(d, a.job)
    if not j: print("Không thấy job:", a.job); sys.exit(1)
    ev = []
    if a.status: j["status"] = a.status; ev.append(f"status={a.status}")
    if a.stage:  j["stage"] = a.stage; ev.append(f"stage={a.stage}")
    if a.owner:  j["owner"] = a.owner; ev.append(f"owner={a.owner}")
    if a.note:   j["note"] = a.note
    if a.ho_ten: j["ho_ten"] = a.ho_ten
    if a.docx:   j["outputs"]["docx"] = a.docx
    if a.json:   j["outputs"]["json"] = a.json
    j["history"].append({"t": now(), "ev": " ".join(ev) or "set"})
    save_job(p, j); render_board(d)
    print(f"✅ {j['job_id']}: {' '.join(ev)}")


def cmd_need_grounding(a, d):
    p, j = load_job(d, a.job)
    if not j: print("Không thấy job:", a.job); sys.exit(1)
    concepts = [c.strip() for c in re.split(r"[;|]", a.concepts) if c.strip()]
    j["status"] = "needs_grounding"
    j["concepts_missing"] = sorted(set(j.get("concepts_missing", []) + concepts))
    j["history"].append({"t": now(), "ev": f"need-grounding:{len(concepts)}"})
    save_job(p, j)
    q = load_queue(d)
    for c in concepts:
        k = norm(c)
        e = q["pending"].setdefault(k, {"concept": c, "jobs": [], "added_at": now()})
        if j["job_id"] not in e["jobs"]:
            e["jobs"].append(j["job_id"])
    save_queue(d, q); render_board(d)
    print(f"✅ {j['job_id']} → needs_grounding; đẩy {len(concepts)} khái niệm vào queue")


def cmd_groundq(a, d):
    q = load_queue(d)
    pend = q.get("pending", {})
    if not pend:
        print("(Hàng đợi grounding trống)"); return
    print(f"{len(pend)} khái niệm chờ grounding (Cowork):")
    for k, v in pend.items():
        print(f"  - {v['concept']}   ← job: {', '.join(v['jobs'])}")
    if a.open:
        print("\nConcepts (mỗi dòng 1):")
        for k, v in pend.items():
            print(v["concept"])


def cmd_resolve_grounding(a, d):
    concepts = [c.strip() for c in re.split(r"[;|]", a.concepts) if c.strip()]
    q = load_queue(d)
    resolved_keys = set()
    for c in concepts:
        k = norm(c)
        if k in q.get("pending", {}):
            q["resolved"][k] = q["pending"].pop(k)
            q["resolved"][k]["resolved_at"] = now()
            resolved_keys.add(k)
        else:
            resolved_keys.add(k)  # vẫn đánh dấu để gỡ khỏi job
    save_queue(d, q)
    flipped = 0
    for p, j in all_jobs(d):
        if j["status"] != "needs_grounding":
            continue
        before = set(norm(x) for x in j.get("concepts_missing", []))
        j["concepts_missing"] = [x for x in j.get("concepts_missing", []) if norm(x) not in resolved_keys]
        if not j["concepts_missing"]:
            j["status"] = "ready"
            j["owner"] = "cli"
            j["history"].append({"t": now(), "ev": "grounding_resolved→ready"})
            flipped += 1
            save_job(p, j)
        elif set(norm(x) for x in j["concepts_missing"]) != before:
            save_job(p, j)
    render_board(d)
    print(f"✅ resolve: {len(resolved_keys)} khái niệm; {flipped} job → ready")


def cmd_next(a, d):
    want = NEXT_FOR.get(a.owner, ACTIVE)
    for status in want:
        for _, j in all_jobs(d):
            if j["status"] == status:
                print(f"{j['job_id']}  [{j['status']}]  {j['pdf']}  {('concepts: '+', '.join(j.get('concepts_missing',[]))) if j.get('concepts_missing') else ''}")
                return
    print(f"(Không còn job nào cho {a.owner})")


def main():
    ap = argparse.ArgumentParser(description="jobctl.py v1.0")
    ap.add_argument("--project", default="/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init"); s.add_argument("--pdf-dir", required=True); s.add_argument("--batch", default=""); s.set_defaults(f=cmd_init)
    s = sub.add_parser("list"); s.add_argument("--status"); s.add_argument("--owner"); s.set_defaults(f=cmd_list)
    s = sub.add_parser("board"); s.set_defaults(f=cmd_board)
    s = sub.add_parser("show"); s.add_argument("job"); s.set_defaults(f=cmd_show)
    s = sub.add_parser("claim"); s.add_argument("job"); s.add_argument("--owner", required=True); s.set_defaults(f=cmd_claim)
    s = sub.add_parser("set"); s.add_argument("job"); s.add_argument("--status"); s.add_argument("--stage"); s.add_argument("--owner"); s.add_argument("--note"); s.add_argument("--ho-ten", dest="ho_ten"); s.add_argument("--docx"); s.add_argument("--json"); s.set_defaults(f=cmd_set)
    s = sub.add_parser("need-grounding"); s.add_argument("job"); s.add_argument("--concepts", required=True); s.set_defaults(f=cmd_need_grounding)
    s = sub.add_parser("groundq"); s.add_argument("--open", action="store_true"); s.set_defaults(f=cmd_groundq)
    s = sub.add_parser("resolve-grounding"); s.add_argument("--concepts", required=True); s.set_defaults(f=cmd_resolve_grounding)
    s = sub.add_parser("next"); s.add_argument("--owner", required=True); s.set_defaults(f=cmd_next)

    a = ap.parse_args()
    d = jobs_dir(a.project)
    a.f(a, d)


if __name__ == "__main__":
    main()
