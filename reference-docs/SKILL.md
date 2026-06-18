---
name: hsba-audit
description: >
  Đánh giá chất lượng hồ sơ bệnh án (HSBA) nội trú tiếng Việt theo tiêu chuẩn Bộ Y tế.
  Dùng skill này khi người dùng: tải lên file PDF hồ sơ bệnh án, yêu cầu "đánh giá HSBA",
  "bình bệnh án", "kiểm tra chất lượng hồ sơ", "rà soát ICD", "audit hồ sơ bệnh án",
  hoặc hỏi về mã ICD / chẩn đoán / điều trị trong một bệnh án cụ thể.
  Output là báo cáo .docx đầy đủ gồm hai phần chính: Kiểm tra hình thức (machine findings)
  và Đánh giá lâm sàng (clinical commentary), kèm danh mục tài liệu tham khảo Vancouver.
  Luôn dùng skill này khi người dùng cung cấp file HSBA — đừng chỉ tóm tắt thủ công.
---

# Skill: Đánh giá chất lượng Hồ sơ Bệnh án (HSBA)

## Nguyên lý cốt lõi

### Kiến trúc luồng dữ liệu (v3.0)

```
PDF/hồ sơ bệnh án
      │
      ▼
[Bước 0] Kiểm tra master.json — đã phân tích chưa?
      │  → CÓ: hỏi user → Không: dừng / Có: xóa dữ liệu cũ
      │  → KHÔNG: tiếp tục
      ▼
[Bước 1] Python extract-pdf-text.py
      │  → raw pages JSON (page-by-page text, 0 AI token)
      │
      ▼
[Bước 2] Claude đọc raw JSON
      │  → trích xuất dữ liệu lâm sàng (extraction, không phải analysis)
      │
      ▼
[Bước 3] Claude phân tích lâm sàng
      │  → đánh giá ICD, chẩn đoán, điều trị, CLS (analysis)
      │
      ├──► RAW JSON (v3.0-raw) ─────────────────────────────────
      │    CHỈ chứa dữ liệu KHÁCH QUAN từ hồ sơ:               │
      │    raw_text, lab_results, timeline_raw,                  │
      │    icd_codes_in_record, bieu_mau.chi_tiet...             │
      │    KHÔNG có: ICD evaluation, verdict, khuyen_nghi        │
      │                                                           │
      └──► DOCX báo cáo ─────────────────────────────────────────
           Chứa cả raw data + AI analysis:
           Phần A (hình thức) + Phần B (lâm sàng) + Khuyến nghị
```

**Nguyên tắc tách biệt JSON vs DOCX:**

| Loại dữ liệu | JSON | DOCX |
|---|---|---|
| Văn bản nguyên văn từ PDF (raw_text) | ✅ | ✅ |
| Kết quả XN, thuốc, timeline thực tế | ✅ | ✅ |
| Mã ICD được ghi trong hồ sơ (factual) | ✅ | ✅ |
| Đánh giá ICD đúng/sai (AI) | ❌ | ✅ |
| Tiêu chí chẩn đoán + đối chiếu (AI) | ❌ | ✅ |
| Verdict "Chấp nhận được" (AI) | ❌ | ✅ |
| Khuyến nghị hành động (AI) | ❌ | ✅ |
| 8 câu hỏi cốt lõi (AI) | ❌ | ✅ |

> **Lý do:** Bất kỳ AI nào đọc JSON sau này sẽ nhận được dữ liệu KHÁCH QUAN,
> không bị "contaminate" bởi conclusions của AI trước — đảm bảo tính độc lập
> của phân tích.

---

> **Claude đọc toàn bộ text PDF → tự phân tích lâm sàng → tạo DOCX bằng Node.js**
>
> KHÔNG dùng Python MCP pipeline (extractor_v2, hsba_analyzer) cho báo cáo cá nhân.
> Pipeline Python chỉ dùng cho batch checklist nhanh (25-30 hồ sơ).

Lý do: PDF HSBA của HIS Việt Nam có cấu trúc one-token-per-line đặc biệt; parser cấu trúc
bỏ sót nhiều nội dung. Claude đọc raw text và áp dụng lý luận lâm sàng cho kết quả
vượt trội hơn nhiều so với bất kỳ parser nào.

---

## Tổng quan

Skill này hướng dẫn Claude thực hiện quy trình đánh giá chất lượng hồ sơ bệnh án nội trú
tiếng Việt theo hai lớp:

- **Lớp A — Kiểm tra hình thức (Machine Findings):** Xác định tính đầy đủ biểu mẫu,
  trình tự thời gian, cảnh báo mã ICD.
- **Lớp B — Đánh giá lâm sàng (Clinical Commentary):** Đối chiếu chẩn đoán, điều trị,
  cận lâm sàng với hướng dẫn BYT và phác đồ quốc tế.

Output cuối cùng là file `.docx` chuyên nghiệp, màu sắc bảng biểu theo mức độ cảnh báo
(xanh / vàng / đỏ), kèm danh mục tài liệu tham khảo định dạng Vancouver.

---

## Bước 0 — Kiểm tra hồ sơ đã phân tích (BẮT BUỘC — chạy trước mọi bước khác)

> Áp dụng cho MỌI nguồn đầu vào: PDF kéo thả vào chat, PDF trong `input/`, hay bất kỳ yêu cầu phân tích HSBA nào.

### 0.1 Xác định mã KCB từ tên file

Tên file tuân theo convention: `{ma_kcb} {TEN_KHONG_DAU}.PDF`

```python
import re
filename = "2600062416 TONG VAN QUANG.PDF"   # ← thay bằng tên file thực
m = re.match(r'^(\d+)\s+(.+?)\.PDF$', filename, re.IGNORECASE)
if m:
    ma_kcb       = m.group(1)   # "2600062416"
    ten_khong_dau = m.group(2)  # "TONG VAN QUANG"
```

Nếu tên file không khớp pattern (HSBA kéo thả không có mã KCB), lấy mã KCB từ nội dung trang bìa hoặc hỏi user.

### 0.2 Đọc master.json và kiểm tra trùng

```bash
MOUNT=$(find /sessions -maxdepth 3 -name "KHTH - P4 HSBA" -type d 2>/dev/null | head -1)
cat "$MOUNT/output/tong-hop/master.json" 2>/dev/null || echo '{"tong_so":0,"records":[]}'
```

Kiểm tra `records[]`: có record nào có `"ma_kcb": "{ma_kcb}"` không?

**Nếu KHÔNG có** → hồ sơ mới, tiếp tục bình thường từ **Bước 0b**.

**Nếu CÓ** → thông báo cho user:

```
📋 Hồ sơ {ho_ten} (mã KCB: {ma_kcb}) đã được phân tích vào ngày {ngay_danh_gia}.

Anh có muốn phân tích lại không?
  → Có: Xóa kết quả cũ và chạy lại toàn bộ quy trình
  → Không: Giữ nguyên kết quả cũ
```

### 0.3a — Nếu user chọn KHÔNG

Dừng lại. Thông báo: `"✅ Giữ nguyên kết quả cũ. File báo cáo: output/word/{FILE_STEM}.docx"`

### 0.3b — Nếu user chọn CÓ → Xóa dữ liệu cũ

```bash
MOUNT=$(find /sessions -maxdepth 3 -name "KHTH - P4 HSBA" -type d 2>/dev/null | head -1)
MA_KCB="{ma_kcb}"
FILE_STEM="$MA_KCB - {ten_khong_dau}"

# Xóa các file output (dùng đúng mount path hiện tại — không dùng path cũ trong master.json)
rm -f "$MOUNT/output/json/$FILE_STEM.json"
rm -f "$MOUNT/output/json/$FILE_STEM - raw.json"
rm -f "$MOUNT/output/word/$FILE_STEM.docx"
echo "Đã xóa: $FILE_STEM.json, raw.json, .docx"
ls "$MOUNT/output/json/" "$MOUNT/output/word/"
```

```bash
# Cập nhật master.json: xóa record cũ, giảm tong_so
python3 - << 'EOF'
import json
MOUNT = __import__('subprocess').check_output(
    'find /sessions -maxdepth 3 -name "KHTH - P4 HSBA" -type d 2>/dev/null | head -1',
    shell=True).decode().strip()
MA_KCB = "{ma_kcb}"
path = f"{MOUNT}/output/tong-hop/master.json"
with open(path) as f:
    d = json.load(f)
before = len(d["records"])
d["records"] = [r for r in d["records"] if r["ma_kcb"] != MA_KCB]
d["tong_so"] = len(d["records"])
with open(path, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print(f"✅ Đã xóa {before - len(d['records'])} record khỏi master.json. Còn lại: {d['tong_so']}")
EOF
```

Sau khi xóa xong → tiếp tục từ **Bước 0b** (phân tích từ đầu).

---

## Bước 0b — Đọc docx skill trước khi viết script

