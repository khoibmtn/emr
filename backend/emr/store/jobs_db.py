from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from emr.contracts import JobRecord, JobUpdate, utc_now


class JobsDB:
    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path).expanduser()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def create(self, job: JobRecord) -> JobRecord:
        payload = self._record_to_row(job)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs (
                    ma_kcb, pdf_path, state, stage1_meta, stage2_mode, stage2_meta,
                    stage3_meta, error_log, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["ma_kcb"],
                    payload["pdf_path"],
                    payload["state"],
                    payload["stage1_meta"],
                    payload["stage2_mode"],
                    payload["stage2_meta"],
                    payload["stage3_meta"],
                    payload["error_log"],
                    payload["created_at"],
                    payload["updated_at"],
                ),
            )
        return job

    def update(self, ma_kcb: str, **changes: Any) -> JobRecord | None:
        current = self.get(ma_kcb)
        if current is None:
            return None

        update = JobUpdate.model_validate(changes)
        data = current.model_dump()
        for key, value in update.model_dump(exclude_none=True).items():
            data[key] = value
        data["updated_at"] = utc_now()
        updated = JobRecord.model_validate(data)
        payload = self._record_to_row(updated)

        with self._connect() as conn:
            conn.execute(
                """
                UPDATE jobs
                SET pdf_path = ?, state = ?, stage1_meta = ?, stage2_mode = ?,
                    stage2_meta = ?, stage3_meta = ?, error_log = ?, updated_at = ?
                WHERE ma_kcb = ?
                """,
                (
                    payload["pdf_path"],
                    payload["state"],
                    payload["stage1_meta"],
                    payload["stage2_mode"],
                    payload["stage2_meta"],
                    payload["stage3_meta"],
                    payload["error_log"],
                    payload["updated_at"],
                    payload["ma_kcb"],
                ),
            )
        return updated

    def get(self, ma_kcb: str) -> JobRecord | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT ma_kcb, pdf_path, state, stage1_meta, stage2_mode, stage2_meta,
                       stage3_meta, error_log, created_at, updated_at
                FROM jobs
                WHERE ma_kcb = ?
                """,
                (ma_kcb,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_record(row)

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL;")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    ma_kcb TEXT PRIMARY KEY,
                    pdf_path TEXT NOT NULL,
                    state TEXT NOT NULL,
                    stage1_meta TEXT NOT NULL,
                    stage2_mode TEXT NOT NULL,
                    stage2_meta TEXT NOT NULL,
                    stage3_meta TEXT NOT NULL,
                    error_log TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _record_to_row(job: JobRecord) -> dict[str, str]:
        return {
            "ma_kcb": job.ma_kcb,
            "pdf_path": job.pdf_path,
            "state": job.state.value,
            "stage1_meta": json.dumps(job.stage1_meta.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
            "stage2_mode": job.stage2_mode.value,
            "stage2_meta": json.dumps(job.stage2_meta.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
            "stage3_meta": json.dumps(job.stage3_meta.model_dump(mode="json"), ensure_ascii=False, sort_keys=True),
            "error_log": json.dumps(job.error_log, ensure_ascii=False),
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
        }

    @staticmethod
    def _row_to_record(row: sqlite3.Row) -> JobRecord:
        return JobRecord.model_validate(
            {
                "ma_kcb": row["ma_kcb"],
                "pdf_path": row["pdf_path"],
                "state": row["state"],
                "stage1_meta": json.loads(row["stage1_meta"]),
                "stage2_mode": row["stage2_mode"],
                "stage2_meta": json.loads(row["stage2_meta"]),
                "stage3_meta": json.loads(row["stage3_meta"]),
                "error_log": json.loads(row["error_log"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
        )
