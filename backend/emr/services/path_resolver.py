from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

EMR_PLACEHOLDER = "<emr>"


class PathResolutionError(ValueError):
    """Raised when a configured path cannot be resolved."""


def get_emr_root(
    *,
    env: Mapping[str, str] | None = None,
    app_root: str | Path | None = None,
    cwd: str | Path | None = None,
    infer_app_root: bool = True,
) -> Path:
    """Return the EMR application root.

    Priority is intentionally explicit and testable:
    1. EMR_HOME environment variable.
    2. Supplied app/install root, or the root inferred from this package.
    3. Current working directory fallback.
    """

    environ = env if env is not None else os.environ
    emr_home = environ.get("EMR_HOME")
    if emr_home:
        return Path(emr_home).expanduser().resolve(strict=False)

    if app_root is not None:
        return Path(app_root).expanduser().resolve(strict=False)

    if infer_app_root:
        inferred = _infer_app_root(Path(__file__).resolve())
        if inferred is not None:
            return inferred

    fallback = Path(cwd).expanduser() if cwd is not None else Path.cwd()
    return fallback.resolve(strict=False)


def resolve_emr_path(
    value: str | Path,
    *,
    env: Mapping[str, str] | None = None,
    app_root: str | Path | None = None,
    cwd: str | Path | None = None,
    infer_app_root: bool = True,
) -> Path:
    """Resolve a configured path, including the ``<emr>`` placeholder.

    ``~`` is expanded for all inputs. Absolute paths stay absolute. Relative
    paths are interpreted relative to the selected EMR root so settings remain
    usable regardless of the process working directory.
    """

    raw = Path(value).expanduser()
    raw_text = str(raw)
    root = get_emr_root(env=env, app_root=app_root, cwd=cwd, infer_app_root=infer_app_root)

    if EMR_PLACEHOLDER in raw_text:
        return Path(raw_text.replace(EMR_PLACEHOLDER, str(root))).expanduser().resolve(strict=False)

    if raw.is_absolute():
        return raw.resolve(strict=False)

    return (root / raw).resolve(strict=False)


def _infer_app_root(start: Path) -> Path | None:
    """Infer repo/app root by walking upward from an installed package file."""

    for parent in start.parents:
        if (parent / "backend" / "emr").exists() or (parent / "reference-docs").exists():
            return parent.resolve(strict=False)
        if (parent / "pyproject.toml").exists() and parent.name == "backend":
            return parent.parent.resolve(strict=False)
    return None
