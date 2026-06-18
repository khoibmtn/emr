# EMR Analyzer — Design Spec

> **Trạng thái**: Đã chốt với người dùng (anh Khôi) ngày 2026-06-16.
> **Mục tiêu**: đóng gói workflow phân tích HSBA hiện đang chạy bằng prompt + script rời rạc trong KHTH P4 thành một **web app local** (FastAPI + React) chạy trên máy bác sĩ/admin.
> **Phạm vi spec này**: kiến trúc, data flow, settings, UI structure, hợp đồng Stage 2.
> **Không thuộc spec này**: implementation plan chi tiết (sẽ do skill `writing-plans` sinh ra ở bước kế tiếp), choice DB indexes cụ thể, deployment.

---

## 0. Bối cảnh

App này **không phải sản phẩm xanh**. Nó kế thừa toàn bộ workflow đang vận hành trong [KHTH/KHTH - P4 HSBA/](../../../../KHTH/) (xem `CLAUDE.md` của dự án). Hai ràng buộc cốt lõi không được phá vỡ:

- **Bảo toàn `raw_text`** — toàn văn từ PDF, không tóm tắt/cắt (CLAUDE.md mục 1).
- **Separation factual vs suy luận AI** — JSON backbone chỉ chứa factual; suy luận chỉ render ra DOCX (CLAUDE.md mục 5).

App phải hoạt động cùng hệ sinh thái cũ: dùng chung `grounding-cache.json`, `master.json`, output folder, `render-report.js` của KHTH. App là **vỏ điều phối**, không thay logic phân tích.

---

## 1. Kiến trúc tổng

```
┌────────────────────────────────────────────────────┐
│  Browser (React + Vite + shadcn/ui)                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Inbox    │ │ Pipeline │ │ Reports  │ │Grounding │ │ Settings │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│           ↕ HTTP + SSE (progress stream)                           │
├────────────────────────────────────────────────────┤
│  FastAPI backend (uvicorn, localhost:8765)                         │
│  ┌────────────────────────────────────────────────┐ │
│  │ api/      routes: hsba, pipeline, settings, fs,                │ │
│  │           grounding, prompts, llm                              │ │
│  ├────────────────────────────────────────────────┤ │
│  │ pipeline/ orchestrator (3 stage state machine)                 │ │
│  │   ├── stage1_extract.py   (ProcessPoolExecutor)                │ │
│  │   ├── stage2_reason.py    (LLM hoặc Cowork-bus)                │ │
│  │   └── stage3_render.py    (Node bridge → render-report.js)     │ │
│  ├────────────────────────────────────────────────┤ │
│  │ services/                                                      │ │
│  │   ├── pdf_parser.py       (pymupdf + OCR)                      │ │
│  │   ├── prompt_loader.py    (đọc MD theo section_anchor)         │ │
│  │   ├── llm_client.py       (Anthropic / OpenAI / Gemini)        │ │
│  │   ├── grounding_cache.py  (read-only)                          │ │
│  │   ├── fs_safe.py          (browse + delete-confirm + log)      │ │
│  │   └── docx_renderer.py    (subprocess → render-report.js)      │ │
│  ├────────────────────────────────────────────────┤ │
│  │ store/    settings.json (~/.config), jobs.db (sqlite WAL)      │ │
│  └────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────┤
│  Filesystem (mọi path từ Settings — không hardcode)                │
└────────────────────────────────────────────────────┘
```

### Nguyên tắc ranh giới module

- **`api/`** — chỉ validate input + gọi service. Không có business logic.
- **`pipeline/`** — điều phối state. Mỗi stage là module pure (input → output), test được không cần network.
- **`services/`** — wrap tài nguyên ngoài. Mỗi service có interface ổn định, có thể swap impl (LLM provider, OCR engine).
- **`fs_safe.py`** — single entry-point cho mọi thao tác xóa file. Check whitelist từ Settings, gọi confirm dialog qua API, log mọi xóa.
- **`prompt_loader.py`** — đọc MD → trả `{name, content, meta}`. Không tự nối prompt; chỉ inject `{{md_content}}` vào meta-prompt template.
- **`store/`** — sqlite cho jobs (concurrent-safe), JSON cho settings (đọc nhiều, ghi ít).

