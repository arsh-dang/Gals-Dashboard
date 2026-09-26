import sqlite3

import pytest

import ingest
import sitdb
from conftest import (sqlite_only, NO_REAL_QSF, OLD_WAVE, OLD_WAVE_META, PRIVATE_QSF, RAW_NUMERIC, RAW_TEXT, TABLES,
                      assert_untouched, counts, csv_rows, raw_args, read_rows, reshape_v3, tidy_args)


def test_dashboard_data_row_counts_match_the_csvs(db):
    assert ingest.main(tidy_args(db, sitdb.DATA_DIR, "w1", "v3", "--meta", str(OLD_WAVE_META))) == 0
    c = counts(db)
    for name in TABLES:
        assert c[name] == csv_rows(sitdb.DATA_DIR / f"{name}.csv"), name
    assert c["respondents"] == 200


def test_first_mock_wave_row_counts_match_its_csvs(db):
    assert ingest.main(tidy_args(db, OLD_WAVE)) == 0
    c = counts(db)
    for name in TABLES:
        assert c[name] == csv_rows(OLD_WAVE / f"{name}.csv"), name


def test_first_mock_wave_is_recorded_as_mock(db):
    ingest.main(tidy_args(db, OLD_WAVE, "mock-2026-a"))
    wave = read_rows(db, "SELECT wave_id, survey_version, is_mock, source_file FROM survey_wave")
    assert wave == [("mock-2026-a", "v3", 1, "mock_wave_a")]
    assert read_rows(db, "SELECT DISTINCT codebook_source FROM question_item") == [("tidy",)]


def test_raw_export_counts_match_reshape_output(db, tiny):
    assert ingest.main(raw_args(db, tiny)) == 0
    _, QS = reshape_v3.load_qsf(tiny["qsf"])
    expected = reshape_v3.reshape(reshape_v3.load(tiny["text"]), reshape_v3.load(tiny["numeric"]), QS)
    c = counts(db)
    for name in TABLES:
        assert c[name] == len(expected[name]) > 0, name


def test_multi_select_labels_containing_commas_stay_whole(db, tiny):
    ingest.main(raw_args(db, tiny))
    subjects = {r[0] for r in read_rows(db, "SELECT DISTINCT item FROM subject_career")}
    assert "Arts, humanities or social sciences" in subjects
    assert "humanities or social sciences" not in subjects
    skills = {r[0] for r in read_rows(db, "SELECT DISTINCT item FROM battery_selections")}
    assert "Problem solving, and design" in skills


def test_scores_are_reversed_so_higher_is_more_positive(db, tiny):
    ingest.main(raw_args(db, tiny))
    rows = read_rows(db, "SELECT response, score FROM activity_ratings WHERE response IN ('Yes a lot', 'No', 'I do not know') GROUP BY response, score")
    assert dict(rows) == {"Yes a lot": 4, "No": 1, "I do not know": None}


def test_codebook_is_built_from_the_qsf(db, tiny):
    ingest.main(raw_args(db, tiny))
    row = read_rows(db, "SELECT item_label, block, scale, battery, activity_type, codebook_source FROM question_item "
                        "WHERE survey_version = 'v3' AND source_column = 'Q15_2'")[0]
    assert row == ("More confident in being a leader", "Default Question Block", "likert4_dk", "outcomes", "Competitions", "qsf")
    q16 = read_rows(db, "SELECT scale, battery FROM question_item WHERE source_column = 'Q16'")[0]
    assert q16 == ("multi_select", "skills")


def test_same_response_id_can_be_loaded_in_two_waves(db, tiny):
    assert ingest.main(raw_args(db, tiny, "w1")) == 0
    assert ingest.main(raw_args(db, tiny, "w2")) == 0
    assert counts(db)["respondents"] == 24
    assert read_rows(db, "SELECT COUNT(DISTINCT ResponseId) FROM respondents") == [(12,)]


def test_existing_wave_is_refused_unless_replace_is_passed(db, tiny, capsys):
    ingest.main(raw_args(db, tiny))
    before = counts(db)
    assert ingest.main(raw_args(db, tiny)) == 2
    assert "already exists" in capsys.readouterr().err
    assert counts(db) == before
    assert ingest.main(raw_args(db, tiny, "w1", "v3", "--replace")) == 0
    assert counts(db) == before  # replaced, not duplicated


def test_replace_only_touches_its_own_wave(db, tiny):
    ingest.main(raw_args(db, tiny, "w1"))
    ingest.main(raw_args(db, tiny, "w2"))
    ingest.main(raw_args(db, tiny, "w1", "v3", "--replace"))
    assert counts(db)["respondents"] == 24


def test_a_failure_part_way_through_leaves_the_database_untouched(db, tiny, monkeypatch):
    real_insert = ingest.insert_table

    def boom(con, wave_id, name, df):
        real_insert(con, wave_id, name, df)
        if name == "open_text":  # the last table: everything before it has been written
            raise RuntimeError("simulated crash")

    monkeypatch.setattr(ingest, "insert_table", boom)
    with pytest.raises(RuntimeError):
        ingest.main(raw_args(db, tiny))
    assert_untouched(db)


def test_a_failed_replace_keeps_the_original_wave(db, tiny, monkeypatch):
    ingest.main(raw_args(db, tiny))
    before = counts(db)
    monkeypatch.setattr(ingest, "insert_table", lambda *a: (_ for _ in ()).throw(RuntimeError("boom")))
    with pytest.raises(RuntimeError):
        ingest.main(raw_args(db, tiny, "w1", "v3", "--replace"))
    assert counts(db) == before


@sqlite_only
def test_foreign_keys_are_enforced_by_the_connection(db):
    con = sitdb.connect(db)
    assert con.execute("PRAGMA foreign_keys").fetchone() == (1,)
    con.close()


@pytest.mark.skipif(not PRIVATE_QSF.exists(), reason=NO_REAL_QSF)
def test_dashboard_mock_export_with_the_real_qsf(db):
    assert ingest.main(["--db", str(db), "--wave-id", "mock-2026-b", "--survey-version", "v3", "--text", str(RAW_TEXT),
                        "--numeric", str(RAW_NUMERIC), "--qsf", str(PRIVATE_QSF)]) == 0
    assert counts(db)["respondents"] == 200
    assert counts(db)["question_item"] > 500


def test_post_school_respondents_with_a_school_value_warn_but_still_load(db, tidy, capsys):
    import pandas as pd
    path = tidy / "respondents.csv"
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df.loc[[0, 1], "is_school_student"] = "No"      # they keep the school Alpha PS / level Year 5
    df.loc[1, "school_level"] = ""
    df.to_csv(path, index=False)
    assert ingest.main(tidy_args(db, tidy)) == 0        # a warning, not a failure
    err = capsys.readouterr().err
    assert "warning: 2 of 2 post-school respondents" in err and "1 also have a year level" in err
    assert counts(db)["respondents"] == 12


def test_no_warning_when_post_school_respondents_have_no_school(db, tidy, capsys):
    import pandas as pd
    path = tidy / "respondents.csv"
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    df.loc[0, ["is_school_student", "school", "school_level"]] = ["No", "", ""]
    df.to_csv(path, index=False)
    assert ingest.main(tidy_args(db, tidy)) == 0
    assert "post-school" not in capsys.readouterr().err
