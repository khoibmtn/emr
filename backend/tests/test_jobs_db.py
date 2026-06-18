from __future__ import annotations

import sqlite3
from pathlib import Path

from emr.contracts import JobRecord, JobState, Stage2Meta, Stage3Meta
from emr.store.jobs_db import JobsDB


def build_job() -> JobRecord:
    return JobRecord(
        ma_kcb="KCB001",
        pdf_path="/tmp/input.pdf",
        state=JobState.queued,
        stage1_meta={
            "pages": 12,
            "ocr": {"pending": [2, 4]},
            "raw_json_path": "/tmp/raw.json",
        },
        stage2_meta={
            "grounding": {"hit": False},
            "notes": ["review"],
            "needs_clinician_review": True,
        },
        stage3_meta={
            "docx": "/tmp/output.docx",
            "bundle_checksum": "abc123",
        },
        error_log=["initial warning"],
    )


def test_jobs_db_initializes_wal_and_schema(tmp_path: Path) -> None:
    db_path = tmp_path / "jobs.db"
    JobsDB(db_path)

    with sqlite3.connect(db_path) as conn:
        journal_mode = conn.execute("PRAGMA journal_mode;").fetchone()[0]
        columns = [row[1] for row in conn.execute("PRAGMA table_info(jobs);").fetchall()]

    assert journal_mode.lower() == "wal"
    assert columns == [
        "ma_kcb",
        "pdf_path",
        "state",
        "stage1_meta",
        "stage2_mode",
        "stage2_meta",
        "stage3_meta",
        "error_log",
        "created_at",
        "updated_at",
    ]


def test_jobs_db_create_get_and_json_roundtrip(tmp_path: Path) -> None:
    db = JobsDB(tmp_path / "jobs.db")
    job = build_job()

    db.create(job)
    stored = db.get(job.ma_kcb)

    assert stored is not None
    assert stored.ma_kcb == "KCB001"
    assert stored.stage1_meta.pages == 12
    assert stored.stage1_meta.ocr is not None
    assert stored.stage1_meta.ocr.pending == [2, 4]
    assert stored.stage1_meta.model_dump(mode="json")["raw_json_path"] == "/tmp/raw.json"
    assert stored.stage2_meta.grounding is not None
    assert stored.stage2_meta.grounding.hit is False
    assert stored.stage2_meta.notes == ["review"]
    assert stored.stage2_meta.model_dump(mode="json")["needs_clinician_review"] is True
    assert stored.stage3_meta.docx == "/tmp/output.docx"
    assert stored.stage3_meta.model_dump(mode="json")["bundle_checksum"] == "abc123"
    assert stored.error_log == ["initial warning"]


def test_jobs_db_update_refreshes_updated_at_only(tmp_path: Path) -> None:
    db = JobsDB(tmp_path / "jobs.db")
    job = build_job()
    db.create(job)
    before = db.get(job.ma_kcb)
    assert before is not None

    updated = db.update(
        job.ma_kcb,
        state="stage2_running",
        stage2_mode="manual",
        stage2_meta={"grounding": {"hit": True}, "citations": 2, "reviewer": "md-01"},
        error_log=["updated"],
    )
    after = db.get(job.ma_kcb)

    assert updated is not None
    assert after is not None
    assert updated.state == "stage2_running"
    assert updated.stage2_mode == "manual"
    assert isinstance(after.stage2_meta, Stage2Meta)
    assert after.stage2_meta.grounding is not None
    assert after.stage2_meta.grounding.hit is True
    assert after.stage2_meta.citations == 2
    assert after.stage2_meta.model_dump(mode="json")["reviewer"] == "md-01"
    assert after.created_at == before.created_at
    assert after.updated_at > before.updated_at


def test_job_contract_serialization_roundtrip() -> None:
    job = build_job()

    payload = job.model_dump(mode="json")
    restored = JobRecord.model_validate(payload)

    assert payload.keys() >= {
        "ma_kcb",
        "pdf_path",
        "state",
        "stage1_meta",
        "stage2_mode",
        "stage2_meta",
        "stage3_meta",
        "error_log",
        "created_at",
        "updated_at",
    }
    assert restored.stage1_meta.ocr is not None
    assert restored.stage1_meta.ocr.pending == [2, 4]
    assert restored.stage2_meta.model_dump(mode="json")["needs_clinician_review"] is True
    assert restored.state == JobState.queued


def test_job_contracts_use_typed_metadata_with_extra_fields() -> None:
    job = build_job()

    assert job.stage1_meta.pages == 12
    assert job.stage1_meta.ocr is not None
    assert job.stage1_meta.ocr.pending == [2, 4]
    assert job.stage1_meta.model_dump(mode="json")["raw_json_path"] == "/tmp/raw.json"
    assert isinstance(job.stage2_meta, Stage2Meta)
    assert job.stage2_meta.model_dump(mode="json")["needs_clinician_review"] is True
    assert isinstance(job.stage3_meta, Stage3Meta)
    assert job.stage3_meta.model_dump(mode="json")["bundle_checksum"] == "abc123"
