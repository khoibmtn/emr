# Workflow phân tích HSBA — Tối ưu Token (v3.8)

> Mục tiêu: từ **nhận PDF → DOCX từng hồ sơ → DOCX tổng hợp (khi yêu cầu)**, giữ nguyên chất lượng JSON + DOCX nhưng **tốn token ít nhất**.
>
> Nguyên lý nền: **đẩy tối đa việc xác định cấu trúc sang Python (0 token AI), Claude chỉ đọc đúng phần cần đọc và chỉ suy luận phần máy không làm được.** Mọi thứ lặp lại (OCR, trích dẫn guideline) đều cache để lần sau = 0 token.

---

## Bản đồ token: tiền đi đâu?

| Khâu | Nguồn tốn token | Đòn bẩy tiết kiệm |
|---|---|---|
| Parse PDF | 0 (Python) | — đã tối ưu |
| OCR trang scan | Mỗi PNG nạp vào context (Vision) | **OCR cache** → re-run = 0; chỉ OCR `ocr_todo` |
| Đọc raw để điền DATA{} | `cat` cả raw JSON (50 trang, text trùng) | **Digest read** + đọc theo lát + dùng `text_table` thay `text` |
| Evidence grounding | Kết quả MCP/web nạp vào context | **Grounding cache** dùng chung; cap 3–6 khái niệm |
| Sinh DOCX/JSON | 0 (Node) | — đã tối ưu |
| Tổng hợp nhiều HSBA | Đọc nhiều JSON đầy đủ | Đọc **master.json + stats**, KHÔNG đọc raw_text |

---

## Luồng từng hồ sơ (per-HSBA)

### Phase 0 — Nhận & chống trùng · ~0 token
- `ls input/` (bash) → lấy `ma_kcb` từ tên file.
- Đọc `output/tong-hop/master.json`, nếu `ma_kcb` đã có → hỏi anh (làm lại/giữ). Pure bash/python, **không AI**.

### Phase 1 — Trích xuất xác định (Python) · 0 token AI
```bash
python3 extract-pdf-text.py "input/<file>.PDF" --output /tmp/hsba_raw.json \
  --ocr-images-dir /tmp/scans --ocr-cache "output/ocr-cache/<ma_kcb>.json"
```
- Python làm hết: phân loại trang, `department_canonical` + forward-fill, `dates_found`, `department_date_ranges`, `text_table`, `ocr_todo`, `ocr_cache_stats`.
- **Không đọc gì vào context ở bước này** — chỉ đọc `ocr_cache_stats` + độ dài `ocr_todo` (vài dòng).

### Phase 2 — OCR chỉ trang MISS · token = số trang chưa cache
- Lặp **chỉ** qua `ocr_todo` (cache HIT đã có text). Read từng PNG → transcribe → điền `ocr_text`.
- Ghi ngược cache: `extract-pdf-text.py --update-cache ... --from-json /tmp/hsba_raw.json` → lần sau 0 token OCR.
- Nếu `ocr_todo` rỗng → **bỏ qua Phase 2 hoàn toàn**.

### Phase 3 — Đọc CHỌN LỌC + điền DATA{} · đòn bẩy lớn nhất
**Tuyệt đối KHÔNG `cat` cả raw JSON.** Thay vào:
- Đọc theo **lát mục tiêu**, mỗi lát 1 lần, dùng `jq`/python in ra đúng nhóm:
  - trang `admission_form` → `admission_workup`
  - trang `discharge_summary` → `discharge_summary`
  - theo từng khoa: `clinical_course`/`medical_orders`/`lab_result` → `department_stays[khoa]`
- Trang lab/orders: đọc **`text_table`** (đã căn cột), **bỏ `text`** để tránh đọc trùng nội dung.
- Gán CLS/điều trị **theo ngày** khi ≥2 khoa (SKILL.md §1.5b) — dùng `department_date_ranges`, không nạp thêm gì.
- **Khuyến nghị mạnh khi batch:** giao Phase 1–3 cho **subagent** (Task tool). Subagent đọc raw, trả về **chỉ `DATA{}`** (hoặc JSON đã điền). Context chính không phình theo 50 trang × N hồ sơ.

### Phase 4 — Evidence grounding · cap + cache
- Lập 3–6 khái niệm ẩn danh (SKILL §3.5). Với mỗi khái niệm:
  1. Tra **grounding-cache** (`/Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json`) trước → HIT thì lấy citation đã verify, **0 token MCP/web**.
  2. MISS → Tier 1 kho nội bộ → Tier 2 BYT/web → Tier 3 PubMed/Consensus → verify → ghi vào cache.
- Bệnh hay gặp (hạ kali, UAP, viêm phổi…) chỉ tốn token **một lần cho cả trung tâm**; các HSBA sau tái dùng.