Trước khi viết script Node.js:

```
Read /var/folders/q1/t45v4c8j4sb3vtxyhc7f4yg00000gn/T/claude-hostloop-plugins/ebaefad825c116ab/skills/docx/SKILL.md
```

Nếu path trên không đúng (sessions khác nhau), dùng:
```bash
find /var/folders -name "SKILL.md" -path "*/skills/docx/*" 2>/dev/null | head -1
```

---

## Bước 1 — Trích xuất toàn bộ text từ PDF

### 1.1 Xác định nguồn dữ liệu

| Tình huống | Hành động |
|---|---|
| PDF upload trong chat (< 20 trang) | Claude đọc trực tiếp từ `<documents>` context |
| PDF ở đường dẫn trên disk | Chạy script extract-pdf-text.py qua bash |
| PDF > 20 trang | Chạy script — ưu tiên dùng bash |

### 1.2 Trích xuất bằng script — Quy trình tự động (Hybrid OCR workflow)

> **Claude tự thực hiện toàn bộ từ Stage 1a → 1c, không cần user can thiệp.**

**Stage 1a: Extract text + render scan pages → PNG**

```bash
# Xác định mount path (bash) và outputs dir (session-scoped, tự xóa khi hết session)
MOUNT=$(find /sessions -maxdepth 3 -name "KHTH - P4 HSBA" -type d 2>/dev/null | head -1)
# Outputs dir: bash path → macOS path (được Read tool truy cập, tự xóa hết session)
OUT_BASH=$(find /sessions -maxdepth 3 -name "outputs" -type d 2>/dev/null | head -1)
OUT_MAC=$(echo "$OUT_BASH" | sed 's|/sessions/[^/]*/mnt/outputs|/Users/buiminhkhoi/Library/Application Support/Claude/local-agent-mode-sessions/32617c0f-658e-45d0-a907-28922c96fbb3/6c6e7285-4ba9-46bb-8726-f68742c32668/local_fcfcfd8d-2b9f-45d0-b2f2-1a6975c36e12/outputs|')
mkdir -p "$OUT_BASH/hsba-scans"

CACHE="$MOUNT/output/ocr-cache/${MA_KCB}.json"   # MA_KCB lấy ở Bước 0; cache theo mã KCB
mkdir -p "$MOUNT/output/ocr-cache"

python3 "$MOUNT/knowledge/hsba-audit-skill/scripts/extract-pdf-text.py" \
    "<đường_dẫn_file.pdf>" \
    --output /tmp/hsba_raw.json \
    --ocr-images-dir "$OUT_BASH/hsba-scans" \
    --ocr-read-dir  "$OUT_MAC/hsba-scans" \
    --ocr-cache     "$CACHE"          # ⚡ v3.1: CACHE HIT → bỏ render + bỏ OCR lại

# Chỉ OCR các trang trong ocr_todo (cache MISS). Cache HIT đã có text sẵn.
python3 -c "
import json
d = json.load(open('/tmp/hsba_raw.json'))
print('OCR CACHE:', d['ocr_cache_stats'])
print('CẦN OCR (todo):', len(d['ocr_todo']))
for t in d['ocr_todo']:
    print(f\"  [{t['page_num']}] {t['scan_image_path']}\")
"
```

> ⚡ **OCR cache (v3.1) — tăng tốc:** Lần đầu OCR trang nào, ghi text vào cache theo **hash ảnh**. Lần sau chạy lại cùng HSBA (hoặc trang giống hệt) → **CACHE HIT** → script điền `ocr_text` sẵn, **không render PNG, không cần Claude OCR lại**. Chỉ xử lý `ocr_todo`. Nếu `ocr_todo` rỗng → bỏ qua Stage 1b, sang thẳng Stage 1d.

**Stage 1b: Claude tự OCR từng trang scan (tự động — không cần user)**

> Chỉ lặp qua **`d['ocr_todo']`** (các trang cache MISS). Trang cache HIT đã có `ocr_text` sẵn — KHÔNG OCR lại.

Với mỗi trang trong `ocr_todo` (có `scan_image_path`):

1. Dùng `Read` tool đọc file PNG tại `scan_image_path`
2. Transcribe toàn bộ text nhìn thấy trong ảnh (verbatim)
3. Ghi vào biến `ocr_results[page_num] = { text, page_type }`

Phân loại `page_type` sau khi OCR dựa trên nội dung:
- Chứa "BỆNH ÁN NỘI KHOA" (bìa hồ sơ) → `administrative`
- Chứa "MS: 01/BV-01" + "HÀNH CHÍNH" → `admission_form`
- Chứa "A. BỆNH ÁN" + "Lý do vào viện" → `admission_form`
- Chứa "B. TỔNG KẾT BỆNH ÁN" → `discharge_summary`

**Stage 1c: Ghi OCR text vào raw JSON và xóa ảnh tạm**

```python
import json
from pathlib import Path

with open('/tmp/hsba_raw.json') as f:
    d = json.load(f)
pages = {p['page_num']: p for p in d['pages']}

# --- Điền từng trang OCR (Claude điền ocr_results vào đây) ---
for page_num, ocr in ocr_results.items():
    p = pages[page_num]
    p['ocr_text']           = ocr['text']
    p['ocr_attempted']      = True
    p['text']               = ocr['text']       # nguồn chính thay thế "[SCAN]"
    p['page_type']          = ocr['page_type']
    p['char_count']         = len(ocr['text'])
    p['content_density']    = 'high'
    p['extraction_quality'] = 'ocr_claude_vision'

with open('/tmp/hsba_raw.json', 'w') as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
print("✅ OCR text đã cập nhật vào raw JSON")
```

```bash
# ⚡ v3.1: GHI NGƯỢC OCR vào cache theo mã KCB → lần sau CACHE HIT, không OCR lại
python3 "$MOUNT/knowledge/hsba-audit-skill/scripts/extract-pdf-text.py" \
    --update-cache "$MOUNT/output/ocr-cache/${MA_KCB}.json" \
    --from-json    /tmp/hsba_raw.json

# PNGs trong OUT_BASH/hsba-scans tự xóa khi session kết thúc (session-scoped outputs dir)
echo "✅ OCR hoàn tất — đã cache; PNGs tự xóa khi hết session"
```

**Stage 1d: Claude đọc DIGEST (gọn, tiết kiệm token) → phân tích + điền DATA{}**

> ⚡ v3.2: **KHÔNG `cat` cả raw JSON** (tốn token, text trùng). Đọc **digest** — đã gom theo khoa, dùng `text_table` cho trang XN/y lệnh, bỏ trang rỗng/hành chính:

```bash
python3 "$MOUNT/knowledge/hsba-audit-skill/scripts/extract-pdf-text.py" \
    --digest --from-json /tmp/hsba_raw.json --output /tmp/hsba_digest.txt
cat /tmp/hsba_digest.txt
```

Chỉ khi cần chi tiết một trang cụ thể (vd verify số liệu) → đọc lát trang đó trong raw JSON, KHÔNG đọc lại cả file. Digest còn ~7% kích thước so với `cat` cả JSON.

Sau khi có OCR, trang scan không còn `[SCAN -- chua OCR]` — Claude đọc `text` (đã là OCR) và:
- Trang `admission_form` có "A. BỆNH ÁN / Lý do vào viện" → `admission_workup.raw_text`
- Trang `discharge_summary` có "B. TỔNG KẾT BỆNH ÁN" → `discharge_summary.raw_text`
- Nhóm trang theo `department_hint` → `department_stays`

> **Nếu PDF không có trang scan** (`scan_pages: []`): bỏ qua Stage 1b–1c, chuyển thẳng Stage 1d.

> **Backward compat**: debug flat text: `--format txt --output /tmp/hsba_text.txt`

> **Điền `admission_workup.raw_text` — thứ tự ưu tiên nguồn:**
>
> 1. Trang có `page_type: "admission_form"` **và** text chứa "Lý do vào viện" / "A. BỆNH ÁN" → copy verbatim
> 2. Không tìm thấy → tìm trang `consultation_note` hoặc `clinical_course` có chứa **"Tình trạng lúc vào viện"** (thường là biên bản hội chẩn) → copy phần nội dung lâm sàng
> 3. Không có gì → để `raw_text: ""` và ghi rõ nguồn nào đã thử
>
> **KHÔNG dùng:** MS 36/BV2 (phiếu chăm sóc điều dưỡng), MS 40/BV2 (cam kết nhập viện), GDSK-01 — đây là phiếu hành chính, không phải bệnh án lâm sàng.
>
> **Bieu_mau STT 1-2 khi trang bìa scan:**
> Nếu trang 1-5 đều `is_scan: true` và KHÔNG tìm thấy text bệnh án → đánh `icon: "⚠️"`, `ket_qua: "Trang bìa scan — không trích xuất được text (giới hạn kỹ thuật, không phải thiếu sót hồ sơ)"`. Chỉ đánh `❌` khi có bằng chứng form thực sự vắng mặt.

