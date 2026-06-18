# Evidence Grounding — Tầng truy xuất bằng chứng cho Phần B

> **Mục đích:** Nâng Phần B (Đánh giá lâm sàng) từ "viết theo trí nhớ" → "đối chiếu bằng chứng thật, có trích dẫn đã kiểm chứng". Đây là tầng chạy **giữa Bước 2 (trích xuất) và Bước 3 (viết Section B)** trong SKILL.md.
>
> **Kết quả:** điền `DATA.evidence_grounding[]` + nâng `DATA.reasoning_boundary` (cho phép `confidence_cap = "supported"` khi có guideline). Mọi trích dẫn đưa vào `DATA.tai_lieu` **bắt buộc** đi qua bước verify (chống hallucinate citation).

---

## 0. Nguyên tắc PRIVACY (đọc trước)

Khi truy vấn nguồn ngoài (PubMed, web BYT, hiệp hội), **CHỈ gửi khái niệm bệnh đã ẩn danh** — KHÔNG bao giờ gửi: họ tên, mã KCB, số BHYT, địa chỉ, ngày sinh, hay bất kỳ định danh nào.

| ✅ Được gửi (khái niệm) | ❌ KHÔNG gửi |
|---|---|
| "tiêu chuẩn chẩn đoán đau thắt ngực không ổn định ESC" | "BN Tống Văn Quang mã 2600062416 đau ngực" |
| "phác đồ bù kali hạ kali máu K+ 2.5 mmol/L" | "BN này K+ 2.5, tê 2 chân, vào viện 05/05" |
| "quy tắc mã ICD theo dõi nghi ngờ NMCT" | (bất kỳ chi tiết định danh nào) |

Quy tắc: trước mỗi query, tự hỏi "câu này có thể áp cho bất kỳ BN nào cùng bệnh không?" — nếu có chi tiết chỉ đúng 1 người → gỡ bỏ.

---

## 1. Bước G1 — Trích "câu hỏi grounding" từ hồ sơ

Sau khi có DATA extraction (chẩn đoán, XN bất thường, thuốc), liệt kê tối đa **3–6 câu hỏi grounding** ẩn danh, mỗi câu gắn 1 mục Section B sẽ dùng:

```
grounding_questions = [
  { concept: "Tiêu chuẩn chẩn đoán đau thắt ngực không ổn định / NSTE-ACS (troponin hs, ECG động học)",
    dùng_cho: "B.1 đánh giá chẩn đoán I20.0" },
  { concept: "Phác đồ bù kali đường uống/tĩnh mạch trong hạ kali máu mức trung bình–nặng",
    dùng_cho: "B.2 đánh giá điều trị E87.6" },
  { concept: "Quy tắc mã hóa ICD-10 cho chẩn đoán 'theo dõi/nghi ngờ' và mã triệu chứng nhóm R",
    dùng_cho: "B.5 đánh giá mã ICD" },
]
```

---

## 2. Bước G2 — Thang nguồn (Source Tier Ladder)

Truy theo thứ tự; dừng khi đủ bằng chứng cho từng câu. Ghi lại **mọi** nguồn dùng.

### Tier 1 — Second brain nội bộ (ưu tiên cao nhất)
- `mcp__version-graph__search_clinical(query)` → `check_clinical_validity(node_id)` để xác nhận phác đồ **còn hiệu lực**.
- `mcp__rag-server__search_knowledge(query, project="p3-clinical")` cho QTKT/HDĐT đã ingest.
- Kho chung: `kho-tri-thuc/wiki/index.md` (nếu mount được).
- ⚠️ **Thực trạng (2026-06):** `p3-clinical` còn rỗng/mỏng — nếu trả về scaffold/noise (similarity thấp, nguồn = CLAUDE.md/README.md) thì coi như **chưa có** và xuống Tier 2. Đồng thời ghi 1 dòng "đề xuất ingest" vào ghi chú để bổ sung kho sau.

