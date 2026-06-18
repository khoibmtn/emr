# Đánh giá Điều trị & Dược lâm sàng — Framework cho Phần B.2

> Bổ sung chiều sâu cho B.2: không chỉ "đủ/thiếu thuốc theo phác đồ", mà soi **toàn bộ quá trình điều trị** — chỉ định có phù hợp chẩn đoán không, dùng thuốc đúng dược lâm sàng không, đáp ứng theo thời gian ra sao, và hồ sơ có cập nhật chẩn đoán/CLS khi diễn biến đổi không.
>
> Nguyên tắc bất biến: **mọi nhận định có nguồn (grounding-cache/phác đồ/Dược thư) hoặc ghi "chưa đủ bằng chứng"; KHÔNG ra lệnh lâm sàng**; viết "theo phác đồ [n], trường hợp này cần xem xét…", "đề nghị DSLS/bác sĩ rà". Đây là rà soát hồ sơ, không thay bác sĩ kê đơn.

---

## Cấu trúc B.2 mới (5 lớp)

### B.2.1 — Tính phù hợp CHỈ ĐỊNH (indication ↔ chẩn đoán)
Lập bảng: mỗi thuốc/can thiệp ↔ chẩn đoán nào trong hồ sơ chứng minh chỉ định ↔ có căn cứ phác đồ không.
- ✅ Phù hợp: thuốc nằm trong phác đồ cho chẩn đoán đã xác nhận.
- ⚠️ Phù hợp một phần: chỉ định hợp lý nhưng chẩn đoán mới ở mức "theo dõi", hoặc thiếu ghi lý do.
- ❌ Chưa phù hợp: không thấy chẩn đoán/triệu chứng nào trong hồ sơ biện minh cho thuốc → **cờ rà**.
- "Thuốc không rõ chỉ định" ≠ "sai" — nêu khách quan, đề nghị đối chiếu.

### B.2.2 — DƯỢC LÂM SÀNG từng thuốc (per-drug review) ★ phần còn thiếu
Với MỖI thuốc đang dùng, soi 6 trục:

| Trục | Câu hỏi rà soát | Nguồn đối chiếu |
|---|---|---|
| **Liều – đường – nhịp – thời gian** | Có khớp khuyến cáo cho chỉ định + cân nặng/tuổi? Thời gian dùng có hợp lý (không quá ngắn/dài)? | Dược thư QG VN, tờ HDSD, phác đồ |
| **Chỉnh liều theo cơ quan** | Có cần giảm liều theo eGFR/creatinin (thận) hay men gan? Hồ sơ có chức năng thận/gan để chỉnh? | Dược thư VN; tính eGFR từ creatinin nếu có |
| **Chống chỉ định / thận trọng** | BN có bệnh nền/chỉ số nào là CCĐ hay cần thận trọng? (vd NSAID + suy thận; metformin + eGFR thấp; chẹn beta + hen/blốc) | Dược thư VN, phác đồ |
| **Tương tác thuốc–thuốc (DDI)** | Cặp thuốc nào tương tác có ý nghĩa lâm sàng? Hậu quả + xử trí? | Dược thư VN; ChEMBL `get_mechanism` (cơ chế); kiểm chéo y văn |
| **Trùng lặp / đa trị liệu** | Có 2 thuốc cùng nhóm/cùng đích không cần thiết? Polypharmacy? | Phân nhóm ATC |
| **Theo dõi điều trị (monitoring)** | Thuốc này cần theo dõi gì (điện giải, đông máu INR, men gan, đường huyết, nồng độ thuốc – TDM, ECG/QT…)? Hồ sơ có làm? | Phác đồ + Dược thư |

Mức mỗi thuốc: ✅ hợp lý · ⚠️ cần lưu ý (liều/theo dõi/chỉnh cơ quan) · ❌ vấn đề (CCĐ/tương tác nặng/sai liều rõ) · ◻️ không đủ thông tin.

### B.2.3 — ĐÁP ỨNG điều trị theo thời gian (response over time) ★ phần còn thiếu
Dựng bảng theo mốc thời gian: diễn biến lâm sàng/CLS → đáp ứng (cải thiện/không/xấu đi) → y lệnh có điều chỉnh kịp thời không.
- Triệu chứng/CLS có cải thiện đúng kỳ vọng của phác đồ? (vd: kháng sinh CAP nên đáp ứng trong 48–72h; bù kali nên về ≥3.5 trong khung giờ hợp lý)
- Khi KHÔNG đáp ứng / xấu đi: hồ sơ có **leo thang/đổi hướng** (đổi kháng sinh, tăng liều, hội chẩn, chuyển khoa) không?
- Có theo dõi tác dụng phụ/biến cố bất lợi (ADR) không?

