# PIPELINE.md — Tài liệu kỹ thuật Pipeline P4 HSBA Audit

> **⚠️ Lưu ý bảo trì:** File này phải được cập nhật mỗi khi có thay đổi code trong:
> - `scripts/extract-pdf-text.py` (Stage 1)
> - `scripts/complete-example.js` (Stage 3)
> - `audit-config.json` (cấu hình rules)
> - `SKILL.md` (workflow)
>
> Cập nhật lần cuối: **2026-06-12** — v3.7: (1) extract-pdf-text.py **v3.0** — table-aware (`text_table`), scan detection theo `image_area_ratio` (bắt trang scan-bằng v2.1 bỏ sót), chuẩn hoá khoa (`department_canonical`) + forward-fill, multi-label (`page_types_all`). (2) **Tầng Evidence Grounding** (`references/evidence-grounding.md`) giữa Stage 2–3. (3) complete-example.js render **B.0** + ghi `evidence_grounding`/`reasoning_boundary` vào JSON.

> Trước đó: v3.6 (2026-05-30) — OCR trang scan bằng Claude Vision; extract-pdf-text.py v2.1 thêm `--ocr-images-dir`; SKILL.md Stage 1b

---

## Kiến trúc tổng thể

```
PDF trên disk
     │
     ▼  [Stage 1] Python subprocess
extract-pdf-text.py  (pymupdf/fitz)
     │  → raw-pages.json  (0 token AI)
     │
     ▼  [Stage 2] Claude LLM reads JSON
Claude extraction + analysis  (in-context)
     │  → DATA{} object (JavaScript)
     │
     ▼  [Stage 3] Node.js subprocess
complete-example.js  (docx@9.x)
     │
     ├──► output/json/{id}.json       (v3.0-raw — raw data only, no AI fields)
     ├──► output/word/{id}.docx       (full AI analysis report)
     └──► output/tong-hop/master.json (upsert registry, sorted by ma_kcb)
```

Chi phí: Stage 1 tốn 0 token AI, chạy ~2–5 giây với PDF 50 trang.

---

## Stage 1 — PDF Extraction (`extract-pdf-text.py`)

### Runtime & thư viện

- **Python 3**, thư viện `pymupdf` (import `fitz`)
- Không cần AI — pure rule-based text extraction

### Luồng xử lý nội bộ

```python
fitz.open(pdf_path)
  └─ foreach page i in page_indices:
       text = page.get_text("text")              # layout=text mode
       if len(text) < 50:
           text = page.get_text("text",
               flags=fitz.TEXT_PRESERVE_WHITESPACE)  # fallback

       is_scan     = (char_count < 50)           # threshold 50 chars
       page_type   = classify_page(text)         # regex rule engine
       dept_hint   = detect_department(text)     # 2-tier detector
```

### Classifier 1 — Page type (priority scoring)

Mỗi trang được gán `page_type` theo rule đầu tiên match, với priority cao nhất thắng:

| page_type | Priority | Keywords mẫu |
|---|---|---|
| `admission_form` | 100 | `A[.-]\s*BENH AN`, `LY DO VAO VIEN`, `QUA TRINH BENH LY` |
| `discharge_summary` | 95 | `TONG KET BENH AN`, `PHUONG PHAP DIEU TRI` |
| `discharge_letter` | 90 | `GIAY RA VIEN`, `HINH THUC RA VIEN` |
| `medical_orders` | 80 | `TO DIEU TRI`, `Y LENH`, `PHIEU THUOC` |
| `clinical_course` | 75 | `DIEN BIEN BENH`, `PHIEU THEO DOI` |
| `nursing_notes` | 70 | `PHIEU CHAM SOC`, `DIEU DUONG` |
| `lab_result` | 65 | `PHIEU XET NGHIEM`, `HUYET HOC`, `HOA SINH` |
| `imaging` | 60 | `SIEU AM`, `X QUANG`, `DIEN TAM` |
| `surgical_record` | 55 | `BIEN BAN PHAU THUAT`, `PHIEU GAY ME` |
| `administrative` | 30 | `CAM KET`, `BHYT`, `BANG KE` |
| `scan_image` | — | char_count < 50 (trang scan không có text) |

Mỗi trang đều được lọc qua `_clean_text()` trước khi phân loại:

```python
def _clean_text(text: str) -> str:
    """Loại CJK/Kangxi artifact từ HIS font embedding (U+2E80–U+FAFF ranges).
    Giữ lại: ký tự Latin, tiếng Việt, ký tự y tế (µ, β, ≤, ≥, ², …)."""
    # → strip các dải U+2E80–U+2EFF, U+2F00–U+2FFF, U+3000–U+31EF,
    #           U+3400–U+4DBF, U+4E00–U+9FFF, U+F900–U+FAFF
```