### Stack cụ thể

| Layer | Tech |
|---|---|
| Frontend framework | React 18 + Vite |
| Component library | shadcn/ui (Radix + Tailwind) |
| Styling | Tailwind CSS, custom token 3 lớp |
| State client-side | Zustand (đơn giản hơn Redux cho app này) |
| Realtime | SSE (`EventSource` API) |
| Backend framework | FastAPI + uvicorn |
| Async runtime | asyncio + `concurrent.futures.ProcessPoolExecutor` cho Stage 1 |
| Job persistence | SQLite (mode WAL) |
| Settings encrypt | `cryptography.fernet` + key trong OS keyring (`keyring` lib) |
| File watcher (Cowork inbox) | `watchdog` |
| PDF parse | pymupdf (đã có sẵn từ extract-pdf-text.py) |
| OCR | PaddleOCR (default), Tesseract (fallback option) |
| Renderer DOCX | Node subprocess gọi `render-report.js` (giữ nguyên, KHÔNG viết lại) |

---

## 2. Data flow & state machine

### State machine cho mỗi job

```
RECEIVED
   ↓ (auto, parallel pool)
S1_PARSING → S1_OCR → S1_DONE (raw.json + digest.txt + ocr-cache)
                ↓ (review gate, có thể skip)
              S2_PENDING
                ↓ (anh chọn 1 trong 3)
   S2_LLM_RUN  |  S2_COWORK_OUT  |  S2_MANUAL
                ↓ (hội tụ)
              S2_DONE (data-<ma_kcb>.js)
                ↓ (review gate, có thể skip)
              S3_RENDERING
                ↓
              COMPLETED  |  FAILED (mọi stage fail rơi vào đây)
```

### Review gate

3 gate (sau S1, sau S2, sau S3) đều có nút "Skip review" trong Settings. Default: 2 gate đầu bật, gate cuối tắt. Có flag `auto_advance_if_no_issue` — Stage 1 auto pass khi **không có issue OCR** theo định nghĩa cụ thể:

- Tỷ lệ trang cần OCR `< 30%` tổng số trang.
- Tất cả trang OCR có `ocr_confidence >= 0.85`.
- Không có trang OCR rỗng (`text.trim().length == 0`).

Nếu vi phạm bất kỳ điều kiện nào, job dừng ở review gate S1 để anh xem/sửa trước khi sang Stage 2.

### Data shape giữa stage

**Sau Stage 1 → `<ma_kcb>.raw.json`** (theo extract-pdf-text.py hiện tại):

```jsonc
{
  "ma_kcb": "2024-12345",
  "ten_khong_dau": "NGUYEN VAN A",
  "pages": [
    { "page": 1, "text": "<toàn văn>", "source": "pymupdf" },
    { "page": 7, "text": "<toàn văn từ OCR>", "source": "ocr",
      "ocr_engine": "paddle", "ocr_confidence": 0.93 }
  ],
  "ocr_cache_path": "<absolute>",
  "extracted_at": "2026-06-16T11:55:00",
  "schema_version": "1.0"
}
```

**Sau Stage 2 → `data-<ma_kcb>.js`** = `module.exports = { ... }` đúng schema [data-example.js](../../../reference-scripts/data-example.js). Không định nghĩa lại schema ở đây — bám đúng cái renderer Node đang chờ.

**Sau Stage 3 → 3 file**:
- `output/word/<ma_kcb> - <TEN_KHONG_DAU>.docx` — toàn bộ
- `output/json/<ma_kcb>.json` — backbone, chỉ factual (renderer tự lọc)
- `output/master.json` — append/update entry mới