### Tier 2 — Văn bản Bộ Y tế + pháp quy (chuẩn quốc gia, BẮT BUỘC cho phác đồ VN)
- `WebSearch` các Quyết định/Hướng dẫn BYT, ví dụ:
  - HD chẩn đoán & điều trị tim mạch — QĐ 1857/QĐ-BYT (2022)
  - HD chẩn đoán & điều trị bệnh nội tiết–chuyển hóa (hạ kali) — QĐ 3879/QĐ-BYT (2014)
  - HD sử dụng ICD-10 trong bệnh viện — QĐ 4469/QĐ-BYT (2012, cập nhật)
  - Mẫu HSBA — TT 32/2023/TT-BYT
- `mcp__workspace__web_fetch` trang chính thức (moh.gov.vn, thuvienphapluat.vn) để lấy số hiệu/ngày/điều khoản chính xác. **Kiểm hiệu lực** (còn/hết hiệu lực, văn bản thay thế) qua skill `tra-cuu-phap-luat`.
- Nếu `web_fetch` trả về vỏ trang (client-rendered) → dùng Claude in Chrome `navigate` + `get_page_text`.

### Tier 3 — Quốc tế: hiệp hội chuyên ngành + y văn
- Hiệp hội: ESC, AHA/ACC, KDIGO, ADA, WHO... và **trong nước**: Hội Tim mạch học VN (VNHA), Hội Nội tiết–ĐTĐ VN, v.v. → `WebSearch` (vd "2023 ESC ACS guideline diagnosis").
- Y văn: `mcp__pubmed-extended__pubmed_search_articles` → `pubmed_fetch_articles` (lấy PMID/DOI/journal/năm thật). Ưu tiên `publicationTypes: ["Guideline","Meta-Analysis","Review"]`.
- Đồng thuận: `mcp__...consensus__search`, `mcp__semantic-scholar__search_papers`.
- Cochrane: qua `pubmed_search_articles(query + "Cochrane")` hoặc `pubmed_europepmc_search`.

### Tier 4 — Mã ICD (đối chiếu, KHÔNG phải nguồn chuẩn VN)
- **Canonical cho VN = `KHTH/hsba-workspace/icd/icd10_lookup.json` (BYT 2026, 15.844 mã)** + `hsba_modules/icd_validator.py`.
- ICD MCP quốc tế (`validate_code`/`lookup_code`) là **ICD-10-CM (Hoa Kỳ)** → chỉ dùng đối chiếu, KHÔNG dùng phán quyết mã VN.
  > **Bằng chứng (kiểm 2026-06-12):** `I20.0` hợp lệ ở cả hai; nhưng `Z03.4` và `R07.3` **"not found" trong ICD-10-CM** dù **tồn tại trong ICD-10 WHO/BYT**. Nếu lấy ICD-CM làm chuẩn → kết luận sai cho hồ sơ VN. ⇒ Luôn ưu tiên lookup nội bộ BYT; chỉ trích ICD-CM khi muốn so sánh hệ mã.

---

## 3. Bước G3 — VERIFY citation (chống hallucinate — BẮT BUỘC)

**Không trích dẫn nào vào `DATA.tai_lieu` mà chưa qua bước này.**

- Có DOI/PMID → `mcp__scholar-sidekick__verifyCitation(title, doi|pmid, author?, year?)`:
  - `verdict: "matched"` → ✅ dùng được.
  - `verdict: "mismatch" | "not_found" | "ambiguous"` → ❌ **loại bỏ**, không đưa vào báo cáo.
- Kiểm rút bài: `mcp__scholar-sidekick__checkRetraction(...)` — nếu retracted/EoC → loại hoặc ghi cảnh báo.
- Lấy chuỗi trích chuẩn: `mcp__scholar-sidekick__formatCitation(style="vancouver")`.
- Văn bản BYT (không có DOI) → "verify" = đã mở được trang chính thức + đúng số hiệu/ngày + còn hiệu lực (ghi `verified_by: "web_moh"` hoặc `"thuvienphapluat"`).

---

## 4. Bước G4 — Điền `DATA.evidence_grounding[]`

