"""Each kind of bad input must fail loudly, say where, and write nothing."""
import pandas as pd
import pytest

import ingest
from conftest import assert_untouched, raw_args, tidy_args


def fail(capsys, code):
    assert code == 1
    err = capsys.readouterr().err
    assert "VALIDATION FAILED" in err and "Nothing was written" in err
    return err


def rewrite_csv(path, fn):
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    fn(df)
    df.to_csv(path, index=False)


def rewrite_export(tiny, fn):
    """Apply fn to the data rows (below the three header rows) of both exports."""
    for key in ("text", "numeric"):
        raw = pd.read_csv(tiny[key], dtype=str, keep_default_na=False)
        head, body = raw.iloc[:2], raw.iloc[2:].reset_index(drop=True)
        out = fn(body)
        pd.concat([head, out if out is not None else body]).to_csv(tiny[key], index=False)


def test_missing_required_column_in_a_raw_export(db, tiny, capsys):
    for key in ("text", "numeric"):
        pd.read_csv(tiny[key], dtype=str, keep_default_na=False).drop(columns=["Q2"]).to_csv(tiny[key], index=False)
    err = fail(capsys, ingest.main(raw_args(db, tiny)))
    assert "required column Q2 is missing" in err and "header" in err
    assert_untouched(db)


def test_missing_required_column_in_a_tidy_table(db, tidy, capsys):
    rewrite_csv(tidy / "activity_ratings.csv", lambda df: df.drop(columns=["score"], inplace=True))
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "[activity_ratings]" in err and "required column score is missing" in err
    assert_untouched(db)


def test_missing_tidy_file(db, tidy, capsys):
    (tidy / "open_text.csv").unlink()
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "open_text" in err and "required file is missing" in err
    assert_untouched(db)


def test_unexpected_survey_version(db, tiny, capsys):
    err = fail(capsys, ingest.main(raw_args(db, tiny, "w1", "v9")))
    assert "unexpected survey version 'v9'" in err and "accepted: v3" in err
    assert_untouched(db)


def test_duplicate_response_ids(db, tidy, capsys):
    rewrite_csv(tidy / "respondents.csv", lambda df: df.__setitem__("ResponseId", ["R_MK0001"] * 2 + list(df.ResponseId[2:])))
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "duplicate ResponseId" in err and "R_MK0001" in err and "row 2" in err
    assert_untouched(db)


def test_duplicate_response_ids_in_a_raw_export(db, tiny, capsys):
    def dupe(body):
        body.loc[1, "ResponseId"] = body.loc[0, "ResponseId"]
    rewrite_export(tiny, dupe)
    err = fail(capsys, ingest.main(raw_args(db, tiny)))
    assert "duplicate ResponseId" in err
    assert_untouched(db)


@pytest.mark.parametrize("bad", ["0", "5", "7", "-1", "abc", "2.5"])
def test_scores_outside_1_to_4(db, tidy, capsys, bad):
    def setbad(df):
        df.loc[3, "score"] = bad
    rewrite_csv(tidy / "activity_ratings.csv", setbad)
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert f"score {bad!r} is outside 1-4" in err and "row 5" in err
    assert_untouched(db)


def test_unknown_question_id_in_a_raw_export(db, tiny, capsys):
    for key in ("text", "numeric"):
        raw = pd.read_csv(tiny[key], dtype=str, keep_default_na=False)
        raw["Q999"] = ["", "", *["x"] * (len(raw) - 2)]
        raw.to_csv(tiny[key], index=False)
    err = fail(capsys, ingest.main(raw_args(db, tiny)))
    assert "unknown question id Q999" in err
    assert_untouched(db)


def test_unknown_question_id_in_tidy_data_checked_against_the_qsf(db, tidy, tiny, capsys):
    rewrite_csv(tidy / "activity_ratings.csv", lambda df: df.__setitem__("source_column", ["Q999_1"] + list(df.source_column[1:])))
    err = fail(capsys, ingest.main(tidy_args(db, tidy, "w1", "v3", "--qsf", str(tiny["qsf"]))))
    assert "unknown question id" in err and "Q999_1" in err
    assert_untouched(db)


def test_orphan_rows_that_point_at_no_respondent(db, tidy, capsys):
    rewrite_csv(tidy / "aspirations.csv", lambda df: df.__setitem__("ResponseId", ["R_MK9999"] + list(df.ResponseId[1:])))
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "[aspirations]" in err and "R_MK9999" in err and "orphan" in err
    assert_untouched(db)


def test_blank_required_value(db, tidy, capsys):
    def blank(df):
        df.loc[0, "item"] = ""
    rewrite_csv(tidy / "activity_ratings.csv", blank)
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "item is blank" in err
    assert_untouched(db)


def test_duplicate_child_rows(db, tidy, capsys):
    df = pd.read_csv(tidy / "open_text.csv", dtype=str, keep_default_na=False)
    pd.concat([df, df.iloc[[0]]]).to_csv(tidy / "open_text.csv", index=False)
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "duplicate" in err and "[open_text]" in err
    assert_untouched(db)


def test_non_boolean_value(db, tidy, capsys):
    def bad(df):
        df.loc[0, "did_gals"] = "maybe"
    rewrite_csv(tidy / "respondents.csv", bad)
    err = fail(capsys, ingest.main(tidy_args(db, tidy)))
    assert "did_gals is not True/False" in err
    assert_untouched(db)


def test_all_problems_are_reported_together_not_just_the_first(db, tidy, capsys):
    rewrite_csv(tidy / "activity_ratings.csv", lambda df: df.__setitem__("score", ["9"] * len(df)))
    rewrite_csv(tidy / "aspirations.csv", lambda df: df.__setitem__("ResponseId", ["R_MK9999"] * len(df)))
    err = fail(capsys, ingest.main(tidy_args(db, tidy, "w1", "v9")))
    assert "unexpected survey version" in err and "score outside" in err and "orphan" in err
    assert "more" in err  # long runs of the same problem are summarised, not printed 100 times
    assert_untouched(db)