### Job persistence (`jobs.db`)

```sql
CREATE TABLE jobs (
  ma_kcb        TEXT PRIMARY KEY,
  pdf_path      TEXT NOT NULL,
  state         TEXT NOT NULL,
  stage1_meta   JSON,
  stage2_mode   TEXT,                -- 'llm' | 'cowork' | 'manual'
  stage2_meta   JSON,
  stage3_meta   JSON,
  error_log     TEXT,
  created_at    DATETIME,
  updated_at    DATETIME
);
```

Lý do chọn sqlite: batch nhiều HSBA cần read/write concurrent từ worker pool — sqlite WAL handle được, JSON file race condition.

### Realtime — SSE

`GET /api/jobs/stream` push event:

```
event: state_change
data: {"ma_kcb":"2024-12345","state":"S1_OCR","page":7,"total":42}

event: log
data: {"ma_kcb":"2024-12345","level":"info","msg":"OCR cache hit, skipping page 7-12"}
```

Frontend `EventSource` API. Không dùng WebSocket — luồng 1 chiều, SSE đủ và đơn giản hơn.

### Worker pool — Stage 1 song song

```python
# pipeline/stage1_extract.py
from concurrent.futures import ProcessPoolExecutor

def parse_batch(pdf_paths: list[Path], n_workers: int = None) -> Iterator[ParseResult]:
    n = n_workers or settings.parallel_workers   # default = cpu_count() // 2
    with ProcessPoolExecutor(max_workers=n) as ex:
        futures = {ex.submit(_parse_one, p): p for p in pdf_paths}
        for fut in as_completed(futures):
            yield fut.result()   # SSE stream từng cái xong
```

Mỗi worker là **process riêng** (không phải thread) vì pymupdf + PaddleOCR đều có GIL contention.

Stage 2 và Stage 3: tuần tự trong main async event loop. Lý do: Stage 2 gọi LLM (I/O bound, không cần process pool), Stage 3 chỉ chạy 1 node subprocess mỗi lần (an toàn, dễ debug).

---

## 3. Settings schema

### Vị trí file

- macOS/Linux: `~/.config/emr-analyzer/settings.json`
- Windows: `%APPDATA%/emr-analyzer/settings.json`

API key được encrypt bằng `cryptography.fernet`, key sinh ra từ `keyring` của OS (macOS Keychain / Windows Credential Vault). settings.json chỉ chứa ciphertext.

### Path placeholder

Mọi path chứa placeholder `<emr>` được resolve theo thứ tự:

1. Biến môi trường `EMR_HOME` nếu có.
2. Install location của app (thư mục chứa backend/frontend khi chạy dev, hoặc bundle root khi đóng gói).
3. Fallback cuối: thư mục project hiện tại khi backend khởi động.

Không resolve `<emr>` relative tới `settings.json`, vì file settings nằm trong `~/.config` và không cùng cây thư mục app.

### Schema đầy đủ

