"""The reshaper must reproduce the reference output exactly.

reference/ holds the six reshaped CSVs from the same (synthetic) generator run as
data/raw/. The byte-for-byte reproduction needs the real survey definition, which
is not in the repository, so that test is skipped when it is absent. The other
checks here run without it.
"""
import warnings

import pytest

import export
import ingest
import sitdb
from conftest import (NO_REAL_QSF, OLD_WAVE_META, PRIVATE_QSF, RAW_NUMERIC, RAW_TEXT, REFERENCE, TABLES,
                      reshape_v3)


@pytest.mark.skipif(not PRIVATE_QSF.exists(), reason=NO_REAL_QSF)
def test_reshape_reproduces_the_reference_byte_for_byte(tmp_path):
    _, QS = reshape_v3.load_qsf(PRIVATE_QSF)
    with warnings.catch_warnings():
        warnings.simplefilter("error")  # an unknown ${...} would fail here
        tables = reshape_v3.reshape(reshape_v3.load(RAW_TEXT), reshape_v3.load(RAW_NUMERIC), QS)
    for name, df in tables.items():
        df.to_csv(tmp_path / f"{name}.csv", index=False)
    for name in TABLES:
        assert (tmp_path / f"{name}.csv").read_bytes() == (REFERENCE / f"{name}.csv").read_bytes(), name


@pytest.mark.skipif(not PRIVATE_QSF.exists(), reason=NO_REAL_QSF)
def test_ingest_then_export_reproduces_the_reference_byte_for_byte(db, tmp_path):
    assert ingest.main(["--db", str(db), "--wave-id", "w", "--survey-version", "v3", "--text", str(RAW_TEXT),
                        "--numeric", str(RAW_NUMERIC), "--qsf", str(PRIVATE_QSF)]) == 0
    export.main(["--db", str(db), "--parity", "--out-dir", str(tmp_path)])
    for name in TABLES:
        assert (tmp_path / f"{name}.csv").read_bytes() == (REFERENCE / f"{name}.csv").read_bytes(), name


def test_the_dashboards_data_folder_is_the_reference_output():
    for name in TABLES:
        assert (sitdb.DATA_DIR / f"{name}.csv").read_bytes() == (REFERENCE / f"{name}.csv").read_bytes(), name


def test_the_raw_exports_are_flagged_as_mock():
    meta = sitdb.load_meta(str(RAW_TEXT) + ".meta.json")
    assert meta.get("is_mock") is True


def test_the_reference_labels_are_the_ones_the_dashboard_looks_up():
    """A guard on the guard: the piped-text and label fixes are visible in the reference itself."""
    import pandas as pd
    q = set(pd.read_csv(REFERENCE / "subject_career.csv", dtype=str, keep_default_na=False).question)
    assert "What helps decide future plans (school students)" in q
    ot = pd.read_csv(REFERENCE / "open_text.csv", dtype=str, keep_default_na=False).question
    assert not ot.str.contains(r"\$\{", regex=True).any()


def test_known_piped_text_is_resolved_and_unknown_piped_text_warns():
    assert reshape_v3.resolve_piped("Which job do you think you might do in ${q://QID1/ChoiceGroup/SelectedChoices}?") \
        == "Which job do you think you might do in your area?"
    with pytest.warns(UserWarning, match="unknown piped text"):
        out = reshape_v3.resolve_piped("Hello ${e://Field/FirstName}")
    assert out == "Hello ${e://Field/FirstName}"  # left as written, not guessed


def test_an_unknown_placeholder_in_a_survey_is_a_warning_not_a_failure(db, tiny, capsys):
    import json
    from conftest import raw_args
    qsf = json.loads(tiny["qsf"].read_text())
    for el in qsf["SurveyElements"]:
        if el["Element"] == "SQ" and el["Payload"]["DataExportTag"] == "Q10":
            el["Payload"]["QuestionText"] = "What did ${e://Field/FirstName} enjoy?"
    tiny["qsf"].write_text(json.dumps(qsf))
    assert ingest.main(raw_args(db, tiny)) == 0
    assert "unknown piped text ${e://Field/FirstName}" in capsys.readouterr().err
