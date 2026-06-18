from __future__ import annotations

from pathlib import Path

import fitz

from emr.services.pdf_parser import OCRResult, extract_pages, file_md5


def make_pdf(path: Path, pages: list[str]) -> Path:
    doc = fitz.open()
    for text in pages:
        page = doc.new_page()
        if text:
            page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()
    return path


def test_extract_pages_returns_text_selectable_pages(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "sample.pdf", ["Example page one", "Example page two"])

    pages = extract_pages(pdf)

    assert [page.page for page in pages] == [1, 2]
    assert all(page.source == "pymupdf" for page in pages)
    assert pages[0].text.strip() == "Example page one"
    assert pages[1].text.strip() == "Example page two"
    assert all(page.needs_ocr is False for page in pages)


def test_extract_pages_marks_blank_pages_for_ocr(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "scan.pdf", ["", "Text page"])

    pages = extract_pages(pdf)

    assert pages[0].page == 1
    assert pages[0].text == ""
    assert pages[0].source == "pymupdf"
    assert pages[0].needs_ocr is True
    assert pages[1].source == "pymupdf"
    assert pages[1].needs_ocr is False


def test_extract_pages_uses_injected_ocr_for_blank_pages(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "ocr.pdf", [""])
    calls: list[tuple[Path, int]] = []

    def fake_ocr(path: Path, page_number: int) -> OCRResult:
        calls.append((path, page_number))
        return OCRResult(text="OCR text", confidence=0.91)

    pages = extract_pages(pdf, ocr_func=fake_ocr)

    assert calls == [(pdf, 1)]
    assert pages[0].source == "ocr"
    assert pages[0].text == "OCR text"
    assert pages[0].ocr_confidence == 0.91


def test_file_md5_is_stable_for_local_cache_keys(tmp_path: Path) -> None:
    file_path = tmp_path / "file.bin"
    file_path.write_bytes(b"abc")

    assert file_md5(file_path) == file_md5(file_path)
