# CLAUDE.md — Build app phân tích HSBA (EMR Analyzer)

> File này cung cấp **bối cảnh** cho Claude CLI khi build app phân tích Hồ sơ bệnh án (HSBA).
> Đọc kỹ trước khi viết bất kỳ dòng code nào. Nguồn gốc: hệ thống KHTH P4 (Bệnh viện Đa khoa / TTYT Thủy Nguyên, Hải Phòng).

---

## 0. MỤC TIÊU

Xây dựng **một ứng dụng** thực hiện công việc phân tích HSBA mà hiện đang được làm **thủ công qua prompt + script rời rạc** trong hệ thống KHTH P4.

Hiện trạng (cái app sẽ thay thế / đóng gói lại):
- Quy trình chạy bằng cách **dán prompt vào Claude CLI** (`PROMPTS-CLI.md`), kết hợp script Python + Node.
- Có 2 "bộ não" phối hợp: **Claude CLI** (máy local, có thư viện) và **Cowork** (Claude Desktop app, có MCP nghiên cứu).
- Output mỗi HSBA = 1 báo cáo DOCX (Section A kiểm biểu mẫu + Section B nhận định lâm sàng) + 1 JSON backbone + cập nhật master.json.

Mục đích file này: để Claude CLI **hiểu chính xác luồng đang chạy** — phần nào do CLI làm (có thể tự động hóa vào app), phần nào do Cowork làm (cần MCP/LLM mạnh) — từ đó thiết kế app đúng ranh giới.

---

## 1. NGUYÊN TẮC SỐ 1 — BẢO TOÀN THÔNG TIN

> **`raw_text` = TEXT NGUYÊN VĂN từ trang PDF. KHÔNG tóm tắt, KHÔNG cắt, KHÔNG thay bằng "...".**

Đây là ràng buộc cứng xuyên suốt mọi stage. JSON backbone phải chứa đủ raw_text để **tái dựng lại nội dung HSBA** mà không cần mở lại PDF. App phải giữ nguyên tắc này: mọi field raw (`admission_workup.raw_text`, `discharge_summary.raw_text`, `clinical_course_raw` từng khoa) là toàn văn.

---

## 2. RÀNG BUỘC BẢO MẬT (PHI — Protected Health Information)

HSBA chứa thông tin định danh bệnh nhân nhạy cảm. App **PHẢI** tuân thủ:

| Quy tắc | Chi tiết |
|---|---|
| **PHI chỉ ở local** | Raw HSBA (PDF, raw_text, tên/địa chỉ/chẩn đoán BN) **chỉ xử lý local** — KHÔNG gửi ra web/cloud/MCP external. |
| **Chỉ khái niệm ẩn danh ra ngoài** | Khi cần grounding (tra cứu phác đồ/guideline), chỉ gửi **tên bệnh / mã ICD ẩn danh** ra MCP/web — không kèm thông tin BN. |
| **Không lưu định danh vào memory** | Không ghi tên/địa chỉ/mã BHYT bệnh nhân vào file memory dài hạn. |
| **Không cat cả raw JSON** | Khi verify, chỉ đọc field cần thiết — tránh dump toàn bộ PHI ra log/terminal. |

---

## 3. KIẾN TRÚC 2 RUNTIME — AI LÀM GÌ

App phải hiểu **ranh giới phân công** giữa hai bên. Đây là điểm cốt lõi.

| Năng lực | **Claude CLI (local)** | **Cowork (Desktop app)** |
|---|---|---|
| pymupdf / OCR / python-docx / Node | ✅ có sẵn | ❌ sandbox chặn |
| Khối lượng lớn, chạy script | ✅ nhanh, deterministic | 🟡 chậm, tốn token |
| MCP nghiên cứu (PubMed, scholar-sidekick, ICD, version-graph, Consensus) | ❌ chưa cấu hình | ✅ đầy đủ |
| Chất lượng văn Section B | 🟡 tốt | ✅ tốt nhất (Opus) |

### Phần do CLI làm (xác định + nặng + cần thư viện) — **APP NÊN TỰ ĐỘNG HÓA PHẦN NÀY**
- Parse PDF → raw text + OCR trang scan (Stage 1).
- Phân loại trang, dựng cấu trúc theo khoa, gắn CLS/điều trị theo ngày.
- Tra **grounding-cache** (chỉ ĐỌC file cache đã verify, 0 MCP).
- Sinh DOCX + JSON + master.json từ DATA (Stage 3).
- Tổng hợp nhiều HSBA (aggregate stats).

