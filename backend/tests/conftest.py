"""Shared test setup. Everything runs against synthetic data: the current mock
CSVs in ./data/ and the tiny fixture in tests/fixtures/."""
import json
import shutil
import sqlite3
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


@pytest.fixture()
def db(tmp_path):
    return tmp_path / "test.db"


def raw_args(db, tiny, wave="w1", version="v3", *extra):
    return ["--db", str(db), "--wave-id", wave, "--survey-version", version,
            "--text", str(tiny["text"]), "--numeric", str(tiny["numeric"]), "--qsf", str(tiny["qsf"]), *extra]


def tidy_args(db, folder, wave="w1", version="v3", *extra):
    return ["--db", str(db), "--wave-id", wave, "--survey-version", version, "--tidy-dir", str(folder), *extra]


def counts(db):
    """Row count of every table, or {} if the database does not exist yet."""
    if not Path(db).exists():
        return {}
    con = sqlite3.connect(str(db))
    try:
        names = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")]
        return {n: con.execute(f"SELECT COUNT(*) FROM {n}").fetchone()[0] for n in names}
    finally:
        con.close()


def assert_untouched(db):
    """No wave, no data and no codebook: what a failed load must leave behind."""
    assert not any(counts(db).values()), counts(db)


def read_rows(db, sql, params=()):
    con = sqlite3.connect(str(db))
    try:
        return con.execute(sql, params).fetchall()
    finally:
        con.close()


def csv_rows(path):
    return len(pd.read_csv(path, dtype=str, keep_default_na=False))
