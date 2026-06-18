from __future__ import annotations

from pathlib import Path

import pytest

from emr.services.fs_safe import (
    DeleteConfirmationRequiredError,
    DeleteOutsideAllowedPathError,
    DeleteTargetMissingError,
    EmptyAllowedPathsError,
    safe_delete,
)


def test_safe_delete_deletes_file_inside_allowed_path_with_confirm(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    target = allowed / "artifact.txt"
    target.write_text("local test artifact", encoding="utf-8")

    deleted = safe_delete(target, allowed_paths=[allowed], confirm=True)

    assert deleted == target
    assert not target.exists()


def test_safe_delete_deletes_directory_inside_allowed_path_with_confirm(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    target = allowed / "job-output"
    target.mkdir(parents=True)
    (target / "artifact.txt").write_text("local test artifact", encoding="utf-8")

    safe_delete(target, allowed_paths=[allowed], confirm=True)

    assert not target.exists()


def test_safe_delete_rejects_missing_confirm_and_keeps_file(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    target = allowed / "artifact.txt"
    target.write_text("local test artifact", encoding="utf-8")

    with pytest.raises(DeleteConfirmationRequiredError, match="confirm=True"):
        safe_delete(target, allowed_paths=[allowed], confirm=False)

    assert target.exists()


def test_safe_delete_rejects_target_outside_allowed_paths_and_keeps_file(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    outside = tmp_path / "outside"
    allowed.mkdir()
    outside.mkdir()
    target = outside / "artifact.txt"
    target.write_text("local test artifact", encoding="utf-8")

    with pytest.raises(DeleteOutsideAllowedPathError, match="outside allowed paths"):
        safe_delete(target, allowed_paths=[allowed], confirm=True)

    assert target.exists()


def test_safe_delete_rejects_empty_allowed_paths(tmp_path: Path) -> None:
    target = tmp_path / "artifact.txt"
    target.write_text("local test artifact", encoding="utf-8")

    with pytest.raises(EmptyAllowedPathsError, match="at least one allowed path"):
        safe_delete(target, allowed_paths=[], confirm=True)

    assert target.exists()


def test_safe_delete_rejects_missing_target(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    allowed.mkdir()
    missing = allowed / "missing.txt"

    with pytest.raises(DeleteTargetMissingError, match="does not exist"):
        safe_delete(missing, allowed_paths=[allowed], confirm=True)


def test_safe_delete_normalizes_dotdot_before_whitelist_check(tmp_path: Path) -> None:
    allowed = tmp_path / "allowed"
    outside = tmp_path / "outside"
    allowed.mkdir()
    outside.mkdir()
    target = outside / "artifact.txt"
    target.write_text("local test artifact", encoding="utf-8")
    traversal = allowed / ".." / "outside" / "artifact.txt"

    with pytest.raises(DeleteOutsideAllowedPathError):
        safe_delete(traversal, allowed_paths=[allowed], confirm=True)

    assert target.exists()
