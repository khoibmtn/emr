from __future__ import annotations

import json
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from emr.contracts import Stage1Meta
from emr.services.pdf_parser import OCRFunction, OCRResult, ParsedPage, extract_pages, file_md5
from emr.store.jobs_db import JobsDB

SCHEMA_VERSION = "1.0"


@dataclass(frozen=True)
class Stage1Result:
    ma_kcb: str
    pdf_path: Path
    raw_json_path: Path
    digest_path: Path
    ocr_cache_path: Path
    page_count: int
    ocr_page_count: int

    def stage1_meta(self) -> Stage1Meta:
        return Stage1Meta.model_validate(
            {
                "pages": self.page_count,
                "ocr": {
                    "completed": [],
                    "pending": [],
                    "failed": [],
                },
                "raw_json_path": str(self.raw_json_path),
                "digest_path": str(self.digest_path),
                "ocr_cache_path": str(self.ocr_cache_path),
                "ocr_page_count": self.ocr_page_count,
            }
        )


def ma_kcb_from_pdf(pdf_path: str | Path) -> str:
    stem = Path(pdf_path).stem.strip()
    return "_".join(stem.split()) or "unknown"


def parse_one(
    pdf_path: str | Path,
    *,
    json_output_dir: str | Path,
    ocr_cache_dir: str | Path,
    jobs_db: JobsDB | None = None,
    ocr_func: OCRFunction | None = None,
) -> Stage1Result:
    path = Path(pdf_path).expanduser().resolve(strict=False)
    ma_kcb = ma_kcb_from_pdf(path)
    raw_dir = Path(json_output_dir).expanduser().resolve(strict=False) / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    cache_dir = Path(ocr_cache_dir).expanduser().resolve(strict=False)
    cache_dir.mkdir(parents=True, exist_ok=True)

    ocr_cache_path = cache_dir / f"{ma_kcb}.json"
    pdf_hash = file_md5(path)
    pages = _extract_with_cache(path, ocr_cache_path, pdf_hash, ocr_func=ocr_func)

    raw_json_path = raw_dir / f"{ma_kcb}.raw.json"
    digest_path = raw_dir / f"{ma_kcb}.digest.txt"
    raw_payload = build_raw_payload(
        ma_kcb=ma_kcb,
        pdf_path=path,
        pages=pages,
        ocr_cache_path=ocr_cache_path,
    )
    raw_json_path.write_text(json.dumps(raw_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    digest_path.write_text(build_digest(raw_payload), encoding="utf-8")

    result = Stage1Result(
        ma_kcb=ma_kcb,
        pdf_path=path,
        raw_json_path=raw_json_path,
        digest_path=digest_path,
        ocr_cache_path=ocr_cache_path,
        page_count=len(pages),
        ocr_page_count=sum(1 for page in pages if page.source == "ocr"),
    )
    if jobs_db is not None:
        jobs_db.update(ma_kcb, stage1_meta=result.stage1_meta())
    return result


def parse_batch(
    pdf_paths: Iterable[str | Path],
    *,
    json_output_dir: str | Path,
    ocr_cache_dir: str | Path,
    jobs_db: JobsDB | None = None,
    max_workers: int | None = None,
    executor_factory: Callable[..., Any] = ProcessPoolExecutor,
) -> Iterator[Stage1Result]:
    paths = [Path(path) for path in pdf_paths]
    if not paths:
        return

    # OCR and DB handles are intentionally not passed into subprocesses. Stage 1
    # worker processes do deterministic text extraction/cache work; parent updates DB.
    with executor_factory(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                parse_one,
                path,
                json_output_dir=json_output_dir,
                ocr_cache_dir=ocr_cache_dir,
                jobs_db=None,
                ocr_func=None,
            ): path
            for path in paths
        }
        for future in as_completed(futures):
            result = future.result()
            if jobs_db is not None:
                jobs_db.update(result.ma_kcb, stage1_meta=result.stage1_meta())
            yield result


def build_raw_payload(
    *,
    ma_kcb: str,
    pdf_path: Path,
    pages: list[ParsedPage],
    ocr_cache_path: Path,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "ma_kcb": ma_kcb,
        "pdf_path": str(pdf_path),
        "pages": [page.to_dict() for page in pages],
        "ocr_cache_path": str(ocr_cache_path),
        "extracted_at": datetime.now(UTC).isoformat(),
    }


def build_digest(raw_payload: dict[str, Any], *, preview_chars: int = 120) -> str:
    pages = raw_payload.get("pages", [])
    lines = [
        f"ma_kcb: {raw_payload.get('ma_kcb', '')}",
        f"schema_version: {raw_payload.get('schema_version', '')}",
        f"page_count: {len(pages)}",
        "pages:",
    ]
    for page in pages:
        text = " ".join(str(page.get("text", "")).split())
        preview = text[:preview_chars]
        lines.append(f"- page: {page.get('page')} | source: {page.get('source')} | chars: {len(page.get('text', ''))} | preview: {preview}")
    return "\n".join(lines) + "\n"


def _extract_with_cache(
    pdf_path: Path,
    cache_path: Path,
    pdf_hash: str,
    *,
    ocr_func: OCRFunction | None,
) -> list[ParsedPage]:
    cache = _load_cache(cache_path)
    if cache.get("pdf_md5") != pdf_hash:
        cache = {"pdf_md5": pdf_hash, "pages": {}}

    def cached_ocr(path: Path, page_number: int) -> OCRResult | str:
        page_key = str(page_number)
        page_cache = cache.setdefault("pages", {})
        if page_key in page_cache:
            entry = page_cache[page_key]
            return OCRResult(text=entry.get("text", ""), confidence=entry.get("confidence"))
        if ocr_func is None:
            return OCRResult(text="", confidence=None)
        result = ocr_func(path, page_number)
        if isinstance(result, OCRResult):
            entry = {"text": result.text, "confidence": result.confidence}
        else:
            entry = {"text": str(result), "confidence": None}
        page_cache[page_key] = entry
        _save_cache(cache_path, cache)
        return OCRResult(text=entry["text"], confidence=entry["confidence"])

    pages = extract_pages(pdf_path, ocr_func=cached_ocr if ocr_func is not None or cache.get("pages") else None)
    if cache.get("pages"):
        _save_cache(cache_path, cache)
    return pages


def _load_cache(cache_path: Path) -> dict[str, Any]:
    if not cache_path.exists():
        return {}
    return json.loads(cache_path.read_text(encoding="utf-8"))


def _save_cache(cache_path: Path, cache: dict[str, Any]) -> None:
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