### Phase 5 — Sinh DOCX + JSON (Node) · 0 token AI
```bash
NODE_PATH=/tmp/node_modules node /tmp/bao-cao-<ma_kcb>.js
```
- Xuất `output/word/...docx` + `output/json/...json` + upsert `master.json`. Không AI.

### Phase 6 — Xác nhận & lưu trữ · ~0 token
- Tóm tắt ngắn (đã có mẫu Bước 7 SKILL) → anh duyệt → `move_to_processed`.

**Ngân sách token/HSBA (ước lượng tương đối):** Phase 2 (chỉ MISS) + Phase 3 (digest) + Phase 4 (cache) chiếm ~90% token. Khi chạy lại hoặc HSBA cùng nhóm bệnh: giảm còn ~30–40%.

---

## Luồng tổng hợp (chỉ khi anh yêu cầu) · token-lean

1. Python pre-aggregator quét `output/json/*.json` → đọc **chỉ** các field stats (`bieu_mau` đếm, `icd`, `evidence_grounding` summary, `meta`, `coverage_audit`) → xuất **1 file** `output/tong-hop/_stats.json`. **Không đọc `raw_text`/`clinical_course_raw`.**
2. Claude đọc **duy nhất** `_stats.json` (nhỏ) + `master.json` → viết phần narrative tổng hợp.
3. `node` sinh DOCX tổng hợp. → `output/tong-hop/YYYY-MM-DD_tong-hop_NHSBA.docx`.

> Nguyên tắc: tổng hợp = đọc **số đã đếm sẵn**, không đọc lại nội dung thô từng hồ sơ.

---

## Chiến lược batch 25–30 HSBA (hai tầng)

- **Tầng 1 — sàng lọc xác định (gần 0 token AI):** `mcp__hsba-analyzer__analyze_batch` → checklist + timeline + ICD cho TẤT CẢ → Excel. Dùng để lọc hồ sơ có cờ đỏ.
- **Tầng 2 — phân tích sâu (skill v3.8):** chỉ chạy cho hồ sơ **được gắn cờ** hoặc **mẫu kiểm** anh chọn, mỗi hồ sơ 1 subagent.
- ⇒ Không deep-analyze cả 30 trừ khi anh yêu cầu — tiết kiệm phần lớn token.

---

## 7 đòn bẩy token (tóm tắt)
1. **Deterministic-first**: Python lo cấu trúc, Claude không "đọc để phân loại".
2. **OCR cache** theo hash ảnh: re-run = 0 OCR.
3. **Digest read**: đọc theo lát, dùng `text_table`, không `cat` cả file, không đọc text trùng.
4. **Subagent/HSBA**: cô lập việc đọc nặng, context chính chỉ nhận `DATA{}`.
5. **Grounding cache**: trích dẫn guideline dùng chung toàn trung tâm.
6. **Tổng hợp từ stats**: đọc số đã đếm, không đọc raw.
7. **Batch hai tầng**: deterministic cho tất cả, deep chỉ cho hồ sơ cần.

---

## Trạng thái triển khai

| Đòn bẩy | Trạng thái | Ghi chú |
|---|---|---|
| Deterministic Stage 1 | ✅ v3.1 | — |
| OCR cache | ✅ v3.1 | `--ocr-cache` / `--update-cache` |
| **Digest read** (`--digest`) | ✅ v3.2 | Còn ~7% vs `cat` cả JSON (test thực) |
| Subagent/HSBA | ✅ Quy ước | Ghi trong SKILL §3.5b — batch chạy Phase 1–3 bằng Task subagent |
| **Grounding cache** | ✅ v1.0 | `grounding-cache.py get/put/list` — citation verified dùng chung |
| **Tổng hợp từ stats** | ✅ v1.0 | `aggregate-stats.py` → `_stats.json` (≈7% kích thước, đọc 1 file thay 18) |
| Batch hai tầng | ✅ Có sẵn | analyze_batch + skill |

### Lệnh 3 công cụ token (đã build & test)

```bash
S="knowledge/hsba-audit-skill/scripts"

# (3) Digest — đọc ở Phase 3 thay vì cat raw JSON
python3 $S/extract-pdf-text.py --digest --from-json /tmp/hsba_raw.json --output /tmp/hsba_digest.txt
#   (thêm --keep-admin nếu cần giữ cả trang hành chính)

# (4) Grounding cache — tra trước khi gọi MCP/web, ghi sau khi verify
python3 $S/grounding-cache.py get  --cache /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json --concept "<khái niệm>"
python3 $S/grounding-cache.py put  --cache /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json --concept "<khái niệm>" --entry-json '<entry verified>'
python3 $S/grounding-cache.py list --cache /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json

# (6) Pre-aggregator — tổng hợp đọc 1 file _stats.json thay vì 18 JSON
python3 $S/aggregate-stats.py --json-dir output/json --out output/tong-hop/_stats.json
#   (lọc đợt: --files "260006*,2600072139*")
```