**Nguyên nhân:** HIS Hải Phòng embed font CJK nội bộ để render giao diện; pymupdf giải mã codepoint thực → trang lab result / y lệnh có thể chứa hàng trăm ký tự Kangxi (⼭⼳帐帉) làm tăng `char_count` giả và gây nhầm `content_density`. Sau khi lọc, `char_count` phản ánh đúng nội dung tiếng Việt.

Matching dùng hàm `_nodiac()`: convert UTF-8 tiếng Việt → ASCII không dấu trước khi regex, tránh lỗi encoding:

```python
def _nodiac(text: str) -> str:
    text = text.upper()
    nfd = unicodedata.normalize("NFD", text)
    result = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    result = result.replace("Đ", "D").replace("đ", "D")
    return result
```

### Classifier 2 — Department detector (2 tầng)

**Tầng 1 (regex):** tìm pattern `KHOA[:\s]+([A-Z0-9 \-/]{3,50})` với noise filter set (`"NOI TRU"`, `"DIEU TRI"`, `"PHONG"`, v.v.)

**Tầng 2 (keyword fallback):** scan `DEPARTMENT_KEYWORDS[]` gồm 22 từ khoá (`"CAP CUU"`, `"HOI SUC"`, `"HSTC"`, `"NOI "`, `"TIM MACH"`, v.v.)

### Classifier 3 — BA type detection

Quét toàn bộ pages tìm pattern `MS[:\s]*(\d{2})/BV[-\s]*01`, tra `BA_TYPE_MAP[]` (20 entries: `01→noi_khoa`, `10→ngoai_khoa`, v.v.), default `"noi_khoa"`.

### Department timeline builder

Group consecutive pages theo `department_hint` thành segments:

```python
def build_department_timeline(pages) -> list:
    # → [{ department, first_page, last_page, page_indices[] }, ...]
```

### Output JSON structure (`schema_version: "raw-v2.0"`)

```json
{
  "schema_version": "raw-v2.0",
  "extracted_at": "2026-05-28T21:00:00",
  "source_file": "2600062416 TONG VAN QUANG.PDF",
  "total_pages": 51,
  "ba_type": "noi_khoa",
  "ma_bieu_mau": "01/BV-01",
  "pages": [
    {
      "page_num": 1,
      "char_count": 0,
      "is_scan": true,
      "page_type": "scan_image",
      "department_hint": null,
      "content_density": "scan",
      "extraction_quality": "scan_no_text",
      "ocr_attempted": false,
      "ocr_text": null,
      "text": "[SCAN -- khong co text]"
    },
    {
      "page_num": 36,
      "char_count": 1798,
      "is_scan": false,
      "page_type": "nursing_notes",
      "department_hint": "Khoa Cấp cứu - HSTC - CĐ",
      "content_density": "high",
      "extraction_quality": "good",
      "ocr_attempted": false,
      "ocr_text": null,
      "text": "MS: 36/BV2\nSỞ Y TẾ HẢI PHÒNG..."
    }
  ],
  "department_timeline": [
    { "department": "Cấp cứu – HSTC – CĐ", "first_page": 8, "last_page": 27, "page_indices": [8,9,...] }
  ],
  "page_type_summary": { "scan_image": 5, "lab_result": 10, "nursing_notes": 12, ... }
}
```

**B1 — `content_density` và `extraction_quality` thresholds:**

| `char_count` | `content_density` | `extraction_quality` |
|---|---|---|
| < 50 | `scan` | `scan_no_text` |
| 50–199 | `low` | `very_sparse` |
| 200–799 | `medium` | `sparse` |
| ≥ 800 | `high` | `good` |

**C1 — OCR scaffold:** `ocr_attempted: false`, `ocr_text: null` — kiến trúc mở để tích hợp OCR sau. Khi OCR được implement, `ocr_attempted` → `true` và `ocr_text` → text đã OCR (chỉ áp dụng cho các trang `is_scan: true` có `content_density: "scan"`).

> **Thực tế HSBA HIS Hải Phòng:** Trang 1–5 thường là output từ HIS render dạng image (0 chars dù không phải viết tay). `is_scan: true` → `extraction_quality: "scan_no_text"` → ứng viên tốt cho OCR khi implement. Trang đánh máy đầy đủ bắt đầu từ trang 6–8 trở đi.

### Cách chạy

```bash
python3 extract-pdf-text.py "<file.pdf>" --output /tmp/hsba_raw.json
# Hoặc range trang:
python3 extract-pdf-text.py "<file.pdf>" --pages 1-20 --output /tmp/hsba_raw.json
# Legacy flat text (debug):
python3 extract-pdf-text.py "<file.pdf>" --format txt --output /tmp/debug.txt
```

---

## Stage 2 — Claude LLM Extraction + Analysis

### Input

Toàn bộ raw-pages JSON được `cat` vào context của Claude.

### Phase 2A — Extraction (facts only)

Claude filter `pages[]` theo `page_type` và `department_hint` để lấy đúng nội dung:

```
pages[page_type == "admission_form"]    → admission_workup.raw_text  (copy verbatim)
pages[page_type == "discharge_*"]       → discharge_summary.raw_text (copy verbatim)
pages[page_type == "lab_result"]        → lab_results[] per department
pages[page_type == "clinical_course"]   → clinical_course_raw per department
pages[page_type == "medical_orders"]    → medications[] per department
pages[page_type == "imaging"]           → imaging_results[]
```

Tất cả text phải được copy **nguyên văn** — không tóm tắt, không dùng `"..."`. Kiểm tra: `raw_text` phải dài > 300 ký tự và chứa từ đặc trưng của biểu mẫu.

### Phase 2B — Clinical Analysis (AI reasoning)

Chạy sau khi đã có đủ raw data. Kết quả chỉ dùng cho DOCX, **không ghi vào JSON**:

```
ICD validation:
  icd_codes_in_record[] (factual)
  → đối chiếu QĐ 4469/QĐ-BYT Rule 1–4
  → icd_canh_bao[], icd_chi_tiet[], icd_summary{}  [DOCX only]

Diagnostic criteria:
  admission_workup.chan_doan + lab_results + imaging_results
  → tieu_chi_uap[], tieu_chi_kali[]                [DOCX only]
  4 mức: Xác nhận / Có căn cứ một phần / Chưa đủ bằng chứng / Mâu thuẫn

Treatment adequacy:
  medications[] vs phac-do-thuoc.md
  → dieu_tri_kali[]                                [DOCX only]

CLS coverage:
  labs_ordered[] vs tiêu chuẩn ESC/BYT
  → cls_du[], cls_thieu[], cls_khong_chi_dinh[]    [DOCX only]

Timeline audit:
  timeline_raw[] (factual events) → ghi vào JSON
  timeline[] với nhan_xet (AI commentary) → DOCX only

Verdict assembly:
  tam_cau_hoi[] (8 câu), ket_luan{}, khuyen_nghi[] [DOCX only]
```

### Audit Config filter (áp dụng sau khi DATA{} được điền) — v3.5

Đọc `audit-config.json` (v1.3) → lọc `thieu_sot[]` theo `suppress_type × cause` → suppress hoàn toàn `bieu_mau[]` theo `canonical_id`:

```javascript
// IIFE applyAuditConfig() trong complete-example.js
cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'audit-config.json')))
activeRules = cfg.ignore_rules.filter(r => r.enabled !== false)

// 1. Lọc thieu_sot — keyword match VÀ cause khớp suppress_type
DATA.thieu_sot = DATA.thieu_sot.filter(ts =>
    !activeRules.some(r => {
        if (!r.thieu_sot_keyword || !ts.noi_dung) return false
        const match = ts.noi_dung.includes(r.thieu_sot_keyword)
        if (!match) return false
        return !r.suppress_type || ts.cause === r.suppress_type
    })
)

// 2. Suppress bieu_mau theo canonical_id (KHÔNG dùng keyword fuzzy, KHÔNG dùng stt)
//    DATA.bieu_mau là FLAT ARRAY — xử lý trực tiếp, không phải .chi_tiet
DATA.bieu_mau = DATA.bieu_mau.map(item => {
    if (!item.canonical_id || item.icon === '❌') return item
    const rule = activeRules.find(r =>
        (r.suppresses_canonical_ids || []).includes(item.canonical_id)
    )
    if (!rule) return item
    // Strip nội dung liên quan khỏi ket_qua, đổi icon → ✅
    // (regex tìm keyword → xóa đến dấu '.')
    let cleaned = stripKeyword(item.ket_qua, rule.thieu_sot_keyword)
    return { ...item, icon: '✅', ket_qua: cleaned || 'Đạt.' }
})

// 3. Ghi lại vào DATA._suppressed_rules[] → xuất vào JSON và DOCX
```

**Schema `audit-config.json` v1.3:**

| Field | Ý nghĩa |
|---|---|
| `suppresses_canonical_ids[]` | canonical_id của bieu_mau items cần suppress (chính xác, không fuzzy) |
| `thieu_sot_keyword` | Chuỗi khớp trong `thieu_sot[].noi_dung` để lọc, và text cần strip khỏi `bieu_mau[].ket_qua` |
| `suppress_type` | Phải khớp `thieu_sot[].cause`; `null` = suppress mọi cause |
| `enabled` | `false` → rule không có hiệu lực, không suppress gì |

**Regression test:** `scripts/test-audit-suppress.js` — chạy `node scripts/test-audit-suppress.js`, 14/14 PASS xác nhận suppress đúng.

**`cause` values trong `thieu_sot[]`:**

| cause | Ý nghĩa |
|---|---|
| `missing_field` | Trường bắt buộc thực sự bị bỏ trống — không có lý do ngoại lệ |
| `policy_exception` | Quy định nội bộ TTYT không yêu cầu điền trường này |
| `form_not_applicable` | Biểu mẫu tại TTYT không có trường này |
| `scan_unreadable` | Không đọc được do scan chất lượng thấp |