### Phần do Cowork làm (cần MCP + trí tuệ tái dùng) — **APP KHÔNG TỰ LÀM ĐƯỢC NẾU KHÔNG CÓ MCP**
- Dựng **grounding-cache** cho các khái niệm bệnh: tra version-graph → web BYT (kiểm hiệu lực) → PubMed/Consensus/hiệp hội → **verify citation** (scholar-sidekick) → đối chiếu ICD BYT.
- Mỗi khái niệm ground **một lần** → ghi vào `grounding-cache.json` → CLI tái dùng cho mọi HSBA.
- (Tùy chọn) Viết lại Section B chất lượng cao cho hồ sơ điển hình.

> **Cơ chế phối hợp:** Hai runtime KHÔNG gọi trực tiếp nhau. Chỉ chia sẻ qua **thư mục dự án** (file bus): CLI đẩy danh sách khái niệm cần ground → Cowork ground → ghi cache → CLI đọc cache. Chi tiết: `reference-docs/COWORK-CLI-COORDINATION.md` và `reference-docs/ORCHESTRATION.md`.

---

## 4. PIPELINE 3 STAGE (luồng chuẩn — Prompt C)

```
┌─ Stage 1 (CLI/Python) ─────────────────────────────────────┐
│ extract-pdf-text.py: PDF → raw JSON                         │
│   • pymupdf đọc text-selectable                             │
│   • trang scan → ocr_todo → OCR (PaddleOCR) → ocr_text      │
│   • output: raw.json (toàn văn) + digest.txt (gọn cấu trúc) │
│   • ocr-cache/<ma_kcb>.json giữ giữa các lần chạy           │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ Stage 2 (LLM reasoning — phần DUY NHẤT cần suy luận) ──────┐
│ Claude đọc raw_text toàn văn + digest → phân tích:          │
│   A. Kiểm biểu mẫu (TT 32/2023) — đạt/thiếu/cần bổ sung     │
│   B. Nhận định lâm sàng (Section B):                        │
│      B.1 chẩn đoán   B.2 điều trị & dược lâm sàng           │
│      B.3 CLS đủ/thiếu B.5 mã ICD (QĐ 4469)                  │
│   • Grounding: grounding-cache.py get (chỉ đọc cache)       │
│       HIT  → confidence_cap="supported" + citation [n]      │
│       MISS → confidence_cap="partially_supported" + cờ      │
│   • Mỗi nhận định B gắn [n] khớp tai_lieu/evidence_grounding│
│   → viết FILE DATA: /tmp/data-<ma_kcb>.js                   │
└────────────────────────────────────────────────────────────┘
                          ↓
┌─ Stage 3 (CLI/Node) ───────────────────────────────────────┐
│ render-report.js /tmp/data-<ma_kcb>.js                     │
│   • CỐ ĐỊNH — KHÔNG viết lại renderer (2000 dòng)           │
│   • DATA{} → DOCX (~44 bảng) + JSON backbone + master.json  │
│   • Naming: output/word/{ma_kcb} - {TEN_KHONG_DAU}.docx     │
└────────────────────────────────────────────────────────────┘
```

### Các prompt khác (do CLI thực thi)
| Prompt | Vai trò | File |
|---|---|---|
| **A** | Chuẩn bị: backup → parse toàn bộ PDF → sweep grounding → liệt kê khái niệm thiếu | `reference-docs/PROMPTS-CLI.md` |
| **B** | (Cowork) dựng grounding-cache cho list khái niệm | `reference-docs/COWORK-CLI-COORDINATION.md` |
| **C** | Phân tích đợt 3–5 HSBA (luồng 3 stage ở trên) | `reference-docs/PROMPTS-CLI.md` |
| **E** | Tổng hợp: aggregate stats → DOCX tổng hợp nhiều HSBA | `reference-docs/PROMPTS-CLI.md` |

---

## 5. SEPARATION PRINCIPLE — JSON vs DOCX

Điểm thiết kế quan trọng app phải giữ:

| Loại dữ liệu | Vào JSON backbone? | Vào DOCX? |
|---|---|---|
| **Factual** (raw_text, lab_results, bieu_mau, timeline_raw, icd_codes_in_record, evidence_grounding, coverage_audit) | ✅ CÓ | ✅ CÓ |
| **Suy luận AI** (icd_canh_bao, khuyen_nghi, tam_cau_hoi, dieu_tri_danh_gia, cls_du/thieu) | ❌ KHÔNG | ✅ CÓ |

> **Lý do:** JSON là "backbone" để AI agent / báo cáo tổng hợp đọc lại sau — chỉ chứa **dữ kiện khách quan**, không bị "nhiễm" bởi kết luận AI của lần chạy trước. Phần suy luận AI chỉ render ra DOCX cho người đọc.
> Renderer (`render-report.js`) tự lọc: DATA có cả hai loại, nhưng khi serialize JSON nó chỉ ghi factual. Xem comment dòng ~1582 trong `reference-scripts/render-report.js`.

