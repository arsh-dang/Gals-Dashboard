import csv
from collections import Counter

import pandas as pd
import pytest

import export
import ingest
import sitdb
from conftest import sqlite_only, OLD_WAVE, OLD_WAVE_META, TABLES, counts, raw_args, read_rows, tidy_args


def read(path):
    return pd.read_csv(path, dtype=str, keep_default_na=False)


# --- round trip ---------------------------------------------------------------------
@pytest.mark.parametrize("source", [sitdb.DATA_DIR, OLD_WAVE], ids=["dashboard data", "first mock wave"])
def test_export_reproduces_a_mock_dataset_byte_for_byte(db, tmp_path, source):
    ingest.main(tidy_args(db, source, "w1", "v3", "--meta", str(OLD_WAVE_META)))
    out = tmp_path / "out"
    assert export.main(["--db", str(db), "--parity", "--out-dir", str(out)]) == 0
    for name in TABLES:
        assert (out / f"{name}.csv").read_bytes() == (source / f"{name}.csv").read_bytes(), name


def test_the_two_mock_waves_can_be_loaded_and_exported_together(db, tmp_path):
    ingest.main(tidy_args(db, OLD_WAVE, "mock-2026-a"))
    ingest.main(tidy_args(db, sitdb.DATA_DIR, "mock-2026-b", "v3", "--meta", str(OLD_WAVE_META)))
    export.main(["--db", str(db), "--parity", "--out-dir", str(tmp_path)])
    ids = read(tmp_path / "respondents.csv").ResponseId
    assert len(ids) == 400 and ids.is_unique  # R_MK0000230 exists in both waves; prefixes keep them apart


def test_raw_ingest_then_export_equals_reshape_output(db, tiny, tmp_path):
    import reshape_v3
    ingest.main(raw_args(db, tiny))
    out = tmp_path / "out"
    export.main(["--db", str(db), "--parity", "--out-dir", str(out)])
    _, QS = reshape_v3.load_qsf(tiny["qsf"])
    direct = tmp_path / "direct"
    direct.mkdir()
    for name, df in reshape_v3.reshape(reshape_v3.load(tiny["text"]), reshape_v3.load(tiny["numeric"]), QS).items():
        df.to_csv(direct / f"{name}.csv", index=False)
    for name in TABLES:
        assert (out / f"{name}.csv").read_bytes() == (direct / f"{name}.csv").read_bytes(), name


def test_export_keeps_the_column_names_and_order_the_build_expects(db, tiny, tmp_path):
    ingest.main(raw_args(db, tiny))
    export.main(["--db", str(db), "--out-dir", str(tmp_path)])
    for name in TABLES:
        assert list(read(tmp_path / f"{name}.csv").columns) == sitdb.TABLE_COLUMNS[name]


# --- suppression --------------------------------------------------------------------
@pytest.fixture()
def suppressed(db, tiny, tmp_path):
    ingest.main(raw_args(db, tiny))
    out = tmp_path / "suppressed"
    export.main(["--db", str(db), "--out-dir", str(out)])
    return {n: read(out / f"{n}.csv") for n in TABLES}


@pytest.fixture()
def parity(db, tiny, tmp_path):
    ingest.main(raw_args(db, tiny))
    out = tmp_path / "parity"
    export.main(["--db", str(db), "--parity", "--out-dir", str(out)])
    return {n: read(out / f"{n}.csv") for n in TABLES}


def test_birth_year_and_adult_occupations_are_blanked(suppressed, parity):
    for col in ("birth_year", "adult1_occupation", "adult2_occupation"):
        assert (parity["respondents"][col] != "").all()  # present in the data...
        assert (suppressed["respondents"][col] == "").all()  # ...gone from the export


def test_adult_occupation_free_text_is_dropped(suppressed, parity):
    assert parity["open_text"].question.str.contains("what job adult", case=False).any()
    assert not suppressed["open_text"].question.str.contains("what job adult", case=False).any()
    assert len(suppressed["open_text"]) < len(parity["open_text"])


def test_small_groups_are_blanked_and_large_ones_kept(suppressed, parity):
    s, p = suppressed["respondents"], parity["respondents"]
    assert p.gender.value_counts().to_dict() == {"Female": 6, "Male": 4, "Non-binary / third gender": 1, "Prefer not to say": 1}
    assert s.gender.value_counts().to_dict() == {"Female": 6, "": 6}  # Male (4), non-binary (1), prefer-not-to-say (1) hidden
    assert (s.school == "Gamma PS").sum() == 0 and (p.school == "Gamma PS").sum() == 1  # school with 1 student
    assert set(s.school) == {"Alpha PS", "Beta SC", ""}
    assert (s.language_other_than_english == "").sum() == 3  # the 3 "Yes" answers
    # Year level is blanked for a region x year cell under 5 (Ballarat, Year 5 has 1 person)
    assert s.loc[s.ResponseId == "R_MK0012", "school_level"].item() == ""
    assert (s.loc[s.region == "Geelong", "school_level"] == "Year 5").all()