### 1.3 Dùng mcp__pdf-reader__read_pdf (thay thế)

```
mcp__pdf-reader__read_pdf(path="<file.pdf>")
```

Nếu MCP này trả về text bị cắt ngắn → dùng `read_pdf_pages` theo từng nhóm trang:
```
mcp__pdf-reader__read_pdf_pages(path="<file.pdf>", start_page=1, end_page=20)
mcp__pdf-reader__read_pdf_pages(path="<file.pdf>", start_page=21, end_page=51)
```

### 1.4 Xây dựng cấu trúc hồ sơ từ raw text

Sau khi có toàn bộ text, Claude phân loại từng trang vào nhóm:

```
THÔNG TIN HÀNH CHÍNH    → trang bìa, trang quản lý BN, giấy ra viện
BỆNH ÁN LÂM SÀNG       → bệnh án nội khoa, tổng kết bệnh án
XÉT NGHIỆM / CLS        → phiếu XN huyết học, hóa sinh, điện tim, SA, Xquang
THEO DÕI ĐIỀU TRỊ       → phiếu TD điều trị, phiếu TD chăm sóc, phiếu truyền dịch
HÀNH CHÍNH BỔ SUNG      → cam kết nhập viện, dị ứng, dinh dưỡng, GDSK, chi phí
```

### 1.5 Đọc cấu trúc raw JSON

Raw JSON từ extract-pdf-text.py v2.0 có cấu trúc:

```json
{
  "ba_type": "noi_khoa",           // Loại bệnh án (detect từ MS code)
  "ma_bieu_mau": "01/BV-01",       // Mã mẫu bệnh án TT 32/2023
  "page_type_summary": {           // Đếm số trang theo loại
    "admission_form": 10,
    "lab_result": 10,
    "clinical_course": 1
  },
  "department_timeline": [         // Ranh giới khoa (Python pre-detect)
    {
      "department": "Cấp cứu - HSTC - CĐ",
      "first_page": 8,
      "last_page": 52,
      "page_indices": [8, 12, ...]
    }
  ],
  "pages": [                       // Mảng tất cả các trang
    {
      "page_num": 6,
      "char_count": 2219,
      "is_scan": false,
      "page_type": "admission_form",
      "department_hint": "Cấp cứu - HSTC - CĐ",
      "text": "...toàn bộ text trang 6..."
    }
  ]
}
```

**Quy trình đọc:** Claude filter `pages[]` theo `page_type` để lấy đúng nội dung:
- `admission_form` → đọc phần A bệnh án
- `discharge_summary` → đọc phần B tổng kết
- Trang có `department_hint` = khoa cụ thể → đọc diễn biến khoa đó
- `lab_result`, `imaging` → kết quả CLS
- `medical_orders`, `clinical_course` → y lệnh + theo dõi

> **Lưu ý**: Python detect không hoàn hảo — Claude phải tự đọc text và điều chỉnh
> phân loại nếu cần. Department_timeline là gợi ý, không phải ground truth.

### 1.5b ★ Gắn CLS / điều trị ĐÚNG KHOA theo NGÀY (BN nằm nhiều khoa) — v3.1

> **Vấn đề:** phiếu XN, y lệnh, CĐHA thường KHÔNG ghi "Khoa:", và HIS hay **gom toàn bộ phiếu XN về cuối hồ sơ**. Nếu gán khoa theo thứ tự trang (forward-fill) → mọi XN dồn nhầm vào khoa cuối. Khi BN nằm ≥2 khoa, **phải gán theo NGÀY**.

**Quy trình bắt buộc khi `len(departments_canonical) >= 2`:**

1. Đọc `department_date_ranges` trong raw JSON — mỗi khoa có `start_date`/`end_date` (suy từ trang lâm sàng có ngày).
2. Với MỖI phiếu `lab_result` / `medical_orders` / `imaging`:
   - Lấy **ngày của phiếu** (trường `dates_found` của trang, hoặc ngày ghi trên kết quả XN/y lệnh).
   - Gán vào khoa có khoảng `[start_date, end_date]` **chứa ngày đó** → đặt entry vào `department_stays[khoa].lab_results/medications/imaging_results`.
   - KHÔNG tin `department_canonical` của trang nếu `department_method == "forward_filled"` mà ngày phiếu rơi vào khoa khác.
3. Mỗi entry XN/thuốc nên kèm `date` + `page` để truy vết. Trong `evidence_map`, ghi rõ khoa được suy từ ngày (`source_method: "synthesized"` nếu gán theo ngày).
4. Nếu một phiếu không có ngày và không chắc khoa → để ở khoa forward-fill nhưng đánh dấu `"_dept_uncertain": true` để Claude/Bác sĩ rà lại (đừng bịa).

**Kiểm tra (self-check) trước khi sang Bước 2:** mỗi khoa trong `department_stays` có nằm trong `cac_khoa_dieu_tri`; tổng số `lab_results`+`medications` các khoa khớp số phiếu thực; không có khoa nào (ngoài khoa thực sự không can thiệp) bị rỗng cả XN lẫn y lệnh.

### 1.6 Trích xuất thông tin cho master registry

Trong quá trình đọc text, xác định đồng thời các trường sau để điền vào `DATA {}`.
Các trường này được ghi vào `master.json` tự động khi script Node.js chạy.

| Trường trong DATA{} | Nguồn tìm trong HSBA | Giá trị hợp lệ |
|---|---|---|
| `gioi` | Trang bìa / Bệnh án nội khoa: "Giới tính" | `"Nam"` \| `"Nữ"` |
| `nam_sinh` | Trang bìa: "Năm sinh" hoặc "Ngày sinh" | Số nguyên 4 chữ số, vd `1980` |
| `hinh_thuc_ra_vien` | **Giấy ra viện** (ưu tiên) hoặc Tổng kết bệnh án: trường "Tình trạng ra viện" / "Hình thức ra viện" | `"Ra viện"` \| `"Chuyển viện"` \| `"Nặng xin về"` \| `"Tử vong"` \| `"Trốn viện"` |
| `khoa_vao_vien` | Trang bìa / Phiếu tiếp nhận: "Khoa tiếp nhận" hoặc khoa ghi ở mục nhập viện | Tên khoa đầu tiên tiếp nhận BN |
| `khoa_ra_vien` | Giấy ra viện: "Khoa" hoặc tiêu đề phiếu cuối cùng | Khoa điều trị khi xuất viện |
| `phau_thuat` | Tìm "Phiếu cam kết phẫu thuật", "Biên bản phẫu thuật", "Phiếu gây mê", hoặc trong y lệnh có "PT:", "Mổ" | `true` \| `false` |
| `cac_khoa_dieu_tri` | Đọc trình tự khoa trong toàn bộ hồ sơ (tiêu đề phiếu, chuyển khoa) | Mảng tên khoa theo thứ tự, vd `["Cấp cứu", "Hồi sức 1"]` |

**Lưu ý khi không tìm được thông tin:**
- `gioi`: Điền `"Không rõ"` nếu không xác định được
- `nam_sinh`: Điền `0` nếu không có
- `hinh_thuc_ra_vien`: Điền `"Không rõ"` nếu hồ sơ không ghi
- `phau_thuat`: Điền `false` nếu không có bằng chứng phẫu thuật

### 1.7 Xây dựng timeline

Liệt kê tất cả mốc thời gian theo thứ tự tăng dần:

```
[ngày giờ] → [sự kiện] → [nguồn trang]
```

Đối chiếu tính logic: không có XN trả kết quả trước khi chỉ định; không có y lệnh
sau giờ ra viện; không có gap bất thường không giải thích được.

---

## Bước 1.9 — DATA{} Schema mở rộng (v2.0)

**Đây là cấu trúc dữ liệu Claude phải điền đầy đủ trước khi chạy script Node.js.**
Phiên bản v2.0 bổ sung 4 nhóm field mới so với v1.x:
`admission_workup`, `discharge_summary`, `department_stays`, `evidence_map`.

> Các field cũ (bieu_mau, section_a, section_b) GIỮ NGUYÊN — không bỏ.

