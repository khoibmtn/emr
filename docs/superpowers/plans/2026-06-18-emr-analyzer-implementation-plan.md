# EMR Analyzer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local HSBA analysis app that preserves raw_text, supports prompt-driven Stage 2 reasoning through local MD files or Cowork, and renders validated DOCX/JSON outputs safely.

**Architecture:** A FastAPI backend owns the 3-stage job state machine, settings, validation, and file safety. A React/Vite/shadcn frontend provides a bento-style operator UI for Inbox, Pipeline, Reports, Grounding, and Settings. Stage 1 runs parallel extraction/OCR, Stage 2 renders a meta-prompt from local MD templates and validates the returned DATA contract, and Stage 3 renders DOCX/JSON through the existing KHTH renderer with archive-safe overwrites.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, sqlite3, watchdog, keyring, cryptography, pymupdf, PaddleOCR/Tesseract, Node subprocess for `render-report.js`, React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand, SSE, Vitest, Playwright.

---

## File map

### Backend core
- Create: `backend/pyproject.toml`
- Create: `backend/emr/__init__.py`
- Create: `backend/emr/main.py`
- Create: `backend/emr/api/app.py`
- Create: `backend/emr/api/routes/health.py`
- Create: `backend/emr/api/routes/settings.py`
- Create: `backend/emr/api/routes/fs.py`
- Create: `backend/emr/api/routes/jobs.py`
- Create: `backend/emr/api/routes/prompts.py`
- Create: `backend/emr/api/routes/reports.py`
- Create: `backend/emr/api/routes/grounding.py`
- Create: `backend/emr/contracts.py`
- Create: `backend/emr/pipeline/orchestrator.py`
- Create: `backend/emr/pipeline/stage1_extract.py`
- Create: `backend/emr/pipeline/stage2_reason.py`
- Create: `backend/emr/pipeline/stage3_render.py`
- Create: `backend/emr/services/path_resolver.py`
- Create: `backend/emr/services/fs_safe.py`
- Create: `backend/emr/services/prompt_loader.py`
- Create: `backend/emr/services/pdf_parser.py`
- Create: `backend/emr/services/llm_client.py`
- Create: `backend/emr/services/grounding_cache.py`
- Create: `backend/emr/services/cowork_bridge.py`
- Create: `backend/emr/services/validation.py`
- Create: `backend/emr/services/docx_renderer.py`
- Create: `backend/emr/services/archive_manager.py`
- Create: `backend/emr/store/settings_store.py`
- Create: `backend/emr/store/jobs_db.py`
- Create: `backend/emr/prompts/meta_template.md`
- Create: `backend/tests/fixtures/prompts/PROMPTS-CLI.sample.md`
- Create: `backend/tests/fixtures/hsba_sample/sample_text.pdf`
- Create: `backend/tests/fixtures/hsba_sample/raw.json`
- Create: `backend/tests/fixtures/hsba_sample/digest.txt`
- Create: `backend/tests/fixtures/stage2/data-valid.js`
- Create: `backend/tests/fixtures/stage2/data-invalid-raw-text.js`
- Create: `backend/tests/fixtures/stage2/data-invalid-schema.js`
- Create: `backend/tests/test_app_factory.py`
- Create: `backend/tests/test_settings_store.py`
- Create: `backend/tests/test_path_resolver.py`
- Create: `backend/tests/test_fs_safe.py`
- Create: `backend/tests/test_prompt_loader.py`
- Create: `backend/tests/test_pdf_parser.py`
- Create: `backend/tests/test_stage1_extract.py`
- Create: `backend/tests/test_llm_client.py`
- Create: `backend/tests/test_grounding_cache.py`
- Create: `backend/tests/test_cowork_bridge.py`
- Create: `backend/tests/test_validation.py`
- Create: `backend/tests/test_stage2_reason.py`
- Create: `backend/tests/test_archive_manager.py`
- Create: `backend/tests/test_stage3_render.py`
- Create: `backend/tests/test_api_settings.py`
- Create: `backend/tests/test_api_jobs.py`
- Create: `backend/tests/test_sse_stream.py`
- Create: `backend/tests/test_orchestrator_review_gates.py`
- Create: `backend/tests/test_e2e_smoke.py`

