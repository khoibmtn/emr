from __future__ import annotations

from pathlib import Path

from emr.services.path_resolver import get_emr_root, resolve_emr_path


def test_emr_placeholder_prefers_emr_home(tmp_path: Path) -> None:
    env_root = tmp_path / "env-root"
    app_root = tmp_path / "app-root"

    resolved = resolve_emr_path("<emr>/reference-docs", env={"EMR_HOME": str(env_root)}, app_root=app_root)

    assert resolved == env_root / "reference-docs"


def test_emr_root_uses_app_root_when_env_missing(tmp_path: Path) -> None:
    app_root = tmp_path / "app-root"

    root = get_emr_root(env={}, app_root=app_root, cwd=tmp_path / "cwd")

    assert root == app_root


def test_emr_root_falls_back_to_cwd_when_no_env_or_app_root(tmp_path: Path) -> None:
    cwd = tmp_path / "cwd-root"

    root = get_emr_root(env={}, app_root=None, cwd=cwd, infer_app_root=False)

    assert root == cwd


def test_resolver_expands_home_and_keeps_absolute_paths_usable(tmp_path: Path, monkeypatch) -> None:
    fake_home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(fake_home))

    resolved = resolve_emr_path("~/Documents/hsba", env={}, app_root=tmp_path / "app")

    assert resolved == fake_home / "Documents" / "hsba"


def test_resolver_resolves_relative_paths_against_emr_root(tmp_path: Path) -> None:
    root = tmp_path / "emr-root"

    resolved = resolve_emr_path("reference-docs/PROMPTS-CLI.md", env={}, app_root=root)

    assert resolved == root / "reference-docs" / "PROMPTS-CLI.md"


def test_resolver_keeps_absolute_paths_independent_of_root(tmp_path: Path) -> None:
    absolute = tmp_path / "external" / "file.txt"

    resolved = resolve_emr_path(absolute, env={"EMR_HOME": str(tmp_path / "env")}, app_root=tmp_path / "app")

    assert resolved == absolute