```javascript
var DATA = {
  // ══════════════════════════════════════════════════════
  // PHẦN 0: METADATA (giữ nguyên từ v1.x)
  // ══════════════════════════════════════════════════════
  schema_version:    "v2.0",
  ma_bn:             "",          // Mã KCB (8-12 chữ số)
  ho_ten:            "",          // Họ tên đầy đủ có dấu
  ten_khong_dau:     "",          // HO TEN KHONG DAU (dùng đặt tên file)
  gioi:              "",          // "Nam" | "Nữ"
  nam_sinh:          0,           // Năm sinh 4 chữ số
  ngay_vao:          "",          // "DD/MM/YYYY"
  ngay_ra:           "",          // "DD/MM/YYYY"
  so_ngay_dieu_tri:  0,
  hinh_thuc_ra_vien: "",          // "Ra viện"|"Chuyển viện"|"Nặng xin về"|"Tử vong trong viện"|"Tử vong trước viện"|"Trốn viện"
  khoa_vao_vien:     "",
  khoa_ra_vien:      "",
  phau_thuat:        false,
  cac_khoa_dieu_tri: [],          // Mảng tên khoa theo thứ tự

  // ── LOẠI BỆNH ÁN (MỚI v2.0) ─────────────────────────
  ba_loai:           "",          // Từ raw JSON: "noi_khoa"|"nhi_khoa"|"ngoai_khoa"|...
  ma_bieu_mau:       "",          // "01/BV-01" v.v.

  // ══════════════════════════════════════════════════════
  // PHẦN 1: PHẦN LÀM BỆNH ÁN KHI NHẬP VIỆN (MỚI v2.0)
  // Section A theo TT 32/2023 — TOÀN VĂN + STRUCTURED
  // ══════════════════════════════════════════════════════
  admission_workup: {
    source_page:      0,          // Trang PDF chứa phần A bệnh án
    raw_text:         "",         // COPY NGUYÊN VĂN toàn bộ phần A từ PDF

    // I. Lý do vào viện
    ly_do_vao_vien:       "",     // Ngắn gọn, ví dụ "Khó thở, phù 2 chân"
    vao_ngay_thu_benh:    "",     // "Ngày thứ X của bệnh" nếu có

    // II. Hỏi bệnh
    qua_trinh_benh_ly:    "",     // Đầy đủ, paragraph
    tien_su_ban_than:     "",
    tien_su_gia_dinh:     "",
    dac_diem_lien_quan:   "",     // Đặc điểm liên quan bệnh (nếu có)

    // III. Khám bệnh — dấu hiệu sinh tồn
    dau_hieu_sinh_ton: {
      mach:      "",              // Ví dụ "90 lần/phút"
      huyet_ap:  "",              // "140/90 mmHg"
      nhiet_do:  "",              // "37.2 °C"
      nhip_tho:  "",              // "22 lần/phút"
      spo2:      "",              // "95%"
      can_nang:  "",              // nếu có
      chieu_cao: ""               // nếu có
    },

    // III. Khám bệnh — toàn thân + cơ quan
    kham_toan_than:    "",        // Đầy đủ paragraph
    kham_co_quan: {
      tuan_hoan:        "",
      ho_hap:           "",
      tieu_hoa:         "",
      than_tiet_nieu:   "",
      than_kinh:        "",
      co_xuong_khop:    "",
      tai_mui_hong:     "",
      rang_ham_mat:     "",
      mat:              "",
      noi_tiet:         ""
    },

    // Tóm tắt + hướng điều trị ban đầu
    cls_can_lam:          "",     // 3. Các XN/CLS cần làm
    tom_tat_benh_an:      "",     // 4. Tóm tắt bệnh án

    // IV. Chẩn đoán khi vào khoa
    chan_doan_vao_khoa: {
      benh_chinh:     "",
      benh_kem:       "",
      phan_biet:      ""
    },

    // V–VI
    tien_luong:           "",
    huong_dieu_tri:       "",
    bac_si_lam_ba:        "",     // Tên BS ký
    ngay_lam_ba:          ""      // "DD/MM/YYYY"
  },

  // ══════════════════════════════════════════════════════
  // PHẦN 2: TỔNG KẾT BỆNH ÁN (MỚI v2.0)
  // Section B theo TT 32/2023 — TOÀN VĂN + STRUCTURED
  // ══════════════════════════════════════════════════════
  discharge_summary: {
    source_page:      0,          // Trang PDF chứa TKBA

    raw_text:         "",         // COPY NGUYÊN VĂN toàn bộ TKBA

    // Các mục trong TKBA
    qua_trinh_va_dien_bien:  "",  // Đầy đủ paragraph
    tom_tat_cls_co_gia_tri:  "",  // Tóm tắt kết quả CLS có giá trị
    phuong_phap_dieu_tri:    "",  // Phương pháp/thuốc đã dùng
    tinh_trang_ra_vien:      "",  // Mô tả tình trạng BN khi xuất viện
    huong_sau_ra_vien:       "",  // Hướng điều trị/theo dõi sau ra viện (nếu có)

    // Chẩn đoán ra viện
    chan_doan_ra_vien: {
      benh_chinh:     "",
      benh_kem:       "",
      icd_chinh:      "",         // Mã ICD-10 ghi trong hồ sơ
      icd_kem:        ""
    },

    bac_si_ky:        "",
    ngay_tong_ket:    ""
  },

  // ══════════════════════════════════════════════════════
  // PHẦN 3: DỮ LIỆU THEO KHOA ĐIỀU TRỊ (MỚI v2.0)
  // MỌI dữ liệu clinical PHẢI gắn theo khoa
  // ══════════════════════════════════════════════════════
  department_stays: [
    // Một entry cho mỗi khoa. Thứ tự = thứ tự thời gian thực tế.
    {
      department:       "",       // Tên khoa đầy đủ
      start_date:       "",       // "DD/MM/YYYY" — ngày bắt đầu điều trị tại khoa
      end_date:         "",       // "DD/MM/YYYY"
      source_pages:     [],       // Danh sách page_num từ JSON liên quan đến khoa này

      // Chẩn đoán tại khoa
      diagnoses: [
        // {type: "vao_khoa"|"trong_khoa"|"ra_khoa", text: "", icd: "", date: "", page: 0}
      ],

      // Diễn biến lâm sàng (raw text đầy đủ từ các trang clinical_course của khoa)
      clinical_course_raw:  "",   // COPY NGUYÊN VĂN — không tóm tắt

      // Y lệnh thuốc
      medications: [
        // {drug: "", dose: "", route: "", frequency: "", start_date: "", end_date: "", page: 0}
      ],

      // Y lệnh xét nghiệm/CLS
      labs_ordered: [
        // {test: "", date: "", page: 0}
      ],

      // Kết quả xét nghiệm (từ các trang lab_result của khoa)
      lab_results: [
        // {test: "", value: "", unit: "", reference: "", flag: ""|"HIGH"|"LOW"|"CRITICAL", date: "", page: 0}
      ],

      // Kết quả CLS (imaging, ECG, echo...)
      imaging_results: [
        // {type: "Xquang"|"Siêu âm"|"CT"|"ECG"|"other", description: "", date: "", page: 0}
      ],

      // Thủ thuật/phẫu thuật tại khoa
      procedures: [
        // {name: "", date: "", page: 0}
      ],

      // Nhận xét bác sĩ (raw text từ doctor notes)
      doctor_notes_raw:   "",     // COPY NGUYÊN VĂN nếu có

      // Chăm sóc điều dưỡng
      nursing_notes_raw:  "",     // COPY NGUYÊN VĂN nếu có

      // Hội chẩn tại khoa
      consultations: [
        // {date: "", specialty: "", summary: "", page: 0}
      ],

      // Chuyển ra (nếu có)
      transfer_out: null          // {to_department: "", date: "", reason: ""}
                                  // null nếu xuất viện từ khoa này
    }
  ],

  // ══════════════════════════════════════════════════════
  // PHẦN 4: EVIDENCE MAP (MỚI v2.0)
  // Truy vết nguồn cho các field quan trọng
  // ══════════════════════════════════════════════════════
  evidence_map: [
    // {field: "path.to.field", value: "...", source_page: 0, source_text: "...trích dẫn..."}
    // Ưu tiên map các field: chan_doan, icd, chan_doan_vao_khoa, hinh_thuc_ra_vien
  ],

  // ══════════════════════════════════════════════════════
  // PHẦN 5: ANALYSIS READINESS
  // ══════════════════════════════════════════════════════
  analysis_readiness: {
    ready:            true,
    completeness_pct: 0,          // % field có data (0-100)
    missing_critical: [],         // Tên field quan trọng còn thiếu
    notes:            ""
  },

  // ══════════════════════════════════════════════════════
  // PHẦN 6: BIEU MAU + SECTION A/B (GIỮ NGUYÊN từ v1.x)
  // ══════════════════════════════════════════════════════
  bieu_mau: [
    // {stt: 1, ten: "...", trang: "...", ket_qua: "dat"|"can_bo_sung"|"thieu", ghi_chu: ""}
  ],
  section_a: {
    bm_tong: 0, bm_dat: 0, bm_can_bo_sung: 0, bm_thieu: 0,
    timeline_issues: [],
    icd_warnings: []
  },
  section_b: {
    chan_doan: [],   // [{ten: "", muc_do: "", bang_chung: "", trang: ""}]
    dieu_tri:  [],
    cls:       [],
    dien_bien: [],
    khuyen_nghi: []
  }
};
```

  // ── RAW TIMELINE (MỚI v3.0) ─────────────────────────────
  // Sự kiện thực tế từ hồ sơ — factual, KHÔNG có AI commentary
  // → Đây là field RAW: GHI VÀO JSON
  timeline_raw: [
    // {datetime: "DD/MM/YYYY HH:MM", department: "", event: "...", event_type: "admission|order|result|note|transfer_in|discharge", source_page: 0}
  ],

  // ── MÃ ICD TRONG HỒ SƠ (MỚI v3.0) ──────────────────────
  // Factual: mã được ghi trong hồ sơ — KHÔNG có AI evaluation đúng/sai
  // → Đây là field RAW: GHI VÀO JSON
  icd_codes_in_record: [
    // {ma: "I20.0", ten_ghi_trong_ho_so: "...", vi_tri: "Bệnh chính — vào/ra viện", source_page: 0}
  ],

  // ══════════════════════════════════════════════════════════════
  // PHÂN BIỆT QUAN TRỌNG: RAW vs ANALYSIS
  // ══════════════════════════════════════════════════════════════
  // Các fields PHÍA TRÊN (admission_workup, discharge_summary,
  // department_stays, timeline_raw, icd_codes_in_record, bieu_mau,
  // evidence_map, analysis_readiness) → GHI VÀO JSON (raw/factual)
  //
  // Các fields PHÍA DƯỚI (section_a, section_b, icd_canh_bao,
  // icd_chi_tiet, icd_summary, tieu_chi_uap, tieu_chi_kali,
  // phat_hien_phu, dieu_tri_kali, cls_du/thieu/khong_chi_dinh,
  // tam_cau_hoi, khuyen_nghi, lam_sang_tomtat, ket_luan)
  // → CHỈ DÙNG CHO DOCX, KHÔNG GHI VÀO JSON
  // ══════════════════════════════════════════════════════════════