### Frontend core
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/settings.ts`
- Create: `frontend/src/lib/format.ts`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/StatusBar.tsx`
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/jobs/JobCard.tsx`
- Create: `frontend/src/components/jobs/JobProgressDots.tsx`
- Create: `frontend/src/components/jobs/ReviewDrawer.tsx`
- Create: `frontend/src/components/jobs/CoworkDialog.tsx`
- Create: `frontend/src/components/jobs/DataPreviewDrawer.tsx`
- Create: `frontend/src/components/prompts/PromptTemplateEditor.tsx`
- Create: `frontend/src/components/settings/SettingsSection.tsx`
- Create: `frontend/src/components/settings/PathPicker.tsx`
- Create: `frontend/src/components/settings/ProviderTab.tsx`
- Create: `frontend/src/pages/InboxPage.tsx`
- Create: `frontend/src/pages/PipelinePage.tsx`
- Create: `frontend/src/pages/ReportsPage.tsx`
- Create: `frontend/src/pages/GroundingPage.tsx`
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/pages/HelpPage.tsx`
- Create: `frontend/src/components/ui/button.tsx`
- Create: `frontend/src/components/ui/card.tsx`
- Create: `frontend/src/components/ui/dialog.tsx`
- Create: `frontend/src/components/ui/sheet.tsx`
- Create: `frontend/src/components/ui/badge.tsx`
- Create: `frontend/src/components/ui/progress.tsx`
- Create: `frontend/src/components/ui/tabs.tsx`
- Create: `frontend/src/components/ui/toast.tsx`
- Create: `frontend/src/components/ui/input.tsx`
- Create: `frontend/src/components/ui/textarea.tsx`
- Create: `frontend/src/components/ui/select.tsx`
- Create: `frontend/src/components/ui/switch.tsx`
- Create: `frontend/src/components/ui/scroll-area.tsx`
- Create: `frontend/src/components/ui/separator.tsx`
- Create: `frontend/src/components/ui/dropdown-menu.tsx`
- Create: `frontend/src/components/ui/drawer.tsx`
- Create: `frontend/src/components/ui/table.tsx`
- Create: `frontend/src/components/ui/tooltip.tsx`
- Create: `frontend/src/components/ui/skeleton.tsx`
- Create: `frontend/src/components/ui/checkbox.tsx`
- Create: `frontend/src/components/ui/radio-group.tsx`
- Create: `frontend/src/components/ui/label.tsx`
- Create: `frontend/src/components/ui/slider.tsx`
- Create: `frontend/src/components/ui/breadcrumb.tsx`
- Create: `frontend/src/components/ui/avatar.tsx`
- Create: `frontend/src/components/ui/command.tsx`
- Create: `frontend/src/components/ui/pagination.tsx`
- Create: `frontend/src/components/ui/sonner.tsx`
- Create: `frontend/src/components/ui/aspect-ratio.tsx`
- Create: `frontend/src/components/ui/card.test.tsx`
- Create: `frontend/src/components/layout/Sidebar.test.tsx`
- Create: `frontend/src/components/jobs/JobCard.test.tsx`
- Create: `frontend/src/pages/SettingsPage.test.tsx`
- Create: `frontend/src/pages/ReportsPage.test.tsx`
- Create: `frontend/src/pages/PipelinePage.test.tsx`

### Docs / ops
- Modify: `README.md`
- Modify: `CLAUDE.md` if implementation decisions require a small note about the new app flow
- Create: `scripts/run-backend.sh`
- Create: `scripts/run-frontend.sh`
- Create: `scripts/run-smoke.sh`
- Create: `docs/superpowers/plans/2026-06-18-emr-analyzer-implementation-plan.md`