```jsonc
{
  "schema_version": "1.0",

  "paths": {
    "pdf_input_dir":       "~/Documents/Claude/KHTH/KHTH - P4 HSBA/input",
    "docx_output_dir":     "~/Documents/Claude/KHTH/KHTH - P4 HSBA/output/word",
    "json_output_dir":     "~/Documents/Claude/KHTH/KHTH - P4 HSBA/output/json",
    "master_json_path":    "~/Documents/Claude/KHTH/KHTH - P4 HSBA/output/master.json",
    "ocr_cache_dir":       "~/Documents/Claude/KHTH/hsba-workspace/ocr-cache",
    "grounding_cache_path":"~/Documents/Claude/kho-tri-thuc/facts/grounding.json",
    "prompt_md_dir":       "<emr>/reference-docs",
    "renderer_script":     "<emr>/reference-scripts/render-report.js",
    "data_temp_dir":       "/tmp",
    "cowork_bus_dir":      "~/Documents/Claude/KHTH/KHTH - P4 HSBA/knowledge/hsba-audit-skill"
  },

  "filesystem": {
    "delete_requires_confirm":    true,
    "delete_log_path":            "<emr>/logs/deletions.log",
    "allow_delete_outside_paths": false
  },

  "pipeline": {
    "stage1_workers":            4,
    "stage1_ocr_engine":         "paddle",
    "review_gates": {
      "after_stage1": true,
      "after_stage2": true,
      "after_stage3": false
    },
    "auto_advance_if_no_issue":  true
  },

  "ai_providers": {
    "default": "anthropic",
    "anthropic": {
      "enabled": true,
      "base_url": "http://localhost:8080",
      "auth_token": "proxy-local",
      "model": "claude-opus-4-8",
      "max_tokens": 16000,
      "temperature": 0.2
    },
    "openai": {
      "enabled": false,
      "base_url": "https://api.openai.com/v1",
      "api_key": "",
      "model": "gpt-4o",
      "max_tokens": 16000,
      "temperature": 0.2
    },
    "gemini": {
      "enabled": false,
      "base_url": "https://generativelanguage.googleapis.com/v1beta",
      "api_key": "",
      "model": "gemini-2.0-pro",
      "max_tokens": 16000,
      "temperature": 0.2
    }
  },

  "stage2": {
    "default_mode": "llm",
    "remember_per_hsba": true
  },

  "cowork_bridge": {
    "default_method": "file_bus",
    "file_bus": {
      "outbox_subdir": "outbox",
      "inbox_subdir":  "inbox",
      "watch_inbox":   true
    },
    "clipboard": {
      "auto_copy_prompt":  true,
      "auto_paste_result": false
    },
    "paste_dialog": {
      "show_full_prompt": true
    }
  },

  "prompts": {
    "active_template": "prompt_C_default",
    "templates": [
      {
        "id": "prompt_C_default",
        "label": "Prompt C — Phân tích đợt 3-5 HSBA (luồng chuẩn)",
        "source_file": "PROMPTS-CLI.md",
        "section_anchor": "## Prompt C",
        "stage": "stage2"
      },
      {
        "id": "prompt_A_prepare",
        "label": "Prompt A — Backup + parse + sweep grounding",
        "source_file": "PROMPTS-CLI.md",
        "section_anchor": "## Prompt A",
        "stage": "stage1_pre"
      },
      {
        "id": "prompt_E_aggregate",
        "label": "Prompt E — Tổng hợp nhiều HSBA",
        "source_file": "PROMPTS-CLI.md",
        "section_anchor": "## Prompt E",
        "stage": "post"
      }
    ],
    "meta_prompt_template": "<emr>/backend/prompts/meta_template.md"
  },

  "ui": {
    "theme":    "system",
    "language": "vi",
    "density":  "comfortable",
    "show_phi_warning_on_first_open": true
  },

  "telemetry": {
    "enabled":     false,
    "send_errors": false,
    "send_usage":  false
  }
}
```

### Bảo mật & PHI

- **API key encrypt at rest** qua OS keyring.
- **Telemetry off mặc định** vì PHI; lúc bật cũng không gửi field nào chứa raw_text/ho_ten/dia_chi.
- **Filesystem whitelist** — `services/fs_safe.py` reject mọi thao tác xóa nằm ngoài `paths.*` đã khai báo, trừ khi user tắt `allow_delete_outside_paths`.
- **PHI không vào memory** — không log raw_text ra terminal, không lưu vào telemetry.

---

## 4. UI structure

### Sidebar (cố định)

```
⚕ EMR
├ 📥 Inbox        (PDF mới, chưa parse)
├ ⚙ Pipeline     (jobs đang chạy / chờ review)
├ 📄 Reports     (HSBA hoàn thành, có button Aggregate cho Prompt E)
├ 📚 Grounding   (cache + queue Cowork)
├ 🔧 Settings
└ ❓ Help
```

