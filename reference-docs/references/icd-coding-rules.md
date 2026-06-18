# Nguyên tắc mã hóa ICD-10 trong bệnh viện
## Căn cứ: QĐ 4469/QĐ-BYT ngày 28/11/2012 (cập nhật 2019)

---

## 1. Nguyên tắc chọn bệnh chính

**Bệnh chính** là tình trạng bệnh lý được xác định là nguyên nhân chính khiến bệnh nhân phải
nhập viện, sau khi đã được khám và điều trị trong đợt nằm viện đó.

Thứ tự ưu tiên:
1. Tình trạng được điều trị trực tiếp (can thiệp, thuốc đặc hiệu)
2. Tình trạng chiếm nhiều nguồn lực nhất (xét nghiệm, theo dõi)
3. Tình trạng nguy hiểm nhất đe dọa tính mạng

**Lưu ý khi có nhiều bệnh:**
- Ghi bệnh chính trước, bệnh kèm theo sau
- Nếu biến chứng xuất phát từ bệnh chính → mã bệnh chính (có thể kèm mã biến chứng)
- Nếu điều trị một bệnh kèm là chủ yếu trong đợt này → có thể chọn bệnh kèm làm bệnh chính

---

## 2. Nguyên tắc mã hóa chẩn đoán không xác định (Theo dõi / Nghi ngờ)

### Quy tắc cốt lõi:

> Khi bệnh nhân nhập viện với chẩn đoán **nghi ngờ** hoặc **theo dõi** và sau đó chẩn đoán
> được **loại trừ** hoặc **không xác nhận** → sử dụng mã nhóm **Z03** (Theo dõi và đánh giá
> người nghi ngờ có bệnh hoặc trạng thái nào đó).

### Nhóm mã Z03 — Hay dùng:

| Mã | Mô tả | Áp dụng |
|---|---|---|
| Z03.0 | Theo dõi nghi ngờ lao | BN ho máu, xquang nghi lao nhưng chưa xác nhận |
| Z03.1 | Theo dõi nghi ngờ u ác tính | Khối u phát hiện tình cờ chưa sinh thiết |
| Z03.2 | Theo dõi nghi ngờ rối loạn tâm thần | Hành vi bất thường chưa đủ tiêu chuẩn DSM |
| Z03.3 | Theo dõi nghi ngờ bệnh thần kinh | Liệt / rối loạn vận động chưa có hình ảnh xác nhận |
| **Z03.4** | **Theo dõi nghi ngờ nhồi máu cơ tim** | **ECG + Troponin chưa xác nhận ACS/NSTEMI** |
| Z03.5 | Theo dõi nghi ngờ bệnh tim mạch khác | Nghi ngờ rối loạn nhịp, van tim... chưa xác nhận |
| Z03.6 | Theo dõi nghi ngờ ngộ độc | Nghi ngộ độc thuốc/chất chưa xác nhận |
| Z03.8 | Theo dõi nghi ngờ bệnh/trạng thái khác | Các tình trạng khác chưa phân loại |
| Z03.9 | Theo dõi nghi ngờ không xác định | Không rõ |

### Cách ghi kèm ghi chú khi ra viện:

```
Bệnh chính: Z03.4 — Theo dõi nghi ngờ nhồi máu cơ tim (đã loại trừ)
Bệnh kèm:   E87.6 — Hạ kali máu
```

---

## 3. Nguyên tắc mã triệu chứng (nhóm R)

### Quy tắc:
> Mã triệu chứng (R00–R99) CHỈ dùng khi:
> - Không có chẩn đoán xác định nào giải thích được triệu chứng đó, **VÀ**
> - Triệu chứng đó là lý do chính khiến bệnh nhân nhập viện hoặc cần điều trị

### Không được dùng mã R khi:
- Đã có mã chẩn đoán xác định bao trùm triệu chứng (ví dụ: I20.0 đã giải thích đau ngực)
- Dùng mã R kèm mã Z03.x cùng chỉ một triệu chứng (dư thừa)

### Ví dụ hay gặp:

