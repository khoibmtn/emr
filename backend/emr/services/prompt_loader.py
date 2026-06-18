from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")


class PromptLoaderError(RuntimeError):
    """Base error for prompt loading failures."""


class PromptFileNotFoundError(PromptLoaderError):
    """Raised when the requested prompt Markdown file is missing."""


class PromptAnchorNotFoundError(PromptLoaderError):
    """Raised when a section anchor is not present in the prompt file."""


@dataclass(frozen=True)
class PromptSection:
    name: str
    content: str
    source_file: Path
    section_anchor: str
    heading_level: int


def load_prompt_section(source_file: str | Path, section_anchor: str) -> PromptSection:
    """Load a Markdown section by heading anchor.

    The returned content includes the matching heading line and stops before the
    next heading with the same or higher level. Nested headings remain part of
    the section.
    """

    path = Path(source_file).expanduser()
    if not path.exists():
        raise PromptFileNotFoundError(f"prompt file not found: {path}")

    lines = path.read_text(encoding="utf-8").splitlines()
    start_index: int | None = None
    start_level: int | None = None
    heading_name = section_anchor.strip().lstrip("#").strip()

    for index, line in enumerate(lines):
        match = HEADING_RE.match(line)
        if match is None:
            continue
        level = len(match.group(1))
        title = match.group(2).strip()
        if line.strip() == section_anchor.strip() or title == heading_name:
            start_index = index
            start_level = level
            heading_name = title
            break

    if start_index is None or start_level is None:
        raise PromptAnchorNotFoundError(f"section anchor not found: {section_anchor}")

    end_index = len(lines)
    for index in range(start_index + 1, len(lines)):
        match = HEADING_RE.match(lines[index])
        if match is not None and len(match.group(1)) <= start_level:
            end_index = index
            break

    content = "\n".join(lines[start_index:end_index]).rstrip() + "\n"
    return PromptSection(
        name=heading_name,
        content=content,
        source_file=path,
        section_anchor=section_anchor,
        heading_level=start_level,
    )
