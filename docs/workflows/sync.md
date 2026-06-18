---
description: Sync EMR Analyzer local project to GitHub safely. Runs local checks, blocks PHI/raw artifacts, commits, and pushes to main. No cloud deploy.
---

# sync — EMR Analyzer

## Purpose

Commit and push EMR Analyzer changes to GitHub after running local quality and safety checks. This workflow is local-app oriented and intentionally does **not** deploy anywhere.

## Commands

```text
sync                 Run checks + commit + push
sync --skip-checks   Commit + push after PHI/raw artifact guard only
sync status          Show git status and latest commit
```

## Hard safety rules

- Never commit patient PDFs, DOCX outputs, raw extracted JSON, digest text, temporary DATA JS, OCR cache, or archives.
- Never commit local secrets or settings files.
- If a raw/PHI artifact is staged, stop immediately and ask for user decision.
- Do not delete files in this workflow.

## Pre-flight checks

### 1. Git status

```bash
cd {{PROJECT_DIR}}
git status --short
```

### 2. PHI/raw artifact guard

Run before and after staging:

```bash
cd {{PROJECT_DIR}}
if git status --short | grep -E '\.raw\.json|\.digest\.txt|data-.*\.js|\.docx|\.pdf|ocr-cache|archive|(^|/)output/|(^|/)outputs/' ; then
  echo "STOP: possible PHI/raw artifact present in git status"
  exit 1
fi
```

### 3. Secret guard

```bash
cd {{PROJECT_DIR}}
if grep -RInE 'sk-[A-Za-z0-9]|AIza[0-9A-Za-z_-]|xox[baprs]-|AKIA[0-9A-Z]{16}' \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.venv \
  --exclude-dir=venv \
  . ; then
  echo "STOP: possible secret detected"
  exit 1
fi
```

Note: Documentation may mention placeholder names such as `api_key` or `ANTHROPIC_AUTH_TOKEN`; those are allowed if they do not contain real secret values.

### 4. Backend checks, if backend exists

```bash
cd {{PROJECT_DIR}}
if [ -d backend ]; then
  cd backend
  uv run pytest tests -v
  uv run python -m compileall emr
  cd ..
fi
```

If dependencies are not installed yet, report the exact blocker instead of skipping silently.

### 5. Frontend checks, if frontend exists

```bash
cd {{PROJECT_DIR}}
if [ -d frontend ]; then
  cd frontend
  npm test -- --run
  npm run build
  cd ..
fi
```

If frontend is not scaffolded yet, report `frontend not present yet` and continue.

## Commit and push

### 1. Stage changes

```bash
cd {{PROJECT_DIR}}
git add -A
```

### 2. Re-run PHI/raw artifact guard after staging

```bash
cd {{PROJECT_DIR}}
if git diff --cached --name-only | grep -E '\.raw\.json|\.digest\.txt|data-.*\.js|\.docx|\.pdf|ocr-cache|archive|(^|/)output/|(^|/)outputs/' ; then
  echo "STOP: PHI/raw artifact staged"
  exit 1
fi
```

### 3. Commit

```bash
cd {{PROJECT_DIR}}
git commit -m "<conventional message>"
```

Commit message examples:

```text
feat: complete backend settings store
fix: prevent staged PHI artifacts
docs: save EMR session context
```

### 4. Push

```bash
cd {{PROJECT_DIR}}
git push origin main
```

## Output format

```markdown
## Sync Complete

### Checks
- Backend tests: <passed/skipped/blocker>
- Frontend tests/build: <passed/skipped/blocker>
- PHI/raw artifact guard: passed
- Secret guard: passed

### Git
- Commit: `<sha>` — <message>
- Branch: main
- Pushed to: https://github.com/khoibmtn/emr.git

### Notes
- No deploy was run. EMR Analyzer remains local-only.
```