| Tình huống | Sai | Đúng |
|---|---|---|
| Nhập viện đau ngực, nghi UAP, ECG bình thường | I20.0 + R07.3 | Z03.4 (hoặc Z03.5) |
| Nhập viện đau ngực không rõ nguyên nhân, chưa có CLS | — | R07.9 (Đau ngực không xác định) |
| UAP được xác nhận | R07.3 + I20.0 | Chỉ I20.0 |
| Nhập viện đau đầu, chưa làm CT | — | R51 (đau đầu) hoặc Z03.3 nếu nghi đột quỵ |

---

## 4. Các lỗi mã ICD phổ biến trong thực tế

### Lỗi loại 1: Dùng mã xác nhận cho chẩn đoán theo dõi

| Mã SAI | Tình huống | Mã ĐÚNG |
|---|---|---|
| I20.0 | Đau ngực, ECG bình thường, Troponin âm tính, nghi UAP | Z03.4 |
| I21.x | Nghi NMCT, chưa đủ tiêu chuẩn | Z03.4 |
| I63.x | Nghi đột quỵ nhồi máu, chưa có CT xác nhận | Z03.3 |
| J18.x | Nghi viêm phổi, chưa có Xquang xác nhận | J22 hoặc R05+R06.0 |
| K35.x | Nghi viêm ruột thừa, chưa phẫu thuật xác nhận | Z03.8 |

### Lỗi loại 2: Dùng mã triệu chứng kèm mã chẩn đoán

| Mã SAI | Vấn đề |
|---|---|
| I20.0 + R07.3 | R07.3 thừa — đau ngực đã được bao trùm bởi I20.0 |
| I50.0 + R06.0 | R06.0 (khó thở) thừa — đã có I50.0 (suy tim) |
| J45.x + R06.2 | R06.2 (thở khò khè) thừa — đã có J45.x (hen) |

### Lỗi loại 3: Mã quá rộng khi có thể cụ thể hơn

| Mã rộng | Khi nào nên dùng mã cụ thể hơn |
|---|---|
| I10 (THA không đặc hiệu) | Nếu có biến chứng tim → I11.x; thận → I12.x; não → I13.x |
| J18.9 (Viêm phổi không xác định) | Nếu có vi khuẩn học → J15.x; vi rút → J12.x |
| K92.2 (Xuất huyết tiêu hóa không xác định) | Nếu có nội soi → K25.x, K57.x... |

### Lỗi loại 4: Ra viện không cập nhật mã theo kết quả cuối

- Vào viện: I20.0 (nghi UAP) → Ra viện sau khi tất cả CLS âm tính: vẫn dùng I20.0 → SAI
- Đúng: Ra viện với Z03.4 kèm ghi chú "đã loại trừ"

---

## 5. Mã bệnh kèm và biến chứng

### Bệnh kèm (comorbidity):
- Là bệnh lý tồn tại song song, KHÔNG phải nguyên nhân nhập viện nhưng ảnh hưởng điều trị
- Ghi sau bệnh chính
- Ví dụ: E87.6 (hạ kali máu) kèm theo Z03.4 (theo dõi nghi UAP)

### Biến chứng của bệnh chính:
- Nếu biến chứng phát sinh trong đợt điều trị → ghi kèm sau bệnh chính
- Ví dụ: I21.0 + I44.2 (NMCT + Block nhĩ thất hoàn toàn do NMCT)

---

## 6. Checklist kiểm tra mã ICD trước khi hoàn thiện hồ sơ

```
□ Bệnh chính có phải là tình trạng được điều trị chủ yếu không?
□ Nếu chẩn đoán còn ở mức "theo dõi/nghi ngờ" → đã dùng Z03.x chưa?
□ Có dùng mã triệu chứng (R) kèm mã chẩn đoán không? → Nếu có, bỏ mã R
□ Khi ra viện, mã có phản ánh đúng kết quả điều trị không?
□ Chẩn đoán được loại trừ → đã đổi sang Z03.x (đã loại trừ) chưa?
□ Có dùng mã quá rộng trong khi có thể cụ thể hơn không?
```