### Quy tắc điền DATA{} v3.0

**Fields RAW (→ ghi vào JSON, bắt buộc đủ nội dung):**

| Trường | Bắt buộc | Ghi chú |
|--------|----------|---------|
| `admission_workup.raw_text` | ✅ | Copy nguyên văn, KHÔNG tóm tắt, KHÔNG "..." |
| `admission_workup.chan_doan_vao_khoa` | ✅ | Chẩn đoán ghi trong hồ sơ + evidence_map |
| `discharge_summary.raw_text` | ✅ | Copy nguyên văn |
| `discharge_summary.chan_doan_ra_vien.icd_chinh` | ✅ | Mã ICD ghi trong hồ sơ (factual) |
| `department_stays[].clinical_course_raw` | ✅ | Copy nguyên văn, không tóm tắt |
| `department_stays[].medications` | ✅ nếu có | Ít nhất ghi drug + dose + route |
| `department_stays[].lab_results` | ✅ nếu có | Tất cả kết quả XN với giá trị thực |
| `timeline_raw` | ✅ | Tối thiểu 10 events factual từ clinical notes |
| `icd_codes_in_record` | ✅ | Tất cả mã ICD được ghi trong hồ sơ |
| `evidence_map` | ✅ | Tối thiểu 5 entries với source_page thực |

**Fields ANALYSIS (→ chỉ dùng cho DOCX, KHÔNG vào JSON):**

| Trường | Mục đích | Chỉ trong DOCX |
|--------|----------|----------------|
| `icd_canh_bao`, `icd_chi_tiet`, `icd_summary` | Đánh giá ICD | B.5 |
| `tieu_chi_uap`, `tieu_chi_kali` | Tiêu chí chẩn đoán | B.1 |
| `phat_hien_phu` | Phát hiện phụ chưa xử trí | B.1 |
| `dieu_tri_kali`, `cls_du/thieu` | Đánh giá điều trị + CLS | B.2-B.3 |
| `lam_sang_tomtat`, `ket_luan` | Verdict + kết luận | Tổng hợp |
| `tam_cau_hoi`, `khuyen_nghi` | 8 câu + khuyến nghị | Tổng hợp |

**Với field không tìm được:** điền `""` (string rỗng) hoặc `[]` (mảng rỗng) — KHÔNG điền `null` vào các field string.

---

## Bước 2 — Phần A: Kiểm tra hình thức

### 2.1 Checklist biểu mẫu

So sánh biểu mẫu có trong hồ sơ với danh sách chuẩn theo
**Thông tư số 32/2023/TT-BYT** (có hiệu lực từ 01/01/2024, Điều 51 + Phụ lục XXVIII–XXIX).

Tham khảo danh sách đầy đủ: `references/bieu-mau-chuan.md`

**Quy tắc phân loại phát hiện:**
- `✅ Đạt` — có mặt, đầy đủ, chữ ký hợp lệ
- `⚠️ Cần bổ sung` — có nhưng thiếu trường hoặc thiếu chữ ký
- `❌ Thiếu` — không có biểu mẫu

### 2.2 Kiểm tra trình tự thời gian

Các xung đột thời gian cần phát hiện:
- Kết quả XN trả trước giờ lấy mẫu
- Y lệnh ghi sau giờ ra viện
- Ngày ra viện trước ngày vào viện
- Kết quả CLS không được nhắc lại trong phiếu theo dõi điều trị
- Y lệnh active còn tồn đọng khi xuất viện

### 2.3 Cảnh báo mã ICD

**Nguyên tắc theo QĐ 4469/QĐ-BYT:**

```
Quy tắc 1: Mã chẩn đoán theo dõi/nghi ngờ → dùng nhóm Z03.x, KHÔNG dùng mã bệnh xác nhận
Quy tắc 2: Mã triệu chứng (nhóm R) không dùng khi đã có mã chẩn đoán giải thích
Quy tắc 3: Bệnh chính là tình trạng được điều trị trực tiếp / chiếm nhiều nguồn lực nhất
Quy tắc 4: Chẩn đoán xác định khi ra viện phải phản ánh đúng kết quả điều trị
```

Tham khảo chi tiết: `references/icd-coding-rules.md`

---

## Bước 3 — Phần B: Đánh giá lâm sàng

**Nguyên tắc: Mọi nhận xét phải có căn cứ từ text hồ sơ — không suy diễn, không hallucinate.**

> ★ **BẮT BUỘC chạy Bước 3.5 (Evidence Grounding) trước khi viết các nhận định B.1–B.5.**
> Đây là điểm nâng cấp v3.7 — quyết định chất lượng "sắc nét, hàn lâm" của báo cáo.

### Bước 3.5 — Evidence Grounding (truy xuất bằng chứng đối chiếu)

Đọc đầy đủ quy trình: `references/evidence-grounding.md`. Tóm tắt 5 bước:

1. **G1 — Câu hỏi grounding ẩn danh:** từ chẩn đoán + XN bất thường + thuốc, lập 3–6 câu hỏi khái niệm (KHÔNG kèm tên/mã/địa chỉ BN), mỗi câu gắn 1 mục Section B.
2. **G2 — Thang nguồn:** ⚡ **TRA `grounding-cache.py get` TRƯỚC** — nếu HIT, lấy citation đã verify, bỏ qua mọi MCP/web (0 token). MISS mới đi tiếp: Tier 1 kho nội bộ (`version-graph.search_clinical` → `check_clinical_validity`) → Tier 2 web Bộ Y tế + thuvienphapluat (kiểm hiệu lực) → Tier 3 hiệp hội (ESC/AHA/VNHA…) + y văn (`pubmed-extended`, `consensus`, `semantic-scholar`) → Tier 4 ICD. Sau khi verify xong → `grounding-cache.py put` để HSBA sau tái dùng.

```bash
GC="/Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json"   # kho grounding DÙNG CHUNG (second brain)
python3 "$MOUNT/knowledge/hsba-audit-skill/scripts/grounding-cache.py" get --cache "$GC" --concept "<khái niệm ẩn danh>"
# ... nếu MISS: grounding theo tier → verify → ghi lại:
python3 "$MOUNT/knowledge/hsba-audit-skill/scripts/grounding-cache.py" put --cache "$GC" --concept "<...>" --entry-json '<entry verified>'
```
3. **G3 — Verify citation (chống hallucinate):** mọi DOI/PMID đi qua `scholar-sidekick.verifyCitation` (`matched` mới dùng) + `checkRetraction`. Văn bản BYT = verify bằng mở trang chính thức + đúng số hiệu/ngày + còn hiệu lực.
4. **G4 — Điền `DATA.evidence_grounding[]`** (concept, used_in, source_tier, source, key_point, citation_ref, identifier, verified, validity).
5. **G5 — Nâng `DATA.reasoning_boundary`**: `guideline_grounded=true`, `confidence_cap="supported"` khi có guideline verified + OCR tốt.

