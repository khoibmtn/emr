#!/usr/bin/env python3
"""
grounding-cache.py  v1.0
Cache trich dan guideline / bang chung DA VERIFY, dung chung toan trung tam.

Muc dich tiet kiem token: benh hay gap (ha kali, dau that nguc khong on dinh,
viem phoi cong dong, ...) chi ton token grounding 1 LAN. Cac HSBA sau co cung
khai niem -> CACHE HIT -> khong goi lai PubMed/web/MCP.

Key = khai niem CHUAN HOA (lowercase, bo dau, gom khoang trang). Value = entry
chua cac citation da verify + key_point + hieu luc.

Cach dung:
  # Truoc khi grounding 1 khai niem -> tra cache:
  python3 grounding-cache.py get --cache <f.json> --concept "tieu chuan chan doan dau that nguc khong on dinh"

  # Sau khi da verify -> ghi cache:
  python3 grounding-cache.py put --cache <f.json> --concept "..." --entry-json '<json entry>'

  # Liet ke khai niem da cache:
  python3 grounding-cache.py list --cache <f.json>

Quy uoc entry (do Claude tao sau khi verify, free-form nhung nen co cac field):
  {
    "concept": "<nguyen van>",
    "citations": [
      {"source":"2020 ESC ACS","citation_ref":"[2]",
       "identifier":{"type":"doi","value":"10.1093/eurheartj/ehaa575"},
       "verified": true, "verify_method":"scholar-sidekick matched",
       "validity":"current", "key_point":"..."}
    ],
    "source_tier":"international_society",
    "updated_at":"2026-06-12"
  }
"""
import sys
import json
import argparse
import unicodedata
import re
from pathlib import Path
from datetime import datetime


def normalize_concept(text: str) -> str:
    """Chuan hoa khai niem lam KEY: lowercase, bo dau, bo ky tu thua, gom khoang trang."""
    text = (text or "").strip().lower()
    nfd = unicodedata.normalize("NFD", text)
    text = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    text = text.replace("đ", "d")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)   # bo dau cau
    text = re.sub(r"\s+", " ", text).strip()
    return text


_STOP = {"benh", "ly", "do", "va", "co", "khong", "khac", "loai", "the", "cua", "mot",
         "chua", "phan", "noi", "duoc", "xac", "dinh", "vi", "tri", "trong", "tren"}


def _tokens(s):
    return set(w for w in normalize_concept(s).split() if w not in _STOP and len(w) > 1)


def _resolved(e):
    """Entry coi la DA GROUNDING khi co citation verified HOAC danh dau na_guideline (ma phu khong can phac do)."""
    return bool(e) and (bool(e.get("citations")) or e.get("status") == "na_guideline")


def find_by_code(cache, codes):
    """Khop entry theo MA ICD (chac hon ten). codes = iterable ma ICD. Tra ve (entry,key)."""
    if not codes:
        return None, None
    cs = list(codes)
    for ek, e in cache.get("entries", {}).items():
        for ec in (e.get("icd") or []):
            for c in cs:
                # khop prefix 2 chieu: I10 ~ I10, J44 ~ J44.0, E87.6 ~ E87
                if c == ec or c.startswith(ec) or ec.startswith(c):
                    return e, ek
    return None, None


def find_entry(cache, concept):
    """Khop entry linh hoat: exact -> substring -> trung tu khoa (Jaccard>=0.6) -> alias.
    Tra ve (entry, matched_key) hoac (None, None)."""
    entries = cache.get("entries", {})
    k = normalize_concept(concept)
    if k in entries:
        return entries[k], k
    nk = " " + k + " "
    # substring 2 chieu
    for ek, e in entries.items():
        if not ek:
            continue
        if (" " + ek + " ") in nk or nk.strip() in ek:
            return e, ek
    # alias khai bao trong entry
    for ek, e in entries.items():
        for al in (e.get("aliases") or []):
            if normalize_concept(al) == k or normalize_concept(al) in k:
                return e, ek
    # trung tu khoa
    ct = _tokens(concept)
    if ct:
        best, bk, bs = None, None, 0.0
        for ek, e in entries.items():
            et = _tokens(e.get("concept", ek))
            if not et:
                continue
            j = len(ct & et) / len(ct | et)
            if j > bs:
                bs, best, bk = j, e, ek
        if bs >= 0.6:
            return best, bk
    return None, None


def load_cache(path: str) -> dict:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return {"version": "1.0", "entries": {}}


def save_cache(path: str, cache: dict) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def cmd_get(args):
    cache = load_cache(args.cache)
    entry, key = find_entry(cache, args.concept)
    if entry:
        print(json.dumps({"hit": True, "key": key, "entry": entry}, ensure_ascii=False, indent=2))
    else:
        print(json.dumps({"hit": False, "key": normalize_concept(args.concept), "entry": None}, ensure_ascii=False))