---

## 6. SCHEMA DATA (input của Stage 3)

File `/tmp/data-<ma_kcb>.js` = `module.exports = { ... }`. Đây là phần DUY NHẤT cần LLM suy luận. Mẫu đầy đủ: **`reference-scripts/data-example.js`**.

### Nhóm field chính
- **Hành chính:** `ma_bn, ten_khong_dau, ho_ten, gioi_tuoi, dia_chi, co_so, khoa_phong, nhap_vien, xuat_vien, so_ngay, bao_hiem, bac_si` + metadata (`schema_version, ba_loai, ma_bieu_mau, gioi, nam_sinh, hinh_thuc_ra_vien, phau_thuat, cac_khoa_dieu_tri`).
- **`admission_workup`** (Section A): `source_page, raw_text` (TOÀN VĂN), `ly_do_vao_vien, qua_trinh_benh_ly, tien_su_*, dau_hieu_sinh_ton{}, kham_toan_than, kham_co_quan{}, chan_doan_vao_khoa{}, ...`.
- **`discharge_summary`:** `source_page, raw_text` (TOÀN VĂN), `qua_trinh_va_dien_bien, tom_tat_cls_co_gia_tri, phuong_phap_dieu_tri, chan_doan_ra_vien{}, ...`.
- **`department_stays[]`:** mỗi khoa = `{department, start_date, end_date, source_pages, diagnoses[], clinical_course_raw, medications[], labs_ordered[], lab_results[], imaging_results[], procedures[], doctor_notes_raw, nursing_notes_raw, consultations[], transfer_out}`.
- **Factual arrays (vào JSON):** `bieu_mau[]`, `timeline_raw[]`, `icd_codes_in_record[]`, `evidence_grounding[]`, `coverage_audit{}`.
- **Suy luận arrays (chỉ DOCX):** `icd_chi_tiet[], icd_canh_bao[], khuyen_nghi[], tam_cau_hoi[], dieu_tri_kali[], tieu_chi_uap[], tieu_chi_kali[], phat_hien_phu[], cls_du[], cls_thieu[], cls_khong_chi_dinh[], thieu_sot[], tai_lieu[]`.
- **`grounding{}`:** `{hit, key, confidence_cap, entry, note}`.

### ⚠️ Field schema phải KHỚP CHÍNH XÁC renderer
Renderer truy cập field theo tên cố định — sai tên → crash. Một số schema dễ nhầm (đối chiếu `render-report.js` khi viết DATA):
```
timeline:     { tg, su_kien, nhan_xet }       (KHÔNG phải ngay/gio/su_kien)
icd_canh_bao: { ma, ten, vi_tri, canh_bao }
tieu_chi_uap: { tieu_chi, yeu_cau, ket_qua, icon, danh_gia }
tieu_chi_kali:{ tieu_chi, noi_dung, icon, danh_gia }
phat_hien_phu:{ phat_hien, gia_tri, tieu_chuan, van_de }   (object, KHÔNG phải string)
dieu_tri_kali:{ tg, y_lenh, k, danh_gia }
cls_du:       { cls, ket_qua, vai_tro, danh_gia }
cls_thieu:    { cls, ly_do, co_so, uu_tien }
icd_chi_tiet: { tg, ma_dung, ly_do_sai, ma_dung_can, ten_ma_dung }
tam_cau_hoi:  { cau, tra_loi, ket_qua, color }   (object, KHÔNG phải string)
khuyen_nghi:  { uu_tien, noi_dung, co_so, don_vi }
thieu_sot:    { muc_do, noi_dung, trang }
bieu_mau:     { stt, ten, ket_qua, icon }   (icon: ✅ đạt / ⚠️ cần bổ sung / ❌ thiếu)
tai_lieu:     { n, parts: [{t, b, i}] }   (HOẶC để trống → auto-build từ evidence_grounding[])
```

---

## 7. GROUNDING — chống bịa nguồn (No-Fabrication)

- **CLI chỉ ĐỌC** `grounding-cache.json` (đường dẫn gốc: `/Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json` trong hệ thống KHTH). Không gọi MCP.
- **KHÔNG tự tạo DOI/PMID/ID học thuật** — chỉ dùng citation đã verify trong cache.
- HIT → `confidence_cap="supported"`. MISS → `partially_supported`, KHÔNG bịa nguồn, đặt cờ "cần Cowork bổ sung".
- Khớp tên bệnh **linh hoạt** (substring + từ khóa + alias): "ĐTĐ không phụ thuộc insulin" ≈ "Đái tháo đường type 2".
- Cache là **bộ nhớ bền**: ground một lần, tái dùng vĩnh viễn cho mọi HSBA/phiên sau.