> ⚠️ **Mã ICD — canonical là BYT, KHÔNG phải ICD MCP quốc tế.** ICD MCP là ICD-10-CM (Mỹ); nhiều mã VN (Z03.x, R07.3…) "not found" ở CM dù tồn tại trong ICD-10 WHO/BYT. Luôn đối chiếu `hsba-workspace/icd/icd10_lookup.json` (BYT 2026); MCP quốc tế chỉ để so sánh hệ mã.
>
> 🔒 **Privacy:** chỉ gửi khái niệm bệnh ẩn danh ra nguồn ngoài. Xem `references/evidence-grounding.md` §0.

`evidence_grounding[]` và `reasoning_boundary` được Stage 3 render thành **B.0 — Cơ sở Bằng chứng Đối chiếu** (bảng + hộp ranh giới suy luận) và ghi vào JSON.

### Bước 3.5b — Token discipline (đặc biệt khi batch)

- **Một HSBA:** chạy tuần tự Phase 1→6 (xem `WORKFLOW-TOKEN-OPTIMIZED.md`). Luôn đọc **digest**, không `cat` raw JSON; tra **grounding-cache** trước.
- **Batch ≥5 HSBA:** giao Phase 1–3 (extract → OCR todo → đọc digest → điền `DATA{}`) cho **Task subagent**; subagent chỉ trả về `DATA{}` đã điền. Context chính không phình theo 50 trang × N hồ sơ.
- **Tổng hợp:** dùng `aggregate-stats.py` → đọc **`_stats.json`** (≈7%), KHÔNG đọc lại từng JSON đầy đủ.

### 3.1 Đánh giá chẩn đoán

**Framework phân tích:**

```
Bước 1: Liệt kê tất cả chẩn đoán trong hồ sơ (vào viện, sơ bộ, xác định, ra viện)
Bước 2: Với mỗi chẩn đoán, liệt kê tiêu chuẩn chẩn đoán theo hướng dẫn BYT/quốc tế
Bước 3: Đối chiếu từng tiêu chí với dữ liệu thực tế trong hồ sơ
Bước 4: Gán mức độ: Xác nhận / Có căn cứ một phần / Không đủ bằng chứng / Mâu thuẫn
```

**4 mức độ chứng cứ (dùng tiếng Việt):**
- `Xác nhận` — Có đủ bằng chứng lâm sàng + CLS theo tiêu chuẩn hướng dẫn
- `Có căn cứ một phần` — Có một số bằng chứng nhưng không đủ tiêu chuẩn xác nhận
- `Chưa đủ bằng chứng` — Thiếu dữ liệu quan trọng để kết luận
- `Mâu thuẫn` — Bằng chứng trong hồ sơ đi ngược lại chẩn đoán

### 3.2 Đánh giá điều trị & Dược lâm sàng ★ (mở rộng v4.1)

> Đọc đầy đủ: `references/treatment-pharmacy-review.md`. KHÔNG chỉ "đủ/thiếu thuốc" — soi cả quá trình điều trị theo 5 lớp:

- **B.2.1 Phù hợp chỉ định:** mỗi thuốc ↔ chẩn đoán nào biện minh ↔ có căn cứ phác đồ không → `dieu_tri_danh_gia[].chi_dinh_cho`.
- **B.2.2 Dược lâm sàng từng thuốc (6 trục):** liều–đường–nhịp–thời gian · chỉnh liều theo thận (eGFR)/gan · chống chỉ định/thận trọng · tương tác thuốc–thuốc · trùng lặp/đa trị liệu · theo dõi điều trị (điện giải, INR, men gan, đường huyết, TDM, QT) → `dieu_tri_danh_gia[]` + `tuong_tac_thuoc[]`.
- **B.2.3 Đáp ứng theo thời gian:** triệu chứng/CLS cải thiện đúng kỳ vọng phác đồ? y lệnh có leo thang/đổi hướng kịp khi không đáp ứng/xấu đi? → `dap_ung_dieu_tri[]`.
- **B.2.4 Thay đổi chẩn đoán & bổ sung CLS:** khi diễn biến mới xuất hiện, hồ sơ có cập nhật chẩn đoán + chỉ định CLS thêm không? phát hiện bất thường có bị "bỏ rơi" không? → `thay_doi_chan_doan[]`.
- **B.2.5 Thiếu/dư:** thuốc nền tảng thiếu (khi dx xác nhận); kháng sinh không xuống thang; điều trị kéo dài không đánh giá lại; bỏ sót theo dõi bắt buộc.

Verdict: `dieu_tri_tomtat = {muc_do: "Phù hợp|Phù hợp một phần|Chưa phù hợp|Không đủ thông tin", noi_dung}`.

**Grounding thuốc (Bước 3.5):** tra `grounding-cache` các khái niệm "Phác đồ <bệnh>", "Liều/chỉnh liều <thuốc>", "Tương tác <A> <B>". Nguồn ưu tiên VN: **Dược thư Quốc gia Việt Nam** → phác đồ BYT → tờ HDSD → guideline hiệp hội → ChEMBL (`get_mechanism`/`get_admet`, chỉ cơ chế/ADMET — KHÔNG phải liều VN/DDI lâm sàng). Verify citation y văn qua PubMed.

**Nguyên tắc:** KHÔNG ra lệnh ("phải dùng X"); viết "theo phác đồ [n], cần xem xét…", "đề nghị DSLS/bác sĩ rà". Mọi nhận định có nguồn hoặc ghi "chưa đủ bằng chứng".

### 3.3 Đánh giá cận lâm sàng

| Nhóm | Tiêu chí |
|---|---|
| Thiết yếu — đủ | Có mặt, kết quả phù hợp mục tiêu lâm sàng |
| Thiết yếu — thiếu | Cần có theo hướng dẫn nhưng không có trong hồ sơ |
| Không rõ chỉ định | Có trong hồ sơ nhưng không có gợi ý lâm sàng ghi nhận |
| Cần theo dõi thêm | Kết quả bất thường không được xử trí hoặc nhắc lại |

### 3.4 Đánh giá diễn biến lâm sàng

Xây dựng bảng diễn biến theo ngày và nhận xét mối liên hệ:
- Điều trị → Cải thiện: có logic không?
- Kết quả CLS → Thay đổi y lệnh: có phản ứng kịp thời không?
- Triệu chứng còn tồn tại sau điều trị: có được giải thích không?

---

## Bước 4 — Tổng hợp và mức đánh giá

### 4.1 Trả lời 8 câu hỏi cốt lõi

| # | Câu hỏi | Đánh giá |
|---|---|---|
| 1 | Hồ sơ có đầy đủ biểu mẫu không? | ✅ / ⚠️ / ❌ |
| 2 | Chẩn đoán có đủ căn cứ không? | ✅ / ⚠️ / ❌ |
| 3 | Điều trị có phù hợp phác đồ không? | ✅ / ⚠️ / ❌ |
| 4 | CLS có hỗ trợ chẩn đoán không? | ✅ / ⚠️ / ❌ |
| 5 | Có mâu thuẫn trong hồ sơ không? | ✅ / ⚠️ / ❌ |
| 6 | Có vấn đề mã ICD không? | ✅ / ⚠️ / ❌ |
| 7 | Cần bác sĩ xem xét thêm không? | ✅ / ⚠️ / ❌ |
| 8 | Mức đánh giá tổng thể? | Xem 4.2 |

### 4.2 Mức đánh giá tổng thể

| Mức | Ký hiệu | Tiêu chí |
|---|---|---|
| Tốt | 🟢 Tốt | Đủ biểu mẫu, chẩn đoán đủ căn cứ, điều trị đúng phác đồ, mã ICD chính xác |
| Chấp nhận được | 🟡 Chấp nhận được | Đủ biểu mẫu cơ bản, có 1–3 điểm cần cải thiện không ảnh hưởng an toàn |
| Cần xem xét | 🟠 Cần xem xét | Thiếu CLS quan trọng, sai mã ICD, điều trị chưa đủ hoặc thiếu theo dõi |
| Vấn đề nghiêm trọng | 🔴 Vấn đề nghiêm trọng | Mâu thuẫn chẩn đoán-điều trị, sai sót mã ICD ảnh hưởng BHYT, thiếu biểu mẫu pháp lý |

---

## Bước 5 — Tạo file DOCX báo cáo

### 5.1 Cài đặt thư viện

```bash
npm list -g docx 2>/dev/null | grep -q docx || npm install -g docx
```

### 5.2 Cấu trúc file output

