# Prompt cho Claude CLI — phối hợp với Cowork (xem COWORK-CLI-COORDINATION.md)

> Dán từng prompt vào Claude CLI **chạy tại thư mục dự án** `KHTH - P4 HSBA`. Theo thứ tự A → (Cowork làm Pha B) → C theo đợt → E.

---

## PROMPT A — Chuẩn bị + bản kê khái niệm (chạy đầu tiên)

```
Bạn đang ở dự án P4 — Kiểm tra hồ sơ bệnh án (HSBA). Hãy đọc trước các file sau để nắm quy trình mới nhất, rồi làm theo:
- CLAUDE.md
- knowledge/hsba-audit-skill/SKILL.md
- knowledge/hsba-audit-skill/WORKFLOW-TOKEN-OPTIMIZED.md
- knowledge/hsba-audit-skill/COWORK-CLI-COORDINATION.md (vai trò của bạn = "Claude CLI")

VAI TRÒ CỦA BẠN: làm phần xác định + cần thư viện (parse, OCR, sinh DOCX, tổng hợp). KHÔNG gọi MCP nghiên cứu — phần grounding do Cowork dựng sẵn trong /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json; bạn chỉ ĐỌC cache đó.

NHIỆM VỤ PHA A (chỉ làm tới đây rồi DỪNG, báo cáo cho tôi):
S=knowledge/hsba-audit-skill/scripts

1) (Tùy chọn) Bản kê khái niệm dễ đọc từ 18 JSON cũ:
   python3 $S/extract-concepts.py --json-dir output/json --out-dir output/_handoff

2) Chạy chuẩn bị — script TỰ làm trọn: backup → hỏi xác nhận xoá → parse toàn bộ PDF (OCR cache) → bảng token metrics → **SWEEP grounding toàn đợt** (quét mã ICD mọi hồ sơ → ghi output/_handoff/grounding-needed.md):
   bash $S/run-batch.sh prepare
   (khi script hỏi, gõ "yes" để xoá json/word/tong-hop cũ — đã backup)

3) BÁO CÁO cho tôi:
   - Bảng token metrics + dòng "Digest còn …% so với raw".
   - Kết quả SWEEP: "N HIT · M THIẾU grounding".
   - **Nội dung output/_handoff/grounding-needed.md** (danh sách bệnh thiếu — để tôi đưa Cowork ground 1 lượt).
   - Đường dẫn WORK=... (lưu cho Pha C).
   - NẾU M = 0 → báo "đã đủ grounding, có thể chạy Pha C luôn".

⚠️ KHÔNG phân tích hồ sơ nào ở Pha A. Chờ Cowork ground xong list rồi tôi mới đưa Prompt C.

QUY TẮC: tiếng Việt, xưng "em" gọi "anh". KHÔNG cat cả raw JSON. KHÔNG gửi nội dung HSBA ra ngoài. Thao tác xoá đã được tôi đồng ý (script có backup), cứ thực hiện.
```

---

## PROMPT C — Phân tích một ĐỢT 3–5 hồ sơ (chạy sau khi Cowork đã dựng grounding-cache)

> Thay `<DANH SÁCH FILE>` bằng 3–5 tên PDF trong input/. Lặp lại prompt này cho từng đợt; cache được giữ nên đợt sau rẻ dần.