def test_after_suppression_no_visible_group_is_under_the_threshold(suppressed):
    s = suppressed["respondents"]
    for cols in (["gender"], ["school"], ["language_other_than_english"], ["region", "school_level"]):
        sizes = Counter(tuple(r) for r in s[cols].values if all(r))
        assert sizes and min(sizes.values()) >= 5, (cols, sizes)


def test_suppression_leaves_everything_else_unchanged(suppressed, parity):
    cols = ["ResponseId", "StartDate", "Finished", "region", "is_school_student", "pathway", "n_activities", "did_gals"]
    assert suppressed["respondents"][cols].equals(parity["respondents"][cols])
    for name in ("activity_ratings", "battery_selections", "aspirations", "subject_career"):
        assert suppressed[name].equals(parity[name]), name


def test_suppression_is_counted_per_wave_not_across_waves(db, tiny, tmp_path):
    # Two waves of 12: Gamma PS has 1 student in each, 2 in total. Pooled it is still under 5,
    # but Male has 4 per wave (8 pooled): counted per wave, so it is hidden in both.
    ingest.main(raw_args(db, tiny, "w1"))
    ingest.main(raw_args(db, tiny, "w2"))
    export.main(["--db", str(db), "--out-dir", str(tmp_path)])
    s = read(tmp_path / "respondents.csv")
    assert (s.gender == "Male").sum() == 0
    assert (s.gender == "Female").sum() == 12


def test_export_reports_what_it_suppressed(db, tiny, tmp_path, capsys):
    ingest.main(raw_args(db, tiny))
    capsys.readouterr()
    export.main(["--db", str(db), "--out-dir", str(tmp_path)])
    out = capsys.readouterr().out
    assert "birth_year blanked: 12" in out and "gender blanked (group under 5): 6" in out
    assert "occupation follow-ups" in out


@pytest.mark.parametrize("source", [sitdb.DATA_DIR, OLD_WAVE], ids=["dashboard data", "first mock wave"])
def test_mock_data_has_no_visible_group_under_5_after_suppression(db, tmp_path, source):
    ingest.main(tidy_args(db, source, "w1", "v3", "--meta", str(OLD_WAVE_META)))
    export.main(["--db", str(db), "--out-dir", str(tmp_path)])
    s = read(tmp_path / "respondents.csv")
    for cols in (["gender"], ["school"], ["region", "school_level"]):
        sizes = Counter(tuple(r) for r in s[cols].values if all(r))
        assert min(sizes.values()) >= 5, (cols, {k: v for k, v in sizes.items() if v < 5})
    assert (s.birth_year == "").all() and (s.adult1_occupation == "").all()


# --- waves ----------------------------------------------------------------------------
def test_two_waves_get_prefixed_unique_response_ids(db, tiny, tmp_path):
    ingest.main(raw_args(db, tiny, "w1"))
    ingest.main(raw_args(db, tiny, "w2"))
    export.main(["--db", str(db), "--parity", "--out-dir", str(tmp_path)])
    ids = read(tmp_path / "respondents.csv").ResponseId
    assert len(ids) == 24 and ids.is_unique and ids.str.startswith(("w1:", "w2:")).all()
    ratings = read(tmp_path / "activity_ratings.csv")
    assert set(ratings.ResponseId) <= set(ids)  # children still point at a respondent


def test_a_single_wave_keeps_its_response_ids_unprefixed(db, tiny, tmp_path):
    ingest.main(raw_args(db, tiny, "w1"))
    ingest.main(raw_args(db, tiny, "w2"))
    export.main(["--db", str(db), "--waves", "w2", "--parity", "--out-dir", str(tmp_path)])
    ids = read(tmp_path / "respondents.csv").ResponseId
    assert len(ids) == 12 and ids.str.startswith("R_MK").all()


def test_unknown_wave_is_refused(db, tiny, tmp_path, capsys):
    ingest.main(raw_args(db, tiny))
    assert export.main(["--db", str(db), "--waves", "nope", "--out-dir", str(tmp_path)]) == 2
    assert "unknown wave" in capsys.readouterr().err


@sqlite_only
def test_exporting_an_empty_or_missing_database_is_refused(tmp_path, capsys):
    assert export.main(["--db", str(tmp_path / "none.db"), "--out-dir", str(tmp_path)]) == 2
    assert "database not found" in capsys.readouterr().err
