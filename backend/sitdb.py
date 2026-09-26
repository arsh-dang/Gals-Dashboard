"""Shared helpers for the survey data store: paths, table layout, connection,
value conversion, config loading and the mock-data guard.

Used by ingest.py and export.py. Standard library plus PyYAML (config) and
pandas (only where reshape_v3.py needs it).
"""
import json
import sqlite3
from pathlib import Path

import yaml

BACKEND_DIR = Path(__file__).resolve().parent
REPO_DIR = BACKEND_DIR.parent
DATA_DIR = REPO_DIR / "data"
REAL_DATA_DIR = REPO_DIR / "data_real"
SCHEMA_PATH = BACKEND_DIR / "schema.sql"
REQUIRED_FIELDS_PATH = BACKEND_DIR / "required_fields.yaml"
EXPORT_RULES_PATH = BACKEND_DIR / "export_rules.yaml"
DEFAULT_DB = BACKEND_DIR / "sit.db"

MOCK_ID_PREFIX = "R_MK"  # ResponseId prefix written by data/generate_mock_v3.py

REAL_DATA_WARNING = (
    "WARNING: --allow-real was passed. Real survey data must only be loaded on "
    "Deakin-approved infrastructure. This repository is public: never commit a "
    "database file or exported real data (they are git-ignored, keep it that way)."
)

# CSV column order for each data table, exactly as the dashboard build reads it.
TABLE_COLUMNS = {
    "respondents": [
        "ResponseId", "StartDate", "Finished", "region", "gender",
        "language_other_than_english", "birth_year", "is_school_student", "school",
        "school_level", "adult1_occupation", "adult2_occupation", "activities_selected",
        "pathway", "n_activities", "did_gals",
    ],
    "activity_ratings": [
        "ResponseId", "activity_type", "battery", "item", "response", "response_code",
        "score", "is_dont_know", "source_column",
    ],
    "battery_selections": ["ResponseId", "activity_type", "battery", "item", "source_column"],
    "aspirations": [
        "ResponseId", "item", "response", "response_code", "score", "is_dont_know",
        "source_column",
    ],
    "subject_career": [
        "ResponseId", "question_group", "question", "item", "multi_select", "source_column",
    ],
    "open_text": ["ResponseId", "question", "source_column", "response"],
}
TABLE_ORDER = list(TABLE_COLUMNS)  # respondents first: children reference it

BOOL_COLUMNS = {"Finished", "did_gals", "is_dont_know", "multi_select"}
INT_COLUMNS = {"birth_year", "n_activities", "score"}


class Refused(Exception):
    """A run was stopped on purpose (guard, existing wave, bad usage), not by a bug."""


# --- values -------------------------------------------------------------------
def to_db(column, value):
    """CSV text -> database value. Blank becomes NULL."""
    if value is None or value == "":
        return None
    if column in BOOL_COLUMNS:
        if value in (True, "True", "TRUE", "true"):
            return 1
        if value in (False, "False", "FALSE", "false"):
            return 0
        raise ValueError(f"{column}: {value!r} is not True/False")
    if column in INT_COLUMNS:
        return int(value)
    return value


def to_csv(column, value):
    """Database value -> CSV text. NULL becomes blank."""
    if value is None:
        return ""
    if column in BOOL_COLUMNS:
        return "True" if value else "False"
    return str(value)


# --- config -------------------------------------------------------------------
def load_required_fields(path=REQUIRED_FIELDS_PATH):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_export_rules(path=EXPORT_RULES_PATH):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


# --- database -----------------------------------------------------------------
def connect(db_path=DEFAULT_DB):
    """Open (creating if needed) the database. Transactions are explicit: the
    connection is in autocommit mode and callers issue BEGIN / COMMIT / ROLLBACK."""
    con = sqlite3.connect(str(db_path), isolation_level=None)
    con.execute("PRAGMA foreign_keys = ON")  # SQLite only enforces FKs when asked
    has_schema = con.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'survey_wave'"
    ).fetchone()[0]
    if not has_schema:
        con.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    return con


# --- mock-data guard ----------------------------------------------------------
def load_meta(meta_path):
    """Read the sidecar .meta.json. Returns {} when there is none."""
    meta_path = Path(meta_path)
    if not meta_path.exists():
        return {}
    with open(meta_path, encoding="utf-8") as f:
        return json.load(f)


def check_mock_guard(meta, meta_path, response_ids, allow_real, warn):
    """Refuse to continue unless the input is flagged as mock (or --allow-real).

    The sidecar must say "is_mock": true, and every ResponseId must carry the mock
    prefix: a flag alone is easy to set by mistake. Returns the is_mock value to
    record on the wave (True only when both checks pass).
    """
    flagged = meta.get("is_mock") is True
    ids = list(response_ids)
    prefix_ok = bool(ids) and all(str(i).startswith(MOCK_ID_PREFIX) for i in ids)
    is_mock = flagged and prefix_ok

    if not is_mock:
        reasons = []
        if not meta_path or not Path(meta_path).exists():
            reasons.append(f"no sidecar metadata file found (expected {meta_path})")
        elif not flagged:
            reasons.append(f'{meta_path} does not say "is_mock": true')
        if flagged and not prefix_ok:
            reasons.append(
                f"the file is flagged as mock but not every ResponseId starts with {MOCK_ID_PREFIX!r}"
            )
        if not allow_real:
            raise Refused(
                "Refusing to load: this input is not confirmed as mock data.\n  - "
                + "\n  - ".join(reasons or ["input is not flagged as mock"])
                + "\nThis repository is public and only synthetic data may be loaded here. "
                "Real data must only be loaded on Deakin-approved infrastructure, with --allow-real."
            )
        warn(REAL_DATA_WARNING)
    return is_mock