def cmd_put(args):
    cache = load_cache(args.cache)
    key = normalize_concept(args.concept)
    try:
        entry = json.loads(args.entry_json)
    except Exception as e:
        print(f"entry-json khong hop le: {e}", file=sys.stderr)
        sys.exit(1)
    entry.setdefault("concept", args.concept)
    entry["updated_at"] = datetime.now().date().isoformat()
    # Chi cache citation da verified (chong hallucinate lan rong qua cache)
    if "citations" in entry:
        entry["citations"] = [c for c in entry["citations"] if c.get("verified")]
    cache.setdefault("entries", {})[key] = entry
    save_cache(args.cache, cache)
    n = len(cache["entries"])
    print(f"✅ Cache PUT: '{key}' ({len(entry.get('citations', []))} citation verified) -> {args.cache} (tong {n} khai niem)")


def cmd_list(args):
    cache = load_cache(args.cache)
    entries = cache.get("entries", {})
    print(f"Grounding cache: {len(entries)} khai niem ({args.cache})")
    for k, e in entries.items():
        nc = len(e.get("citations", []))
        print(f"  · [{e.get('source_tier','?')}] {e.get('concept', k)}  — {nc} citation · cập nhật {e.get('updated_at','?')}")


def _concepts_from_icd_json(path):
    """Trich danh sach ten benh tu JSON HSBA (icd_codes[].text/ten hoac chan_doan)."""
    import json as _j
    out = []
    try:
        d = _j.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return out
    for c in (d.get("icd_codes") or []):
        t = c.get("text") or c.get("ten")
        if t:
            out.append(re.sub(r"\s*\(.*?\)\s*$", "", t).strip())  # bo phan trong ngoac
    for c in (d.get("icd_codes_in_record") or []):
        t = c.get("ten_ghi_trong_ho_so") or c.get("ten")
        if t:
            out.append(t.strip())
    return out


def cmd_check(args):
    """Cong kiem grounding: doi chieu cac benh trong ho so voi cache -> HIT/MISS.
    Neu --write-handoff: ghi cac benh MISS vao <dir>/grounding-needed.md (de Cowork doc)."""
    cache = load_cache(args.cache)
    entries = cache.get("entries", {})
    concepts = []
    if args.concepts:
        concepts += [c.strip() for c in re.split(r"[;|\n]", args.concepts) if c.strip()]
    if args.from_json:
        concepts += _concepts_from_icd_json(args.from_json)
    # unique giu thu tu
    seen, uniq = set(), []
    for c in concepts:
        k = normalize_concept(c)
        if k and k not in seen:
            seen.add(k); uniq.append(c)
    hit, miss = [], []
    for c in uniq:
        e, _ = find_entry(cache, c)
        (hit if _resolved(e) else miss).append(c)
    print(f"GROUNDING CHECK: {len(hit)} HIT · {len(miss)} MISS (cache {len(entries)} khái niệm)")
    for c in hit:  print(f"  ✓ {c}")
    for c in miss: print(f"  ✗ THIẾU: {c}")
    if args.write_handoff and miss:
        hd = Path(args.write_handoff); hd.mkdir(parents=True, exist_ok=True)
        f = hd / "grounding-needed.md"
        existing = f.read_text(encoding="utf-8") if f.exists() else "# Khái niệm cần Cowork grounding (ẩn danh)\n\n> CLI tự ghi. Cowork đọc file này, grounding, rồi xoá dòng đã xong.\n\n"
        lines = existing
        tag = ("[" + args.job + "] ") if args.job else ""
        for c in miss:
            entry = f"- [ ] {tag}{c}\n"
            if c not in existing:
                lines += entry
        f.write_text(lines, encoding="utf-8")
        print(f"→ Đã ghi {len(miss)} khái niệm MISS vào {f}")
    # exit code: 0 nếu đủ, 2 nếu thiếu (để script CLI biết có cần chờ Cowork không)
    sys.exit(2 if miss else 0)


_DX_PAGE_TYPES = {"admission_form", "discharge_summary", "discharge_letter", "consultation_note"}
_ICD_RE = re.compile(r"\b[A-TV-Z][0-9]{2}(?:\.[0-9]{1,2})?\b")


def _codes_from_file(d):
    """Tra ve set ma ICD tu 1 JSON (raw.json page-text HOAC analyzed JSON structured)."""
    codes = set()
    # structured (analyzed JSON)
    for c in (d.get("icd_codes") or []):
        for kk in ("code", "ma"):
            if c.get(kk):
                codes.add(c[kk])
    for c in (d.get("icd_codes_in_record") or []):
        if c.get("ma"):
            codes.add(c["ma"])
    # raw.json: chi quet trang chan doan (giam nhieu)
    pages = d.get("pages") or []
    if pages:
        for p in pages:
            if p.get("page_type") in _DX_PAGE_TYPES:
                for m in _ICD_RE.findall(p.get("text") or ""):
                    codes.add(m)
    # analyzed JSON co raw_fields/discharge text
    rf = d.get("raw_fields") or {}
    if isinstance(rf, dict):
        for v in rf.values():
            if isinstance(v, str):
                for m in _ICD_RE.findall(v):
                    codes.add(m)
    return codes


