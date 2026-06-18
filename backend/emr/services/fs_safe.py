from __future__ import annotations

import shutil
from pathlib import Path


class FileSystemSafetyError(RuntimeError):
    """Base error for guarded filesystem operations."""


class DeleteConfirmationRequiredError(FileSystemSafetyError):
    """Raised when a delete request is missing explicit confirmation."""


class DeleteOutsideAllowedPathError(FileSystemSafetyError):
    """Raised when the target is outside every allowed root."""


class DeleteTargetMissingError(FileSystemSafetyError):
    """Raised when the delete target does not exist."""


class EmptyAllowedPathsError(FileSystemSafetyError):
    """Raised when no delete whitelist is provided."""


def safe_delete(
    target: str | Path,
    *,
    allowed_paths: list[str | Path] | tuple[str | Path, ...],
    confirm: bool = False,
) -> Path:
    """Delete a file or directory only after whitelist and confirmation checks.

    Returns the normalized target path that was deleted. All checks happen
    before deletion, and callers should pass only paths that came from local
    settings. Directory deletion is recursive and intended for app-managed
    artifact directories only.
    """

    if confirm is not True:
        raise DeleteConfirmationRequiredError("safe_delete requires confirm=True")

    if not allowed_paths:
        raise EmptyAllowedPathsError("safe_delete requires at least one allowed path")

    target_path = _normalize(target)
    if not target_path.exists():
        raise DeleteTargetMissingError(f"delete target does not exist: {target_path}")

    allowed_roots = [_normalize(path) for path in allowed_paths]
    if not any(_is_inside(target_path, root) for root in allowed_roots):
        raise DeleteOutsideAllowedPathError(f"delete target is outside allowed paths: {target_path}")

    if target_path.is_dir():
        shutil.rmtree(target_path)
    else:
        target_path.unlink()

    return target_path


def _normalize(value: str | Path) -> Path:
    return Path(value).expanduser().resolve(strict=False)


def _is_inside(target: Path, root: Path) -> bool:
    try:
        target.relative_to(root)
    except ValueError:
        return False
    return True
