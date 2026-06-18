# Điều phối Cowork ↔ Claude CLI — Job board + tự động hoá

> Trả lời câu hỏi "có cách nào tự động, tôi can thiệp tối thiểu?"

## Sự thật kỹ thuật (đọc trước)

**Hai runtime KHÔNG gọi trực tiếp được nhau.** Cowork (desktop app) và Claude CLI (extension trong Antigravity) là hai phiên độc lập, không có API để bên này "bấm nút" bên kia. Thứ **duy nhất** chia sẻ được là **thư mục dự án** (đang đồng bộ qua Google Drive → cả hai đều thấy).

⇒ Giải pháp: biến thư mục chung thành **bảng công việc (job board)**. Hai bên tự đọc/cập nhật. Phần "ai làm gì, xong chưa" do `jobctl.py` quản. Phần "tự động" do **scheduled task của Cowork** đảm nhiệm (Cowork tự thức dậy, làm grounding, ngủ lại — không cần anh switch sang).

---

## 4 thành phần chia sẻ (đều trong `output/`)

| File/Folder | Vai trò | Ai ghi |
|---|---|---|
| `grounding-cache.json` | **Tri thức dùng chung** (citation đã verify) | Cowork ghi · CLI đọc |
| `_jobs/<ma_kcb>.json` | **1 HSBA = 1 job** (status, owner, stage, concepts) | Cả hai |
| `_jobs/_grounding_queue.json` | **Hàng đợi bàn giao** (khái niệm CLI cần Cowork grounding) | CLI đẩy · Cowork rút |
| `_jobs/JOBS.md` | **Bảng người-đọc** (anh liếc là biết tiến độ) | jobctl tự render |

## Vòng đời 1 job
```
queued → parsing → ocr → analyzing → (needs_grounding ⇄ ready) → done        [hoặc error]
   └───────────────── CLI ─────────────────┘   └─ Cowork ─┘   └─ CLI ─┘
```
- **CLI** gánh parse/OCR/phân tích/sinh DOCX. Gặp khái niệm chưa có trong `grounding-cache` → `jobctl need-grounding` (job sang `needs_grounding`, đẩy concept vào queue) rồi **làm job khác**.
- **Cowork** rút queue → grounding (MCP/web) → ghi cache → `jobctl resolve-grounding` (job đủ grounding tự về `ready`) → CLI quay lại sinh DOCX.

---

## Mức can thiệp của anh — 3 cấp

### Cấp 1 — Gần như tự động (khuyến nghị)
1. **Cowork chạy scheduled task** mỗi N phút: đọc `_grounding_queue.json`; nếu rỗng → thoát ngay (tốn ~0). Nếu có → grounding hết + `resolve-grounding`. **Anh không cần switch sang Cowork.**
2. Anh chỉ lái **CLI**: bảo nó "phân tích tiếp các job `ready`/`queued`". CLI đọc cache, job nào thiếu thì tự đẩy queue và bỏ qua, làm job khác.
3. Phần lớn HSBA đã được cache phủ (nhóm I20.0/I10/J15/E87.6/J44/E11) nên **không cần bàn giao** — CLI chạy thẳng.
→ **Can thiệp: gần như chỉ 1 câu "tiếp tục" cho CLI sau mỗi đợt.**

### Cấp 2 — Thủ công nhẹ (không dùng scheduled task)
- Anh lái CLI tới khi `jobctl groundq` có hàng → switch sang Cowork **một lần** → Cowork grounding cả lô → switch lại CLI nói "tiếp". Mỗi đợt 1 lần qua-lại, không phải mỗi HSBA.

### Cấp 3 — Tách phiên hoàn toàn
- CLI làm hết bằng cache hiện có; cuối cùng xuất danh sách concept thiếu; anh đưa em grounding 1 lượt cho đợt sau.

---

## ★ Bàn giao grounding TỰ ĐỘNG (anh không gõ lệnh nào)

