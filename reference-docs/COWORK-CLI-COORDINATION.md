# Phối hợp Cowork ↔ Claude CLI — Plan phân tích lại 18 HSBA

> Mục tiêu: chạy lại 18 HSBA với chất lượng cao nhất, **không** vượt hạn mức một session, bằng cách chia việc theo **thế mạnh từng bên** và trao đổi qua **thư mục dự án dùng chung** (file bus).

---

## 1. Vì sao phối hợp?

| | **Claude CLI (máy anh)** | **Cowork (Opus 4.8, app)** |
|---|---|---|
| pymupdf / docx / node | ✅ có sẵn (đã sinh 18 báo cáo) | ❌ sandbox chặn tải |
| Tốc độ / khối lượng lớn | ✅ nhanh, chạy script | 🟡 chậm hơn, tốn token Pro |
| MCP nghiên cứu (PubMed, scholar-sidekick, ICD, Consensus, version-graph) | ❌ chưa cấu hình | ✅ đầy đủ |
| Web BYT / thuvienphapluat | ✅ WebSearch/WebFetch | ✅ |
| Chất lượng văn Phần B | 🟡 tốt | ✅ tốt nhất (Opus) |

**Nguyên lý chia việc:** CLI làm phần **xác định + nặng + cần thư viện** (parse, OCR, sinh DOCX, tổng hợp — 18×). Cowork làm phần **cần MCP + trí tuệ tái dùng**: dựng **grounding-cache** cho ~15–25 khái niệm bệnh **một lần** (dùng chung cho cả 18). Nhờ đó CLI **không cần** cấu hình MCP nghiên cứu, và Cowork **không** phải đọc 18 hồ sơ.

---

## 2. File bus — hai bên trao đổi qua đây (không nói chuyện trực tiếp)

```
output/
├── _handoff/concepts.json|md     ← CLI → Cowork: danh sách khái niệm cần grounding (ẩn danh)
├── grounding-cache.json          ← Cowork → CLI: citation đã verify, dùng chung
├── ocr-cache/<ma_kcb>.json       ← CLI tự quản: OCR cache (giữ giữa các đợt)
├── json/ · word/ · tong-hop/     ← CLI sinh; aggregate đọc lại
└── _backup_<ts>/                 ← run-batch.sh backup trước khi xoá
```
**Anh là nhạc trưởng:** chạy lệnh CLI, khi tới bước grounding thì chuyển sang Cowork, xong quay lại CLI.

---

## 3. Quy trình 5 pha

### Pha A — CLI: chuẩn bị (deterministic, ~0 token AI)
```bash
cd "/Users/buiminhkhoi/Documents/Claude/KHTH/KHTH - P4 HSBA"
S=knowledge/hsba-audit-skill/scripts
bash $S/run-batch.sh prepare          # backup → xoá → parse 18 PDF (OCR cache) → bảng token metrics
python3 $S/extract-concepts.py --json-dir output/json --out-dir output/_handoff
#   (lần đầu output/json đã bị xoá → chạy extract-concepts trên các raw JSON trong /tmp/hsba_batch_*,
#    hoặc trên backup: --json-dir output/_backup_<ts>/json)
```
Kết quả: raw + digest + `ocr_todo` mỗi hồ sơ; **`_handoff/concepts.md`** (76 mục, xếp theo tần suất).

### Pha B — COWORK: dựng grounding-cache (bounded, dùng MCP) ⭐ chỉ Cowork làm được tốt
1. Đọc `output/_handoff/concepts.md`.
2. Grounding **top ~15–25 khái niệm hay gặp** (phủ phần lớn 18 HSBA): mỗi khái niệm → version-graph/kho nội bộ → web BYT (kiểm hiệu lực) → PubMed/Consensus/hiệp hội → **verify citation** (scholar-sidekick) → đối chiếu ICD BYT.
3. Ghi vào cache:
   ```bash
   python3 $S/grounding-cache.py put --cache output/grounding-cache.json --concept "<ten benh>" --entry-json '<entry verified>'
   ```
