from __future__ import annotations

from pathlib import Path

import pytest

from emr.services.prompt_loader import PromptAnchorNotFoundError, PromptFileNotFoundError, load_prompt_section

FIXTURE = Path(__file__).parent / "fixtures" / "prompts" / "PROMPTS-CLI.sample.md"


def test_load_prompt_section_includes_heading_and_nested_headings() -> None:
    section = load_prompt_section(FIXTURE, "# Prompt C")

    assert section.name == "Prompt C"
    assert section.heading_level == 1
    assert section.content.startswith("# Prompt C\n")
    assert "Phân tích HSBA theo luồng chuẩn." in section.content
    assert "## Stage 1 context" in section.content
    assert "### Detail" in section.content


def test_load_prompt_section_stops_before_same_or_higher_level_heading() -> None:
    section = load_prompt_section(FIXTURE, "# Prompt C")

    assert "# Prompt E" not in section.content
    assert "Tổng hợp nhiều HSBA." not in section.content


def test_load_prompt_section_supports_anchor_title_match() -> None:
    section = load_prompt_section(FIXTURE, "## Step A.1")

    assert section.name == "Step A.1"
    assert section.heading_level == 2
    assert section.content == "## Step A.1\n\nNội dung con của Prompt A.\n"


def test_load_prompt_section_raises_clear_error_for_missing_file(tmp_path: Path) -> None:
    missing = tmp_path / "missing.md"

    with pytest.raises(PromptFileNotFoundError, match="prompt file not found"):
        load_prompt_section(missing, "# Prompt C")


def test_load_prompt_section_raises_clear_error_for_missing_anchor() -> None:
    with pytest.raises(PromptAnchorNotFoundError, match="section anchor not found"):
        load_prompt_section(FIXTURE, "# Prompt Z")


def test_meta_template_contains_required_placeholders_and_hard_rules() -> None:
    template = (Path(__file__).parents[1] / "emr" / "prompts" / "meta_template.md").read_text(encoding="utf-8")

    for placeholder in ["{{workflow_md}}", "{{raw_json}}", "{{digest}}", "{{grounding}}", "{{schema}}"]:
        assert placeholder in template

    assert "Bảo toàn `raw_text`" in template
    assert "Conservative+" in template
    assert "No PHI external" in template
    assert "Schema exactness" in template
