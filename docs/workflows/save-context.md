---
description: Save EMR Analyzer session context, update CODEBASE.md and docs/SESSION_NOTES.md, then run sync so the saved context is pushed to GitHub.
---

# save-context — EMR Analyzer

## Purpose

Persist the current project context for future sessions, then run `sync` so the context and code changes are committed and pushed.

This workflow is meant for the end of a working session or after an important milestone.

## Commands

```text
save-context           Save context + run sync
save-context quick     Update session notes only + run sync
save-context --no-sync Save context only, do not push
```

## PHI guardrails

Do **not** copy patient identifiers or raw HSBA content into context docs. In `CODEBASE.md` and `docs/SESSION_NOTES.md`, summarize implementation state only.

Allowed:
- architecture decisions
- source files changed
- test results
- known technical blockers
- prompt/template design decisions

Not allowed:
- patient name/address/BHYT/KCB details
- raw_text from HSBA
- excerpts from raw JSON/DATA JS containing PHI
- output DOCX/JSON paths containing patient-identifying names, unless anonymized

## Phase 1: Scan current project state safely

```bash
cd {{PROJECT_DIR}}
git status --short
git log --oneline -10
find backend frontend docs reference-docs reference-scripts .claude/skills \
  -type f \( \
    -name "*.py" -o -name "*.ts" -o -name "*.tsx" \
    -o -name "*.js" -o -name "*.json" -o -name "*.md" \
    -o -name "*.toml" -o -name "*.css" \
  \) \
  ! -name "*.raw.json" \
  ! -name "*.digest.txt" \
  ! -name "data-*.js" \
  | sort
```

## Phase 2: Update `CODEBASE.md`

Create or update `CODEBASE.md` at project root.

Recommended structure:

```markdown
# CODEBASE.md - EMR Analyzer

> Last updated: <YYYY-MM-DD>

## Project Overview
- **Type:** Local web app
- **Purpose:** Analyze HSBA via local extraction, prompt-driven reasoning, and DOCX/JSON rendering.
- **Repo:** https://github.com/khoibmtn/emr
- **Runtime:** FastAPI backend + React/Vite frontend

## Hard Constraints
- PHI local-only.
- `raw_text` must be preserved verbatim.
- JSON backbone is factual-only.
- AI reasoning belongs in DOCX, not JSON backbone.
- Grounding cache is read-only in the app.
- Provider calls containing HSBA/PHI must be local endpoint/proxy only.
- All delete actions require user confirmation.

## Architecture
- Backend: FastAPI, Pydantic contracts, settings store, sqlite jobs DB.
- Frontend: React + Vite + shadcn/ui.
- Stage 1: local PDF text extraction/OCR.
- Stage 2: local MD prompt + meta-prompt + LM/Cowork/manual.
- Stage 3: existing `render-report.js` renderer.

## Key Files
- `CLAUDE.md`
- `docs/superpowers/specs/2026-06-16-emr-analyzer-design.md`
- `docs/superpowers/plans/2026-06-18-emr-analyzer-implementation-plan.md`
- `reference-docs/PROMPTS-CLI.md`
- `reference-scripts/data-example.js`
- `reference-scripts/render-report.js`

## Current Implementation State
- <current milestone/task status>

## Recent Changes
- <recent commits / current session changes>

## Known Issues / TODOs
- <pending work>

## How to Resume
- Run `docs/workflows/load-context.md` workflow.
- Continue from the implementation plan task list.
```

## Phase 3: Update `docs/SESSION_NOTES.md`

Append a new dated section:

```markdown
# Session Notes

## Session <YYYY-MM-DD>

### What was done
- <bullet list>

### Decisions made
- <bullet list>

### Pending items
- <bullet list>

### Test status
- <commands run and results>

### Key files modified
- <files>

### PHI note
- No patient raw artifact was read or saved into context docs.
```

If the file already exists, append instead of replacing prior sessions.

## Phase 4: Run sync at the end

Unless the command was `save-context --no-sync`, run the EMR sync workflow after updating context files:

```text
Read and execute docs/workflows/sync.md
```

This means `save-context` always ends by:

1. running PHI/raw artifact guard,
2. running backend/frontend checks where available,
3. committing changes,
4. pushing to `origin main`.

## Output format

```markdown
## Context Saved

### Context files
- CODEBASE.md: updated
- docs/SESSION_NOTES.md: updated

### Sync
- Ran docs/workflows/sync.md: <yes/no>
- Commit: `<sha>` — <message>
- Pushed: <yes/no>

### Safety
- PHI/raw artifacts: not included
- Secrets: not included
```