4. Đánh dấu `status: grounded` trong concepts.json.
> Token Cowork **có giới hạn**: chỉ ~20 khái niệm × 1 lần, KHÔNG đọc hồ sơ BN. Privacy: chỉ gửi tên bệnh/ICD ẩn danh ra MCP/web.

### Pha C — CLI: phân tích 18 hồ sơ (volume, local, rẻ) — theo đợt
Mỗi HSBA (dùng subagent khi batch, SKILL §3.5b):
1. OCR các trang trong `ocr_todo` → ghi `ocr_text` → `extract-pdf-text.py --update-cache`.
2. Đọc **digest** (không cat raw).
3. Grounding = **chỉ `grounding-cache.py get`** (0 MCP, vì Cowork đã dựng cache). Khái niệm hiếm chưa có cache → để `confidence_cap` thấp hơn + cờ "cần Cowork bổ sung".
4. Điền `DATA{}` → `node complete-example.js` → DOCX + JSON (**schema v4.0-backbone meta giàu**).
> Chia **3–5 hồ sơ/đợt**, giữ cache giữa các đợt → đợt sau OCR≈0, grounding tái dùng.

### Pha D — COWORK (tùy chọn): bản DOCX cao cấp cho hồ sơ điển hình
Với 2–3 hồ sơ giá trị đào tạo cao, Cowork (Opus) tự viết lại Section B sắc nét nhất từ `digest` + `grounding-cache` của hồ sơ đó.

### Pha E — CLI: tổng hợp
```bash
bash $S/run-batch.sh finalize         # aggregate-stats → _stats.json
```
→ Cowork/CLI dùng tong-hop-skill đọc `_stats.json` (≈7%) sinh DOCX tổng hợp.

---

## 4. Sơ đồ luồng

```
CLI:   [A prepare+concepts] ───concepts.md──►            ┌───────────────┐
                                              COWORK: [B grounding-cache]
       ◄──grounding-cache.json────────────────          └───────────────┘
CLI:   [C phân tích 18 (đợt 3-5)] ──► json/ word/
                                              COWORK: [D premium Section B] (tùy chọn)
CLI:   [E finalize] ──► _stats.json ──► DOCX tổng hợp
```

---

## 5. Kinh tế token & an toàn

- **Cowork** chỉ tốn token ở Pha B (~20 khái niệm) + Pha D (vài hồ sơ) → vừa hạn mức Pro.
- **CLI** gánh 18× phần nặng, quota/tốc độ riêng, local.
- **Cache bền** (ocr-cache + grounding-cache) → mọi lần chạy lại đều rẻ dần.
- **An toàn:** `run-batch.sh` backup trước khi xoá; không bao giờ xoá rồi mới phân tích → không mất dữ liệu giữa chừng.
- **Privacy:** PHI (raw HSBA) chỉ ở CLI/local; chỉ khái niệm ẩn danh đi qua MCP/web ở Cowork.

---

## 6. Phương án thay thế (nếu không muốn 2 cửa)

Cấu hình thêm MCP nghiên cứu (PubMed, scholar-sidekick, ICD, Consensus) vào `~/.claude/settings.json` → **CLI tự grounding**, bỏ Pha B Cowork. Đánh đổi: mất chất lượng Opus + phải tự quản MCP; nhưng một cửa, đơn giản hơn. Khuyến nghị vẫn dùng phối hợp cho **chất lượng + tiết kiệm** tốt nhất.

---

## 7. Bắt đầu

Anh chạy **Pha A** trên máy (`run-batch.sh prepare` + `extract-concepts.py`), gửi em `concepts.md` + bảng token metrics. Em (Cowork) làm **Pha B** ngay — dựng grounding-cache cho ~15–25 khái niệm hay gặp. Sau đó anh chạy Pha C theo đợt.