**`suppress_type` trong `audit-config.json`:** Phải khớp `cause` của thiếu sót để rule có hiệu lực. `null` = bỏ qua bất kể cause.

---

## Stage 3 — Document Generation (`complete-example.js`)

### Runtime & thư viện

- **Node.js**, thư viện `docx@9.x`
- `const fs = require('fs')`, `const path = require('path')`

### Helper layer (pure functions)

```javascript
txt(text, opts)          → TextRun
para(children, opts)     → Paragraph
cell(children, w, opts)  → TableCell
tbl(headers, rows, colW, opts)  → Table  // generic table builder
h1/h2/h3(text)           → Heading paragraphs
sectionBanner(text)      → full-width colored banner Table
guidelineBox(lines)      → blue-tinted reference box
noticeBox(lines, fill)   → colored notice (green/amber/red)
spacer(n)                → n empty Paragraphs
```

### Document assembly

```javascript
new Document({
  styles: { ... },
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 } },   // A4 in twips
      margin: { top: 720, bottom: 720, left: 1701, right: 851 }  // NĐ 30/2020
    },
    headers: { default: headerWithPageNum() },
    children: [
      coverTable(),                // bảng thông tin hành chính
      sectionBanner("PHẦN A"),
      h1("A.1  Kiểm tra đủ biểu mẫu"),
      buildBieuMauTable(),         // DATA.bieu_mau[] (đã áp dụng audit-config)
      thieuSotTable(),             // DATA.thieu_sot[] (đã lọc)
      suppressedRulesTable(),      // DATA._suppressed_rules[] nếu có
      h1("A.2  Kiểm tra Trình tự Thời gian"),
      buildTimelineTable(),        // DATA.timeline[]
      h1("A.3  Cảnh báo ICD sơ bộ"),
      buildIcdCanhBaoTable(),      // DATA.icd_canh_bao[]
      sectionBanner("PHẦN B"),
      // B.1 Đánh giá chẩn đoán, B.2 Điều trị, B.3 CLS, B.4 Diễn biến, B.5 ICD chi tiết
      buildSummaryTable(),         // DATA.tam_cau_hoi[] (8 câu hỏi)
      buildRecommendations(),      // DATA.khuyen_nghi[]
      buildReferences(),           // DATA.tai_lieu[] → Vancouver
    ]
  }]
})
```

### Page dimension constants

```javascript
PAGE_W  = 11906   // twips (A4 width = 210mm)
MARGIN  = 1134    // twips (~2cm)
CONT_W  = PAGE_W - MARGIN * 2   // = 9638 twips — content width cho tất cả Table
```

### Hệ màu chuẩn

```javascript
const C = {
  navy:   "1F3864",  blue:   "2E75B6",  dblue:  "1A5276",
  lblue:  "D6E4F0",  lblue2: "EBF5FB",
  green:  "1E7145",  lgreen: "E2EFDA",
  amber:  "C55A11",  lamber: "FEF9E7",
  red:    "C00000",  lred:   "FCECEA",
  gray:   "595959",  lgray:  "F2F2F2",
  white:  "FFFFFF",  black:  "000000",
}
```

| Màu fill | Ý nghĩa |
|---|---|
| `E2EFDA` (lgreen) | Đạt / Phù hợp |
| `FEF9E7` (lamber) | Cần chú ý / Một phần |
| `FCECEA` (lred) | Sai sót / Không phù hợp |
| `EBF5FB` (lblue2) | Guideline box / Hướng dẫn |
| `F2F2F2` (lgray) | Thông tin trung tính / Suppressed rules |

### Output serialization

```javascript
Packer.toBuffer(doc).then(buf => {
    // 1. DOCX binary
    fs.writeFileSync(DOCX_PATH, buf)

    // 2. Raw JSON (rawJsonData — chỉ chứa raw/factual fields)
    fs.writeFileSync(JSON_PATH, JSON.stringify(rawJsonData, null, 2), 'utf8')

    // 3. Master registry upsert theo ma_kcb
    var master = JSON.parse(fs.readFileSync(MASTER_PATH)) || { records: [] }
    var idx = master.records.findIndex(r => r.ma_kcb === masterRecord.ma_kcb)
    if (idx >= 0) master.records[idx] = masterRecord
    else master.records.push(masterRecord)
    master.records.sort((a, b) => a.ma_kcb.localeCompare(b.ma_kcb))
    fs.writeFileSync(MASTER_PATH, JSON.stringify(master, null, 2), 'utf8')
})
```

---

## Separation Principle — JSON vs DOCX

Đây là nguyên tắc thiết kế quan trọng nhất của v3.0:

| Loại dữ liệu | Ghi JSON | Ghi DOCX | Lý do |
|---|---|---|---|
| `raw_text`, `lab_results`, `timeline_raw` | ✅ | ✅ | Factual — AI sau đọc được không bị ảnh hưởng |
| `icd_codes_in_record` | ✅ | ✅ | Mã ghi trong hồ sơ — khách quan |
| `bieu_mau.chi_tiet`, `thieu_sot` | ✅ | ✅ | Checklist khách quan (đã lọc theo audit-config) |
| `evidence_map`, `coverage_audit` | ✅ | ✅ | Metadata truy vết nguồn + trạng thái extraction |
| `audit_config.suppressed_rules` | ✅ | ✅ | Config metadata — AI sau cần biết |
| `icd_canh_bao`, `icd_chi_tiet`, `icd_summary` | ❌ | ✅ | AI evaluation — có thể sai, không persist |
| `tieu_chi_uap`, `phat_hien_phu` | ❌ | ✅ | AI reasoning — 1-time use |
| `ket_luan`, `khuyen_nghi`, `tam_cau_hoi` | ❌ | ✅ | Conclusions dễ outdated |
| `timeline[].nhan_xet` (AI commentary) | ❌ | ✅ | Suy luận từ timeline_raw |

**Lý do kỹ thuật:** Nếu AI tiếp theo đọc JSON có `"danh_gia_icd: SAI"`, nó bị anchored vào kết luận cũ và mất tính độc lập phân tích. JSON v3.0-raw chỉ chứa numbers và verbatim text — AI tiếp theo tự suy luận lại từ đầu.

---

## rawJsonData Schema (v3.0-raw)

11 top-level keys, không có AI analysis fields:

```json
{
  "schema_version": "v3.0-raw",
  "lineage": { "workflow", "extracted_at", "source_file", "json_path", "docx_path" },
  "meta": { "ma_bn", "ho_ten", "gioi", "nam_sinh", "bao_hiem", "khoa_phong", ... },
  "admission_workup": { "source_page", "raw_text", "ly_do_vao_vien", "chan_doan_vao_khoa", ... },
  "discharge_summary": { "source_page", "raw_text", "chan_doan_ra_vien", ... },
  "department_stays": [ { "department", "clinical_course_raw", "lab_results", "medications", ... } ],
  "timeline_raw": [ { "datetime", "event", "event_type", "source_page" } ],
  "icd_codes_in_record": [ { "ma", "ten_ghi_trong_ho_so", "vi_tri", "source_page" } ],
  "icd": { "ma_chinh": {"code","ten","status:valid|loi"}, "ma_kem_theo":[...],
           "tong_ma", "ma_hop_le", "ma_loi",
           "loi_chi_tiet":[ {"code","loai_loi:thieu_ky_tu|sai_ten|khong_ton_tai|khong_dac_hieu|thieu_ma_kem","mo_ta","muc_do:cao|trung binh|thap"} ] },
  // ↑ structured ICD quality summary (đếm số, KHÁC icd_summary prose ở DOCX) — dùng cho tong-hop §II-bis. null nếu chưa phân tích.
  "bieu_mau": { "tong", "dat", "can_bo_sung", "thieu", "chi_tiet", "thieu_sot" },
  "evidence_map": [ { "field", "value", "source_page", "source_text",
                       "confidence": { "level": "high|medium|low", "reason": "..." },
                       "source_method": "direct_text|his_parsed|synthesized|inferred" } ],
  "coverage_audit": { "departments_found": [...], "per_department": [
                        { "department", "expected_groups", "missing", "cause", "needs_retry" }
                      ], "scan_pages_not_processed": [], "overall_completeness_pct", "ready_for_analysis" },
  "audit_config": { "version", "hospital", "suppressed_rules": [
                      { "id", "description", "reason", "suppress_type" }
                    ] }
}
```

---

## audit-config.json — Cấu hình rules bỏ qua

File: `hsba-audit-skill/audit-config.json` (version hiện tại: 1.1)

```json
{
  "version": "1.1",
  "hospital": "Trung tâm Y tế Thủy Nguyên",
  "ignore_rules": [
    {
      "id": "trang_bia_ra_vien",
      "enabled": true,
      "description": "Trường 'Ra viện' bỏ trống trên trang bìa",
      "reason": "TTYT không yêu cầu điền trường này",
      "suppress_type": "policy_exception",
      "thieu_sot_keyword": "Ra viện\" bỏ trống trên trang bìa",
      "bieu_mau_stt": "1"
    }
  ]
}
```

**Thêm rule mới:** thêm object vào `ignore_rules[]` với đủ 6 trường (bao gồm `suppress_type`).

**Tắt tạm 1 rule:** đặt `"enabled": false`.

**Matching logic (v1.1):**
- `thieu_sot_keyword` → substring match trong `DATA.thieu_sot[].noi_dung`
- `suppress_type` → phải khớp `DATA.thieu_sot[].cause` (nếu null → match tất cả)
- `bieu_mau_stt` → exact match `DATA.bieu_mau[].stt` (icon phải là `⚠️` để được nâng cấp)