---

## Artifact layout (must not collide in batch mode)

All pipeline artifacts are per-job/per-`ma_kcb`; never write generic `raw.json` or `digest.txt` in a shared directory.

| Stage | Artifact | Default path pattern |
|---|---|---|
| Stage 1 | raw text JSON | `{json_output_dir}/raw/{ma_kcb}.raw.json` |
| Stage 1 | digest text | `{json_output_dir}/raw/{ma_kcb}.digest.txt` |
| Stage 1 | OCR cache | `{ocr_cache_dir}/{ma_kcb}.json` |
| Stage 2 | DATA module | `{data_temp_dir}/data-{ma_kcb}.js` |
| Stage 2 | LLM/Cowork metadata | `{json_output_dir}/stage2/{ma_kcb}.stage2-meta.json` |
| Stage 2 Cowork | file-bus request | `{cowork_bus_dir}/outbox/data-request-{ma_kcb}.md` |
| Stage 2 Cowork | file-bus response | `{cowork_bus_dir}/inbox/data-{ma_kcb}.js` |
| Stage 3 | DOCX report | `{docx_output_dir}/{ma_kcb} - {TEN_KHONG_DAU}.docx` |
| Stage 3 | JSON backbone | `{json_output_dir}/{ma_kcb}.json` |
| Stage 3 | master index | `{master_json_path}` |
| Re-run | archive snapshot | `{json_output_dir}/archive/{ma_kcb}/{timestamp}/...` |

The jobs database stores absolute paths for the artifacts produced by each stage in `stage1_meta`, `stage2_meta`, and `stage3_meta` so later API calls never infer paths ambiguously.

---

## Milestone 1: Backend foundation and safe configuration

### Task 1: Bootstrap the backend package, app factory, and persistence layer

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/emr/__init__.py`
- Create: `backend/emr/main.py`
- Create: `backend/emr/api/app.py`
- Create: `backend/emr/contracts.py`
- Create: `backend/emr/store/settings_store.py`
- Create: `backend/emr/store/jobs_db.py`
- Create: `backend/tests/test_app_factory.py`
- Create: `backend/tests/test_settings_store.py`
- Create: `backend/tests/test_jobs_db.py`

- [ ] **Step 1: Write the failing tests**

```python
# backend/tests/test_app_factory.py
from emr.api.app import create_app

def test_create_app_registers_routes():
    app = create_app()
    assert "/api/health" in {route.path for route in app.routes}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_app_factory.py -v`
Expected: FAIL with `ModuleNotFoundError` or missing `create_app`.

- [ ] **Step 3: Write minimal implementation**

Create the FastAPI app factory, a tiny `contracts.py` with Pydantic models for settings/job state, and sqlite-backed settings/jobs storage. Implement encrypted-at-rest provider secrets in `settings_store.py`: plaintext API keys/auth tokens must be encrypted before writing settings.json, decrypted only in-memory for provider calls, and never returned by default API responses except as masked values.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_app_factory.py backend/tests/test_settings_store.py backend/tests/test_jobs_db.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/pyproject.toml backend/emr backend/tests
git commit -m "feat: bootstrap emr backend foundation"
```

### Task 2: Implement path resolution, filesystem safety, and prompt loading

**Files:**
- Create: `backend/emr/services/path_resolver.py`
- Create: `backend/emr/services/fs_safe.py`
- Create: `backend/emr/services/prompt_loader.py`
- Create: `backend/emr/prompts/meta_template.md`
- Create: `backend/tests/fixtures/prompts/PROMPTS-CLI.sample.md`
- Create: `backend/tests/test_path_resolver.py`
- Create: `backend/tests/test_fs_safe.py`
- Create: `backend/tests/test_prompt_loader.py`

- [ ] **Step 1: Write the failing tests**