Status bar dưới: `[●] connected localhost:8765 │ AI: Anthropic ✓ │ N jobs running │ paths OK`. Đỏ nếu provider/path lỗi.

### Page 1 — Inbox

Bento grid 3 cột × N hàng. Mỗi card hiển thị: ma_kcb, họ tên (không dấu), số trang, kích thước, status (chưa parse / đã parse S1 / etc), 2 button [Parse / Stage 2] [Xem]. Floating button "Parse all" góc phải. Filter chip: Tất cả / Chưa parse / Đã parse / Lỗi.

### Page 2 — Pipeline

3 section dọc:
- **Active jobs** — progress dot indicator (●●○○○○○ cho 7 stage), thời gian đã chạy, ETA, button Cancel.
- **Chờ review** — sau mỗi gate, hiện summary + button [Xem raw.json] / [Xem DATA] / [Tiếp Stage tiếp theo] / [Bỏ].
- **Failed** — log + button Retry / Đổi sang Cowork.

3 modal chính:
1. **Xem raw.json** — drawer phải, tree view, button "Mở file" mở folder OS.
2. **Xem DATA** (sau Stage 2) — split view: JSON tree trái, DOCX preview iframe phải (render qua `mammoth` browser lib từ DOCX tạm).
3. **Cowork bridge dialog** — 3 tab tương ứng 3 method: file bus / clipboard / paste dialog.

### Page 3 — Reports

Bento grid HSBA hoàn thành. Filter: khoa, tháng, hình thức ra viện. Mỗi card: ma_kcb, tên, khoa, số ngày, ICD chính, status biểu mẫu (đầy đủ/thiếu), 3 button [DOCX] [JSON] [Xem]. Stat strip dưới cùng: tổng HSBA, % đầy đủ, cảnh báo, tổng cost, % LLM vs Cowork.

Click 👁 → page chi tiết: JSON backbone trái, DOCX preview phải, button Re-render / Re-reason.

**Re-reason / Re-render safety**: thao tác re-run có thể ghi đè output hiện có. Trước khi ghi đè, app tự backup file cũ vào `archive/<ma_kcb>/<timestamp>/` gồm DOCX, JSON backbone, DATA JS nếu có, và snapshot entry master.json cũ. Backup không thay thế xác nhận xóa: mọi thao tác xóa vẫn cần confirm riêng.

**Aggregate (Prompt E)**: button góc phải Reports → modal: chọn HSBA + chọn template `prompt_E_aggregate` từ Settings → chạy như Stage 2 → output DOCX tổng hợp + entry vào master.json.

### Page 4 — Grounding

2 tab:
- **Cached entries** — search, list entries với confidence_cap, citations count, aliases.
- **Queue cần Cowork bổ sung** — tự sinh từ field `confidence_cap = partially_supported` trong các JSON backbone đã render. 2 button: [Copy danh sách] / [Xuất prompt B vào outbox].

### Component patterns thống nhất

| Pattern | shadcn component | Ghi chú |
|---|---|---|
| Card bento | `Card` + custom `shadow-soft` | `0 4px 24px -8px rgba(0,0,0,0.08)` |
| Filter chip | `Badge` outline | Click toggle |
| Drawer phải | `Sheet` (right) | raw.json, DATA preview |
| Modal | `Dialog` | confirm xóa, Cowork bridge |
| Progress | `Progress` + dot indicator | ●●○○○○○ |
| Tree view JSON | `react-json-view-lite` | Lightweight |
| DOCX preview | iframe + `mammoth` | DOCX → HTML phía client |
| Toast | `Sonner` | Notifications |

### Design tokens (3 lớp theo skill design-system)