---

## File output và Naming Convention

```
output/
├── json/{ma_bn} - {TEN_KHONG_DAU}.json       # cá nhân, v3.0-raw
├── word/{ma_bn} - {TEN_KHONG_DAU}.docx       # báo cáo đầy đủ
└── tong-hop/master.json                       # registry tổng hợp
```

`FILE_STEM = DATA.ma_bn + " - " + DATA.ten_khong_dau`

Ví dụ: `2600062416 - TONG VAN QUANG`

**master.json** chứa các trường thống kê nhanh (không cần đọc full JSON):
`bm_tong`, `bm_dat`, `bm_can_bo_sung`, `bm_thieu`, `kn_cao_n`, `trang_thai_danh_gia`, v.v.

---

## Cấu trúc thư mục

```
KHTH - P4 HSBA/
├── CLAUDE.md                              ← project config chính
├── input/                                 ← PDF chờ xử lý
├── processed/                             ← PDF đã xử lý (move sang đây sau khi confirm)
├── output/
│   ├── json/                              ← rawJsonData v3.0-raw
│   ├── word/                              ← báo cáo DOCX
│   └── tong-hop/master.json              ← registry tổng hợp
└── knowledge/
    └── hsba-audit-skill/
        ├── SKILL.md                       ← workflow hướng dẫn cho Claude
        ├── PIPELINE.md                    ← file này — tài liệu kỹ thuật
        ├── audit-config.json             ← cấu hình rules bỏ qua của TTYT
        ├── references/
        │   ├── bieu-mau-chuan.md
        │   ├── icd-coding-rules.md
        │   ├── phac-do-thuoc.md
        │   └── tai-lieu-tham-khao.md
        └── scripts/
            ├── extract-pdf-text.py        ← Stage 1: PDF → JSON
            ├── complete-example.js        ← Stage 3: DATA{} → DOCX + JSON
            └── run-{ma_bn}.js             ← instance script cho từng HSBA
```

---

## Changelog