---

## 8. TIÊU CHUẨN PHÁP QUY (cơ sở đánh giá)

| Văn bản | Dùng cho |
|---|---|
| **TT 32/2023/TT-BYT** | Chuẩn biểu mẫu HSBA (Section A) — `reference-docs/references/bieu-mau-chuan.md` |
| **QĐ 4469/QĐ-BYT** | Quy tắc mã hóa ICD-10 (chọn mã chính ra viện) — `reference-docs/references/icd-coding-rules.md` |
| **ICD-10 BYT 2026** | 15.844 mã (`hsba-workspace/icd/icd10_lookup.json` trong hệ thống gốc) |
| Phác đồ / dược lâm sàng | `references/phac-do-thuoc.md`, `references/treatment-pharmacy-review.md` |

### Nguyên tắc reasoning lâm sàng (Conservative+) — app PHẢI enforce
Claude **ĐƯỢC:** highlight mâu thuẫn, flag thiếu sót, đánh giá mức độ hỗ trợ bằng chứng, đề xuất review kèm page reference.
Claude **KHÔNG ĐƯỢC:** kết luận "chẩn đoán sai / điều trị sai / bác sĩ nhầm"; dùng kiến thức y khoa ngoài HSBA mà không có grounding; vượt quá `confidence_cap`; thay bác sĩ ra quyết định lâm sàng.

---

## 9. FILE THAM CHIẾU (đã copy vào thư mục này)

```
emr/
├── CLAUDE.md                        ← file đang đọc
├── reference-docs/                  ← tài liệu workflow (đọc để hiểu luồng)
│   ├── SKILL.md                     ★ workflow chi tiết nhất — ĐỌC TRƯỚC
│   ├── PROMPTS-CLI.md               ★ 4 prompt A/C/E + điều phối (luồng chuẩn)
│   ├── PIPELINE.md                  ★ tài liệu kỹ thuật 3 stage + schema
│   ├── COWORK-CLI-COORDINATION.md   phân công CLI ↔ Cowork (file bus)
│   ├── ORCHESTRATION.md             job board + tự động hóa grounding
│   ├── WORKFLOW-TOKEN-OPTIMIZED.md  tối ưu token
│   └── references/                  khung đánh giá (biểu mẫu, ICD, phác đồ, dược)
└── reference-scripts/               ← script gốc (tham khảo schema + logic)
    ├── extract-pdf-text.py          Stage 1: PDF → raw JSON + OCR
    ├── render-report.js             Stage 3: DATA → DOCX + JSON (CỐ ĐỊNH, ~2000 dòng)
    ├── data-example.js              ★ MẪU DATA đầy đủ (~44 bảng) — schema chuẩn
    ├── grounding-cache.py           get/put/sweep grounding cache
    ├── jobctl.py                    quản job board (status/owner/stage)
    ├── run-batch.sh                 orchestrator prepare/finalize
    └── audit-config.json            rule bỏ qua tùy biến per đơn vị
```

**Khi build app:** `reference-scripts/` là **đặc tả tham chiếu**, không nhất thiết chạy nguyên trạng. App có thể tái triển khai logic bằng ngôn ngữ/framework khác — nhưng PHẢI giữ: bảo toàn raw_text, separation JSON/DOCX, schema DATA khớp renderer (hoặc thay renderer thì giữ output tương đương), grounding chỉ-đọc-cache, ràng buộc PHI và Conservative+.

---

## 10. HỆ THỐNG GỐC (để tra cứu thêm khi cần)

Hệ thống KHTH đang chạy tại: `/Users/buiminhkhoi/Documents/Claude/KHTH/`
- Project P4 HSBA: `KHTH/KHTH - P4 HSBA/` (CLAUDE.md + input/ + output/ + knowledge/hsba-audit-skill/)
- Data store: `KHTH/hsba-workspace/` (bang-kiem/, icd/icd10_lookup.json, output/cache_v3.json)
- Grounding cache gốc: `/Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json`

> Khi cần bản mới nhất của script/tài liệu, đối chiếu với hệ thống gốc — file trong `emr/reference-*` là snapshot tại thời điểm copy (2026-06-16).

---

## 11. NGÔN NGỮ & PHONG CÁCH

- Trả lời **tiếng Việt**, xưng "em", gọi "anh".
- Code, tên biến, commit message: tiếng Anh.
- Ưu tiên đơn giản, ít dependency — tránh over-engineer.
- Không hỏi những gì đã rõ trong file này — làm thẳng.

---

*Tạo: 2026-06-16. Snapshot luồng P4 HSBA v3.x để build app EMR Analyzer độc lập.*