### B.2.4 — THAY ĐỔI CHẨN ĐOÁN & BỔ SUNG CLS khi diễn biến đổi ★ phần còn thiếu
- Khi diễn biến/CLS mới xuất hiện (vd men tim tăng, X-quang có thâm nhiễm mới, sốt mới): hồ sơ có **cập nhật chẩn đoán** và **chỉ định CLS bổ sung** tương ứng không?
- Chẩn đoán vào viện → trong khoa → ra viện có **mạch logic** (diagnosis drift hợp lý) hay nhảy cóc không giải thích?
- Phát hiện bất thường (vd block nhánh mới, nang thận, nốt phổi) có được ghi nhận/định hướng theo dõi không (tránh "bỏ rơi phát hiện")?

### B.2.5 — THIẾU / DƯ điều trị (gap & overuse)
- **Thiếu theo phác đồ** (khi chẩn đoán XÁC NHẬN): thuốc nền tảng còn thiếu (vd ACS xác nhận thiếu kháng kết tập tiểu cầu/statin) → nêu "thiếu theo [n]", không "phải dùng ngay".
- **Dư / kéo dài**: kháng sinh không xuống thang khi có kháng sinh đồ; PPI/dịch truyền/thuốc duy trì không đánh giá lại; corticoid kéo dài.
- **Bỏ sót theo dõi bắt buộc** của thuốc (vd warfarin không INR, aminoglycoside không chức năng thận).

---

## Đầu ra → DATA{} (Stage 3 render)

| Field | Nội dung |
|---|---|
| `dieu_tri_danh_gia[]` | B.2.1+B.2.2 mỗi thuốc: {ten_thuoc, nhom, chi_dinh_cho, lieu_dung, duong, nhip, thoi_gian, lieu_chuan, chinh_than_gan, chong_chi_dinh, tuong_tac, theo_doi, muc_do, nhan_xet, trang} |
| `tuong_tac_thuoc[]` | {cap_thuoc, co_che, muc_do, hau_qua, xu_tri, trang} |
| `dap_ung_dieu_tri[]` | B.2.3: {moc_tg, dien_bien, dap_ung, dieu_chinh_y_lenh, phu_hop, ghi_chu} |
| `thay_doi_chan_doan[]` | B.2.4: {moc, tu_cd, sang_cd, ly_do, cls_bo_sung, phu_hop} |
| `dieu_tri_tomtat` | Verdict B.2: {muc_do, noi_dung} — tổng kết tính phù hợp điều trị |

> Các field cũ (`dieu_tri_kali`, `cls_du/thieu/khong_chi_dinh`) GIỮ NGUYÊN — vẫn render. Field mới render khi có dữ liệu; rỗng thì bỏ qua (backward-compat).

---

## Grounding cho phần điều trị (ẩn danh)

Thêm vào Bước 3.5 các **khái niệm thuốc/điều trị** cần grounding (tra `grounding-cache` trước):
- "Phác đồ điều trị <bệnh>" (đã có cho nhóm hay gặp).
- "Liều & chỉnh liều <thuốc> theo chức năng thận" — Dược thư QG VN (web BYT) là canonical cho VN.
- "Tương tác <thuốc A> <thuốc B>" — đối chiếu Dược thư + cơ chế qua ChEMBL `get_mechanism`/`get_admet` (chỉ cơ chế/ADMET, KHÔNG phải DB tương tác lâm sàng → vẫn cần Dược thư/ y văn xác nhận).
- Verify mọi citation y văn qua PubMed (verify-by-retrieval) trước khi đưa vào báo cáo.

**Nguồn ưu tiên (VN trước):** Dược thư Quốc gia Việt Nam → phác đồ BYT → tờ HDSD đã duyệt → guideline hiệp hội (ESC/ADA/GOLD…) → ChEMBL (cơ chế/ADMET, bổ trợ).

> ⚠️ ChEMBL cho **cơ chế tác dụng + ADMET + bioactivity**, KHÔNG cho liều lâm sàng VN hay DDI lâm sàng. Dùng để giải thích "thuốc tác động đích nào" → củng cố lập luận chỉ định; liều/tương tác phải lấy từ Dược thư/phác đồ.

---

## Bảng kiểm nhanh trước khi kết luận B.2
- [ ] Mỗi thuốc đã soi đủ 6 trục dược lâm sàng (liều/cơ quan/CCĐ/tương tác/trùng lặp/theo dõi)?
- [ ] Đã đối chiếu liều với Dược thư VN / phác đồ (có nguồn)?
- [ ] Đã rà tương tác các cặp thuốc nguy cơ?
- [ ] Đã dựng bảng đáp ứng theo thời gian + kiểm "y lệnh điều chỉnh kịp khi diễn biến đổi"?
- [ ] Đã kiểm chẩn đoán có cập nhật + CLS bổ sung khi diễn biến mới?
- [ ] Mọi nhận định đều có nguồn hoặc gắn cờ "chưa đủ bằng chứng / đề nghị DSLS rà"?