- **Primitive**: blue-50 → blue-900, gray-50 → gray-900, red/yellow/green warning.
- **Semantic**: `--color-bg`, `--color-card`, `--color-text-primary`, `--color-accent` (= blue-600 = #2563EB), `--color-success`, `--color-warning`, `--color-danger`.
- **Component**: `--card-shadow`, `--card-radius`, `--input-border`, etc.

Theme: light/dark/system, switch qua Settings. Density: comfortable mặc định.

Typography: Inter (UI), JetBrains Mono (JSON/code).

---

## 5. Stage 2 — meta-prompt + ranh giới

### Triết lý "prompt as data"

| Phần | Nguồn | Ai sửa | Khi nào reload |
|---|---|---|---|
| **Domain prompt** (cách đọc HSBA, bảng kiểm TT 32, QĐ 4469, schema DATA, ví dụ) | File MD trong `prompt_md_dir` | Anh + Cowork | Mỗi lần app đọc |
| **Meta-prompt** (cách orchestrator nhét data, format output, contract JSON) | `backend/prompts/meta_template.md` (code-versioned) | Em (developer) | Khi update app |
| **Variables** (raw_text, digest, schema_hint, grounding hits) | Runtime | Tự động | Mỗi job |

Meta-prompt **biết về cấu trúc** (format output, biến gì có sẵn) nhưng **không biết về domain** (không hardcode "biểu mẫu là gì", "ICD code là gì"). Domain knowledge nằm hết trong MD anh kiểm soát.

### Cấu trúc meta-prompt template

`backend/prompts/meta_template.md` — 6 section:

1. **Vai trò + tổng quan input/output**
2. **Tài liệu workflow** — `<workflow_md>{{md_content}}</workflow_md>`
3. **Dữ liệu HSBA** — `{{ma_kcb}}`, `{{pdf_filename}}`, `{{n_pages}}`, `{{n_ocr}}`, `<digest>`, `<raw_pages>`
4. **Grounding cache** — `<grounding_hits>{{grounding_json}}</grounding_hits>` + quy tắc HIT/MISS
5. **Ràng buộc cứng** (override mọi thứ trong workflow_md):
   - Bảo toàn raw_text toàn văn
   - Conservative+ — không kết luận "sai"
   - Separation factual vs suy luận
   - Schema khớp chính xác — `<schema_hint>`
   - PHI — không thêm thông tin định danh ngoài raw
6. **Định dạng trả lời** — 2 code block (JS module + JSON metadata), không văn xuôi giữa/sau.

### Variable nhét vào meta-prompt

| Biến | Nguồn |
|---|---|
| `{{md_content}}` | `prompt_loader.py` đọc `source_file`, cắt theo `section_anchor` đến heading kế tiếp |
| `{{ma_kcb}}` | từ filename PDF (regex) hoặc trang đầu |
| `{{pdf_filename}}` | từ job record |
| `{{n_pages}}, {{n_ocr}}` | từ raw.json metadata |
| `{{digest}}` | digest.txt từ Stage 1 |
| `{{raw_pages_concat}}` | nối toàn bộ `pages[].text` của raw.json, prefix `=== Trang N ===\n` |
| `{{grounding_json}}` | sweep candidate từ digest, lookup cache, format JSON ngắn gọn (chỉ HIT) |
| `{{schema_example_excerpt}}` | đọc data-example.js, lấy ~200 dòng đầu (bật/tắt qua Settings) |

**Tổng prompt size HSBA điển hình** ≈ 40-100k tokens (workflow_md 5-15k + raw_pages 30-80k + grounding 1-3k + meta 2k). Trong context 200k của Claude Opus 4.8 → thoải mái.

### Pipeline Stage 2 = LLM

```
1. Load workflow MD (theo template active)
2. Load raw.json + digest từ Stage 1
3. Sweep grounding hits (chỉ ĐỌC cache)
4. Build full prompt từ meta_template + variables
5. Call LLM (provider từ settings, stream SSE về frontend)
6. Parse response — 2 code block
7. Save data-<ma_kcb>.js + meta JSON
```

**Streaming contract**: frontend nhận SSE event `llm_delta` gồm raw text token/delta và `llm_usage` định kỳ nếu provider có trả usage. Tuy nhiên app **không parse/validate DATA trong lúc stream**. 4 validation check chỉ chạy sau khi event `llm_done` xuất hiện và response hoàn chỉnh đã được lưu tạm. Như vậy UI vẫn thấy tiến độ realtime nhưng không tạo false-positive do JS/JSON chưa hoàn chỉnh.

### Pipeline Stage 2 = Cowork

3 method, dùng cùng `full_prompt`:

- **file_bus**: ghi `outbox/data-request-<ma_kcb>.md`, watcher theo dõi `inbox/data-<ma_kcb>.js`, auto pickup khi xuất hiện.
- **clipboard**: backend gửi prompt qua API → frontend copy clipboard. User paste vào Cowork. User paste lại response qua dialog → POST submit.
- **paste_dialog**: modal mở sẵn 2 textarea (prompt + response). Frontend POST khi user submit.

### Validation sau Stage 2 (cùng cho LLM và Cowork)

App **luôn chạy 4 check** trước khi cho phép sang Stage 3 — đây là điểm bắt lỗi cuối cùng:

1. **Syntax check**: `node -c data-<ma_kcb>.js` (subprocess). Fail → hiển thị error line.
2. **Schema check**: AST parse, đảm bảo các field bắt buộc có mặt với đúng kiểu (timeline có `tg/su_kien/nhan_xet`, `phat_hien_phu` là array of object, `tam_cau_hoi` là object — đúng schema CLAUDE.md mục 6).
3. **Raw text preservation**: so sánh `admission_workup.raw_text` và `discharge_summary.raw_text` với raw.json — phải khớp ≥95%. Thuật toán: Unicode NFC → lowercase → normalize whitespace → tokenize theo word boundary tiếng Việt/cơ bản → token-level Jaccard similarity giữa field raw_text và đoạn raw_pages ứng viên tốt nhất. Điều kiện pass: `intersection / union >= 0.95`. Fail → flag "AI có thể đã tóm tắt".
4. **Citation integrity**: với mỗi `[n]` xuất hiện trong field B, phải có entry tương ứng trong `tai_lieu` hoặc `evidence_grounding`. Mismatch → warning.

Fail bất kỳ validation hard-error → API trả HTTP 422 với shape:

```json
{
  "status": "validation_failed",
  "checks": [
    {
      "check_name": "raw_text_preservation",
      "severity": "error",
      "field": "admission_workup.raw_text",
      "details": "similarity=0.71 < 0.95"
    }
  ],
  "warnings": []
}
```

Warning-only (ví dụ citation mismatch không làm crash renderer) trả HTTP 200 với `warnings[]`, vẫn dừng ở review gate để anh quyết định tiếp tục hay sửa.

### Token tracking & cost

Lưu vào `jobs.db.stage2_meta`:

```json
{
  "provider": "anthropic",
  "model": "claude-opus-4-8",
  "prompt_tokens": 47230,
  "completion_tokens": 8120,
  "cost_usd_estimate": 0.18,
  "duration_seconds": 142
}
```

Reports stat strip: tổng cost tháng, % LLM vs Cowork, token trung bình.

---

## 6. API surface (sơ bộ)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/health` | Liveness + provider/path check |
| GET | `/api/settings` | Đọc settings.json |
| PUT | `/api/settings` | Ghi (validate trước) |
| POST | `/api/settings/test/{provider}` | Test connection AI provider |
| GET | `/api/fs/list?path=...` | Liệt kê thư mục con (cho folder picker) |
| GET | `/api/fs/exists?path=...` | Check tồn tại |
| POST | `/api/fs/delete` | Xóa file/folder — qua confirm |
| GET | `/api/inbox/scan` | Scan pdf_input_dir → list PDF |
| GET | `/api/jobs` | List jobs (filter theo state) |
| POST | `/api/jobs` | Tạo job mới (1 PDF) |
| POST | `/api/jobs/batch_parse` | Parse all PDF chưa có job |
| GET | `/api/jobs/{ma_kcb}` | Chi tiết |
| POST | `/api/jobs/{ma_kcb}/advance` | Auto next stage |
| POST | `/api/jobs/{ma_kcb}/cancel` | Cancel |
| POST | `/api/jobs/{ma_kcb}/retry` | Retry stage failed |
| POST | `/api/jobs/{ma_kcb}/stage2/llm` | Run Stage 2 với LLM |
| POST | `/api/jobs/{ma_kcb}/stage2/cowork` | Init Stage 2 qua Cowork |
| POST | `/api/jobs/{ma_kcb}/stage2/submit` | User paste DATA về |
| POST | `/api/jobs/{ma_kcb}/stage3/render` | Render DOCX |

**Error contract chuẩn**: mọi endpoint thao tác Stage 2/3 trả lỗi validation bằng HTTP 422 với body `{status, checks, warnings}` như mục §5. Không dùng error text trần. UI dựa trên `checks[].severity` để tô đỏ/amber.
| GET | `/api/jobs/stream` | SSE — state_change, log |
| GET | `/api/grounding/cache` | List cached entries |
| GET | `/api/grounding/queue` | List concept thiếu cache |
| POST | `/api/grounding/queue/export` | Xuất prompt B vào outbox |
| GET | `/api/prompts/templates` | List templates |
| GET | `/api/prompts/render?template_id=...&ma_kcb=...` | Preview full prompt |
| GET | `/api/reports` | List HSBA hoàn thành |
| POST | `/api/reports/aggregate` | Prompt E — tổng hợp |

---

## 7. Layout repo (đề xuất)

```
emr/
├── CLAUDE.md                            ← đã có
├── docs/
│   └── superpowers/specs/               ← đây
├── reference-docs/                      ← đã có
├── reference-scripts/                   ← đã có
├── backend/
│   ├── pyproject.toml
│   ├── emr/
│   │   ├── __init__.py
│   │   ├── main.py                      ← entrypoint uvicorn
│   │   ├── api/
│   │   ├── pipeline/
│   │   ├── services/
│   │   ├── store/
│   │   └── prompts/
│   │       └── meta_template.md
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── index.html
├── .claude/skills/                      ← đã có 10 skill
├── .gitignore
└── README.md
```

---

## 8. Anti-goals (cố tình KHÔNG làm)

- **Không viết lại `render-report.js`** — gọi nguyên qua subprocess.
- **Không tự gọi MCP từ app** — grounding chỉ đọc cache. Cowork phụ trách bổ sung.
- **Không làm authentication / multi-user** — single-user local. Nếu sau này cần, là phase mới.
- **Không cloud sync** — PHI, tuyệt đối local.
- **Không tự định nghĩa schema DATA mới** — bám đúng `data-example.js`.
- **Không workflow editor visual** — workflow là 3 stage cố định, anh sửa qua MD prompt.
- **Không OCR auto-correct** — flag low confidence, anh sửa tay.

---

## 9. Mở (out of scope, để phase sau)

- Đóng gói Tauri để có native folder picker + bundle `.app` / `.exe`.
- Hỗ trợ thêm provider (Ollama local, vLLM).
- Plugin system cho rule kiểm biểu mẫu (bvbộ riêng).
- Multi-machine (1 máy parse, 1 máy reasoning).
- Diff giữa các lần re-reason cùng một HSBA.

---

## 10. Open questions (cần resolve trước khi implementation)

Không có — toàn bộ 5 section đã được người dùng duyệt.

---

*Tác giả: Claude (em) — phối hợp brainstorm với anh Khôi.*
*Ngày chốt: 2026-06-16.*
*Skill chuỗi: brainstorming → (đây) → writing-plans (bước kế tiếp).*