Cover three behaviors:
1. `<emr>` resolves via `EMR_HOME`, then install root, then fallback.
2. delete operations fail unless the target is inside an allowed path and confirm is true.
3. prompt loader extracts the correct section between heading anchors.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_path_resolver.py backend/tests/test_fs_safe.py backend/tests/test_prompt_loader.py -v`
Expected: FAIL with missing modules or assertion failures.

- [ ] **Step 3: Write minimal implementation**

Implement `resolve_emr_path()`, `safe_delete()`, and `load_prompt_section()`. Keep `meta_template.md` as a code-versioned wrapper that injects `{{md_content}}` and runtime variables.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_path_resolver.py backend/tests/test_fs_safe.py backend/tests/test_prompt_loader.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/services backend/emr/prompts backend/tests/fixtures backend/tests/test_path_resolver.py backend/tests/test_fs_safe.py backend/tests/test_prompt_loader.py
git commit -m "feat: add path resolution and prompt loading"
```

---

## Milestone 2: Stage 1 extraction and parallel OCR

### Task 3: Build Stage 1 parsing, OCR queueing, and cache reuse

**Files:**
- Create: `backend/emr/services/pdf_parser.py`
- Create: `backend/emr/pipeline/stage1_extract.py`
- Create: `backend/tests/fixtures/hsba_sample/sample_text.pdf`
- Create: `backend/tests/fixtures/hsba_sample/raw.json`
- Create: `backend/tests/fixtures/hsba_sample/digest.txt`
- Create: `backend/tests/test_pdf_parser.py`
- Create: `backend/tests/test_stage1_extract.py`

- [ ] **Step 1: Write the failing tests**

Cover:
1. `pdf_parser` returns text-selectable pages plus OCR todo entries for scan pages.
2. Stage 1 uses `ProcessPoolExecutor` for batches.
3. OCR cache hit skips recomputation when the md5 matches.
4. Stage 1 writes per-job artifacts `{json_output_dir}/raw/{ma_kcb}.raw.json` and `{json_output_dir}/raw/{ma_kcb}.digest.txt` with the exact expected shape, and batch parsing two jobs does not overwrite either job's artifacts.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_pdf_parser.py backend/tests/test_stage1_extract.py -v`
Expected: FAIL with missing modules or shape mismatches.

- [ ] **Step 3: Write minimal implementation**

