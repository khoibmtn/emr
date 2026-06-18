#!/usr/bin/env bash
# run-batch.sh — Orchestrator phân tích lại toàn bộ HSBA trong input/ (chạy TRÊN MÁY có pymupdf+docx)
# v1.0 — token-optimized, an toàn (backup trước khi xoá).
#
# Script làm phần XÁC ĐỊNH (deterministic, 0 token AI):
#   prepare : backup output cũ → xoá json/word/tong-hop + reset master → parse 18 PDF (OCR cache) → in token metrics
#   finalize: chạy aggregate-stats → _stats.json (sau khi Claude đã sinh xong DOCX/JSON)
#
# Phần Claude làm (per HSBA, KHÔNG tự động trong bash): OCR ocr_todo → đọc digest →
#   grounding (tra cache trước) → điền DATA{} → node sinh DOCX/JSON. Theo SKILL.md + WORKFLOW-TOKEN-OPTIMIZED.md.
#
# Lưu ý token: GIỮ ocr-cache + grounding-cache (KHÔNG xoá) → re-run rẻ hơn nhiều.

set -uo pipefail

PROJECT="/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA"
S="$PROJECT/knowledge/hsba-audit-skill/scripts"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$PROJECT/output/_backup_$TS"
WORK="/tmp/hsba_batch_$TS"

cmd="${1:-prepare}"

if [ "$cmd" = "prepare" ]; then
  echo "════════════════════════════════════════════════════════"
  echo " PREPARE — backup + clear + parse-all + token metrics"
  echo "════════════════════════════════════════════════════════"

  # 1. BACKUP (an toàn — có thể khôi phục)
  mkdir -p "$BK"
  cp -R "$PROJECT/output/json"       "$BK/json"       2>/dev/null || true
  cp -R "$PROJECT/output/word"       "$BK/word"       2>/dev/null || true
  cp -R "$PROJECT/output/tong-hop"   "$BK/tong-hop"   2>/dev/null || true
  echo "✅ Backup → $BK"

  # 2. XÁC NHẬN trước khi xoá (không hoàn tác)
  read -r -p "Xoá toàn bộ json/word/tong-hop + reset master.json? (đã backup ở trên) [yes/N] " ans
  if [ "$ans" != "yes" ]; then echo "Huỷ — không xoá gì."; exit 1; fi

  # 3. CLEAR — GIỮ ocr-cache + grounding-cache (tiết kiệm token re-run)
  rm -f "$PROJECT/output/json/"*.json        2>/dev/null || true
  rm -f "$PROJECT/output/word/"*.docx        2>/dev/null || true
  rm -f "$PROJECT/output/tong-hop/"*.docx "$PROJECT/output/tong-hop/_stats.json" 2>/dev/null || true
  echo '{"tong_so":0,"cap_nhat_lan_cuoi":"","records":[]}' > "$PROJECT/output/tong-hop/master.json"
  echo "✅ Đã xoá json/word/tong-hop + reset master.json (giữ ocr-cache, grounding-cache)"

  # 4. PARSE TẤT CẢ + METRICS
  mkdir -p "$WORK" "$PROJECT/output/ocr-cache"
  echo ""
  printf "%-40s %6s %6s %8s %9s %9s %7s\n" "FILE" "pages" "scan" "ocrTodo" "rawKB" "digKB" "dig%"
  printf '%.0s─' {1..92}; echo ""
  # v1.1 — metrics qua file TSV: KHÔNG truyền float qua biến shell, KHÔNG read đa biến
  # → an toàn với tên hồ sơ tiếng Việt; mọi tính toán làm trong python.
  METRICS="$WORK/_metrics.tsv"; : > "$METRICS"
  shopt -s nullglob
  for pdf in "$PROJECT/input/"*.pdf "$PROJECT/input/"*.PDF; do
    base="$(basename "$pdf")"; stem="${base%.*}"
    raw="$WORK/$stem.raw.json"; dig="$WORK/$stem.digest.txt"
    mk="$(echo "$base" | grep -oE '^[0-9]{6,}' | head -1)"; [ -z "$mk" ] && mk="$stem"
    python3 "$S/extract-pdf-text.py" "$pdf" --output "$raw" \
        --ocr-images-dir "$WORK/scans_$stem" \
        --ocr-cache "$PROJECT/output/ocr-cache/$mk.json" >/dev/null 2>&1 \
        || { echo "  ⚠️ LỖI parse: $base"; continue; }
    python3 "$S/extract-pdf-text.py" --digest --from-json "$raw" --output "$dig" >/dev/null 2>&1
    # Ghi 1 dòng TSV: name<TAB>pages<TAB>scan<TAB>todo<TAB>rawKB<TAB>digKB
    python3 - "$raw" "$dig" "$stem" >> "$METRICS" <<'PY'
