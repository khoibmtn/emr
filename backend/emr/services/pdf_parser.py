from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz


@dataclass(frozen=True)
class ParsedPage:
    page: int
    text: str
    source: str
    needs_ocr: bool = False
    ocr_confidence: float | None = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "page": self.page,
            "text": self.text,
            "source": self.source,
        }
        if self.needs_ocr:
            data["needs_ocr"] = True
        if self.ocr_confidence is not None:
            data["ocr_confidence"] = self.ocr_confidence
        return data


@dataclass(frozen=True)
class OCRResult:
    text: str
    confidence: float | None = None


OCRFunction = Callable[[Path, int], OCRResult | str]


def file_md5(path: str | Path) -> str:
    digest = hashlib.md5()  # noqa: S324 - local cache key, not security use
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_pages(pdf_path: str | Path, *, ocr_func: OCRFunction | None = None) -> list[ParsedPage]:
    path = Path(pdf_path).expanduser()
    pages: list[ParsedPage] = []

    with fitz.open(path) as doc:
        for index, page in enumerate(doc, start=1):
            text = page.get_text("text") or ""
            if text.strip():
                pages.append(ParsedPage(page=index, text=text, source="pymupdf"))
                continue

            if ocr_func is None:
                pages.append(ParsedPage(page=index, text="", source="pymupdf", needs_ocr=True))
                continue

            ocr = ocr_func(path, index)
            if isinstance(ocr, OCRResult):
                pages.append(ParsedPage(page=index, text=ocr.text, source="ocr", ocr_confidence=ocr.confidence))
            else:
                pages.append(ParsedPage(page=index, text=str(ocr), source="ocr"))

    return pages