Implement `extract_pages()`, `build_digest()`, `parse_batch()`, and the cache read/write flow. Write raw/digest artifacts only to the per-job paths defined in the artifact layout table and persist those absolute paths into `jobs_db.stage1_meta`. Keep stage output deterministic and local-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_pdf_parser.py backend/tests/test_stage1_extract.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/services/pdf_parser.py backend/emr/pipeline/stage1_extract.py backend/tests
git commit -m "feat: implement stage 1 extraction pipeline"
```

---

## Milestone 3: Stage 2 reasoning, Cowork bridge, and validation

### Task 4: Implement provider adapters, prompt rendering, and Stage 2 validation

**Files:**
- Create: `backend/emr/services/llm_client.py`
- Create: `backend/emr/services/cowork_bridge.py`
- Create: `backend/emr/services/validation.py`
- Create: `backend/emr/pipeline/stage2_reason.py`
- Create: `backend/emr/contracts.py`
- Create: `backend/tests/fixtures/stage2/data-valid.js`
- Create: `backend/tests/fixtures/stage2/data-invalid-raw-text.js`
- Create: `backend/tests/fixtures/stage2/data-invalid-schema.js`
- Create: `backend/tests/test_llm_client.py`
- Create: `backend/tests/test_grounding_cache.py`
- Create: `backend/tests/test_cowork_bridge.py`
- Create: `backend/tests/test_validation.py`
- Create: `backend/tests/test_stage2_reason.py`

- [ ] **Step 1: Write the failing tests**

Cover:
1. Anthropic/OpenAI/Gemini provider config is loaded from decrypted in-memory settings without hardcoding or logging secrets.
2. Provider adapters sanitize request params per provider/model: for Anthropic models that reject sampling params (including `claude-opus-4-7`, `claude-opus-4-8`, and Fable-family models), request payloads must omit `temperature`, `top_p`, and `top_k` even if those fields exist in Settings UI. OpenAI/Gemini adapters may map `temperature` according to their own API contracts.
3. **PHI guardrail for every LLM/provider call**: any request containing HSBA content/PHI — raw pages, digest, JSON backbone, DATA JS, Prompt E aggregate inputs, re-reason context, or report text — is allowed only for local endpoints (`localhost`, `127.0.0.1`, `::1`, or explicitly configured local proxy). OpenAI/Gemini/external Anthropic URLs must be blocked for HSBA/PHI-bearing prompts unless a future explicit unsafe override is added; do not implement that override in this milestone.
3. **Grounding cache read-only**: `grounding_cache.py` loads cache, performs flexible alias/substring sweep from digest candidates, returns HIT/MISS, and never writes cache or calls MCP/network.
4. Prompt rendering injects the local MD template, raw pages, grounding hits, grounding misses queue, and schema excerpt.
5. Stage 2 parsing accepts a JS module plus JSON metadata code block.
6. The full four validation checks are covered exactly as spec'd: `node -c` syntax check; renderer-required schema check; raw-text preservation with normalized token-level Jaccard for **all raw fields** (`admission_workup.raw_text`, `discharge_summary.raw_text`, every `department_stays[].clinical_course_raw`, and any future `*_raw`/`raw_text` field); citation integrity where mismatches become warning-only review-gate warnings, not hard errors.
7. Validation returns the exact 422 body shape for hard errors and HTTP 200 + `warnings[]` for warning-only citation issues.
8. File-bus, clipboard, and paste-dialog cowork modes produce the right local artifacts.
9. File-bus mode starts a `watchdog` inbox watcher that auto-picks up `{cowork_bus_dir}/inbox/data-{ma_kcb}.js`, validates it, stores it as the Stage 2 DATA artifact, and transitions the job to `S2_DONE` or validation failed.
10. Streaming emits `llm_delta`, `llm_usage` when available, and `llm_done`, and writes prompt/completion usage into `jobs_db.stage2_meta` for Reports stats.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_llm_client.py backend/tests/test_grounding_cache.py backend/tests/test_cowork_bridge.py backend/tests/test_validation.py backend/tests/test_stage2_reason.py -v`
Expected: FAIL with missing modules or assertion failures.

- [ ] **Step 3: Write minimal implementation**

Implement provider adapters with provider-specific parameter sanitization (especially no `temperature`/`top_p`/`top_k` for `claude-opus-4-7`, `claude-opus-4-8`, and Fable-family Anthropic requests), the PHI local-endpoint guardrail applied to every HSBA/PHI-bearing provider call, read-only grounding cache sweep, prompt assembly, `llm_delta` / `llm_usage` / `llm_done` event emission, JS-module extraction, all four validation checks across all raw fields, token/cost metadata persistence, and all Cowork modes including the `watchdog` file-bus inbox watcher. Keep external calls mockable and unit tests offline.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_llm_client.py backend/tests/test_grounding_cache.py backend/tests/test_cowork_bridge.py backend/tests/test_validation.py backend/tests/test_stage2_reason.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/services/llm_client.py backend/emr/services/grounding_cache.py backend/emr/services/cowork_bridge.py backend/emr/services/validation.py backend/emr/pipeline/stage2_reason.py backend/tests
git commit -m "feat: implement stage 2 reasoning and validation"
```

### Task 5: Add archive-safe overwrite support for re-reason and prepare Stage 3 hook

**Files:**
- Create: `backend/emr/services/archive_manager.py`
- Modify: `backend/emr/pipeline/stage2_reason.py`
- Modify after Task 6 creates it: `backend/emr/pipeline/stage3_render.py`
- Create: `backend/tests/test_archive_manager.py`

- [ ] **Step 1: Write the failing tests**

Verify that re-reason and re-render actions archive the prior DOCX, JSON backbone, DATA JS, and master.json snapshot under `archive/<ma_kcb>/<timestamp>/` before overwriting the current output.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_archive_manager.py -v`
Expected: FAIL with missing archive logic.