| Ngày | Version | Thay đổi |
|---|---|---|
| 2026-06-14 | v4.2 | **Chất lượng DOCX (so với bản backup):** phát hiện CLI tự chế script docx rút gọn (1 bảng) thay vì dùng complete-example.js (13 bảng). Sửa: (1) thêm `DATA.bang_xet_nghiem[]` → bảng kết quả XN giá trị thô (B.3) + `DATA.dien_bien_lam_sang[]` → bảng diễn biến **data-driven** (B.4 hết hard-code). (2) `autoReferences()` tự sinh `tai_lieu[]` từ `evidence_grounding[]` khi để trống → luôn có danh mục TLTK. (3) PROMPTS-CLI Prompt C: BẮT BUỘC clone complete-example.js, điền đủ bảng + khuyến nghị CỤ THỂ có căn cứ ("theo [n], nên dùng thuốc X liều Y"); kiểm DOCX ≥8 bảng. grounding-cache +6 khái niệm (HBV mạn, sepsis, sốc NK, gút, suy thận cấp/mạn — verified PubMed). |
| 2026-06-13 | v4.1 | **B.2 mở rộng — Đánh giá Điều trị & Dược lâm sàng:** `references/treatment-pharmacy-review.md` (5 lớp: B.2.1 phù hợp chỉ định, B.2.2 dược lâm sàng 6 trục/thuốc — liều/chỉnh thận-gan/CCĐ/tương tác/trùng lặp/theo dõi, B.2.3 đáp ứng theo thời gian, B.2.4 thay đổi chẩn đoán+CLS bổ sung, B.2.5 thiếu/dư). complete-example.js: DATA thêm `dieu_tri_danh_gia[]`, `tuong_tac_thuoc[]`, `dap_ung_dieu_tri[]`, `thay_doi_chan_doan[]`, `dieu_tri_tomtat` + helper render (`buildB2Extended`) chèn vào B.2; render-nếu-có-dữ-liệu (backward-compat); các field analysis này CHỈ ở DOCX (giữ separation). SKILL.md Bước 3.2 viết lại + grounding thuốc (Dược thư VN/phác đồ/ChEMBL bổ trợ). Test node --check + stub-run OK. |
| 2026-06-13 | v4.0 | **Chuẩn hoá schema JSON = v4.0-backbone (clean):** `complete-example.js` xuất `meta` GIÀU (ma_kcb + so_ho_so/bhyt/cccd/phong/giuong/bac_si_dieu_tri/truong_khoa/co_so; giữ ma_bn làm alias), `schema_version:"v4.0-backbone"`, NHƯNG **giữ separation** — KHÔNG nhét `section_b`/mảng trùng (`lab_results`/`icd_codes`/`bang_kiem` flat) vào JSON như bản v4.0-backbone cũ. Quyết định: bản cũ vi phạm separation + trùng lặp + chứa PII không kiểm soát → chỉ giữ phần meta giàu. `aggregate-stats.py` đã dung nạp mọi thế hệ. **`run-batch.sh`** (prepare/finalize): backup → clear json/word/tong-hop + reset master (GIỮ ocr-cache+grounding-cache) → parse 18 PDF + in token metrics (rawKB vs digestKB, ocr_todo) → finalize aggregate-stats. Chạy trên máy có pymupdf+docx. |
| 2026-06-12 | v3.9 | **Token optimization (3 công cụ):** (1) `extract-pdf-text.py --digest --from-json` → digest text gọn theo khoa, dùng `text_table` thay `text`, bỏ trang rỗng/hành chính/chưa-OCR → còn ~7% so với `cat` raw JSON (SKILL Stage 1d). (2) `grounding-cache.py` (get/put/list, key = khái niệm chuẩn hoá không dấu) → citation đã verify dùng chung toàn trung tâm, bệnh hay gặp chỉ tốn token grounding 1 lần; chỉ cache citation `verified:true`. (3) `aggregate-stats.py --json-dir --out` → `_stats.json` đọc CHỈ field thống kê (dung nạp schema v2.0/v3.0/v3.0-raw/v4.0-backbone), tổng hợp đọc 1 file ≈7% thay 18 JSON đầy đủ. SKILL §3.5b token discipline + subagent cho batch. Tất cả đã unit-test + chạy thật trên 18 JSON. |
| 2026-06-12 | v3.8 | **Stage 1 v3.1 — OCR cache + gán khoa theo ngày:** (a) `--ocr-cache <file>`: hash pixmap (md5 samples) làm khóa; **CACHE HIT** → điền `ocr_text` thẳng, KHÔNG render PNG, KHÔNG OCR lại → tăng tốc re-run mạnh. Output thêm `ocr_todo[]` (chỉ trang MISS) + `ocr_cache_stats`. `--update-cache --from-json` ghi ngược OCR Claude vừa làm vào cache. (b) `extract_dates()` → `dates_found[]` mỗi trang + `department_date_ranges[]` (start/end mỗi khoa từ trang lâm sàng) + `department_method` (explicit\|forward_filled\|unknown) → **gán phiếu XN/y lệnh/CĐHA đúng khoa theo NGÀY** khi BN nằm nhiều khoa (HIS hay gom phiếu XN về cuối hồ sơ). schema → `raw-v3.1`. SKILL.md §1.5b + Stage 1b/1c (todo + write-back). complete-example.js `buildDeptCoverageNote()` cảnh báo khoa thiếu CLS/điều trị. Đã unit-test 11/11 + end-to-end. |
| 2026-06-12 | v3.7 | **Stage 1 v3.0:** `extract-pdf-text.py` thêm — (a) **table-aware** `text_table` cho trang `lab_result`/`medical_orders` (tái tạo bảng theo toạ độ y/x → giá trị XN không dính dòng); (b) **scan detection thông minh**: ngoài ngưỡng `<50` ký tự, thêm `image_area_ratio` — trang `<200` ký tự + ảnh phủ ≥60% → render PNG OCR (bắt trang scan-bảng v2.1 bỏ sót); (c) `department_canonical` (map 20 khoa chuẩn) + **forward-fill** (mọi trang gắn khoa) + `departments_canonical[]`; (d) **multi-label** `page_types_all[]`; (e) `scan_summary`. schema_version → `raw-v3.0`. Backward-compat: giữ mọi key cũ. |
| 2026-06-12 | v3.7 | **Evidence Grounding layer:** `references/evidence-grounding.md` — quy trình G1–G5 truy xuất bằng chứng ẩn danh theo thang nguồn (kho nội bộ → BYT/thuvienphapluat → hiệp hội + PubMed/Consensus → ICD), verify citation qua scholar-sidekick (chống hallucinate). Phát hiện quan trọng: **ICD MCP là ICD-10-CM (Mỹ) ≠ ICD-10 WHO/BYT** (Z03.4, R07.3 not-found ở CM) → canonical là `icd10_lookup.json` BYT. |
| 2026-06-12 | v3.7 | **Stage 3:** `complete-example.js` thêm `DATA.evidence_grounding[]` + `DATA.reasoning_boundary{}`; helper `reasoningBoundaryBox()` + `buildEvidenceGroundingTable()`; render **B.0 — Cơ sở Bằng chứng Đối chiếu** đầu Phần B; ghi `evidence_grounding`+`reasoning_boundary` vào `rawJsonData` (factual đã verify → hợp separation). `confidence_cap` có thể đạt `supported`. |
| 2026-05-30 | v3.5 | **Canonical field IDs:** Mỗi `bieu_mau` item có `canonical_id` (e.g. `MS_12_BV02`, `MS_01_BV_01_BA`) — lookup table 25 entries trong SKILL.md. `applyAuditConfig()` dùng `suppresses_canonical_ids[]` thay keyword fuzzy — chính xác, không false-positive |
| 2026-05-30 | v3.5 | **Suppress hoàn toàn:** `applyAuditConfig()` viết lại — xử lý `DATA.bieu_mau` (flat array, không phải `.chi_tiet`); strip text liên quan bằng `thieu_sot_keyword`; icon ⚠️ → ✅; không để lại annotation "[Không kiểm tra:]" |
| 2026-05-30 | v3.5 | **Source-of-truth principle:** SKILL.md cập nhật — `admission_workup`/`discharge_summary` populated → form present; scan page + empty text → `⚠️ "present (scan)"`; chỉ ❌ khi THỰC SỰ không có; `coverage_audit` chỉ đo extraction quality |
| 2026-05-30 | v3.5 | **Regression test:** `scripts/test-audit-suppress.js` — 4 test suites, 14 assertions, 14/14 PASS; verify: disable ECG → không còn "cân nặng" trong bieu_mau output; variant keyword "/" vs "và" đều xử lý đúng |
| 2026-05-30 | v3.4 | **ECG suppress (broken):** Đã thay thế bằng v3.5 — code v3.4 có bug: xử lý `DATA.bieu_mau.chi_tiet` thay vì flat array, không hoạt động trong thực tế |
| 2026-05-30 | v3.4 | **Scan page biểu mẫu (partial):** Đã thay thế bằng v3.5 — logic source-of-truth được định nghĩa rõ hơn |
| 2026-05-30 | v3.3 | **Deduplication check:** Thêm Bước 0 vào SKILL.md — đọc master.json trước khi bắt đầu, hỏi user nếu ma_kcb đã tồn tại, xóa sạch output cũ (json + raw.json + docx + master record) nếu xác nhận phân tích lại |
| 2026-05-29 | v3.2 | **CJK fix:** Thêm `_clean_text()` vào `extract-pdf-text.py` — lọc bỏ CJK/Kangxi artifacts (U+2E80–U+2FFF, U+3000–U+31EF, U+3400–U+4DBF, U+4E00–U+9FFF, U+F900–U+FAFF) từ HIS font embedding; giữ nguyên ký tự y tế hợp lệ (µ, β, ≤, ≥, ², …) |
| 2026-05-29 | v3.2 | **BASE_OUT fix:** `complete-example.js` thay BASE_OUT hardcode bằng auto-detect IIFE (macOS path → bash sandbox `/sessions/*/mnt/KHTH/...` → fallback); SKILL.md thêm cảnh báo chống nested folder |
| 2026-05-29 | v3.2 | **Folder consolidation:** Di chuyển toàn bộ output TRAN HUU LUU từ nested `KHTH - P4 HSBA/KHTH - P4 HSBA/output/` → `KHTH - P4 HSBA/output/` (nguồn duy nhất) |
| 2026-05-28 | v3.1 | **A1:** Thay `analysis_readiness` bằng `coverage_audit` (per-department checklist + scan_pages_not_processed) |
| 2026-06-12 | v3.4 | **ICD aggregate:** Thêm `DATA.icd` (structured: tong_ma/ma_hop_le/ma_loi/loi_chi_tiet) + `rawJsonData.icd` (= `DATA.icd \|\| null`). KHÁC `icd_summary` (prose, chỉ DOCX). Cho phép tong-hop-skill §II-bis tổng hợp chất lượng mã ICD toàn trung tâm. Additive — không đổi field cũ. |
| 2026-05-28 | v3.1 | **A2:** Thêm `suppress_type` vào audit-config.json rules; thêm `cause` vào `thieu_sot[]`; enforce cause×suppress_type matching trong `applyAuditConfig()` |
| 2026-05-28 | v3.1 | **A3:** Thêm `confidence: {level, reason}` object + `source_method` vào mỗi `evidence_map[]` entry |
| 2026-05-28 | v3.1 | **B1:** Thêm `content_density` + `extraction_quality` per page trong `extract-pdf-text.py` |
| 2026-05-28 | v3.1 | **C1:** Thêm `ocr_attempted: false` + `ocr_text: null` scaffold per page (không implement OCR, chỉ mở kiến trúc) |
| 2026-05-28 | v3.0 | Tạo file PIPELINE.md lần đầu; bổ sung audit-config.json (ignore rules); separation principle JSON vs DOCX hoàn chỉnh |
| 2026-05-28 | v3.0 | rawJsonData thêm key `audit_config.suppressed_rules`; DOCX thêm section "Quy tắc bỏ qua theo cấu hình TTYT" |
| 2026-05-25 | v3.0 | Tách rawJsonData: JSON chỉ còn raw/factual fields; AI analysis fields chỉ trong DOCX |
| 2026-05-20 | v2.0 | Thêm `department_stays`, `evidence_map`, `timeline_raw`, `icd_codes_in_record` |
| 2026-05-15 | v1.0 | Pipeline ban đầu: extract-pdf-text.py + complete-example.js |
