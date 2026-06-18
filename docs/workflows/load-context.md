---
description: Load EMR Analyzer project context safely at session start. Pulls latest code, creates a working branch, reads context docs, and scans source files only.
---

# load-context — EMR Analyzer

## Purpose

Use this at the beginning of a new EMR Analyzer work session to reload project context without exposing PHI. It pulls latest `main`, creates a timestamped working branch, reads architecture/session docs, and scans source files only.

## Commands

```text
load-context          Full context load + create temp branch
load-context quick    CODEBASE.md + session notes + recent git only
load-context deep     Full load + key architecture file scan
```

## PHI guardrails

Do **not** read, print, grep, or commit these during context loading:

- `input/`
- `output/`
- `outputs/`
- `ocr-cache/`
- `archive/`
- `*.raw.json`
- `*.digest.txt`
- `data-*.js`
- `*.docx`
- `*.pdf`
- any HSBA patient artifact outside the repo

Only scan source/docs/config files.

## Steps

### 1. Pull latest `main`

```bash
cd {{PROJECT_DIR}}
git checkout main
git pull origin main
```

### 2. Create a working branch

```bash
cd {{PROJECT_DIR}}
git checkout -b "$(date +%Y%m%d-%H%M)-temp"
```

Branch example: `20260618-1430-temp`.

### 3. Read core context docs

Read these files in order:

```text
CLAUDE.md
CODEBASE.md                         # if present
docs/SESSION_NOTES.md               # if present
docs/superpowers/specs/2026-06-16-emr-analyzer-design.md
docs/superpowers/plans/2026-06-18-emr-analyzer-implementation-plan.md
```

If `CODEBASE.md` or `docs/SESSION_NOTES.md` does not exist yet, report that `save-context` should create them later.

### 4. Check recent git history

```bash
cd {{PROJECT_DIR}}
git log --oneline -20
git status --short
git branch --show-current
```

### 5. Scan source structure only

```bash
cd {{PROJECT_DIR}}
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

### 6. Check dev servers

```bash
lsof -i :8765 -i :5173 2>/dev/null | head -10 || echo "No EMR dev servers running"
```

### 7. Deep mode only

Read key source files if they exist:

```text
backend/emr/main.py
backend/emr/api/app.py
backend/emr/contracts.py
backend/emr/store/settings_store.py
backend/emr/store/jobs_db.py
frontend/src/App.tsx
frontend/src/main.tsx
```

Do not read runtime artifacts or patient outputs.

## Output format

```markdown
## Context Loaded

### Project
- Repo: https://github.com/khoibmtn/emr
- Branch: <branch>
- Stack: FastAPI backend + React/Vite frontend

### Current State
- Recent commits: <summary>
- Uncommitted changes: <yes/no>
- Dev servers: backend :8765 <status>, frontend :5173 <status>

### Key Docs Read
- CLAUDE.md
- CODEBASE.md <present/missing>
- docs/SESSION_NOTES.md <present/missing>
- design spec
- implementation plan

### PHI Guard
- No patient artifact was read.
```