- [ ] **Step 3: Write minimal implementation**

Implement `snapshot_job_output()` and call it before overwrite paths in Stage 2 re-reason flows. Expose a small helper or orchestrator hook that Task 6 must call before Stage 3 render overwrite, because `stage3_render.py` is created in Task 6.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_archive_manager.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/services/archive_manager.py backend/emr/pipeline/stage2_reason.py backend/tests/test_archive_manager.py
git commit -m "feat: archive prior hsba outputs before overwrite"
```

---

## Milestone 4: Stage 3 render, API, and SSE orchestration

### Task 6: Wire the renderer bridge and Stage 3 output generation

**Files:**
- Create: `backend/emr/services/docx_renderer.py`
- Create: `backend/emr/pipeline/stage3_render.py`
- Create: `backend/tests/test_stage3_render.py`
- Create: `backend/tests/test_e2e_smoke.py`

- [ ] **Step 1: Write the failing tests**

Cover:
1. `render-report.js` is invoked through subprocess with the correct DATA path.
2. Stage 3 writes DOCX, JSON backbone, and master.json entries to the configured output directories.
3. Stage 3 rejects invalid DATA with the same validation body used by Stage 2.
4. Stage 3 calls `snapshot_job_output()` before overwriting an existing DOCX, JSON backbone, or master.json entry.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_stage3_render.py backend/tests/test_e2e_smoke.py -v`
Expected: FAIL with missing renderer bridge or validation failures.

- [ ] **Step 3: Write minimal implementation**

Implement `render_job()`, `build_output_paths()`, the subprocess wrapper for `render-report.js`, and the archive hook before any Stage 3 overwrite. Store absolute Stage 3 artifact paths in `jobs_db.stage3_meta`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_stage3_render.py backend/tests/test_e2e_smoke.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/services/docx_renderer.py backend/emr/pipeline/stage3_render.py backend/tests/test_stage3_render.py backend/tests/test_e2e_smoke.py
git commit -m "feat: add stage 3 renderer bridge"
```

### Task 7: Expose the API surface and SSE event stream

**Files:**
- Create: `backend/emr/api/routes/health.py`
- Create: `backend/emr/api/routes/settings.py`
- Create: `backend/emr/api/routes/fs.py`
- Create: `backend/emr/api/routes/jobs.py`
- Create: `backend/emr/api/routes/prompts.py`
- Create: `backend/emr/api/routes/reports.py`
- Create: `backend/emr/api/routes/grounding.py`
- Modify: `backend/emr/api/app.py`
- Modify: `backend/emr/main.py`
- Create: `backend/tests/test_api_settings.py`
- Create: `backend/tests/test_api_jobs.py`
- Create: `backend/tests/test_sse_stream.py`
- Create: `backend/tests/test_orchestrator_review_gates.py`

- [ ] **Step 1: Write the failing tests**

Cover the full API surface from the design spec:
1. `/api/health` reports provider/path readiness.
2. `/api/settings`, `/api/settings/test/{provider}` round-trip paths/provider settings and test provider connectivity without exposing plaintext secrets.
3. `/api/fs/list`, `/api/fs/exists`, `/api/fs/delete` enforce path whitelist and delete confirmation.
4. `/api/inbox/scan` lists PDFs from `pdf_input_dir`.
5. `/api/jobs`, `/api/jobs/batch_parse`, `/api/jobs/{ma_kcb}`, `/advance`, `/cancel`, `/retry`, `/stage2/llm`, `/stage2/cowork`, `/stage2/submit`, `/stage3/render` call the orchestrator with expected state transitions.
6. `/api/jobs/stream` emits `state_change`, `log`, `llm_delta`, `llm_usage`, and `llm_done` events.
7. `/api/grounding/cache`, `/api/grounding/queue`, `/api/grounding/queue/export` expose read-only cache and Cowork queue export.
8. `/api/prompts/templates`, `/api/prompts/render` expose prompt templates and full prompt preview.
9. `/api/reports`, `/api/reports/aggregate` list completed jobs and run Prompt E aggregate through the same prompt-template pipeline.
10. `/api/jobs/{ma_kcb}/stage2/submit` and `/api/jobs/{ma_kcb}/stage3/render` return HTTP 422 with the validation shape on hard errors.
11. Review-gate behavior: defaults gate after S1/S2, S1 auto-advance only when OCR pages `<30%`, every OCR confidence `>=0.85`, and no OCR page is empty; otherwise job stops at S1 review. Tests cover gates enabled and disabled.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_api_settings.py backend/tests/test_api_jobs.py backend/tests/test_sse_stream.py backend/tests/test_orchestrator_review_gates.py -v`
Expected: FAIL with missing routes or bad response shapes.

