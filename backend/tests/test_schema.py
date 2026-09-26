"""Schema smoke tests: the schema loads, and its keys and checks bite."""
import sqlite3
from pathlib import Path

import pytest

SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


@pytest.fixture()
def db():
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    con.executescript(SCHEMA.read_text())
    con.execute("INSERT INTO survey_version VALUES ('v3', 'test')")
    for wave in ("w1", "w2"):
        con.execute(
            "INSERT INTO survey_wave VALUES (?, 'v3', NULL, NULL, 'x.csv', '2026-01-01T00:00:00', 1, NULL)",
            (wave,),
        )
    yield con
    con.close()


def add_respondent(con, wave, rid, seq=0):
    con.execute(
        "INSERT INTO respondents (wave_id, row_seq, ResponseId) VALUES (?, ?, ?)", (wave, seq, rid)
    )


def add_rating(con, wave, rid, seq, score=3, col="Q15_1"):
    con.execute(
        "INSERT INTO activity_ratings (wave_id, row_seq, ResponseId, activity_type, battery, item, score, source_column)"
        " VALUES (?, ?, ?, 'Excursions', 'outcomes', 'item', ?, ?)",
        (wave, seq, rid, score, col),
    )


def test_same_response_id_allowed_in_different_waves(db):
    add_respondent(db, "w1", "R_1")
    add_respondent(db, "w2", "R_1")


def test_response_id_unique_within_wave(db):
    add_respondent(db, "w1", "R_1", 0)
    with pytest.raises(sqlite3.IntegrityError):
        add_respondent(db, "w1", "R_1", 1)


def test_child_row_needs_respondent_in_same_wave(db):
    add_respondent(db, "w1", "R_1")
    with pytest.raises(sqlite3.IntegrityError):
        add_rating(db, "w2", "R_1", 0)  # R_1 exists only in w1


def test_score_outside_1_to_4_rejected(db):
    add_respondent(db, "w1", "R_1")
    for bad in (0, 5):
        with pytest.raises(sqlite3.IntegrityError):
            add_rating(db, "w1", "R_1", 0, score=bad)
    add_rating(db, "w1", "R_1", 1, score=None)  # "I do not know"


def test_duplicate_natural_key_rejected(db):
    add_respondent(db, "w1", "R_1")
    add_rating(db, "w1", "R_1", 0)
    with pytest.raises(sqlite3.IntegrityError):
        add_rating(db, "w1", "R_1", 1)  # same respondent/activity/column


def test_deleting_a_wave_removes_only_that_wave(db):
    for wave in ("w1", "w2"):
        add_respondent(db, wave, "R_1")
        add_rating(db, wave, "R_1", 0)
    db.execute("DELETE FROM survey_wave WHERE wave_id = 'w1'")
    assert db.execute("SELECT COUNT(*) FROM respondents").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM activity_ratings WHERE wave_id = 'w2'").fetchone()[0] == 1
    assert db.execute("SELECT COUNT(*) FROM activity_ratings WHERE wave_id = 'w1'").fetchone()[0] == 0


def test_wave_needs_a_known_survey_version(db):
    with pytest.raises(sqlite3.IntegrityError):
        db.execute("INSERT INTO survey_wave VALUES ('w3', 'v9', NULL, NULL, 'x.csv', '2026', 1, NULL)")


def test_codebook_source_limited_to_known_values(db):
    with pytest.raises(sqlite3.IntegrityError):
        db.execute(
            "INSERT INTO question_item (survey_version, source_column, question_id, codebook_source)"
            " VALUES ('v3', 'Q1', 'Q1', 'guess')"
        )