```
BaoCao_HSBA_[MaBenhNhan].docx
├── Trang tiêu đề + bảng thông tin hành chính
├── PHẦN A — Kiểm tra hình thức hồ sơ
│   ├── A.1 Kiểm tra đủ biểu mẫu (bảng 3 cột: STT / Biểu mẫu / Kết quả)
│   ├── A.2 Kiểm tra trình tự thời gian (bảng timeline)
│   └── A.3 Cảnh báo mã ICD (bảng sơ bộ)
├── PHẦN B — Đánh giá lâm sàng
│   ├── B.0 Cơ sở bằng chứng đối chiếu (hộp ranh giới suy luận + bảng evidence_grounding) [v3.7]
│   ├── B.1 Đánh giá chẩn đoán (có hộp hướng dẫn + bảng đối chiếu bằng chứng)
│   ├── B.2 Đánh giá điều trị & dược lâm sàng [v4.1: B.2.1 chỉ định, B.2.2 DLS 6 trục/thuốc + tương tác, B.2.3 đáp ứng theo thời gian, B.2.4 thay đổi chẩn đoán+CLS, B.2.5 thiếu/dư + verdict]
│   ├── B.3 Đánh giá cận lâm sàng (3 bảng: đủ / không rõ chỉ định / còn thiếu)
│   ├── B.4 Đánh giá diễn biến lâm sàng
│   └── B.5 Đánh giá mã ICD chi tiết (với bảng mã sai → mã đúng)
├── Tổng hợp kết quả (bảng 8 câu hỏi + hộp verdict màu + bảng khuyến nghị)
└── Danh mục tài liệu tham khảo (Vancouver, đánh số [1], [2]...)
```

### 5.3 Quy trình sinh DOCX (v4.4 — TÁCH TEMPLATE / DATA, tránh viết lại 2000 dòng)

> ⚠️ KHÔNG copy/viết lại `complete-example.js` (≈2000 dòng) — đó là nguyên nhân CLI chậm/"prompt too long". Renderer đã tách thành **`scripts/render-report.js`** (cố định, không đụng). Bạn CHỈ viết **file DATA**.

1. **Đọc cấu trúc DATA**: `scripts/data-example.js` (`module.exports = {...}`) — mẫu đầy đủ field.
2. **Viết file DATA của ca**: `/tmp/data-[MaKCB].js` = `module.exports = { ...DATA thực... };`. Đây là phần DUY NHẤT cần suy luận (≈600 dòng nội dung, không có code render).
3. **Chạy renderer cố định** (docx đã cài ở `scripts/node_modules`):
   ```bash
   cd "<...>/knowledge/hsba-audit-skill/scripts"
   node render-report.js /tmp/data-[MaKCB].js     # → DOCX + JSON + master.json
   ```
   `render-report.js` tự phát hiện BASE_OUT (output/word, output/json). Không cần NODE_PATH nếu chạy trong scripts/.

> `complete-example.js` (script + DATA gộp) GIỮ làm tài liệu tham chiếu cấu trúc; KHÔNG dùng để chạy nữa.

### ⚠️ CHECKLIST BẮT BUỘC TRƯỚC KHI CHẠY SCRIPT

> **DỪNG LẠI và kiểm tra từng điểm sau trước khi `node script.js`.**
> Vi phạm bất kỳ điểm nào → JSON output sẽ không đủ để AI agent khác tái tạo lại phân tích.

**[1] raw_text PHẢI là toàn văn nguyên xi từ PDF — KHÔNG được viết tóm tắt hay "..."**
- `admission_workup.raw_text` → copy toàn bộ text trang admission_form từ raw JSON (`pages[].text` của trang có `page_type: "admission_form"`)
- `discharge_summary.raw_text` → copy toàn bộ text trang discharge_summary
- Kiểm tra: trường này phải dài hơn 300 ký tự và chứa các từ đặc trưng của biểu mẫu (VD: "Lý do vào viện", "Khám bệnh", "Chẩn đoán")

**[2] clinical_course_raw PHẢI là toàn văn nguyên xi — KHÔNG rút gọn, KHÔNG "..."**
- `department_stays[n].clinical_course_raw` → ghép toàn bộ text từ các trang `page_type: "clinical_course"` và `"medical_orders"` thuộc khoa đó
- Kiểm tra: phải chứa giờ/ngày cụ thể, y lệnh thực tế, kết quả XN thực tế

**[3] doctor_notes_raw và nursing_notes_raw PHẢI là nguyên văn — KHÔNG tóm tắt**
- Chỉ để `""` nếu trang thực sự không có nội dung

**[4] icd_summary, lam_sang_tomtat, ket_luan PHẢI được điền đầy đủ**
- Đây là dữ liệu đánh giá lâm sàng của Section B — KHÔNG để `null` hoặc `{}`
- Nếu chưa phân tích xong Section B, hãy phân tích xong trước khi tạo DATA{}

**[5] evidence_map PHẢI có ≥ 3 entries, mỗi entry có source_page và source_text thực**
- Tối thiểu cover: chan_doan_vao_khoa, icd_chinh ra viện, hinh_thuc_ra_vien

**[6] department_stays PHẢI có source_pages là danh sách số trang thực từ raw JSON**
- `source_pages: []` là sai — phải là danh sách page_num thực tế

**[7] Văn phong Section B: burstiness, số liệu tích hợp trong câu, tối đa 1 connector / 3 câu**
- Xem memory `feedback_writing_style_natural` để biết chi tiết

> Ví dụ ĐÚNG cho raw_text:
> ```
> "A- BỆNH ÁN\nMS: 01/BV-01\nHỌ VÀ TÊN: NGUYỄN VĂN A\nNăm sinh: 01/01/1970\n..."
> ```
> Ví dụ SAI (bị từ chối):
> ```
> "A- BỆNH ÁN\nI. Lý do vào viện: Đau ngực. II. Hỏi bệnh: Quá trình bệnh lý: ..."
> ```
> (Sai vì dùng "..." thay vì text thực)

```bash
# Cài docx vào /tmp (không cần quyền root)
cd /tmp && npm install docx 2>/dev/null | tail -1

# Chạy script với NODE_PATH trỏ vào /tmp/node_modules
NODE_PATH=/tmp/node_modules node /tmp/bao-cao-[MaBN].js
```

> **⚠️ LƯU Ý VỀ ĐƯỜNG DẪN OUTPUT (quan trọng — tránh tạo thư mục lồng nhau):**
>
> Script `complete-example.js` tự phát hiện BASE_OUT đúng (macOS hoặc bash sandbox).
> KHÔNG cần sửa BASE_OUT thủ công. Nếu cần override, dùng:
> ```bash
> # Tìm mount path trong bash sandbox:
> MOUNT=$(find /sessions -maxdepth 3 -name "KHTH - P4 HSBA" -type d 2>/dev/null | head -1)
> echo "Mount: $MOUNT"  # Verify trước khi dùng
> # Chạy với override nếu cần:
> HSBA_OUT="$MOUNT/output" NODE_PATH=/tmp/node_modules node /tmp/bao-cao-[MaBN].js
> ```
> TUYỆT ĐỐI không hardcode đường dẫn có dạng `KHTH/KHTH - P4 HSBA/KHTH - P4 HSBA/` —
> nếu thấy thư mục lồng nhau trong output/, đó là bug đường dẫn, cần dừng và báo cáo.

### 5.4 Hệ màu chuẩn (sao chép nguyên xi vào script)

```javascript
const C = {
  navy:"1F3864",   blue:"2E75B6",   dblue:"1A5276",
  lblue:"D6E4F0",  lblue2:"EBF5FB",
  green:"1E7145",  lgreen:"E2EFDA",
  amber:"C55A11",  lamber:"FEF9E7",
  red:"C00000",    lred:"FCECEA",
  gray:"595959",   lgray:"F2F2F2",
  white:"FFFFFF",  black:"000000",
};
```

### 5.5 Quy tắc màu cho bảng đánh giá

| Màu ô | Ý nghĩa | Hex fill |
|---|---|---|
| Xanh lá | Đạt / Phù hợp | `E2EFDA` |
| Vàng cam | Cần chú ý / Một phần | `FEF9E7` |
| Đỏ nhạt | Sai sót / Không phù hợp | `FCECEA` |
| Xanh dương nhạt | Hướng dẫn / Guideline box | `EBF5FB` |
| Xám nhạt | Thông tin trung tính | `F2F2F2` |

### 5.6 Danh mục tài liệu tham khảo

Trích dẫn theo thứ tự xuất hiện trong văn bản. Định dạng Vancouver.
Tham khảo danh sách tài liệu mẫu: `references/tai-lieu-tham-khao.md`

---

## Bước 6 — Chạy script → tạo DOCX và JSON

### 6.1 Đặt tên file (naming convention bắt buộc)

```
{mã_kcb} - {TEN_KHONG_DAU}
Ví dụ: 2600062416 - TONG VAN QUANG
```

- `ten_khong_dau` lấy từ tên file PDF trong input/ hoặc từ trường họ tên trong HSBA,
  bỏ dấu và viết hoa toàn bộ
- Điền vào trường `ten_khong_dau` trong `DATA {}` của script Node.js

### 6.2 Chạy Node.js → xuất DOCX + JSON song song

```bash
# Cài docx nếu chưa có
cd /tmp && npm install docx 2>/dev/null | tail -1

# Chạy script (script đã có đường dẫn output cứng trong BASE_OUT)
NODE_PATH=/tmp/node_modules node /tmp/bao-cao-[MaBN].js
```