- [ ] **Step 3: Write minimal implementation**

Implement route modules, response models, SSE event generator, the full endpoint table from the spec, orchestrator review-gate logic, and orchestrator calls for inbox scanning, batch parse, stage transitions, prompt preview, grounding queue export, and Prompt E aggregate. Aggregate uses the local MD prompt template selected by `prompt_E_aggregate`; it must not be implemented as hardcoded reasoning text.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_api_settings.py backend/tests/test_api_jobs.py backend/tests/test_sse_stream.py backend/tests/test_orchestrator_review_gates.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/emr/api backend/emr/main.py backend/tests/test_api_settings.py backend/tests/test_api_jobs.py backend/tests/test_sse_stream.py
git commit -m "feat: expose emr api and sse stream"
```

---

## Milestone 5: Frontend operator experience

### Task 8: Build the app shell, design tokens, and shared client layer

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`
- Create: `frontend/src/lib/settings.ts`
- Create: `frontend/src/lib/format.ts`
- Create: `frontend/src/components/ui/*`
- Create: `frontend/src/components/layout/AppShell.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/StatusBar.tsx`
- Create: `frontend/src/components/layout/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Cover:
1. Sidebar renders the six navigation items (Inbox, Pipeline, Reports, Grounding, Settings, Help) and status bar.
2. Tokens expose the blue-600 accent and comfortable density baseline.
3. API client can fetch settings/jobs/health.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run frontend/src/components/layout/Sidebar.test.tsx`
Expected: FAIL with missing app shell or component imports.

- [ ] **Step 3: Write minimal implementation**

Build the shell, theme variables, shadcn UI primitives, and the API client wrapper.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run frontend/src/components/layout/Sidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/src frontend/tailwind.config.ts frontend/vite.config.ts frontend/tsconfig.json frontend/postcss.config.js
git commit -m "feat: scaffold frontend shell and shared ui"
```

### Task 9: Implement Inbox, Pipeline, Reports, Grounding, and Settings pages

**Files:**
- Create: `frontend/src/pages/InboxPage.tsx`
- Create: `frontend/src/pages/PipelinePage.tsx`
- Create: `frontend/src/pages/ReportsPage.tsx`
- Create: `frontend/src/pages/GroundingPage.tsx`
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/pages/HelpPage.tsx`
- Create: `frontend/src/components/jobs/JobCard.tsx`
- Create: `frontend/src/components/jobs/JobProgressDots.tsx`
- Create: `frontend/src/components/jobs/ReviewDrawer.tsx`
- Create: `frontend/src/components/jobs/CoworkDialog.tsx`
- Create: `frontend/src/components/jobs/DataPreviewDrawer.tsx`
- Create: `frontend/src/components/prompts/PromptTemplateEditor.tsx`
- Create: `frontend/src/components/settings/SettingsSection.tsx`
- Create: `frontend/src/components/settings/PathPicker.tsx`
- Create: `frontend/src/components/settings/ProviderTab.tsx`
- Create: `frontend/src/pages/SettingsPage.test.tsx`
- Create: `frontend/src/pages/ReportsPage.test.tsx`
- Create: `frontend/src/pages/PipelinePage.test.tsx`
- Create: `frontend/src/components/jobs/JobCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Cover:
1. Inbox cards show file metadata and start actions.
2. Pipeline page renders active/review/failed sections.
3. Reports page exposes the Prompt E aggregate action from the prompt template list, not as a separate static page.
4. Grounding page lists cache hits and queue items.
5. Settings page edits paths, providers, stage-2 mode, and cowork bridge options.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- --run frontend/src/pages/SettingsPage.test.tsx frontend/src/pages/ReportsPage.test.tsx frontend/src/pages/PipelinePage.test.tsx frontend/src/components/jobs/JobCard.test.tsx`
Expected: FAIL with missing pages or components.

