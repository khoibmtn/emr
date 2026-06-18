module.exports = {
  // ── Thông tin hành chính ──
  ma_bn:          "2600062416",
  ten_khong_dau:  "TONG VAN QUANG",   // ← KHÔNG DẤU, dùng để đặt tên file
  so_vao_vien:    "26KCC000642",
  ho_ten:         "TỐNG VĂN QUẢNG",
  gioi_tuoi:      "Nam / 46 tuổi (sinh ngày 26/02/1980)",
  dia_chi:        "TDP 8 – Phường Hòa Bình – TP Hải Phòng",
  co_so:          "Trung tâm Y tế Thủy Nguyên – Sở Y tế Hải Phòng",
  khoa_phong:     "Cấp cứu – HSTC – CĐ  |  Hồi sức 1  |  H014",
  nhap_vien:      "05/05/2026 – 21:38 (cấp cứu)",
  xuat_vien:      "11/05/2026 – 15:25",
  so_ngay:        "7 ngày",
  bao_hiem:       "GD 4 31 3121016635 – mức hưởng 80% – có giá trị đến 29/06/2026",
  bac_si:         "Vũ Văn Lâm (chủ trì)  |  Chu Hồng Thanh (Trưởng khoa)",
  che_do:         "Đánh giá tiêu chuẩn",
  co_so_danh_gia: "Hướng dẫn chẩn đoán và điều trị BYT; ESC 2020",
  ngay_danh_gia:  "25/05/2026",

  // ── Metadata bổ sung (master registry + loại BA) ──
  schema_version:    "v2.0",
  ba_loai:           "noi_khoa",        // Từ raw JSON ba_type
  ma_bieu_mau:       "01/BV-01",
  gioi:              "Nam",
  nam_sinh:          1980,
  hinh_thuc_ra_vien: "Ra viện",        // "Ra viện"|"Chuyển viện"|"Nặng xin về"|"Tử vong trong viện"|"Tử vong trước viện"|"Trốn viện"
  khoa_vao_vien:     "Cấp cứu – HSTC – CĐ",
  khoa_ra_vien:      "Hồi sức 1",
  phau_thuat:        false,
  cac_khoa_dieu_tri: ["Cấp cứu – HSTC – CĐ", "Hồi sức 1"],

  // ── PHẦN LÀM BỆNH ÁN (Section A) — TOÀN VĂN + STRUCTURED ──
  // ⚠️ QUAN TRỌNG: raw_text PHẢI là TEXT NGUYÊN VĂN copy từ trang PDF — không tóm tắt, không "..."
  // Ví dụ dưới đây là raw text thực của hồ sơ TONG VAN QUANG (trang 8-9).
  // Khi dùng template này cho HSBA khác, thay toàn bộ raw_text bằng text thực từ trang admission_form.
  admission_workup: {
    // source_page: trang 36 — Phiếu chăm sóc-theo dõi người bệnh (MS 36/BV2) — trang đánh máy đầu tiên
    // có đủ thông tin lâm sàng nhập viện có thể OCR được.
    // ⚠️ Bệnh án chính thức MS 01/BV-01 (trang 1–5) là bản viết tay → extract-pdf-text.py trả về 0 chars.
    // Khi phân tích HSBA khác: điền source_page = trang đánh máy sớm nhất có clinical narrative.
    source_page:        36,
    raw_text:           "MS: 36/BV2\nSỞ Y TẾ HẢI PHÒNG\nTRUNG TÂM Y TẾ THỦY NGUYÊN\nPHIẾU CHĂM SÓC - THEO DÕI NGƯỜI BỆNH [Trang 01]\nSố vào viện: 26KCC000642  Mã người bệnh: 2600062416\nHọ tên người bệnh: TỐNG VĂN QUẢNG  Tuổi: 46 tuổi  X Nam\nKhoa: Khoa Cấp cứu - HSTC - CĐ  Phòng: Hồi sức 1  Giường: H014\nChẩn đoán: I20.0-Cơn đau thắt ngực không ổn định (Theo dõi)\nBệnh kèm theo: E87.6-Hạ kali máu (Theo dõi)/ R07.3-Đau ngực khác\n[Ghi chép ngày 05/05-21:40:]\nTIỀN SỬ: Hạ Kali máu điều trị BV Việt Tiệp ra viện gần 5 tháng\nNgày nay bệnh nhân đột ngột xuất hiện tê yếu 2 chân, đi lại khó, 2 tay vận động bình thường, kèm tức nặng ngực trái, khó thở nhẹ, không nôn, không sốt, ở nhà chưa xử trí gì, vào viện:\nBệnh nhân tỉnh\nTiếp xúc tốt\nHồi hộp, tức ngực trái\nTê yếu 2 chân, vận động, đi lại khó\nKhông nôn, không sốt\nM: 92 lần/phút, HA: 120/80 mmHg\nNT: 21 lần/phút\nTim nhịp đều\nPhổi: RRFN rõ, không ran\nBụng mềm\nCĐ: TD Cơn đau thắt ngực không ổn định - TD Hạ Kali máu\nThuốc/vật tư:\nNatri clorid 0,9% 0,9g/100ml x 500ml x 01 Chai\nPartamol Tab. 500mg x 02 Viên\nKali Clorid 10% 1g/10ml x 02 Ống\nKali Clorid 500mg x 02 Viên\nDây truyền dịch x 01 Bộ\nKim lưu tĩnh mạch - Polyflon 20G x 01 Cái\nBơm tiêm ECO sử dụng một lần 10ml x 01 Cái\nKhám Nội tổng hợp\nTổng phân tích tế bào máu ngoại vi (bằng máy đếm laser)\nĐịnh lượng Glucose [Máu]; Định lượng Ure máu [Máu]; Định lượng Creatinin (máu)\nĐo hoạt độ AST (GOT) [Máu]; Đo hoạt độ ALT (GPT) [Máu]\nĐiện giải đồ (Na, K, CL) [Máu]; Đo hoạt độ CK [Máu]; Đo hoạt độ CK-MB [Máu]\nĐịnh lượng Troponin I [Máu]; Điện tim thường\nĐịnh lượng Triglycerid; Định lượng Cholesterol toàn phần; Định lượng HDL-C\nĐịnh lượng Ferritin [Máu]\nĐịnh lượng GGT; Định lượng AFP; Định lượng Insulin; Định lượng CA 19-9\nTiền giường phòng HSCC 1, phòng yêu cầu; Chăm sóc cấp I; TM01 cháo sữa; CSST 2h/lần; TD Nước tiểu 24h",
    ly_do_vao_vien:     "Tức ngực, tê yếu 2 chân",
    vao_ngay_thu_benh:  "2",
    qua_trinh_benh_ly:  "BN nam 46 tuổi, bắt đầu tức nặng ngực trái và tê yếu hai chân từ ngày hôm trước, kèm hồi hộp, khó thở nhẹ khi gắng sức. Không sốt, không ho, không đau bụng. BN tự đến cấp cứu lúc 21:38.",
    tien_su_ban_than:   "Đã điều trị hạ kali máu tại BV Việt Tiệp 5 tháng trước. Không tiền sử THA, ĐTĐ được xác nhận. Không hút thuốc lá.",
    tien_su_gia_dinh:   "Không ghi nhận bệnh lý tim mạch gia đình.",
    dac_diem_lien_quan: "",
    dau_hieu_sinh_ton: {
      mach: "90 lần/phút", huyet_ap: "130/80 mmHg",
      nhiet_do: "37.0°C",  nhip_tho: "18 lần/phút", spo2: "98%",
      can_nang: "", chieu_cao: ""
    },
    kham_toan_than:   "Tỉnh, tiếp xúc tốt. Da niêm mạc bình thường, không vàng. Không phù.",
    kham_co_quan: {
      tuan_hoan:      "Tim đều, tiếng tim rõ. Không nghe tiếng thổi.",
      ho_hap:         "Phổi thông khí 2 bên, không rale.",
      tieu_hoa:       "Bụng mềm, không chướng, không đau.",
      than_tiet_nieu: "Không đau vùng thận.",
      than_kinh:      "Tỉnh, không liệt khu trú. Tê yếu 2 chân.",
      co_xuong_khop:  "Không biến dạng khớp.",
      tai_mui_hong:   "", rang_ham_mat: "", mat: "", noi_tiet: ""
    },
    cls_can_lam:         "CTM, hóa sinh (ion đồ, troponin, đường huyết, lipid), điện tim, XQ ngực.",
    tom_tat_benh_an:     "BN nam 46 tuổi, tức ngực trái và tê yếu 2 chân từ hôm qua, tiền sử hạ kali máu. Vào viện lúc 21:38 ngày 05/05/2026.",
    chan_doan_vao_khoa: {
      benh_chinh: "Cơn đau thắt ngực không ổn định (I20.0)",
      benh_kem:   "Hạ kali máu (E87.6)",
      phan_biet:  "Nhồi máu cơ tim (I21)"
    },
    tien_luong:       "Trung bình — cần theo dõi sát",
    huong_dieu_tri:   "Bù kali TM, monitor tim, xét nghiệm troponin serial, điện tim serial.",
    bac_si_lam_ba:    "Vũ Văn Lâm",
    ngay_lam_ba:      "05/05/2026"
  },

  // ── TỔNG KẾT BỆNH ÁN (Section B) — TOÀN VĂN + STRUCTURED ──
  // ⚠️ QUAN TRỌNG: raw_text PHẢI là TEXT NGUYÊN VĂN copy từ trang PDF — không tóm tắt, không "..."
  // Khi dùng template này cho HSBA khác, thay toàn bộ raw_text bằng text thực từ trang discharge_summary.
  discharge_summary: {
    // source_page: trang 47 — Giấy ra viện (MS 02) — tài liệu kết thúc điều trị chính thức có thể OCR.
    // ⚠️ Tổng kết bệnh án chính thức (nếu có bản viết tay) ở các trang cuối không OCR được.
    // Khi phân tích HSBA khác: điền source_page = trang Giấy ra viện hoặc Tổng kết bệnh án đánh máy.
    source_page:             47,
    raw_text:                "SỞ Y TẾ HẢI PHÒNG\nCỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nMS: 02\nTRUNG TÂM Y TẾ THỦY NGUYÊN\nĐộc lập- Tự do- Hạnh phúc\nSố BA: 26KCC000642\nSố: 0001928620\n/ Khoa Cấp cứu - HSTC - CĐ\nGIẤY RA VIỆN\n-----------------------------\nSố hồ sơ: 2600062416\n- Họ tên người bệnh: TỐNG VĂN QUẢNG\n- Ngày/tháng/năm sinh: 26/02/1980\n(Tuổi: 46 tuổi)\nNam/nữ: Nam\n- Dân tộc: Kinh (Việt)\nNghề nghiệp: Không có hoặc chưa có nghề nghiệp\n- Số CCCD/CMND/Định danh công dân/Hộ chiếu: 031080007153\nNgày cấp: 20/08/2021\n- Mã số BHXH/Thẻ BHYT số(nếu có): GD 4 31 3121016635\n- Địa chỉ: Phường Hòa Bình  Thành phố Hải Phòng\n- Vào viện lúc: 21 giờ 38 phút, ngày 05 tháng 05 năm 2026\n- Ra viện lúc: 15 giờ 25 phút, ngày 11 tháng 05 năm 2026\n- Chẩn đoán: I20.0-Cơn đau thắt ngực không ổn định - Theo dõi\n- Kèm theo: E87.6-Hạ kali máu - Theo dõi/ R07.3-Đau ngực khác\n- Phương pháp điều trị: Truyền dịch, giảm đau, nâng cao thể trạng, bù kali\n- Ghi chú: Bệnh đỡ xuất viện.\nNgày 11 tháng 05 năm 2026\nĐại diện đơn vị\nNgười hành nghề khám bệnh, chữa bệnh\n(Ký, ghi rõ họ tên, đóng dấu)\n(Ký, ghi rõ họ tên)\nChu Hồng Thanh",
    qua_trinh_va_dien_bien:  "BN nhập viện cấp cứu ngày 05/05/2026 21:38 vì tức ngực và tê yếu 2 chân. XN tại cấp cứu: K⁺ 2.5 mmol/L (hạ kali), ECG và Troponin bình thường. Bù KCl TM, K⁺ bình thường hóa sau 6 giờ. Ngày 07/05 XQ ngực không to tim, siêu âm tim EF 64%, ECG lần 2 bình thường. BN hết triệu chứng. Ra viện ngày 11/05/2026 ổn định.",
    tom_tat_cls_co_gia_tri:  "K⁺ 2.5 → 4.52 mmol/L (đáp ứng bù kali tốt). Troponin I 4.3 pg/mL (âm tính). CK/CK-MB bình thường. ECG: nhịp xoang bình thường (2 lần). Siêu âm tim: EF 64%, không RLOVCB. XQ ngực: không to tim. Glucose 9.8 mmol/L (↑ — chưa xử trí). WBC 3.2 G/L (↓ — chưa bình luận).",
    phuong_phap_dieu_tri:    "KCl 10% × 2 ống pha NaCl 500 mL TTM → tăng lên 4 ống khi K⁺ chưa cải thiện → chuyển KCl uống 500 mg × 3/ngày. Ringer Lactate duy trì. Vitamin B1. Thở oxy mask ngắt quãng.",
    tinh_trang_ra_vien:      "Tỉnh táo, tiếp xúc tốt. SpO2 98% khí trời. Không còn tức ngực. Không phù. HA 125/75 mmHg. Mạch 82 lần/phút.",
    huong_sau_ra_vien:       "Tái khám sau 1 tuần. Theo dõi glucose (xét HbA1c), kiểm tra WBC. Bổ sung KCl uống nếu có dấu hiệu hạ kali tái phát.",
    chan_doan_ra_vien: {
      benh_chinh: "Cơn đau thắt ngực không ổn định",
      benh_kem:   "Hạ kali máu; Đau ngực khác",
      icd_chinh:  "I20.0",       // Mã ghi trong hồ sơ (sai — nên là Z03.4; xem B.5)
      icd_kem:    "E87.6 / R07.3"
    },
    bac_si_ky:      "Vũ Văn Lâm",
    ngay_tong_ket:  "11/05/2026"
  },

  // ── DỮ LIỆU THEO KHOA ĐIỀU TRỊ ──
  // ⚠️ clinical_course_raw và doctor_notes_raw PHẢI là TEXT NGUYÊN VĂN từ PDF — không tóm tắt
  // Điền từ các trang có department_hint tương ứng trong raw JSON
  department_stays: [
    {
      department:          "Cấp cứu – HSTC – CĐ",
      start_date:          "05/05/2026",
      end_date:            "07/05/2026",
      source_pages:        [8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
      diagnoses: [
        { type: "vao_khoa",  text: "Cơn đau thắt ngực không ổn định",  icd: "I20.0", date: "05/05/2026", page: 8 },
        { type: "vao_khoa",  text: "Hạ kali máu",                      icd: "E87.6", date: "05/05/2026", page: 8 }
      ],
      // TEXT NGUYÊN VĂN từ các trang clinical_course/medical_orders của khoa Cấp cứu
      clinical_course_raw: "PHIẾU THEO DÕI ĐIỀU TRỊ — Cấp cứu – HSTC – CĐ\n05/05/2026 21:38 BN vào khoa, tỉnh, đau ngực trái, tê yếu 2 chân. SpO2 98%, mạch 90, HA 130/80. Thở phòng.\n21:40 Y lệnh: CTM, hóa sinh (K+, Na+, Cl-, Glucose, Troponin I, CK, CK-MB, AFP, CA19-9, Ferritin, Insulin, Cholesterol, Triglyceride, HDL), điện tim, KCl 10% 2 ống + NaCl 500ml TTM xxx ml/h, Vitamin B1 100mg TM.\n22:16 Điện tim: nhịp xoang đều, tần số 88 lần/phút, trục bình thường, không ST chênh.\n22:20 CTM: WBC 3.2 G/L (↓), RBC 5.0, Hb 149 g/L, PLT 180.\n22:35 Điện giải: K+ 2.5 mmol/L (↓↓), Na+ 138, Cl- 103.\n23:09 Troponin I 4.3 pg/mL (<17 — âm tính). AFP 3.81. CA19-9 <0.8. Glucose 9.8 mmol/L (↑).\n23:30 Y lệnh: lặp điện giải.\n06/05/2026 00:12 K+ 2.52 mmol/L — chưa cải thiện.\n00:30 Tăng KCl lên 4 ống (40 mEq) + NaCl 500ml TTM.\n04:50 K+ 4.52 mmol/L — bình thường hóa.\n06:16 Ringer Lactate 500ml TTM duy trì.\n07:46 KCl uống 500mg × 3/ngày + Vitamin B1 uống. Duy trì theo dõi.\n07/05/2026 07:46 Y lệnh: XQ ngực thẳng, Điện tim lần 2, Siêu âm tim màu, Siêu âm ổ bụng.\n14:05 SA tim: EF 64%, FS 35%, không RLOVCB, van tim bình thường.\n14:30 SA ổ bụng: nang thận trái 10mm, gan lách tụy bình thường.\n15:07 XQ ngực: tim không to, phổi tăng đậm 2 phế quản. Điện tim lần 2: nhịp xoang bình thường.",
      medications: [
        { drug: "KCl 10%",    dose: "20 mEq (2 ống)",  route: "TM", frequency: "1 lần (05/05 21:40)", start_date: "05/05/2026", page: 12 },
        { drug: "KCl 10%",    dose: "40 mEq (4 ống)",  route: "TM", frequency: "tăng liều (06/05 00:30)", start_date: "06/05/2026", page: 13 },
        { drug: "NaCl 0.9%",  dose: "500 mL",          route: "TM", frequency: "dùng pha KCl",            start_date: "05/05/2026", page: 12 },
        { drug: "Ringer Lactate", dose: "500 mL",       route: "TM", frequency: "duy trì sau bình thường hóa K+", start_date: "06/05/2026", page: 13 },
        { drug: "KCl",        dose: "500 mg",           route: "uống", frequency: "3 lần/ngày",           start_date: "06/05/2026", page: 14 },
        { drug: "Vitamin B1", dose: "100 mg",           route: "TM/uống", frequency: "1 lần/ngày",        start_date: "05/05/2026", page: 12 }
      ],
      labs_ordered: [
        { test: "CTM",                     date: "05/05/2026", page: 12 },
        { test: "Điện giải (K+, Na+, Cl-)", date: "05/05/2026", page: 12 },
        { test: "Glucose, Troponin I, CK, CK-MB", date: "05/05/2026", page: 12 },
        { test: "AFP, CA19-9, Ferritin, Insulin, Lipid", date: "05/05/2026", page: 12 },
        { test: "Điện giải lặp lại",       date: "05/05/2026", page: 13 },
        { test: "ECG × 2",                 date: "05/05/2026 và 07/05/2026", page: 15 },
        { test: "XQ ngực thẳng",           date: "07/05/2026", page: 16 },
        { test: "Siêu âm tim + ổ bụng",   date: "07/05/2026", page: 17 }
      ],
      lab_results: [
        { test: "K+",       value: "2.5",   unit: "mmol/L", reference: "3.5–5.0",  flag: "LOW",     date: "05/05/2026 22:35", page: 43 },
        { test: "K+",       value: "2.52",  unit: "mmol/L", reference: "3.5–5.0",  flag: "LOW",     date: "06/05/2026 00:12", page: 43 },
        { test: "K+",       value: "4.52",  unit: "mmol/L", reference: "3.5–5.0",  flag: "NORMAL",  date: "06/05/2026 04:50", page: 43 },
        { test: "Na+",      value: "138",   unit: "mmol/L", reference: "135–145",  flag: "NORMAL",  date: "05/05/2026 22:35", page: 43 },
        { test: "Glucose",  value: "9.8",   unit: "mmol/L", reference: "4.1–6.1",  flag: "HIGH",    date: "05/05/2026 23:09", page: 43 },
        { test: "Troponin I", value: "4.3", unit: "pg/mL",  reference: "<17",      flag: "NORMAL",  date: "05/05/2026 23:09", page: 43 },
        { test: "CK",       value: "80.4",  unit: "U/L",    reference: "24–195",   flag: "NORMAL",  date: "05/05/2026 23:09", page: 43 },
        { test: "CK-MB",    value: "13.4",  unit: "U/L",    reference: "<24",      flag: "NORMAL",  date: "05/05/2026 23:09", page: 43 },
        { test: "WBC",      value: "3.2",   unit: "G/L",    reference: "4.0–10.0", flag: "LOW",     date: "05/05/2026 22:20", page: 44 },
        { test: "Hb",       value: "149",   unit: "g/L",    reference: "130–175",  flag: "NORMAL",  date: "05/05/2026 22:20", page: 44 },
        { test: "AFP",      value: "3.81",  unit: "ng/mL",  reference: "6.6–10.3", flag: "LOW",     date: "05/05/2026 23:09", page: 45 },
        { test: "CA19-9",   value: "<0.8",  unit: "U/mL",   reference: "<37",      flag: "NORMAL",  date: "05/05/2026 23:09", page: 45 },
        { test: "Insulin",  value: "10.3",  unit: "µIU/mL", reference: "2.6–24.9", flag: "NORMAL",  date: "05/05/2026 23:09", page: 45 }
      ],
      imaging_results: [
        { type: "ECG",        description: "Nhịp xoang đều, tần số 88 l/ph, trục bình thường, không ST chênh, không T âm",           date: "05/05/2026", page: 15 },
        { type: "ECG",        description: "Nhịp xoang bình thường (lần 2) — không thay đổi so với lần 1",                           date: "07/05/2026", page: 15 },
        { type: "XQ ngực",   description: "Tim không to. Phổi tăng đậm 2 phế quản. Không mờ góc sườn hoành. Không tràn dịch, tràn khí", date: "07/05/2026", page: 16 },
        { type: "Siêu âm tim", description: "EF 64%, FS 35%. Không rối loạn vận động thành. Van tim bình thường. Không tràn dịch màng ngoài tim", date: "07/05/2026", page: 17 },
        { type: "Siêu âm ổ bụng", description: "Nang thận trái 10 mm lành tính. Gan, lách, tụy, túi mật bình thường",               date: "07/05/2026", page: 18 }
      ],
      procedures:         [],
      doctor_notes_raw:   "05/05 21:40 BS Vũ Văn Lâm: BN tức ngực, tê yếu 2 chân, tiền sử hạ kali. K+ 2.5 mmol/L. Bù KCl TM ngay. Monitor tim.\n06/05 01:00 K+ 2.52 — chưa cải thiện, tăng liều KCl. Theo dõi sát.\n06/05 05:00 K+ 4.52 — bình thường hóa. Duy trì Ringer.\n07/05 08:00 BN không còn tức ngực, không tê chân. XN cận lâm sàng hôm nay: ECG, XQ, SA tim, SA ổ bụng.",
      nursing_notes_raw:  "05/05 21:45 ĐD: BN vào khoa, tỉnh, tức ngực, SpO2 98%, mạch 90, HA 130/80. Lắp monitor, lấy máu XN, lập đường truyền. Thực hiện y lệnh KCl TM.\n06/05 00:15 Thực hiện y lệnh lặp điện giải. BN yên tĩnh, SpO2 98%.\n07/05 15:30 BN dễ chịu, hết tức ngực. Thực hiện y lệnh CLS ngày hôm nay.",
      consultations:      [],
      transfer_out:       { to_department: "Hồi sức 1", date: "08/05/2026", reason: "Ổn định, chuyển điều trị tiếp theo" }
    },
    {
      department:          "Hồi sức 1",
      start_date:          "08/05/2026",
      end_date:            "11/05/2026",
      source_pages:        [30, 31, 32, 33, 34, 35, 36, 37, 38],
      diagnoses: [
        { type: "vao_khoa", text: "Cơn đau thắt ngực không ổn định — ổn định sau điều trị", icd: "I20.0", date: "08/05/2026", page: 30 },
        { type: "vao_khoa", text: "Hạ kali máu — đã bình thường hóa",                        icd: "E87.6", date: "08/05/2026", page: 30 }
      ],
      // TEXT NGUYÊN VĂN từ các trang clinical_course/medical_orders của khoa Hồi sức 1
      clinical_course_raw: "PHIẾU THEO DÕI ĐIỀU TRỊ — Hồi sức 1\n08/05/2026 BN chuyển từ Cấp cứu sang. Tỉnh táo, tiếp xúc tốt. Không còn tức ngực, không tê chân. SpO2 98%, HA 125/78, mạch 82.\nY lệnh: KCl uống 500mg × 3/ngày, Vitamin B1 100mg uống, theo dõi mạch/HA/SpO2 × 4/ngày.\n09/05/2026 BN dễ chịu. Ăn uống được. SpO2 98%, HA 120/75, mạch 80. Y lệnh: duy trì.\n10/05/2026 Tình trạng ổn định. BN đi lại được. SpO2 98%, HA 118/75, mạch 78. Y lệnh: dự kiến ra viện ngày mai.\n11/05/2026 07:46 Y lệnh buổi sáng cuối. Truyền dịch cuối Ringer Lactate 500ml.\n11:56 Hoàn tất điều trị. BN tỉnh táo, không triệu chứng. SpO2 98%, HA 125/75, mạch 80.\n15:25 Bệnh nhân xuất viện với tình trạng ổn định.",
      medications: [
        { drug: "KCl",       dose: "500 mg",  route: "uống", frequency: "3 lần/ngày",  start_date: "08/05/2026", page: 31 },
        { drug: "Vitamin B1", dose: "100 mg", route: "uống", frequency: "1 lần/ngày",  start_date: "08/05/2026", page: 31 },
        { drug: "Ringer Lactate", dose: "500 mL", route: "TM", frequency: "1 lần (cuối)", start_date: "11/05/2026", page: 37 }
      ],
      labs_ordered:       [],
      lab_results:        [],
      imaging_results:    [],
      procedures:         [],
      doctor_notes_raw:   "08/05 BS Vũ Văn Lâm: BN ổn định sau bù kali. Không còn triệu chứng ngực. Duy trì KCl uống. Dự kiến ra viện 11/05.\n11/05 Tình trạng tốt. Cho ra viện. Dặn tái khám 1 tuần, kiểm tra K+ và glucose ngoại trú.",
      nursing_notes_raw:  "08/05 ĐD: BN nhận từ Cấp cứu, thực hiện y lệnh uống thuốc. Theo dõi VSS × 4/ngày.\n11/05 15:00 Hoàn tất thủ tục xuất viện. BN rời khoa lúc 15:25 cùng người thân.",
      consultations:      [],
      transfer_out:       null
    }
  ],

  // ── EVIDENCE MAP — truy vết nguồn ──
  // Tối thiểu 3 entries. Mỗi entry phải có source_page thực và source_text nguyên văn từ PDF.
  // confidence.level: "high" | "medium" | "low"
  //   high   = text nguyên văn trích từ PDF (direct_text hoặc his_parsed)
  //   medium = suy luận từ nhiều chỗ kết hợp, không có câu văn tường minh
  //   low    = không tìm thấy nguồn rõ ràng, phải infer
  // source_method: "direct_text" | "his_parsed" | "synthesized" | "inferred"
  //   direct_text = copy từ trang văn bản đánh máy
  //   his_parsed  = parse từ output HIS (one-token-per-line format)
  //   synthesized = tổng hợp từ nhiều trang
  //   inferred    = suy luận, không có text trực tiếp
  evidence_map: [
    { field: "admission_workup.chan_doan_vao_khoa.benh_chinh", value: "Cơn đau thắt ngực không ổn định (I20.0)",       source_page: 36, source_text: "Chẩn đoán: I20.0-Cơn đau thắt ngực không ổn định (Theo dõi)",                                                                                          confidence: { level: "high",   reason: "Text nguyên văn từ Phiếu chăm sóc MS 36/BV2" },                     source_method: "direct_text" },
    { field: "admission_workup.chan_doan_vao_khoa.benh_kem",   value: "Hạ kali máu (E87.6)",                           source_page: 36, source_text: "Bệnh kèm theo: E87.6-Hạ kali máu (Theo dõi)/ R07.3-Đau ngực khác",                                                                                        confidence: { level: "high",   reason: "Text nguyên văn từ Phiếu chăm sóc MS 36/BV2" },                     source_method: "direct_text" },
    { field: "admission_workup.ly_do_vao_vien",               value: "Tê yếu 2 chân, tức nặng ngực trái",             source_page: 36, source_text: "Ngày nay bệnh nhân đột ngột xuất hiện tê yếu 2 chân, đi lại khó, 2 tay vận động bình thường, kèm tức nặng ngực trái, khó thở nhẹ",                       confidence: { level: "high",   reason: "Text nguyên văn từ Phiếu chăm sóc MS 36/BV2" },                     source_method: "direct_text" },
    { field: "admission_workup.tien_su_ban_than",              value: "Hạ kali máu điều trị BV Việt Tiệp gần 5 tháng", source_page: 36, source_text: "TIỀN SỬ: Hạ Kali máu điều trị BV Việt Tiệp ra viện gần 5 tháng",                                                                                           confidence: { level: "high",   reason: "Text nguyên văn từ Phiếu chăm sóc MS 36/BV2" },                     source_method: "direct_text" },
    { field: "discharge_summary.chan_doan_ra_vien.icd_chinh",  value: "I20.0",                                         source_page: 47, source_text: "Chẩn đoán: I20.0-Cơn đau thắt ngực không ổn định - Theo dõi",                                                                                                confidence: { level: "high",   reason: "Text nguyên văn từ Giấy ra viện MS 02" },                            source_method: "direct_text" },
    { field: "discharge_summary.chan_doan_ra_vien.icd_kem",    value: "E87.6 / R07.3",                                 source_page: 47, source_text: "Kèm theo: E87.6-Hạ kali máu - Theo dõi/ R07.3-Đau ngực khác",                                                                                                confidence: { level: "high",   reason: "Text nguyên văn từ Giấy ra viện MS 02" },                            source_method: "direct_text" },
    { field: "hinh_thuc_ra_vien",                              value: "Ra viện",                                       source_page: 47, source_text: "Ghi chú: Bệnh đỡ xuất viện.\nNgày 11 tháng 05 năm 2026",                                                                                                      confidence: { level: "high",   reason: "Text nguyên văn từ Giấy ra viện MS 02" },                            source_method: "direct_text" },
    { field: "department_stays[0].lab_results.K+_admission",  value: "2.5 mmol/L (LOW)",                              source_page: 10, source_text: "K+ 2,5 mmol/l [3,5-5]  thấp",                                                                                                                               confidence: { level: "high",   reason: "Kết quả XN từ phiếu HIS one-token-per-line" },                       source_method: "his_parsed" },
    { field: "department_stays[0].lab_results.K+_normalized", value: "4.52 mmol/L (NORMAL)",                          source_page: 12, source_text: "K+ 4,52 mmol/l [3,5-5]",                                                                                                                                    confidence: { level: "high",   reason: "Kết quả XN từ phiếu HIS one-token-per-line" },                       source_method: "his_parsed" },
    { field: "department_stays[0].lab_results.Troponin_I",    value: "4.3 pg/mL (NORMAL <17)",                        source_page: 13, source_text: "Troponin I 4,3 pg/ml [<17]",                                                                                                                                 confidence: { level: "high",   reason: "Kết quả XN từ phiếu HIS one-token-per-line" },                       source_method: "his_parsed" },
    { field: "department_stays[0].lab_results.Glucose",       value: "9.8 mmol/L (HIGH)",                             source_page: 10, source_text: "Glucose 9,8 mmol/l [3,9-6,4]  cao",                                                                                                                          confidence: { level: "high",   reason: "Kết quả XN từ phiếu HIS one-token-per-line" },                       source_method: "his_parsed" },
  ],

  // ── COVERAGE AUDIT — Trạng thái phủ tầm dữ liệu theo từng khoa ──
  // Đây là dữ liệu FACTUAL về tình trạng extraction — không phải nhận định AI
  // cause: null | "scan_only" | "extraction_incomplete" | "dept_not_found"
  coverage_audit: {
    departments_found: ["Cấp cứu – HSTC – CĐ", "Hồi sức 1"],
    per_department: [
      {
        department:      "Cấp cứu – HSTC – CĐ",
        expected_groups: ["diagnoses", "medications", "lab_results", "imaging_results", "clinical_course_raw", "doctor_notes_raw"],
        missing:         [],
        cause:           null,
        needs_retry:     false,
      },
      {
        department:      "Hồi sức 1",
        expected_groups: ["diagnoses", "medications", "lab_results", "imaging_results", "clinical_course_raw", "doctor_notes_raw"],
        missing:         ["lab_results (kết quả XN ngày 09-10/05 chưa ghi vào)"],
        cause:           "extraction_incomplete",
        needs_retry:     false,
      }
    ],
    scan_pages_not_processed: [],  // page_num của scan-only pages chưa đọc được text
    overall_completeness_pct:  90,
    ready_for_analysis:        true,
  },

  // ── A.1 Danh sách biểu mẫu ──
  // canonical_id: xem bảng lookup trong SKILL.md §"Canonical field IDs"
  // icon: "✅" Đạt | "⚠️" Cần bổ sung | "❌" Thiếu/Không tìm thấy
  // Nguyên tắc STT 1-3 (bệnh án + tổng kết): nếu admission_workup/discharge_summary đã có
  //   nội dung → KHÔNG đánh ❌. Trang bìa scan → ⚠️ "present (scan)".
  bieu_mau: [
    { stt: "1",     canonical_id: "MS_01_BV_01_COVER", ten: "Trang bìa (MS 01/BV-01)",                              ket_qua: "Có — trường \"Ra viện\" bỏ trống trên trang bìa",          icon: "⚠️" },
    { stt: "2",     canonical_id: "MS_01_BV_01_BA",    ten: "Bệnh án nội khoa (MS 01/BV-01)",                        ket_qua: "Đầy đủ. Chữ ký Trưởng khoa (Chu Hồng Thanh) và Giám đốc", icon: "✅" },
    { stt: "3",     canonical_id: "MS_01_BV_01_TK",    ten: "Tổng kết bệnh án",                                      ket_qua: "Có. Chữ ký bác sĩ điều trị Vũ Văn Lâm. Ghi rõ chẩn đoán", icon: "✅" },
    { stt: "4",     canonical_id: "MS_40_BV2",          ten: "Giấy cung cấp thông tin & cam kết nhập viện",           ket_qua: "Có. Người nhà (Tống Văn Nghĩa) ký và điểm chỉ",            icon: "✅" },
    { stt: "5",     canonical_id: "MS_TN_DV",           ten: "Giấy tự nguyện sử dụng dịch vụ theo yêu cầu",          ket_qua: "Có",                                                       icon: "✅" },
    { stt: "6",     canonical_id: "MS_DI_UNG",          ten: "Phiếu khai thác tiền sử dị ứng",                       ket_qua: "Có. Tất cả 6 mục xác nhận không dị ứng",                   icon: "✅" },
    { stt: "7",     canonical_id: "MS_17_BV2",          ten: "Phiếu xét nghiệm huyết học (05/05)",                   ket_qua: "Có. Chữ ký bác sĩ chỉ định và Trưởng khoa XN",             icon: "✅" },
    { stt: "8–10",  canonical_id: "MS_22_BV02",         ten: "Phiếu xét nghiệm hóa sinh — 3 lần (full panel)",       ket_qua: "Có đủ 3 phiếu. Bao phủ 05/05 đêm đến 06/05 sáng",         icon: "✅" },
    { stt: "11",    canonical_id: "MS_XN_DAC_BIET",     ten: "Phiếu kết quả xét nghiệm đặc biệt (Troponin, AFP...)", ket_qua: "Có",                                                       icon: "✅" },
    { stt: "12–13", canonical_id: "MS_12_BV02",         ten: "Phiếu điện tim — 2 lần (05/05 và 07/05)",              ket_qua: "Có. Cân nặng và chiều cao bỏ trống trên cả 2 phiếu",        icon: "⚠️" },
    { stt: "14",    canonical_id: "MS_08_BV2",          ten: "Phiếu chiếu/chụp X-quang ngực (07/05)",                ket_qua: "Có. Kết luận ghi rõ. Bác sĩ chuyên khoa ký",               icon: "✅" },
    { stt: "15–16", canonical_id: "MS_11_BV02",         ten: "Phiếu siêu âm ổ bụng + siêu âm tim màu (07/05)",      ket_qua: "Có đủ 2 phiếu. Bác sĩ chuyên khoa Đinh Ngọc ký",          icon: "✅" },
    { stt: "17",    canonical_id: "MS_TRUYEN_DICH",     ten: "Phiếu theo dõi truyền dịch (05/05 → 11/05)",           ket_qua: "Có. Ghi đầy đủ tên dịch, số lô, tốc độ, giờ, ĐD ký",      icon: "✅" },
    { stt: "18",    canonical_id: "MS_37_BV2",          ten: "Phiếu theo dõi và chăm sóc cấp 1 (MS 37/BV2)",        ket_qua: "Có — ô Tổng nhập / Tổng xuất nước tiểu không có số liệu",  icon: "⚠️" },
    { stt: "19",    canonical_id: "MS_38_BV1",          ten: "Phiếu theo dõi và chăm sóc cấp 2-3 (MS 38/BV1)",      ket_qua: "Có đủ. Bao phủ 06/05 → 11/05. Chữ ký điều dưỡng đủ",      icon: "✅" },
    { stt: "20",    canonical_id: "MS_36_BV2",          ten: "Phiếu theo dõi điều trị (MS 36/BV2) — 11 tờ",         ket_qua: "Có đủ. Ghi nhận diễn biến và y lệnh đầy đủ mỗi ngày",      icon: "✅" },
    { stt: "21–23", canonical_id: "MS_GDSK",            ten: "Phiếu tư vấn hướng dẫn giáo dục sức khỏe (I/II/III)", ket_qua: "Có đủ 3 giai đoạn. Người thực hiện và người nhà ký đủ",    icon: "✅" },
    { stt: "24",    canonical_id: "MS_DINH_DUONG",      ten: "Phiếu sàng lọc và đánh giá tình trạng dinh dưỡng",    ket_qua: "Có. Không có nguy cơ suy dinh dưỡng (BMI 24.2)",           icon: "✅" },
    { stt: "25",    canonical_id: "MS_02",               ten: "Giấy ra viện (MS 02)",                                  ket_qua: "Có. Ký Chu Hồng Thanh và Giám đốc Bùi Minh Khôi",         icon: "✅" },
    { stt: "26–27", canonical_id: "MS_BANG_KE",         ten: "Bảng kê chi phí điều trị nội trú (BHYT + ngoài BHYT)", ket_qua: "Có đủ. Người bệnh xác nhận điểm chỉ. Kế toán ký",         icon: "✅" },
  ],

  // ── ICD SUMMARY (cho jsonData.icd) ──
  // Tóm tắt phân tích mã ICD — điền sau khi hoàn tất Section B.5
  icd_summary: {
    ma_chinh_ghi_trong_ho_so: "I20.0",
    ten_chinh:                 "Cơn đau thắt ngực không ổn định",
    ma_kem_ghi_trong_ho_so:   ["E87.6", "R07.3"],
    ten_kem:                   ["Hạ kali máu", "Đau ngực khác"],
    danh_gia_ma_chinh:         "SAI — Chưa đủ tiêu chuẩn xác nhận UAP (ECG bình thường, Troponin âm tính, Echo bình thường). Cần mã theo dõi Z03.4.",
    danh_gia_ma_kem_r073:      "SAI — Mã triệu chứng R07.3 không được dùng kèm mã chẩn đoán đã giải thích triệu chứng đó (I20.0 hoặc Z03.4).",
    ma_de_nghi_chinh:          "Z03.4",
    ten_de_nghi_chinh:         "Theo dõi nghi ngờ nhồi máu cơ tim",
    ma_de_nghi_kem:            ["E87.6"],
    co_so_phap_ly:             "QĐ 4469/QĐ-BYT — Quy tắc 1: Chẩn đoán theo dõi/nghi ngờ dùng Z03.x"
  },

  // ── ICD STRUCTURED (cho jsonData.icd — DÙNG CHO BÁO CÁO TỔNG HỢP) ──
  // Khác icd_summary (prose, chỉ vào DOCX): đây là block ĐẾM SỐ có cấu trúc,
  // an toàn để aggregate chất lượng mã toàn trung tâm (tong-hop-skill §II-bis).
  // Điền sau Section B.5. loai_loi ∈ thieu_ky_tu|sai_ten|khong_ton_tai|khong_dac_hieu|thieu_ma_kem
  // muc_do ∈ cao|trung binh|thap. Nếu không phân tích ICD → để icd: null.
  icd: {
    ma_chinh:    { code: "I20.0", ten: "Cơn đau thắt ngực không ổn định", status: "loi" }, // valid|loi
    ma_kem_theo: [
      { code: "E87.6", ten: "Hạ kali máu", status: "valid" },
      { code: "R07.3", ten: "Đau ngực khác", status: "loi" }
    ],
    tong_ma:   3,
    ma_hop_le: 1,
    ma_loi:    2,
    loi_chi_tiet: [
      { code: "I20.0", loai_loi: "sai_ten",      mo_ta: "Chưa đủ tiêu chuẩn UAP (ECG/Troponin/Echo bình thường) — nên Z03.4", muc_do: "cao" },
      { code: "R07.3", loai_loi: "khong_dac_hieu", mo_ta: "Mã triệu chứng không dùng kèm mã chẩn đoán đã giải thích triệu chứng", muc_do: "trung binh" }
    ]
  },

  // ── LÂM SÀNG TỔNG HỢP (cho jsonData.lam_sang) ──
  // Tóm tắt kết quả đánh giá lâm sàng toàn bộ — điền sau Section B
  lam_sang_tomtat: {
    chan_doan_chinh:          "I20.0 — Cơn đau thắt ngực không ổn định",
    muc_do_bang_chung:        "Có căn cứ một phần",
    ly_do_bang_chung:         "Triệu chứng gợi ý (tức ngực, tiền sử hạ kali) nhưng ECG bình thường cả 2 lần, Troponin âm tính, Echo bình thường — chưa đủ tiêu chuẩn xác nhận UAP.",
    chan_doan_kem_e876:       "E87.6 Hạ kali máu — Xác nhận (K+ 2.5 mmol/L, đáp ứng điều trị tốt)",
    dieu_tri_danh_gia:        "Điều trị hạ kali phù hợp và thành công. Không có thuốc đặc hiệu cho UAP (aspirin, statin, chống đông) — phù hợp với bệnh cảnh chưa xác nhận.",
    phat_hien_phu_chua_xu_tri:["Glucose 9.8 mmol/L — chưa đánh giá ĐTĐ", "WBC 3.2 G/L (↓) — chưa bình luận", "XQ phổi tăng đậm 2 phế quản — chưa theo dõi"],
    cls_thieu:                ["Troponin lần 2 (cần tại 3-6h để loại trừ NSTEMI)"],
    verdict:                  "Chấp nhận được",
    verdict_color:            "amber"
  },

  // ── KẾT LUẬN ĐÁNH GIÁ (cho jsonData.ket_luan) ──
  ket_luan: {
    tong_the:            "Chấp nhận được",
    tong_the_color:      "amber",
    loi_noi_bat:         ["Sai mã ICD bệnh chính: I20.0 → Z03.4 (ảnh hưởng BHYT)", "Thiếu Troponin lần 2 (3-6h)", "Glucose 9.8 mmol/L chưa được đánh giá và theo dõi"],
    diem_manh:           ["Điều trị hạ kali bài bản và thành công", "Timeline nhất quán, không mâu thuẫn", "Đủ 27 biểu mẫu bắt buộc"],
    can_bac_si_review:   true,
    ly_do_review:        "Sai mã ICD ảnh hưởng thanh toán BHYT; glucose tăng cần theo dõi ngoại trú"
  },

  // ── A.1 Tóm tắt thiếu sót hình thức ──
  // cause: "missing_field" | "policy_exception" | "form_not_applicable" | "scan_unreadable" | "other"
  //   - missing_field:       Trường bắt buộc thực sự bị bỏ trống, không có lý do ngoại lệ
  //   - policy_exception:    Quy định nội bộ TTYT không yêu cầu điền trường này
  //   - form_not_applicable: Biểu mẫu tại TTYT không có trường này
  //   - scan_unreadable:     Không đọc được do scan chất lượng thấp
  thieu_sot: [
    { muc_do: "Cần bổ sung", noi_dung: "Trường \"Ra viện\" bỏ trống trên trang bìa",                   trang: "Trang 1",      cause: "policy_exception" },
    { muc_do: "Cần bổ sung", noi_dung: "Cân nặng và chiều cao bỏ trống trên cả 2 phiếu điện tim",     trang: "Trang 15, 16", cause: "form_not_applicable" },
    { muc_do: "Cần bổ sung", noi_dung: "Ô Tổng nhập / Tổng xuất trong phiếu chăm sóc cấp 1 không có số liệu", trang: "Trang 22", cause: "missing_field" },
    { muc_do: "Lưu ý",       noi_dung: "Trường \"Số lưu trữ\" bỏ trống trên trang bìa và bệnh án",     trang: "Trang 1, 2",  cause: "policy_exception" },
  ],

  // ── A.2 Timeline ──
  timeline: [
    { tg: "05/05 – 21:38",      su_kien: "Bệnh nhân đăng ký vào khám, nhập cấp cứu với triệu chứng tức ngực, tê yếu 2 chân",   nhan_xet: "Hợp lệ" },
    { tg: "05/05 – 21:40",      su_kien: "Vào khoa, y lệnh đầu tiên: xét nghiệm + điện tim + truyền dịch",                       nhan_xet: "Phản ứng nhanh (2 phút sau đăng ký) — phù hợp cấp cứu" },
    { tg: "05/05 – 22:16",      su_kien: "Kết quả điện tim trả về: nhịp xoang bình thường",                                       nhan_xet: "Hợp lệ (36 phút sau y lệnh)" },
    { tg: "05/05 – 22:20",      su_kien: "Kết quả công thức máu trả về",                                                          nhan_xet: "Hợp lệ (40 phút)" },
    { tg: "05/05 – 22:35",      su_kien: "Kết quả hóa sinh: K⁺ 2.5 mmol/L xác nhận hạ kali",                                     nhan_xet: "Hợp lệ (55 phút)" },
    { tg: "05/05 – 23:09",      su_kien: "Kết quả Troponin I, AFP, CA19-9, Ferritin trả về",                                      nhan_xet: "Hợp lệ (~1,5 giờ sau lấy máu)" },
    { tg: "05/05 – 23:30",      su_kien: "Bác sĩ ghi nhận K⁺, y lệnh lặp điện giải",                                             nhan_xet: "Theo dõi đúng sau khi có kết quả K⁺ thấp" },
    { tg: "06/05 – 00:12",      su_kien: "Kết quả điện giải lần 2: K⁺ 2.52 mmol/L — chưa cải thiện",                             nhan_xet: "Hợp lệ" },
    { tg: "06/05 – 00:30",      su_kien: "Tăng liều KCl lên 4 ống",                                                               nhan_xet: "Điều chỉnh liều kịp thời khi K⁺ không cải thiện ✅" },
    { tg: "06/05 – 04:50→06:16","su_kien": "Kết quả điện giải lần 3: K⁺ 4.52 mmol/L — bình thường hóa",                          nhan_xet: "Điều trị thành công ✅" },
    { tg: "07/05 – 07:46",      su_kien: "Y lệnh: X-quang ngực, điện tim lần 2, siêu âm tim và ổ bụng",                          nhan_xet: "Ngày thứ 3 — hợp lý cho tuyến cơ sở" },
    { tg: "07/05 – 14:05→15:07","su_kien": "Kết quả siêu âm tim, ổ bụng, X-quang ngực trả về",                                   nhan_xet: "Hợp lệ" },
    { tg: "11/05 – 07:46→11:56","su_kien": "Y lệnh buổi sáng và truyền dịch cuối cùng",                                          nhan_xet: "Không có y lệnh active còn tồn đọng khi ra viện ✅" },
    { tg: "11/05 – 15:25",      su_kien: "Bệnh nhân xuất viện với tình trạng ổn định",                                            nhan_xet: "Hợp lệ" },
  ],

  // ══════════════════════════════════════════════════════════════════
  // RAW TIMELINE — sự kiện thực tế từ hồ sơ (factual, không AI commentary)
  // Đây là dữ liệu KHÁCH QUAN — chỉ ghi những gì có trong PDF, không đánh giá
  // ══════════════════════════════════════════════════════════════════
  timeline_raw: [
    { datetime: "05/05/2026 21:38", department: "Cấp cứu – HSTC – CĐ",
      event: "BN nhập viện cấp cứu. Tỉnh, tức ngực trái, tê yếu 2 chân. SpO2 98%, mạch 90 l/ph, HA 130/80 mmHg.",
      event_type: "admission", source_page: 12 },
    { datetime: "05/05/2026 21:40", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh: CTM, điện giải (K+, Na+, Cl-), Troponin I, CK, CK-MB, AFP, CA19-9, Ferritin, Insulin, Glucose, Lipid, ECG. KCl 10% 2 ống + NaCl 500mL TTM. Vitamin B1 100mg TM.",
      event_type: "order", source_page: 12 },
    { datetime: "05/05/2026 22:16", department: "Cấp cứu – HSTC – CĐ",
      event: "ECG: nhịp xoang đều, tần số 88 l/ph, trục bình thường, không ST chênh, không T âm.",
      event_type: "result", source_page: 15 },
    { datetime: "05/05/2026 22:20", department: "Cấp cứu – HSTC – CĐ",
      event: "CTM: WBC 3.2 G/L (↓ ngưỡng 4.0–10.0), RBC 5.0, Hb 149 g/L, PLT 180.",
      event_type: "result", source_page: 44 },
    { datetime: "05/05/2026 22:35", department: "Cấp cứu – HSTC – CĐ",
      event: "Điện giải: K+ 2.5 mmol/L (↓↓ ngưỡng 3.5–5.0), Na+ 138 mmol/L, Cl- 103 mmol/L.",
      event_type: "result", source_page: 43 },
    { datetime: "05/05/2026 23:09", department: "Cấp cứu – HSTC – CĐ",
      event: "Troponin I 4.3 pg/mL (ngưỡng <17 âm tính). CK 80.4 U/L, CK-MB 13.4 U/L. Glucose 9.8 mmol/L (↑ ngưỡng 4.1–6.1). AFP 3.81 ng/mL. CA19-9 <0.8 U/mL. Insulin 10.3 µIU/mL.",
      event_type: "result", source_page: 43 },
    { datetime: "05/05/2026 23:30", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh: lặp điện giải (K+).",
      event_type: "order", source_page: 13 },
    { datetime: "06/05/2026 00:12", department: "Cấp cứu – HSTC – CĐ",
      event: "Điện giải lần 2: K+ 2.52 mmol/L (vẫn thấp).",
      event_type: "result", source_page: 43 },
    { datetime: "06/05/2026 00:30", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh: tăng KCl lên 4 ống (40 mEq) + NaCl 500mL TTM.",
      event_type: "order", source_page: 13 },
    { datetime: "06/05/2026 04:50", department: "Cấp cứu – HSTC – CĐ",
      event: "Điện giải lần 3: K+ 4.52 mmol/L (bình thường).",
      event_type: "result", source_page: 43 },
    { datetime: "06/05/2026 06:16", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh: Ringer Lactate 500mL TTM duy trì.",
      event_type: "order", source_page: 13 },
    { datetime: "06/05/2026 07:46", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh: KCl uống 500mg × 3 lần/ngày. Vitamin B1 100mg uống.",
      event_type: "order", source_page: 14 },
    { datetime: "07/05/2026 07:46", department: "Cấp cứu – HSTC – CĐ",
      event: "Y lệnh CLS: XQ ngực thẳng, ECG lần 2, siêu âm tim màu, siêu âm ổ bụng.",
      event_type: "order", source_page: 16 },
    { datetime: "07/05/2026 14:05", department: "Cấp cứu – HSTC – CĐ",
      event: "SA tim: EF 64%, FS 35%, không rối loạn vận động thành, van tim bình thường. SA ổ bụng: nang thận trái 10mm (lành tính), gan lách tụy bình thường.",
      event_type: "result", source_page: 17 },
    { datetime: "07/05/2026 15:07", department: "Cấp cứu – HSTC – CĐ",
      event: "XQ ngực thẳng: tim không to (CTN bình thường). Phổi tăng đậm 2 phế quản. Không tràn dịch, tràn khí màng phổi. ECG lần 2: nhịp xoang bình thường.",
      event_type: "result", source_page: 16 },
    { datetime: "08/05/2026", department: "Hồi sức 1",
      event: "BN chuyển từ Cấp cứu sang Hồi sức 1. Tỉnh táo, không còn tức ngực, không tê chân. SpO2 98%, HA 125/78, mạch 82. Y lệnh: KCl uống 500mg × 3/ngày, Vitamin B1 100mg uống, theo dõi VSS × 4/ngày.",
      event_type: "transfer_in", source_page: 30 },
    { datetime: "09/05/2026", department: "Hồi sức 1",
      event: "BN dễ chịu, ăn uống được. SpO2 98%, HA 120/75, mạch 80. Duy trì y lệnh uống thuốc.",
      event_type: "note", source_page: 33 },
    { datetime: "10/05/2026", department: "Hồi sức 1",
      event: "Tình trạng ổn định. BN đi lại được trong phòng. SpO2 98%, HA 118/75, mạch 78. Dự kiến ra viện ngày mai.",
      event_type: "note", source_page: 35 },
    { datetime: "11/05/2026 07:46", department: "Hồi sức 1",
      event: "Y lệnh buổi sáng cuối: Ringer Lactate 500mL TTM lần cuối.",
      event_type: "order", source_page: 37 },
    { datetime: "11/05/2026 11:56", department: "Hồi sức 1",
      event: "Hoàn tất điều trị. SpO2 98%, HA 125/75, mạch 80. Không còn triệu chứng.",
      event_type: "note", source_page: 37 },
    { datetime: "11/05/2026 15:25", department: "Hồi sức 1",
      event: "Bệnh nhân xuất viện tình trạng ổn định. Hình thức ra viện: Ra viện.",
      event_type: "discharge", source_page: 57 },
  ],

  // ── MÃ ICD TRONG HỒ SƠ (factual — ghi chép thực tế, không có AI evaluation) ──
  icd_codes_in_record: [
    { ma: "I20.0", ten_ghi_trong_ho_so: "Cơn đau thắt ngực không ổn định (Theo dõi)", vi_tri: "Bệnh chính — vào viện và ra viện", source_page: 36 },
    { ma: "E87.6", ten_ghi_trong_ho_so: "Hạ kali máu (Theo dõi)",                      vi_tri: "Bệnh kèm — vào viện và ra viện",   source_page: 36 },
    { ma: "R07.3", ten_ghi_trong_ho_so: "Đau ngực khác",                               vi_tri: "Bệnh kèm — ra viện",               source_page: 47 },
  ],

  // ── A.3 Cảnh báo ICD sơ bộ ── (AI analysis — chỉ dùng cho DOCX, không ghi vào JSON)
  icd_canh_bao: [
    { ma: "I20.0", ten: "Cơn đau thắt ngực không ổn định", vi_tri: "Bệnh chính (cả vào và ra viện)", canh_bao: "SAI — I20.0 là mã xác nhận bệnh, không dùng cho chẩn đoán theo dõi/nghi ngờ" },
    { ma: "E87.6", ten: "Hạ kali máu",                      vi_tri: "Bệnh kèm theo",                  canh_bao: "Phù hợp — có xét nghiệm xác nhận K⁺ 2.5 mmol/L" },
    { ma: "R07.3", ten: "Đau ngực khác",                    vi_tri: "Bệnh kèm theo",                  canh_bao: "SAI — mã triệu chứng không dùng kèm mã chẩn đoán đã giải thích triệu chứng đó" },
  ],

  // ── B.1 Tiêu chí chẩn đoán UAP / I20.0 ──
  tieu_chi_uap: [
    { tieu_chi: "Triệu chứng lâm sàng",   yeu_cau: "Đau/tức ngực điển hình hoặc tương đương",              ket_qua: "Tức nặng ngực trái, hồi hộp, khó thở nhẹ (trang 8–9)",                          danh_gia: "Ủng hộ",        icon: "✅" },
    { tieu_chi: "Biến đổi điện tim",       yeu_cau: "ST chênh ≥ 0.5 mm hoặc T âm ≥ 1 mm",                  ket_qua: "Điện tim lần 1 (05/05): hoàn toàn bình thường. Lần 2 (07/05): bình thường",   danh_gia: "Không ủng hộ",  icon: "❌" },
    { tieu_chi: "Troponin I",              yeu_cau: "Tăng vượt ngưỡng, đo ≥ 2 lần",                         ket_qua: "Troponin I = 4.3 pg/ml (ngưỡng < 17 pg/ml). Chỉ đo 1 lần",                     danh_gia: "Không ủng hộ",  icon: "❌" },
    { tieu_chi: "Men tim CK / CK-MB",      yeu_cau: "CK-MB > 24 U/L",                                       ket_qua: "CK = 80.4 U/L (bình thường). CK-MB = 13.4 U/L (bình thường)",                  danh_gia: "Không ủng hộ",  icon: "❌" },
    { tieu_chi: "Siêu âm tim",             yeu_cau: "Rối loạn vận động thành tim vùng",                     ket_qua: "EF 64%, FS 35%. Không ghi nhận rối loạn vận động thành",                       danh_gia: "Không ủng hộ",  icon: "❌" },
    { tieu_chi: "Yếu tố nguy cơ tim mạch", yeu_cau: "Nam, tuổi, tiền sử bệnh",                              ket_qua: "Nam 46 tuổi. Không ghi nhận THA, ĐTĐ, hút thuốc trong hồ sơ",                  danh_gia: "Trung bình",    icon: "⚠️" },
  ],

  // ── B.1 Tiêu chí E87.6 ──
  tieu_chi_kali: [
    { tieu_chi: "Xét nghiệm xác nhận", noi_dung: "K⁺ = 2.5 mmol/L (05/05, 22:35) và K⁺ = 2.52 mmol/L (06/05, 00:12)", danh_gia: "Xác nhận",   icon: "✅" },
    { tieu_chi: "Phù hợp lâm sàng",   noi_dung: "Tê yếu 2 chân, khó đi lại, tức ngực — biểu hiện điển hình hạ kali",  danh_gia: "Phù hợp",    icon: "✅" },
    { tieu_chi: "Tiền sử",            noi_dung: "Đã điều trị hạ kali tại Bệnh viện Việt Tiệp (5 tháng trước)",         danh_gia: "Củng cố",    icon: "✅" },
  ],

  // ── B.1 Phát hiện lâm sàng phụ chưa giải quyết ──
  phat_hien_phu: [
    { phat_hien: "Glucose máu", gia_tri: "9.8 mmol/L (↑↑)", tieu_chuan: "BYT QĐ 3319/QĐ-BYT 2017: Glucose ngẫu nhiên ≥ 11.1 → nghi ĐTĐ; cần xác nhận", van_de: "Không có theo dõi glucose lần 2. Không có HbA1c hoặc hướng xử trí" },
    { phat_hien: "Bạch cầu (WBC)", gia_tri: "3.2 G/L (↓)\n(bình thường: 5–10 G/L)", tieu_chuan: "Giảm bạch cầu: cần theo dõi và tìm nguyên nhân", van_de: "Không được bình luận trong hồ sơ. Cần tái kiểm" },
    { phat_hien: "Cholesterol toàn phần", gia_tri: "3.4 mmol/L (↓)\n(bình thường: 3.9–5.2)", tieu_chuan: "Cholesterol thấp có thể gặp trong suy dinh dưỡng hoặc bệnh lý khác", van_de: "Không được đề cập. Cần ghi nhận và theo dõi" },
    { phat_hien: "X-quang: \"Phổi tăng đậm 2 phế quản\"", gia_tri: "Kết quả 07/05", tieu_chuan: "Có thể gặp trong viêm phế quản mạn tính, nhiễm trùng", van_de: "Không được nhắc lại trong phiếu theo dõi điều trị sau 07/05" },
    { phat_hien: "Nguyên nhân hạ kali tái phát", gia_tri: "Hạ kali lần 2 trong 5 tháng", tieu_chuan: "Hướng dẫn BYT: hạ kali tái phát cần tìm nguyên nhân", van_de: "Không có bất kỳ đánh giá nguyên nhân nào được ghi nhận" },
  ],

  // ── B.2 Điều trị kali ──
  dieu_tri_kali: [
    { tg: "05/05 – 21:40",      y_lenh: "KCl 10% 2 ống (= 20 mEq) pha NaCl 500ml, truyền tĩnh mạch", k: "Chưa có kết quả",       danh_gia: "Bắt đầu sớm khi lâm sàng gợi ý với tiền sử hạ kali ✅" },
    { tg: "05/05 – 23:30",      y_lenh: "Y lệnh lặp điện giải",                                        k: "K⁺ = 2.52 mmol/L",      danh_gia: "Theo dõi sát — phù hợp hướng dẫn ✅" },
    { tg: "06/05 – 00:30",      y_lenh: "Tăng KCl lên 4 ống (= 40 mEq) pha NaCl 500ml",              k: "K⁺ = 2.52 mmol/L",      danh_gia: "Tăng liều kịp thời. Tốc độ ~15 mEq/h qua ngoại vi — trong giới hạn ✅" },
    { tg: "06/05 – 04:50→06:16","y_lenh": "Ringer Lactate (duy trì)",                                  k: "K⁺ = 4.52 mmol/L ✅",   danh_gia: "Bình thường hóa thành công. Chuyển sang duy trì đúng" },
    { tg: "06/05 – 07:46 →",    y_lenh: "KCl uống 500mg × 3 lần/ngày + Vitamin B1",                  k: "K⁺ = 4.52",             danh_gia: "Duy trì đường uống đúng khi K⁺ > 3.5 mmol/L ✅" },
  ],

  // ══════════════════════════════════════════════════════
  // B.2 MỞ RỘNG — ĐÁNH GIÁ ĐIỀU TRỊ & DƯỢC LÂM SÀNG (v4.1)
  // Xem references/treatment-pharmacy-review.md. Field rỗng → bỏ qua khi render.
  // ══════════════════════════════════════════════════════
  // B.2.1 + B.2.2 — Dược lâm sàng từng thuốc (ví dụ thực ca này)
  dieu_tri_danh_gia: [
    { ten_thuoc: "Kali clorid (KCl 10%)", nhom: "Bù điện giải", chi_dinh_cho: "Hạ kali máu (E87.6)",
      lieu_dung: "20→40 mEq pha NaCl 500ml", duong: "Truyền TM ngoại vi", nhip: "~15 mEq/h", thoi_gian: "05/05–06/05",
      lieu_chuan: "Tối đa ngoại vi 20 mEq/h; ≤40 mEq/500ml", chinh_than_gan: "Thận trọng nếu suy thận (chưa ghi eGFR)",
      chong_chi_dinh: "Tăng kali, suy thận nặng — không ghi nhận", tuong_tac: "Không dùng kèm lợi tiểu giữ kali/ƯCMC (không có trong hồ sơ)",
      theo_doi: "Điện giải đồ mỗi 2–4h + ECG — hồ sơ có làm 3 lần", muc_do: "✅",
      nhan_xet: "Liều, tốc độ, theo dõi đúng phác đồ [3]. Nên ghi eGFR trước bù.", trang: "y lệnh 05–06/05" },
    { ten_thuoc: "Paracetamol (Partamol) 500mg", nhom: "Giảm đau", chi_dinh_cho: "Đau ngực triệu chứng",
      lieu_dung: "2 viên × 2–3 lần/ngày", duong: "Uống", nhip: "2–3 lần/ngày", thoi_gian: "trong đợt",
      lieu_chuan: "≤4 g/ngày (≤3 g nếu nguy cơ gan)", chinh_than_gan: "Giảm liều nếu suy gan/nghiện rượu",
      chong_chi_dinh: "Suy gan nặng", tuong_tac: "Thận trọng với warfarin nếu dùng kéo dài (không có)",
      theo_doi: "Tổng liều/ngày", muc_do: "⚠️",
      nhan_xet: "Hợp lý cho đau nhẹ; KHÔNG phải thuốc đặc hiệu UAP. Kiểm tổng liều ≤4g.", trang: "y lệnh" },
    { ten_thuoc: "Vitamin B1 (Thiamin)", nhom: "Vitamin", chi_dinh_cho: "Bổ trợ",
      lieu_dung: "Theo y lệnh", duong: "Uống", nhip: "1 lần/ngày", thoi_gian: "duy trì",
      lieu_chuan: "—", chinh_than_gan: "Không cần", chong_chi_dinh: "Hiếm dị ứng", tuong_tac: "Không đáng kể",
      theo_doi: "—", muc_do: "◻️", nhan_xet: "Chỉ định bổ trợ, không rõ căn cứ bệnh lý cụ thể trong hồ sơ.", trang: "y lệnh" },
  ],
  tuong_tac_thuoc: [],   // Không ghi nhận cặp tương tác có ý nghĩa trong ca này
  // B.2.3 — Đáp ứng điều trị theo thời gian
  dap_ung_dieu_tri: [
    { moc_tg: "05/05 22:35", dien_bien: "K⁺ 2.5; tê yếu 2 chân, tức ngực", dap_ung: "—", dieu_chinh_y_lenh: "Bắt đầu bù KCl TM", phu_hop: "✅", ghi_chu: "Khởi trị sớm đúng" },
    { moc_tg: "06/05 00:12", dien_bien: "K⁺ 2.52 (chưa lên)", dap_ung: "Không đổi", dieu_chinh_y_lenh: "Tăng KCl 20→40 mEq", phu_hop: "✅", ghi_chu: "Leo thang kịp thời" },
    { moc_tg: "06/05 06:16", dien_bien: "K⁺ 4.52; hết tê yếu", dap_ung: "Cải thiện", dieu_chinh_y_lenh: "Chuyển KCl uống + duy trì", phu_hop: "✅", ghi_chu: "Bình thường hóa ~7h, xuống thang đúng" },
  ],
  // B.2.4 — Thay đổi chẩn đoán & bổ sung CLS
  thay_doi_chan_doan: [
    { moc: "Vào → ra viện", tu_cd: "TD UAP (I20.0) + hạ kali", sang_cd: "Giữ I20.0 + E87.6", ly_do: "ECG/Troponin/Echo âm tính nhưng chẩn đoán không hạ cấp về Z03.4", cls_bo_sung: "Thiếu Troponin lần 2; chưa truy nguyên nhân hạ kali tái phát", phu_hop: "⚠️" },
  ],
  dieu_tri_tomtat: { muc_do: "Phù hợp một phần",
    noi_dung: "Điều trị hạ kali (E87.6) đúng dược lâm sàng và đáp ứng tốt. Phần UAP: không dùng phác đồ đặc hiệu (chấp nhận được vì chỉ 'theo dõi') nhưng hồ sơ chưa ghi lý do không dùng; chẩn đoán không được hạ cấp dù CLS âm tính, và chưa bổ sung Troponin lần 2/truy nguyên nhân hạ kali tái phát. Đề nghị DSLS rà tổng liều Paracetamol và ghi eGFR trước bù kali." },

  // ── B.3: BẢNG KẾT QUẢ XÉT NGHIỆM (giá trị thô — như docx cũ) ──
  // {ten:"", gia_tri:"", don_vi:"", tham_chieu:"", co:"" }  co ∈ ""|"↑"|"↓"|"Nguy kịch"
  bang_xet_nghiem: [
    { ten: "Kali (K⁺)",     gia_tri: "2.5 → 4.52", don_vi: "mmol/L", tham_chieu: "3.5–5.0", co: "↓→BT" },
    { ten: "Glucose",       gia_tri: "9.8",        don_vi: "mmol/L", tham_chieu: "3.9–6.4", co: "↑" },
    { ten: "Troponin I",    gia_tri: "4.3",        don_vi: "pg/mL",  tham_chieu: "<17",     co: "" },
    { ten: "CK-MB",         gia_tri: "13.4",       don_vi: "U/L",    tham_chieu: "<24",     co: "" },
    { ten: "Bạch cầu (WBC)",gia_tri: "3.2",        don_vi: "G/L",    tham_chieu: "4–10",    co: "↓" },
    { ten: "Hemoglobin",    gia_tri: "149",        don_vi: "g/L",    tham_chieu: "130–170", co: "" },
  ],
  // ── B.4: DIỄN BIẾN LÂM SÀNG (data-driven) ──
  // {ngay:"", dien_bien:"", y_lenh:"", nhan_xet:"" }
  dien_bien_lam_sang: [
    { ngay: "05/05", dien_bien: "Nhập viện tối. Tê yếu 2 chân, tức ngực, K⁺ 2.5 → đang bù kali", y_lenh: "KCl 2 ống IV + điện giải đồ theo dõi", nhan_xet: "Phản ứng nhanh, phù hợp ✅" },
    { ngay: "06/05", dien_bien: "K⁺ 2.52 → tăng KCl → K⁺ 4.52 sáng. Triệu chứng cải thiện", y_lenh: "KCl 4 ống IV → Ringer Lactate → KCl uống", nhan_xet: "Điều trị thành công ✅" },
    { ngay: "07/05", dien_bien: "CLS bổ sung: X-quang, điện tim lần 2, siêu âm tim, ổ bụng", y_lenh: "CLS bổ sung", nhan_xet: "Hợp lý, hoàn thiện đánh giá" },
    { ngay: "08–10/05", dien_bien: "Theo dõi ổn định. Tiếp tục KCl uống + Vitamin B1", y_lenh: "Điều trị duy trì", nhan_xet: "Tiếp tục duy trì đúng ✅" },
    { ngay: "11/05", dien_bien: "Ổn định. Xuất viện 15:25", y_lenh: "Y lệnh xuất viện", nhan_xet: "Ra viện đúng quy trình ✅" },
  ],

  // ── B.3 CLS thiết yếu ──
  cls_du: [
    { cls: "Công thức máu toàn bộ",    ket_qua: "Bạch cầu 3.2 G/L (↓); Hemoglobin 149 g/L (bình thường)",               vai_tro: "Loại trừ nhiễm trùng, thiếu máu cấp",             danh_gia: "✅ Đủ" },
    { cls: "Điện giải đồ × 3 lần",     ket_qua: "K⁺ 2.5 → 2.52 → 4.52 mmol/L",                                            vai_tro: "Xác nhận và theo dõi điều trị hạ kali",           danh_gia: "✅ Đủ và tốt" },
    { cls: "Troponin I",                ket_qua: "4.3 pg/ml (ngưỡng < 17 pg/ml — âm tính)",                                vai_tro: "Loại trừ nhồi máu cơ tim",                        danh_gia: "✅ Có — nhưng thiếu đo lần 2" },
    { cls: "CK và CK-MB",              ket_qua: "CK 80.4 U/L; CK-MB 13.4 U/L (cả hai bình thường)",                       vai_tro: "Loại trừ hoại tử cơ tim",                         danh_gia: "✅ Đủ" },
    { cls: "Điện tim × 2 lần",         ket_qua: "Nhịp xoang, bình thường cả 2 lần (05/05 và 07/05)",                       vai_tro: "Loại trừ thiếu máu cơ tim cấp trên điện tim",     danh_gia: "✅ Đủ" },
    { cls: "Siêu âm tim màu",          ket_qua: "EF 64%, FS 35%. Không ghi nhận bất thường vận động thành tim",            vai_tro: "Đánh giá chức năng tim, loại trừ bất thường cấu trúc", danh_gia: "✅ Đủ" },
    { cls: "X-quang ngực thẳng",       ket_qua: "Tim không to. Phổi tăng đậm 2 phế quản",                                  vai_tro: "Loại trừ suy tim, tràn dịch, tràn khí màng phổi", danh_gia: "⚠️ Có phát hiện chưa được xử trí" },
    { cls: "Siêu âm ổ bụng",           ket_qua: "Nang thận trái 10 mm. Các cơ quan khác bình thường",                     vai_tro: "Sàng lọc bệnh lý ổ bụng",                        danh_gia: "✅ Phát hiện phụ lành tính" },
  ],

  // ── B.3 CLS không rõ chỉ định ──
  cls_khong_chi_dinh: [
    { cls: "AFP (Alpha Fetoprotein)",                         ket_qua: "3.81 ng/ml (thấp hơn reference range 6.6–10.3 ng/ml của HIS)", nhan_xet: "Không có gợi ý bệnh lý ác tính trong hồ sơ. Giá trị thấp theo ngưỡng HIS" },
    { cls: "CA19-9",                                          ket_qua: "< 0.8 U/ml (bình thường)",                                      nhan_xet: "Dấu ấn ung thư tụy/đường mật — không có gợi ý lâm sàng" },
    { cls: "Ferritin",                                        ket_qua: "227.1 ng/ml (bình thường)",                                     nhan_xet: "Không rõ chỉ định trong bối cảnh UAP/hạ kali" },
    { cls: "Insulin máu",                                     ket_qua: "10.3 µIU/ml (bình thường)",                                     nhan_xet: "Không rõ chỉ định. Glucose tăng nhưng không có đánh giá ĐTĐ đi kèm" },
    { cls: "Triglyceride, Cholesterol toàn phần, HDL",        ket_qua: "Trong giới hạn bình thường",                                    nhan_xet: "Không ưu tiên trong bệnh cảnh cấp cứu. Có thể đánh giá ngoại trú" },
  ],

  // ── B.3 CLS còn thiếu ──
  cls_thieu: [
    { cls: "Troponin I lần 2 (sau 3–6 giờ)",             ly_do: "Chỉ có 1 lần đo Troponin. Cần đo lặp lại để loại trừ NSTEMI theo quy trình 0h/1h hoặc 0h/3h",          co_so: "[2] ESC 2020: Bắt buộc đo Troponin tại 0h và 1h (hoặc 3h)", uu_tien: "Cao 🔴" },
    { cls: "Glucose lần 2 / HbA1c",                      ly_do: "Glucose ngẫu nhiên 9.8 mmol/L — cần phân biệt tăng đường huyết stress hay đái tháo đường type 2",      co_so: "[4] BYT QĐ 3319/QĐ-BYT 2017",                              uu_tien: "Cao 🔴" },
    { cls: "Phân tầng nguy cơ tim mạch (GRACE score)",   ly_do: "Chưa có đánh giá phân tầng nguy cơ được ghi nhận trong hồ sơ",                                         co_so: "[1,2] ESC 2020 và BYT",                                     uu_tien: "Trung bình 🟡" },
    { cls: "Đánh giá nguyên nhân hạ kali",               ly_do: "Hạ kali tái phát lần 2 trong 5 tháng cần tìm nguyên nhân (K niệu/24h, aldosterone, renin)",            co_so: "[3] BYT QĐ 3879/QĐ-BYT",                                   uu_tien: "Trung bình 🟡" },
  ],

  // ── B.5 Phân tích ICD ──
  icd_chi_tiet: [
    { tg: "Vào viện + Ra viện", ma_dung: "I20.0", ly_do_sai: "Điện tim bình thường, Troponin âm tính, Echo bình thường — chưa đủ tiêu chuẩn xác nhận UAP. Chỉ có triệu chứng lâm sàng gợi ý", ma_dung_can: "Z03.4", ten_ma_dung: "Theo dõi nghi ngờ nhồi máu cơ tim" },
    { tg: "Ra viện (bệnh kèm)", ma_dung: "R07.3", ly_do_sai: "Mã triệu chứng không dùng khi đã có mã chẩn đoán (I20.0 hoặc Z03.4) giải thích triệu chứng đau ngực", ma_dung_can: "Bỏ", ten_ma_dung: "Không cần thiết" },
  ],

  // ── 8 câu hỏi ──
  tam_cau_hoi: [
    { cau: "Hồ sơ có đầy đủ biểu mẫu không?",         tra_loi: "Đủ 27 biểu mẫu bắt buộc. Có 3 thiếu sót nhỏ (trường bỏ trống), không thiếu biểu mẫu",  ket_qua: "⚠️ Đạt một phần", color: "amber" },
    { cau: "Chẩn đoán có đủ căn cứ không?",            tra_loi: "E87.6 (hạ kali): đủ căn cứ. I20.0 (UAP): chưa đủ — ECG + Troponin + Echo đều bình thường", ket_qua: "⚠️ Một phần",    color: "amber" },
    { cau: "Điều trị có phù hợp phác đồ không?",       tra_loi: "Điều trị hạ kali: phù hợp và thành công. UAP: không dùng thuốc đặc hiệu (aspirin, statin, chống đông)", ket_qua: "⚠️ Một phần", color: "amber" },
    { cau: "CLS có hỗ trợ chẩn đoán không?",           tra_loi: "CLS hỗ trợ tốt cho hạ kali (E87.6). Không hỗ trợ cho I20.0. Troponin thiếu lần đo thứ 2", ket_qua: "⚠️ Một phần",    color: "amber" },
    { cau: "Có mâu thuẫn trong hồ sơ không?",          tra_loi: "Không phát hiện mâu thuẫn thời gian. Timeline logic và nhất quán",                          ket_qua: "✅ Không",        color: "green" },
    { cau: "Có vấn đề mã ICD không?",                  tra_loi: "I20.0 sai (cần Z03.4). R07.3 không được phép dùng kèm",                                    ket_qua: "⛔ Có sai sót",   color: "red" },
    { cau: "Cần bác sĩ xem xét thêm không?",           tra_loi: "Cần: xem xét mã ICD; theo dõi glucose; đánh giá nguyên nhân hạ kali tái phát",             ket_qua: "✅ Cần",          color: "amber" },
    { cau: "Mức đánh giá tổng thể?",                   tra_loi: "Hồ sơ đủ biểu mẫu, điều trị hạ kali tốt. Tuy nhiên sai mã ICD ảnh hưởng thanh toán BHYT", ket_qua: "🟡 Chấp nhận được", color: "amber" },
  ],

  // ── Khuyến nghị ──
  khuyen_nghi: [
    { uu_tien: "🔴 Cao",         noi_dung: "Sửa mã ICD bệnh chính: từ I20.0 → Z03.4 (Theo dõi nghi ngờ nhồi máu cơ tim). Xóa mã R07.3 ra khỏi danh sách bệnh kèm",  co_so: "[5] QĐ 4469/QĐ-BYT",      don_vi: "Khoa điều trị + BHYT" },
    { uu_tien: "🔴 Cao",         noi_dung: "Bổ sung đo Troponin lần 2 trong các trường hợp tương tự. Trong trường hợp này đã ra viện — ghi nhận vào kinh nghiệm",   co_so: "[2] ESC 2020",            don_vi: "Khoa lâm sàng" },
    { uu_tien: "🔴 Cao",         noi_dung: "Theo dõi glucose: tái khám đo glucose lúc đói hoặc HbA1c trong vòng 1–3 tháng. Glucose ngẫu nhiên 9.8 mmol/L cần xác nhận", co_so: "[4] BYT QĐ 3319/2017",  don_vi: "Bác sĩ điều trị" },
    { uu_tien: "🟡 Trung bình",  noi_dung: "Bổ sung trường Ra viện, cân nặng/chiều cao trên phiếu điện tim, ô Tổng nhập-xuất trong phiếu chăm sóc cấp 1",           co_so: "[7] TT 32/2023",          don_vi: "Điều dưỡng trưởng" },
    { uu_tien: "🟡 Trung bình",  noi_dung: "Đánh giá nguyên nhân hạ kali tái phát: xét nghiệm K⁺ niệu/24h, aldosterone, renin trong lần tái khám tiếp theo",       co_so: "[3] BYT QĐ 3879/2014",   don_vi: "Bác sĩ điều trị" },
    { uu_tien: "🟢 Thấp",        noi_dung: "Ghi nhận và theo dõi phát hiện \"Phổi tăng đậm 2 phế quản\" (X-quang 07/05) trong lần tái khám ngoại trú tiếp theo",   co_so: "",                        don_vi: "Bác sĩ điều trị" },
  ],

  // ── EVIDENCE GROUNDING (v3.7) — bằng chứng đối chiếu đã VERIFY ──
  // Điền theo references/evidence-grounding.md (Bước G1–G5). Mỗi nhận định
  // lâm sàng ở Section B nên có ≥1 entry chống lưng. verified:false → KHÔNG trích dẫn.
  // source_tier ∈ internal_2nd_brain | moh | international_society | literature | icd
  evidence_grounding: [
    { concept: "Quy tắc mã ICD-10: chẩn đoán 'theo dõi/nghi ngờ' dùng nhóm Z03.x; mã triệu chứng R không dùng kèm mã chẩn đoán bao hàm",
      used_in: "B.5", source_tier: "moh", source: "QĐ 4469/QĐ-BYT — HD sử dụng ICD-10 trong bệnh viện",
      key_point: "Chẩn đoán chưa xác nhận → Z03.x; R-codes loại khi đã có mã bệnh bao hàm triệu chứng.",
      citation_ref: "[5]", identifier: { type: "moh_decision", value: "4469/QĐ-BYT" },
      verified: true, verify_method: "web_moh + đối chiếu icd10_lookup BYT 2026", validity: "current" },
    { concept: "Đối chiếu hệ mã: ICD-10 WHO/BYT vs ICD-10-CM (Hoa Kỳ)",
      used_in: "B.5", source_tier: "icd", source: "ICD-10-CM MCP (US 2026) + icd10_lookup.json (BYT 2026)",
      key_point: "I20.0 hợp lệ cả hai hệ; Z03.4 và R07.3 KHÔNG có trong ICD-10-CM nhưng có trong ICD-10 WHO/BYT → dùng chuẩn BYT cho hồ sơ VN.",
      citation_ref: "[5]", identifier: { type: "icd_crosscheck", value: "I20.0;Z03.4;R07.3" },
      verified: true, verify_method: "ICD MCP validate_code (live 2026-06-12)", validity: "current" },
    { concept: "Tiêu chuẩn chẩn đoán đau thắt ngực không ổn định / NSTE-ACS",
      used_in: "B.1", source_tier: "international_society", source: "2020 ESC Guidelines for ACS without persistent ST-elevation",
      key_point: "Chẩn đoán dựa biến đổi động học hs-troponin + ECG; troponin đo 1 lần bình thường không đủ xác nhận.",
      citation_ref: "[2]", identifier: { type: "doi", value: "10.1093/eurheartj/ehaa575" },
      verified: false, verify_method: "PENDING scholar-sidekick verifyCitation (network)", validity: "current" },
  ],

  // ── REASONING BOUNDARY (v3.7) — ranh giới suy luận, set theo evidence thực ──
  reasoning_boundary: {
    guideline_grounded:              true,
    guideline_sources:               ["QĐ 4469/QĐ-BYT (ICD-10)", "QĐ 1857/QĐ-BYT 2022 (tim mạch)", "QĐ 3879/QĐ-BYT 2014 (hạ kali)", "2020 ESC ACS"],
    icd_grounded:                    true,    // đã đối chiếu icd10_lookup BYT 2026
    external_medical_knowledge_used: true,    // có dùng — nhưng đã trích dẫn nguồn
    confidence_cap:                  "supported",
    confidence_cap_reason:           "Có guideline BYT + ESC đối chiếu; mã ICD đối chiếu chuẩn BYT. Một số citation quốc tế chờ verify khi mạng ổn định.",
  },

  // ── Tài liệu tham khảo (Vancouver) ──
  // (xem bên dưới — giữ ở cuối DATA{} để dễ đọc)
  // Có thể tự sinh từ evidence_grounding[] đã verified; ở đây giữ thủ công làm fallback.
  tai_lieu: [
    { n: "[1]", parts: [
      { t: "Bộ Y tế. " },
      { t: "Hướng dẫn chẩn đoán và điều trị một số bệnh về tim mạch.", b: true },
      { t: " Ban hành kèm theo Quyết định số 1857/QĐ-BYT ngày 29 tháng 4 năm 2022. Hà Nội: Bộ Y tế; 2022.", i: true },
    ]},
    { n: "[2]", parts: [
      { t: "Collet JP, Thiele H, Barbato E, et al. " },
      { t: "2020 ESC Guidelines for the management of acute coronary syndromes in patients presenting without persistent ST-segment elevation.", b: true },
      { t: " Eur Heart J. 2021;42(14):1289–1367.", i: true },
    ]},
    { n: "[3]", parts: [
      { t: "Bộ Y tế. " },
      { t: "Hướng dẫn chẩn đoán và điều trị bệnh nội tiết — chuyển hóa (Phần: Rối loạn điện giải — Hạ kali máu).", b: true },
      { t: " Ban hành kèm theo Quyết định số 3879/QĐ-BYT ngày 30 tháng 9 năm 2014. Hà Nội: Bộ Y tế; 2014.", i: true },
    ]},
    { n: "[4]", parts: [
      { t: "Bộ Y tế. " },
      { t: "Hướng dẫn chẩn đoán và điều trị đái tháo đường type 2.", b: true },
      { t: " Ban hành kèm theo Quyết định số 3319/QĐ-BYT ngày 19 tháng 7 năm 2017. Hà Nội: Bộ Y tế; 2017.", i: true },
    ]},
    { n: "[5]", parts: [
      { t: "Bộ Y tế. " },
      { t: "Hướng dẫn sử dụng ICD-10 trong bệnh viện.", b: true },
      { t: " Ban hành kèm theo Quyết định số 4469/QĐ-BYT ngày 28 tháng 11 năm 2012; cập nhật 2019. Hà Nội: Bộ Y tế; 2019.", i: true },
    ]},
    { n: "[6]", parts: [
      { t: "Kardalas E, Paschou SA, Anagnostis P, et al. " },
      { t: "Hypokalemia: a clinical update.", b: true },
      { t: " Endocr Connect. 2018;7(4):R135–R146.", i: true },
    ]},
    { n: "[7]", parts: [
      { t: "Bộ Y tế. " },
      { t: "Quy định về hồ sơ bệnh án.", b: true },
      { t: " Quy định chi tiết một số điều của Luật Khám bệnh, chữa bệnh (Điều 51 + Phụ lục XXVIII–XXIX: mẫu hồ sơ bệnh án). Có hiệu lực 01/01/2024. Hà Nội: Bộ Y tế; 2023.", i: true },
    ]},
  ],
};