def cmd_sweep(args):
    """Quet TOAN BO dot tu dau (0 token AI): doc moi JSON -> trich ma ICD -> map ten qua
    icd10_lookup -> doi chieu cache -> liet ke MOI benh thieu grounding trong 1 danh sach."""
    import glob as _g
    lookup = {}
    if args.icd_lookup:
        try:
            lk = json.loads(Path(args.icd_lookup).read_text(encoding="utf-8"))
            lookup = lk.get("lookup", lk) if isinstance(lk, dict) else {}
        except Exception as e:
            print(f"! Không đọc được icd-lookup: {e}", file=sys.stderr)
    cache = load_cache(args.cache)
    files = sorted(set(_g.glob(str(Path(args.dir) / "*.json")) + _g.glob(str(Path(args.dir) / "*.raw.json"))))
    files = [f for f in files if "_stats" not in Path(f).name and not Path(f).name.startswith("_")]
    concept = {}  # vn_name -> {codes:set, files:set}
    for f in files:
        try:
            d = json.loads(Path(f).read_text(encoding="utf-8"))
        except Exception:
            continue
        for code in _codes_from_file(d):
            info = lookup.get(code) or lookup.get(code.split(".")[0])
            name = (info or {}).get("vn_name")
            if not name:
                continue
            e = concept.setdefault(name, {"codes": set(), "files": set()})
            e["codes"].add(code); e["files"].add(Path(f).stem)
    hit, miss = [], []
    for name, info in sorted(concept.items()):
        e, _ = find_by_code(cache, info["codes"])   # khớp theo MÃ trước (chắc hơn)
        if not e:
            e, _ = find_entry(cache, name)
        (hit if _resolved(e) else miss).append((name, info))
    print(f"SWEEP: {len(files)} hồ sơ · {len(concept)} chẩn đoán riêng · {len(hit)} HIT · {len(miss)} THIẾU grounding")
    for name, info in miss:
        print(f"  ✗ {sorted(info['codes'])[0]:8s} {name[:50]:50s} ({len(info['files'])} HS)")
    if args.write_handoff and miss:
        hd = Path(args.write_handoff); hd.mkdir(parents=True, exist_ok=True)
        fpath = hd / "grounding-needed.md"
        lines = ["# Khái niệm cần Cowork grounding (quét toàn đợt — ẩn danh)", "",
                 f"> Tự sinh {datetime.now().date().isoformat()}. Cowork grounding hết list này MỘT LƯỢT, rồi CLI chạy phân tích một lượt.", ""]
        for name, info in miss:
            lines.append(f"- [ ] {sorted(info['codes'])[0]} · {name}  ({len(info['files'])} HS)")
        fpath.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"→ Đã ghi {len(miss)} khái niệm THIẾU vào {fpath}")
    sys.exit(2 if miss else 0)


if __name__ == "__main__":
    from datetime import datetime
    p = argparse.ArgumentParser(description="grounding-cache.py v1.2")
    sub = p.add_subparsers(dest="cmd", required=True)

    sw = sub.add_parser("sweep", help="Quét TOÀN BỘ đợt → liệt kê mọi bệnh thiếu grounding (1 danh sách)")
    sw.add_argument("--dir", required=True, help="Thư mục chứa raw JSON (Phase A) hoặc JSON đã phân tích")
    sw.add_argument("--cache", required=True)
    sw.add_argument("--icd-lookup", help="KHTH/hsba-workspace/icd/icd10_lookup.json (map mã→tên)")
    sw.add_argument("--write-handoff", help="Thư mục ghi grounding-needed.md")
    sw.set_defaults(func=cmd_sweep)

    ck = sub.add_parser("check", help="Đối chiếu bệnh trong hồ sơ với cache, ghi MISS ra handoff")
    ck.add_argument("--cache", required=True)
    ck.add_argument("--concepts", help='Danh sách bệnh, phân tách bằng ";"')
    ck.add_argument("--from-json", help="JSON HSBA (tự trích icd_codes)")
    ck.add_argument("--write-handoff", help="Thư mục ghi grounding-needed.md (vd output/_handoff)")
    ck.add_argument("--job", help="Mã KCB để gắn nhãn dòng")
    ck.set_defaults(func=cmd_check)

    g = sub.add_parser("get", help="Tra cache theo khai niem")
    g.add_argument("--cache", required=True)
    g.add_argument("--concept", required=True)
    g.set_defaults(func=cmd_get)

    pu = sub.add_parser("put", help="Ghi entry da verify vao cache")
    pu.add_argument("--cache", required=True)
    pu.add_argument("--concept", required=True)
    pu.add_argument("--entry-json", required=True)
    pu.set_defaults(func=cmd_put)

    li = sub.add_parser("list", help="Liet ke khai niem da cache")
    li.add_argument("--cache", required=True)
    li.set_defaults(func=cmd_list)

    args = p.parse_args()
    args.func(args)