- [ ] **Step 3: Write minimal implementation**

Build the pages with shadcn components, bento layout, drawers, dialogs, provider tabs, and prompt template controls. Keep Prompt E inside the prompt template selector, not as a separate navigation page.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- --run frontend/src/pages/SettingsPage.test.tsx frontend/src/pages/ReportsPage.test.tsx frontend/src/pages/PipelinePage.test.tsx frontend/src/components/jobs/JobCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages frontend/src/components frontend/src/styles frontend/src/lib
git commit -m "feat: implement emr operator ui"
```

---

## Milestone 6: Documentation, smoke tests, and release readiness

### Task 10: Add integration smoke checks, run scripts, and operator docs

**Files:**
- Create: `scripts/run-backend.sh`
- Create: `scripts/run-frontend.sh`
- Create: `scripts/run-smoke.sh`
- Modify: `README.md`
- Modify: `CLAUDE.md` only if a small runtime note is needed
- Update: `docs/superpowers/specs/2026-06-16-emr-analyzer-design.md` if implementation revealed a small unavoidable adjustment

- [ ] **Step 1: Write the failing tests**

Add a smoke test that starts the backend in test mode, hits `/api/health`, and confirms the frontend shell loads the expected app title.

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_e2e_smoke.py -v`
Expected: FAIL before the run scripts and docs exist.

- [ ] **Step 3: Write minimal implementation**

Add run scripts, smoke commands, and concise docs for setup, local dev, and the safety model (PHI local, delete confirm, prompt files local, archive before overwrite).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_e2e_smoke.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md CLAUDE.md scripts backend/tests/test_e2e_smoke.py
git commit -m "docs: add emr run and smoke instructions"
```

---

## Verification checklist before handoff

- [ ] Backend tests pass for settings, prompt loading, Stage 1, Stage 2, Stage 3, API, and SSE.
- [ ] Frontend tests pass for shell, settings, pages, and job cards.
- [ ] Smoke test proves the app boots locally and can process one sample HSBA end-to-end.
- [ ] Prompt E remains a template in the local MD file, not a separate app page.
- [ ] Delete operations still require explicit confirmation.
- [ ] Re-reason and re-render archive prior outputs before overwrite.
- [ ] Prompt content still flows from local MD files through the meta-prompt wrapper.

---

## Risks and constraints to watch

- Keep all PHI local; no external calls from the app for raw HSBA content.
- Do not rewrite `reference-scripts/render-report.js`; call it through a subprocess wrapper.
- Treat the Stage 2 schema from `reference-scripts/data-example.js` as the source of truth.
- Preserve the `raw_text` contract exactly; only validation and rendering may inspect it.
- Keep Cowork integration file-based; do not invent a network bridge unless the user later asks for one.
- Keep the UI polished but restrained: bento layout, blue-600 accent, comfortable density, and accessible shadcn components.

---

## Execution handoff

Once this plan is approved, implement it with `superpowers:subagent-driven-development` if you want a fresh subagent per task and review gates between tasks. Use `superpowers:executing-plans` only if you want to batch the work inline with checkpoints.
