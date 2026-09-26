"""Shared test setup. Everything runs against synthetic data: the current mock
CSVs in ./data/ and the tiny fixture in tests/fixtures/."""
import json
import os
import shutil
import sys
from pathlib import Path

import pandas as pd
import pytest

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(REPO / "data"))

import ingest  # noqa: E402
import reshape_v3  # noqa: E402
import sitdb  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"
OLD_WAVE = FIXTURES / "mock_wave_a"      # the first mock dataset (tidy CSVs), kept as the second wave in tests
OLD_WAVE_META = OLD_WAVE / "wave.meta.json"
REFERENCE = FIXTURES / "reference"        # reshape output from the same generator run as data/raw
RAW_TEXT = REPO / "data" / "raw" / "mock_v3_text.csv"
RAW_NUMERIC = REPO / "data" / "raw" / "mock_v3_numeric.csv"
PRIVATE_QSF = BACKEND / "private" / "survey_v3.qsf"
NO_REAL_QSF = "real QSF not found at backend/private/, skipping reproduction test"
TABLES = list(sitdb.TABLE_COLUMNS)


@pytest.fixture()
def tiny(tmp_path):
    """A writable copy of the tiny synthetic survey: paths to text, numeric, qsf."""
    dest = tmp_path / "tiny"
    shutil.copytree(FIXTURES, dest)
    return {"text": dest / "tiny_text.csv", "numeric": dest / "tiny_numeric.csv",
            "qsf": dest / "tiny_survey.qsf", "meta": dest / "tiny_text.csv.meta.json", "dir": dest}


@pytest.fixture()
def tidy(tmp_path, tiny):
    """The tiny survey already reshaped into tidy CSVs (a folder + wave.meta.json)."""
    dest = tmp_path / "tidy"
    dest.mkdir()
    _, QS = reshape_v3.load_qsf(tiny["qsf"])
    tables = ingest.stringify(reshape_v3.reshape(reshape_v3.load(tiny["text"]), reshape_v3.load(tiny["numeric"]), QS))
    for name, df in tables.items():
        df.to_csv(dest / f"{name}.csv", index=False)
    (dest / "wave.meta.json").write_text(json.dumps({"is_mock": True}), encoding="utf-8")
    return dest


# Set SIT_TEST_POSTGRES to a postgresql:// URL of a scratch database to run the whole
# suite on PostgreSQL instead of SQLite. Each test gets its own schema (dropped
# afterwards), so nothing else in that database is touched.
PG_URL = os.environ.get("SIT_TEST_POSTGRES")
ON_POSTGRES = bool(PG_URL)
sqlite_only = pytest.mark.skipif(ON_POSTGRES, reason="SQLite-specific behaviour (file databases, PRAGMA)")


@pytest.fixture()
def db(tmp_path):
    """The database under test: a SQLite file, or a fresh PostgreSQL schema."""
    if not ON_POSTGRES:
        yield tmp_path / "test.db"
        return
    import uuid
    import psycopg
    schema = f"t_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(PG_URL, autocommit=True) as admin:
        admin.execute(f"CREATE SCHEMA {schema}")
    sep = "&" if "?" in PG_URL else "?"
    yield f"{PG_URL}{sep}options=-csearch_path%3D{schema}"
    with psycopg.connect(PG_URL, autocommit=True) as admin:
        admin.execute(f"DROP SCHEMA {schema} CASCADE")


def raw_args(db, tiny, wave="w1", version="v3", *extra):
    return ["--db", str(db), "--wave-id", wave, "--survey-version", version,
            "--text", str(tiny["text"]), "--numeric", str(tiny["numeric"]), "--qsf", str(tiny["qsf"]), *extra]


def tidy_args(db, folder, wave="w1", version="v3", *extra):
    return ["--db", str(db), "--wave-id", wave, "--survey-version", version, "--tidy-dir", str(folder), *extra]


def counts(db):
    """Row count of every table, or {} if the database does not exist yet."""
    if not sitdb.is_postgres(db) and not Path(db).exists():
        return {}
    con = sitdb.connect(db)
    try:
        return {n: con.execute(f"SELECT COUNT(*) FROM {n}").fetchone()[0] for n in con.table_names()}
    finally:
        con.close()


def assert_untouched(db):
    """No wave, no data and no codebook: what a failed load must leave behind."""
    assert not any(counts(db).values()), counts(db)


def read_rows(db, sql, params=()):
    con = sitdb.connect(db)
    try:
        return con.execute(sql, params).fetchall()
    finally:
        con.close()


def csv_rows(path):
    return len(pd.read_csv(path, dtype=str, keep_default_na=False))