import json, sys, os
raw, dig, name = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    d = json.load(open(raw))
    pages = d.get('total_pages', 0)
    scan  = d.get('scan_summary', {}).get('total_scan', 0)
    todo  = len(d.get('ocr_todo', []))
    rk = os.path.getsize(raw) / 1024
    dk = (os.path.getsize(dig) / 1024) if os.path.exists(dig) else 0.0
    print(f"{name}\t{pages}\t{scan}\t{todo}\t{rk:.1f}\t{dk:.1f}")
except Exception as e:
    print(f"{name}\tERR\t-\t-\t-\t-")
PY
  done
  # In bảng + tổng (đọc TSV bằng python — tránh lỗi locale/float của shell)
  python3 - "$METRICS" <<'PY'
import sys
rows = [l.rstrip("\n").split("\t") for l in open(sys.argv[1], encoding="utf-8") if l.strip()]
print(f"{'FILE':40.40s} {'pages':>6} {'scan':>6} {'ocrTodo':>8} {'rawKB':>9} {'digKB':>9} {'dig%':>6}")
print("─" * 92)
tr = td = n = 0
for r in rows:
    if len(r) < 6: continue
    name, pages, scan, todo, rk, dk = r
    try:
        rkf, dkf = float(rk), float(dk)
        pct = f"{int(100*dkf/rkf)}%" if rkf else "-"
        tr += rkf; td += dkf; n += 1
    except ValueError:
        pct = "-"
    print(f"{name:40.40s} {pages:>6} {scan:>6} {todo:>8} {rk:>9} {dk:>9} {pct:>6}")
print("─" * 92)
tail = f" · digest còn {100*td/tr:.0f}% so với raw" if tr else ""
print(f"Tổng: {n} hồ sơ · raw={tr:.0f}KB · digest={td:.0f}KB{tail}")
PY
  echo ""
  echo "Raw + digest + ocr_todo đã sẵn ở: $WORK"

  # 5. SWEEP GROUNDING TOÀN ĐỢT (1 lượt) → grounding-needed.md
  echo ""
  echo "── SWEEP grounding toàn đợt ──"
  ICD_LOOKUP="/Users/buiminhkhoi/Documents/Claude/KHTH/hsba-workspace/icd/icd10_lookup.json"
  # Kho grounding DÙNG CHUNG (second brain) — một nguồn sự thật cho mọi project
  GCACHE="/Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json"
  python3 "$S/grounding-cache.py" sweep --dir "$WORK" \
      --cache "$GCACHE" \
      --icd-lookup "$ICD_LOOKUP" \
      --write-handoff "$PROJECT/output/_handoff"
  SWEEP_RC=$?
  echo ""
  if [ "$SWEEP_RC" = "2" ]; then
    echo "⚠️  CÓ bệnh THIẾU grounding (xem output/_handoff/grounding-needed.md)."
    echo "→ BÀN GIAO COWORK 1 LƯỢT: mở Cowork, nói 'check grounding'. Cowork ground hết list rồi báo xong."
    echo "→ Sau đó mới phân tích (Prompt C). KHÔNG phân tích trước khi grounding đủ."
  else
    echo "✅ Tất cả chẩn đoán đã có grounding → có thể phân tích luôn (Prompt C)."
  fi
  echo ""
  echo "WORK=$WORK   (lưu lại đường dẫn này cho Prompt C)"

elif [ "$cmd" = "finalize" ]; then
  echo "Finalize — tổng hợp stats..."
  python3 "$S/aggregate-stats.py" --json-dir "$PROJECT/output/json" --out "$PROJECT/output/tong-hop/_stats.json"
  echo "→ Tiếp: dùng tong-hop-skill đọc _stats.json (≈7%) để sinh DOCX tổng hợp."

else
  echo "Dùng: bash run-batch.sh [prepare|finalize]"; exit 1
fi