Script sẽ tự xuất **3 file** trong 1 lần chạy:
- `output/word/{mã_kcb} - {TEN_KHONG_DAU}.docx` — báo cáo DOCX
- `output/json/{mã_kcb} - {TEN_KHONG_DAU}.json` — dữ liệu cá nhân HSBA
- `output/tong-hop/master.json` — registry tổng hợp (upsert theo mã KCB)

### 6.3 Validate output

```bash
python3 -c "
from docx import Document
doc = Document('/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA/output/word/<file>.docx')
print(f'OK: {len(doc.paragraphs)} paragraphs, {len(doc.tables)} tables')
" --break-system-packages 2>/dev/null || pip install python-docx --break-system-packages -q && python3 -c "..."
```

---

## Bước 7 — Trình bày kết quả và xác nhận với user

Sau khi script chạy xong, Claude trình bày **tóm tắt ngắn** cho user:

```
📄 Đã tạo báo cáo: {mã_kcb} - {TEN_KHONG_DAU}

Phần A (Hình thức):
  • Biểu mẫu: {N} đạt / {X} cần bổ sung / {Y} thiếu
  • Lỗi chính: [liệt kê 2-3 lỗi nổi bật nhất]

Phần B (Lâm sàng):
  • Phát hiện chính: [1-2 dòng]
  • Khuyến nghị ưu tiên cao: [1-2 dòng]

📎 File DOCX: output/word/{mã_kcb} - {TEN_KHONG_DAU}.docx
📎 File JSON: output/json/{mã_kcb} - {TEN_KHONG_DAU}.json

Anh có hài lòng với kết quả đầu ra không?
(Nếu ok → em sẽ chuyển file HSBA gốc sang thư mục processed/)
```

**Chờ user xác nhận.** Nếu user cần chỉnh sửa → sửa DATA{} → chạy lại script → hỏi lại.

---

## Bước 8 — Lưu trữ sau khi được xác nhận

Chỉ thực hiện sau khi user trả lời hài lòng / đồng ý:

```bash
INPUT_FILE="/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA/input/<ten_file>.PDF"
PROCESSED_DIR="/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA/processed/"

# Move sang processed/ (mv đã xóa khỏi input/)
mv "$INPUT_FILE" "$PROCESSED_DIR"

# Xóa tường minh nếu vẫn còn (trường hợp hard link)
[ -f "$INPUT_FILE" ] && rm -f "$INPUT_FILE"

# Verify input/ đã sạch
echo "Còn lại trong input/:" && ls "/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA/input/" || echo "(rỗng)"
```

Hoặc dùng MCP tool (đã xử lý hard link nội bộ):
```
mcp__hsba-analyzer__move_to_processed(files=["<ten_file>.PDF"])
```

Sau đó thông báo: "✅ Hoàn tất. File HSBA đã lưu vào processed/ và đã xóa khỏi input/."

---

## Nguyên tắc quan trọng

### Không hallucinate

- Mọi nhận xét phải có nguồn trang cụ thể trong hồ sơ
- Nếu thông tin không có trong hồ sơ: ghi "Không có trong hồ sơ" — không tự suy diễn
- Mức độ chứng cứ phải phản ánh đúng bằng chứng đọc được

### Không thay thế bác sĩ

Báo cáo hỗ trợ rà soát, không ra lệnh lâm sàng:
- Không viết "Bác sĩ chẩn đoán sai" → Viết "Chưa đủ bằng chứng xác nhận"
- Không viết "Cần dùng thuốc X" → Viết "Theo phác đồ [n], trường hợp này cần xem xét..."
- Không tính điểm nguy cơ thay cho bác sĩ — chỉ nêu thiếu sót

### Ngôn ngữ hoàn toàn tiếng Việt

- Không dùng: `timeline`, `Partially Supported`, `ACCEPTABLE`, `finding`, `assessment`
- Dùng thay thế: `trình tự thời gian`, `có căn cứ một phần`, `chấp nhận được`,
  `phát hiện`, `đánh giá`

### Trích dẫn tài liệu

- Mọi nhận xét lâm sàng phải kèm số trích dẫn `[n]` ngay trong bảng/hộp guideline
- Thứ tự số trích dẫn theo lần đầu xuất hiện trong báo cáo
- Định dạng Vancouver cho danh mục cuối

---

## Canonical Field IDs — Bảng tra cứu

Mỗi `bieu_mau` item phải có `canonical_id` lấy từ bảng sau. canonical_id được dùng bởi `applyAuditConfig()` để suppress theo config — KHÔNG dùng keyword fuzzy.

| canonical_id | Biểu mẫu | MS TT 32/2023 |
|---|---|---|
| `MS_01_BV_01_COVER` | Trang bìa (phần hành chính + Ra viện) | MS 01/BV-01 trang 1 |
| `MS_01_BV_01_BA` | Bệnh án nội khoa (phần A) | MS 01/BV-01 phần A |
| `MS_01_BV_01_TK` | Tổng kết bệnh án (phần B) | MS 01/BV-01 phần B |
| `MS_40_BV2` | Giấy cung cấp thông tin & cam kết nhập viện | MS 40/BV2 |
| `MS_TN_DV` | Giấy tự nguyện sử dụng dịch vụ theo yêu cầu | (local) |
| `MS_DI_UNG` | Phiếu khai thác tiền sử dị ứng (TT 51/2017) | (TT 51) |
| `MS_DINH_DUONG` | Phiếu sàng lọc & đánh giá tình trạng dinh dưỡng | (local) |
| `MS_17_BV2` | Phiếu xét nghiệm huyết học | MS 17/BV-2 |
| `MS_22_BV02` | Phiếu xét nghiệm hóa sinh | MS 22/BV-02 |
| `MS_XN_DAC_BIET` | Phiếu kết quả XN đặc biệt (Troponin, Ferritin…) | (local) |
| `MS_12_BV02` | Phiếu điện tim (ECG) | MS 12/BV-02 |
| `MS_09_BV02` | Phiếu chụp CLVT sọ não | MS 09/BV-02 |
| `MS_08_BV2` | Phiếu chiếu/chụp X-quang ngực | MS 08/BV2 |
| `MS_11_BV02` | Phiếu siêu âm ổ bụng | MS 11/BV-02 |
| `MS_SIEU_AM_TIM` | Phiếu siêu âm tim màu | (local) |
| `MS_TRUYEN_DICH` | Phiếu theo dõi truyền dịch | (local) |
| `MS_37_BV2` | Phiếu theo dõi và chăm sóc cấp 1 | MS 37/BV2 |
| `MS_38_BV1` | Phiếu theo dõi và chăm sóc cấp 2-3 | MS 38/BV1 |
| `MS_36_BV2` | Phiếu theo dõi điều trị (bệnh án điều trị) | MS 36/BV2 |
| `MS_HOI_CHAN` | Biên bản hội chẩn khoa | (local) |
| `MS_27_BV02` | Trích biên bản hội chẩn | MS 27/BV-02 |
| `MS_GDSK` | Phiếu tư vấn hướng dẫn giáo dục sức khỏe | GDSK-01 |
| `MS_GIAY_CHUYEN_VIEN` | Giấy chuyển viện | (local) |
| `MS_02` | Giấy ra viện | MS 02 |
| `MS_BANG_KE` | Bảng kê chi phí điều trị nội trú (BHYT + ngoài BHYT) | MS 01/KBCB, 01/KB |

> Biểu mẫu không có trong bảng trên: dùng `canonical_id: "LOCAL_<ten_viet_tat_khong_dau>"`.

---

## Cấu trúc thư mục skill

```
hsba-audit-skill/
├── SKILL.md                          ← file này
├── PIPELINE.md                       ← tài liệu kỹ thuật pipeline
├── audit-config.json                 ← cấu hình rules kiểm tra TTYT
├── BaoCao_HSBA_TongVanQuang_2600062416_CHUAN.docx  ← file mẫu chuẩn
├── references/
│   ├── bieu-mau-chuan.md             ← danh sách biểu mẫu theo TT 32/2023/TT-BYT
│   ├── icd-coding-rules.md           ← nguyên tắc mã hóa ICD-10 QĐ 4469
│   ├── phac-do-thuoc.md              ← phác đồ điều trị theo bệnh (BYT + quốc tế)
│   └── tai-lieu-tham-khao.md         ← danh mục tài liệu tham khảo mẫu (Vancouver)
└── scripts/
    ├── extract-pdf-text.py           ← trích xuất raw text từ PDF (dùng ở Bước 1)
    ├── docx-template.js              ← template Node.js với helper functions
    ├── complete-example.js           ← ví dụ hoàn chỉnh — clone và điền data thực
    └── test-audit-suppress.js        ← regression test: verify suppress rules

```

Đọc file tham chiếu khi cần thiết — không tải tất cả vào context cùng lúc.