```
think hard. Tiếp tục dự án P4 HSBA.

★ ĐỌC TRƯỚC (nạp vào ngữ cảnh để reasoning sắc — đây là điểm khiến chất lượng kém nếu bỏ qua):
- knowledge/hsba-audit-skill/SKILL.md
- references/treatment-pharmacy-review.md   (khung đánh giá điều trị & dược lâm sàng)
- references/icd-coding-rules.md             (quy tắc mã ICD QĐ 4469)
- references/phac-do-thuoc.md                (phác đồ tham chiếu)
- references/bieu-mau-chuan.md               (biểu mẫu TT 32/2023)

PHÂN TÍCH ĐỢT NÀY (mỗi hồ sơ 1 Task subagent — SKILL §3.5b):
Danh sách hồ sơ đợt này: <DANH SÁCH FILE>

══ BƯỚC 0 — XÁC MINH GROUNDING (sweep đã chạy ở Pha A, Cowork đã ground) ══
Chạy lại sweep để chắc chắn đã đủ trước khi phân tích:
   python3 $S/grounding-cache.py sweep --dir "$WORK" \
       --cache /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json \
       --icd-lookup "/Users/buiminhkhoi/Documents/Claude/KHTH/hsba-workspace/icd/icd10_lookup.json"
- Nếu in "0 THIẾU" (exit 0) → phân tích TOÀN ĐỢT một mạch, không dừng nữa.
- Nếu còn THIẾU → DỪNG, báo tôi đưa Cowork ground nốt (đừng phân tích thiếu căn cứ).
($WORK = đường dẫn Pha A đã in ra.)

══ Với MỖI hồ sơ (sau khi grounding đã đủ) ══
1. Parse: python3 $S/extract-pdf-text.py "input/<file>" --output /tmp/<stem>.raw.json --ocr-images-dir /tmp/scans_<stem> --ocr-cache "output/ocr-cache/<ma_kcb>.json"
2. OCR CHỈ trang ocr_todo → ghi ocr_text → python3 $S/extract-pdf-text.py --update-cache "output/ocr-cache/<ma_kcb>.json" --from-json /tmp/<stem>.raw.json
3. Đọc digest cho cấu trúc: python3 $S/extract-pdf-text.py --digest --from-json /tmp/<stem>.raw.json --output /tmp/<stem>.digest.txt
   ★ NHƯNG để reasoning B.1–B.4 cho SẮC: đọc THÊM toàn văn các trường raw — admission_workup.raw_text, discharge_summary.raw_text, và clinical_course_raw của từng khoa trong /tmp/<stem>.raw.json (digest chỉ gọn để định cấu trúc; phân tích lâm sàng cần đọc nguyên văn).
4. Gắn CLS/điều trị theo NGÀY nếu BN nằm ≥2 khoa (SKILL §1.5b).
5. GROUNDING = chỉ đọc cache (0 MCP): python3 $S/grounding-cache.py get --cache /Users/buiminhkhoi/Documents/Claude/kho-tri-thuc/facts/grounding.json --concept "<tên bệnh>"
   - HIT → dùng citation/key_point đã verify, confidence_cap="supported".
   - MISS → confidence_cap="partially_supported" + cờ cần Cowork; KHÔNG bịa nguồn.
6. ⚠️ KHÔNG viết lại script renderer (2000 dòng → chậm, "prompt too long"). **CHỈ viết FILE DATA** rồi gọi renderer cố định:
   - Viết `/tmp/data-<ma_kcb>.js` theo MẪU `data-example.js` (xem cấu trúc field ở đó). Nội dung = `module.exports = { ...DATA của ca này... };`. Đây là phần DUY NHẤT cần suy luận.
   - Chạy renderer (KHÔNG đụng tới): `cd "$S/.."/scripts && node render-report.js /tmp/data-<ma_kcb>.js` → tự xuất DOCX + JSON + master.json (docx đã cài ở scripts/node_modules).
   - DATA phải ĐỦ field như data-example.js: meta giàu (ma_kcb/so_ho_so/bhyt/cccd/phong/giuong/bac_si_dieu_tri/truong_khoa/co_so), bieu_mau, **bang_xet_nghiem[]**, timeline, icd, B.0 evidence_grounding[], B.1 chẩn đoán, B.2 dieu_tri_danh_gia[] + tuong_tac_thuoc[] + dap_ung_dieu_tri[] + thay_doi_chan_doan[] + dieu_tri_tomtat, B.3 cls_du/thieu, **dien_bien_lam_sang[]**, B.5 icd_chi_tiet, tam_cau_hoi, **khuyen_nghi[]**, tai_lieu[] (hoặc để trống cho auto-build từ evidence_grounding[]).
   - **Khuyến nghị phải CỤ THỂ + có căn cứ**: "Theo [guideline trong grounding-cache], nên [thuốc+liều / XN bổ sung / sửa mã ICD]". VD: "Viêm gan B mạn chưa điều trị kháng virus → theo AASLD 2018 [n], cân nhắc Entecavir 0,5 mg/ngày hoặc Tenofovir 300 mg/ngày, đề nghị BS chuyên khoa xác nhận".
   - Mỗi nhận định B.1–B.5 gắn [n] khớp tai_lieu/evidence_grounding (citation từ grounding-cache đã verify).
7. Báo cáo tóm tắt mỗi hồ sơ: biểu mẫu đạt/thiếu, phát hiện chính, confidence_cap. Kiểm: DOCX ≥ 8 bảng (data-example.js render ra ~44 bảng).

QUY TẮC: tiếng Việt; mọi nhận định Phần B phải có nguồn từ cache (đã verify) hoặc ghi rõ "chưa đủ bằng chứng"; KHÔNG kết luận "bác sĩ sai"; KHÔNG gửi PHI ra ngoài.
```

---

## PROMPT E — Tổng hợp (sau khi đã sinh xong DOCX 18 hồ sơ)

```
Tiếp tục dự án P4 HSBA. Đã sinh xong DOCX + JSON cho toàn bộ hồ sơ.

1) Tạo file thống kê gộp (token-lean):
   bash knowledge/hsba-audit-skill/scripts/run-batch.sh finalize
   → output/tong-hop/_stats.json

2) Dùng tong-hop-skill: ĐỌC DUY NHẤT output/tong-hop/_stats.json (KHÔNG đọc lại từng JSON đầy đủ) để viết báo cáo tổng hợp, rồi sinh DOCX tổng hợp vào output/tong-hop/YYYY-MM-DD_tong-hop_<N>HSBA.docx.

3) Báo cáo: tỷ lệ biểu mẫu đạt, ICD đúng/sai theo loại, thiếu sót hay gặp (top), phân bố theo khoa, số hồ sơ còn thiếu grounding.
```

---

## Lưu ý điều phối (thứ tự chuẩn — chạy 1 lượt)
1. **Pha A** (CLI): `run-batch.sh prepare` tự backup → xoá → parse → **sweep grounding toàn đợt** → `output/_handoff/grounding-needed.md`. CLI DỪNG, đưa danh sách đó cho tôi.
2. **Pha B** (Cowork): tôi chuyển sang Cowork, nói "check grounding" → Cowork đọc `grounding-needed.md`, ground **cả list 1 lượt** → `grounding-cache.json`, báo xong.
3. **Pha C** (CLI): xác minh sweep = 0 thiếu → phân tích **toàn bộ đợt một mạch** (clone complete-example.js, đủ bảng + khuyến nghị có căn cứ).
4. **Pha E** (CLI): `run-batch.sh finalize` → DOCX tổng hợp.
- Nhờ sweep ở Pha A: **chỉ 1 lần bàn giao Cowork**, không dừng-chạy-lại giữa chừng.
- Nếu cấu hình MCP nghiên cứu thẳng vào CLI thì bỏ được Pha B Cowork — nhưng mất chất lượng văn (xem COORDINATION §6).