**SWEEP toàn đợt MỘT LƯỢT ở đầu** (CLI tự chạy theo Prompt C, Bước 0) — liệt kê HẾT từ đầu, chạy một lượt:
1. CLI parse TẤT CẢ hồ sơ → `grounding-cache.py sweep --dir <raw> --icd-lookup icd10_lookup.json --write-handoff output/_handoff` → quét mã ICD toàn đợt (0 token AI), map mã→tên, đối chiếu cache (khớp theo **MÃ** rồi tên).
2. MỌI bệnh THIẾU của cả đợt ghi vào **`output/_handoff/grounding-needed.md`** trong MỘT danh sách (checkbox `- [ ]` + mã + số HS).
3. NẾU còn thiếu → CLI DỪNG (chưa phân tích gì), nhắn anh 1 câu. → Cowork ground cả list 1 lượt → CLI phân tích toàn đợt 1 mạch. **Chỉ 1 lần bàn giao/đợt, không dừng-chạy-lại.**
4. Anh **chỉ chuyển sang Cowork** và nói "check grounding" (hoặc "tiếp") — **không gõ lệnh**.
5. **Cowork (em)** đọc `grounding-needed.md` → grounding từng bệnh qua MCP/PubMed → `grounding-cache.py put` → đánh dấu `- [x]` (hoặc xoá dòng) trong file.
6. Anh chuyển lại CLI, nói "tiếp" → CLI chạy tiếp, lần này check sẽ HIT hết.

> Khớp tên bệnh **linh hoạt** (substring + trùng từ khoá + alias) → "Viêm gan B mạn, không đồng nhiễm D" tự khớp cache "Viêm gan virus B mạn"; "ĐTĐ không phụ thuộc insulin" khớp "Đái tháo đường type 2". Không cần trùng khít từng chữ.

**grounding-cache.json = BỘ NHỚ bền:** mọi grounding đã làm được lưu vĩnh viễn; đợt sau / hồ sơ sau / phiên sau đều tái dùng, không grounding lại. Đây chính là "ghi nhớ" anh muốn.

---

## Cheat-sheet lệnh (cả hai bên dùng)

```bash
S=knowledge/hsba-audit-skill/scripts

# Khởi tạo job cho 18 HSBA (1 lần)
python3 $S/jobctl.py init --pdf-dir input --batch dot1

# Xem bảng / tiến độ
python3 $S/jobctl.py board
python3 $S/jobctl.py next --owner cli        # job kế tiếp CLI nên làm
python3 $S/jobctl.py next --owner cowork      # job đang chờ grounding

# CLI cập nhật khi làm
python3 $S/jobctl.py set <ma_kcb> --owner cli --status analyzing --stage ocr
python3 $S/jobctl.py need-grounding <ma_kcb> --concepts "Bệnh X; Bệnh Y"
python3 $S/jobctl.py set <ma_kcb> --status done --docx "output/word/<...>.docx"

# COWORK rút & trả hàng grounding
python3 $S/jobctl.py groundq --open
# ... grounding qua MCP → grounding-cache.py put ...
python3 $S/jobctl.py resolve-grounding --concepts "Bệnh X; Bệnh Y"
```

> Tham chiếu job bằng **mã KCB đầy đủ** (vd `2600067043`) — jobctl tự tái tạo từ mã ngắn 5 số trên tên file (prefix viện `26000`).

---

## Lưu ý đồng bộ (Google Drive)
- Drive đồng bộ có độ trễ vài giây → tránh hai bên sửa **cùng một job** cùng lúc. Quy ước owner trong job + làm theo `next` giúp tránh đụng.
- `jobctl` ghi atomic (tmp→replace) để giảm hỏng file khi đang sync.

---

## Tiếp theo
Anh muốn bật **Cấp 1** (scheduled task Cowork tự grounding) thì em tạo task đó — chỉ cần anh chọn nhịp chạy (vd mỗi 30 phút khi đang làm đợt). Khi đó anh gần như chỉ lái CLI.