```javascript
evidence_grounding: [
  {
    concept:        "Tiêu chuẩn chẩn đoán NSTE-ACS/đau thắt ngực không ổn định",
    used_in:        "B.1",                       // mục Section B áp dụng
    source_tier:    "international_society",      // internal_2nd_brain | moh | international_society | literature | icd
    source:         "2023 ESC Guidelines for the management of ACS",
    key_point:      "Chẩn đoán dựa biến đổi động học hs-troponin (0/1-2h) + ECG; troponin đo 1 lần bình thường không loại trừ nhưng không đủ xác nhận.",
    citation_ref:   "[2]",                        // khớp số trong DATA.tai_lieu
    identifier:     { type: "doi", value: "10.1093/eurheartj/ehad191" },
    verified:       true,                          // kết quả verifyCitation
    verify_method:  "scholar-sidekick verifyCitation: matched",
    validity:       "current"                      // current | superseded | unknown (cho VB BYT: còn/het hieu luc)
  },
  // ... mỗi câu hỏi grounding 1–2 entry
]
```

**Quy tắc:**
- Mỗi mục Section B có nhận định lâm sàng nên có ≥1 `evidence_grounding` chống lưng.
- `verified: false` → KHÔNG được dùng làm căn cứ; tối đa ghi "tham khảo, chưa kiểm chứng" và không gắn số trích dẫn.
- `source_tier: "internal_2nd_brain"` + `validity: "current"` (đã `check_clinical_validity`) là bằng chứng mạnh nhất cho bối cảnh VN.

---

## 5. Bước G5 — Nâng `reasoning_boundary`

```javascript
reasoning_boundary: {
  guideline_grounded:        true,                 // true khi có ≥1 evidence_grounding verified ở tier moh/society/internal
  guideline_sources:         ["QĐ 1857/QĐ-BYT 2022", "2023 ESC ACS", "QĐ 3879/QĐ-BYT 2014"],
  icd_grounded:              true,                  // đã đối chiếu icd10_lookup BYT
  external_medical_knowledge_used: true,            // CÓ — nhưng đã trích dẫn nguồn, không phải trí nhớ trần
  confidence_cap:            "supported",           // supported khi guideline_grounded=true & OCR tốt;
                                                    // partially_supported khi chỉ logic nội bộ; insufficient khi OCR<0.5
  confidence_cap_reason:     "Có guideline BYT + ESC đối chiếu, mọi trích dẫn đã verify"
}
```

> Tương quan với CLAUDE.md §6: "CHỈ dẫn chiếu, không tự kết luận". Grounding **không** phá nguyên tắc này — ngược lại, nó *bắt buộc* mọi nhận định phải dẫn chiếu nguồn đã kiểm chứng. Vẫn KHÔNG viết "bác sĩ chẩn đoán sai"; viết "đối chiếu tiêu chuẩn [n], hồ sơ chưa đủ bằng chứng xác nhận".

---

## 6. Tích hợp vào DOCX (Stage 3)

`complete-example.js` (đã nâng cấp) sẽ:
- Render **B.0 — Cơ sở bằng chứng đối chiếu**: bảng `concept | nguồn | tier | hiệu lực | verify | [n]`.
- Hộp `reasoning_boundary` đầu Phần B (confidence_cap + số nguồn).
- Tự sinh `DATA.tai_lieu` từ `evidence_grounding[]` đã verified (nếu để trống), giữ đường thủ công làm fallback.
- Ghi `evidence_grounding` + `reasoning_boundary` vào **JSON** (đây là dữ kiện khách quan đã verify — KHÔNG phải kết luận AI về BN, nên hợp nguyên tắc separation).

---

## 7. Checklist nhanh trước khi viết Section B

- [ ] Đã liệt kê 3–6 câu hỏi grounding ẩn danh (không PII)?
- [ ] Mỗi câu đã truy Tier 1→4 và ghi nguồn?
- [ ] Phác đồ VN: đã có ≥1 văn bản BYT + kiểm hiệu lực?
- [ ] Mã ICD: đã đối chiếu `icd10_lookup.json` (BYT), KHÔNG dùng ICD-CM làm chuẩn?
- [ ] Mọi citation PubMed/DOI đã `verifyCitation = matched` + `checkRetraction` sạch?
- [ ] Đã set `reasoning_boundary.confidence_cap` đúng mức bằng chứng thực tế?
