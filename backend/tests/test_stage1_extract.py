from __future__ import annotations

from pathlib import Path
from typing import Any

import fitz

from emr.contracts import JobRecord, JobState
from emr.pipeline.stage1_extract import build_digest, ma_kcb_from_pdf, parse_batch, parse_one
from emr.services.pdf_parser import OCRResult
from emr.store.jobs_db import JobsDB


def make_pdf(path: Path, pages: list[str]) -> Path:
    doc = fitz.open()
    for text in pages:
        page = doc.new_page()
        if text:
            page.insert_text((72, 72), text)
    doc.save(path)
    doc.close()
    return path


def test_parse_one_writes_per_job_raw_and_digest_artifacts(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "KCB 001.pdf", ["Example clinical note", "Second page"])
    result = parse_one(pdf, json_output_dir=tmp_path / "json", ocr_cache_dir=tmp_path / "ocr")

    assert result.ma_kcb == "KCB_001"
    assert result.raw_json_path == tmp_path / "json" / "raw" / "KCB_001.raw.json"
    assert result.digest_path == tmp_path / "json" / "raw" / "KCB_001.digest.txt"
    assert result.ocr_cache_path == tmp_path / "ocr" / "KCB_001.json"
    assert result.raw_json_path.exists()
    assert result.digest_path.exists()

    raw = result.raw_json_path.read_text(encoding="utf-8")
    assert '"schema_version": "1.0"' in raw
    assert '"ma_kcb": "KCB_001"' in raw
    assert "Example clinical note" in raw
    assert "Second page" in raw
    digest = result.digest_path.read_text(encoding="utf-8")
    assert "page_count: 2" in digest
    assert "source: pymupdf" in digest


def test_parse_one_uses_ocr_cache_hit_and_skips_ocr_recomputation(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "KCB002.pdf", [""])
    calls = 0

    def fake_ocr(path: Path, page_number: int) -> OCRResult:
        nonlocal calls
        calls += 1
        return OCRResult(text=f"OCR page {page_number}", confidence=0.9)

    first = parse_one(pdf, json_output_dir=tmp_path / "json", ocr_cache_dir=tmp_path / "ocr", ocr_func=fake_ocr)
    second = parse_one(pdf, json_output_dir=tmp_path / "json", ocr_cache_dir=tmp_path / "ocr", ocr_func=fake_ocr)

    assert calls == 1
    assert first.ocr_page_count == 1
    assert second.ocr_page_count == 1
    assert "OCR page 1" in second.raw_json_path.read_text(encoding="utf-8")


def test_parse_one_updates_jobs_db_stage1_meta_with_absolute_paths(tmp_path: Path) -> None:
    pdf = make_pdf(tmp_path / "KCB003.pdf", ["Text"])
    jobs = JobsDB(tmp_path / "jobs.db")
    jobs.create(JobRecord(ma_kcb="KCB003", pdf_path=str(pdf), state=JobState.received))

    result = parse_one(pdf, json_output_dir=tmp_path / "json", ocr_cache_dir=tmp_path / "ocr", jobs_db=jobs)
    stored = jobs.get("KCB003")

    assert stored is not None
    meta = stored.stage1_meta.model_dump(mode="json")
    assert meta["raw_json_path"] == str(result.raw_json_path)
    assert meta["digest_path"] == str(result.digest_path)
    assert meta["ocr_cache_path"] == str(result.ocr_cache_path)
    assert Path(meta["raw_json_path"]).is_absolute()
    assert Path(meta["digest_path"]).is_absolute()


def test_parse_batch_uses_executor_and_does_not_overwrite_outputs(tmp_path: Path, monkeypatch) -> None:
    pdf_a = make_pdf(tmp_path / "KCB-A.pdf", ["Alpha"])
    pdf_b = make_pdf(tmp_path / "KCB-B.pdf", ["Beta"])
    submitted: list[Path] = []

    class ImmediateFuture:
        def __init__(self, value: Any) -> None:
            self._value = value

        def result(self) -> Any:
            return self._value

    class FakeExecutor:
        def __init__(self, *, max_workers: int | None = None) -> None:
            self.max_workers = max_workers

        def __enter__(self) -> "FakeExecutor":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def submit(self, fn, path, **kwargs):
            submitted.append(Path(path))
            return ImmediateFuture(fn(path, **kwargs))

    def fake_as_completed(futures):
        return list(futures)

    monkeypatch.setattr("emr.pipeline.stage1_extract.as_completed", fake_as_completed)

    results = list(
        parse_batch(
            [pdf_a, pdf_b],
            json_output_dir=tmp_path / "json",
            ocr_cache_dir=tmp_path / "ocr",
            max_workers=2,
            executor_factory=FakeExecutor,
        )
    )

    assert submitted == [pdf_a, pdf_b]
    assert {result.ma_kcb for result in results} == {"KCB-A", "KCB-B"}
    assert (tmp_path / "json" / "raw" / "KCB-A.raw.json").exists()
    assert (tmp_path / "json" / "raw" / "KCB-B.raw.json").exists()
    assert "Alpha" in (tmp_path / "json" / "raw" / "KCB-A.raw.json").read_text(encoding="utf-8")
    assert "Beta" in (tmp_path / "json" / "raw" / "KCB-B.raw.json").read_text(encoding="utf-8")


def test_build_digest_uses_short_page_previews() -> None:
    digest = build_digest(
        {
            "schema_version": "1.0",
            "ma_kcb": "KCB004",
            "pages": [
                {"page": 1, "source": "pymupdf", "text": "A" * 200},
                {"page": 2, "source": "ocr", "text": "OCR text"},
            ],
        },
        preview_chars=10,
    )

    assert "ma_kcb: KCB004" in digest
    assert "page_count: 2" in digest
    assert "preview: AAAAAAAAAA" in digest
    assert "OCR text" in digest


def test_ma_kcb_from_pdf_sanitizes_spaces() -> None:
    assert ma_kcb_from_pdf("/tmp/KCB 005.pdf") == "KCB_005"
