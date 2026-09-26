"""Nothing that is not confirmed as mock data may be loaded or exported by accident."""
import json

import pandas as pd

import export
import ingest
import sitdb
from conftest import assert_untouched, counts, raw_args, read_rows, tidy_args


def test_no_sidecar_file_is_refused(db, tiny, capsys):
    tiny["meta"].unlink()
    assert ingest.main(raw_args(db, tiny)) == 2
    err = capsys.readouterr().err
    assert "not confirmed as mock" in err and "Deakin-approved infrastructure" in err
    assert_untouched(db)


def test_sidecar_that_does_not_say_mock_is_refused(db, tiny, capsys):
    tiny["meta"].write_text(json.dumps({"is_mock": False}))
    assert ingest.main(raw_args(db, tiny)) == 2
    assert '"is_mock": true' in capsys.readouterr().err
    assert_untouched(db)


def test_flag_alone_is_not_enough_ids_must_carry_the_mock_prefix(db, tiny, capsys):
    for key in ("text", "numeric"):
        tiny[key].write_text(tiny[key].read_text().replace("R_MK", "R_ab"))
    assert ingest.main(raw_args(db, tiny)) == 2
    assert "not every ResponseId starts with 'R_MK'" in capsys.readouterr().err
    assert_untouched(db)


def test_tidy_folder_needs_its_own_flag(db, tidy, capsys):
    (tidy / "wave.meta.json").unlink()
    assert ingest.main(tidy_args(db, tidy)) == 2
    assert_untouched(db)


def test_allow_real_loads_with_a_warning_and_records_the_wave_as_not_mock(db, tiny, capsys):
    tiny["meta"].write_text(json.dumps({"is_mock": False}))
    assert ingest.main(raw_args(db, tiny, "real-1", "v3", "--allow-real")) == 0
    captured = capsys.readouterr()
    assert "real survey data must only be loaded on deakin-approved infrastructure" in captured.err.lower()
    assert "NOT MOCK" in captured.out
    assert read_rows(db, "SELECT is_mock FROM survey_wave") == [(0,)]


def test_flagged_mock_with_wrong_ids_is_recorded_as_not_mock_under_allow_real(db, tiny):
    for key in ("text", "numeric"):
        tiny[key].write_text(tiny[key].read_text().replace("R_MK", "R_ab"))
    assert ingest.main(raw_args(db, tiny, "w1", "v3", "--allow-real")) == 0
    assert read_rows(db, "SELECT is_mock FROM survey_wave") == [(0,)]


def real_wave_db(db, tiny):
    tiny["meta"].write_text(json.dumps({"is_mock": False}))
    ingest.main(raw_args(db, tiny, "real-1", "v3", "--allow-real"))


def test_export_refuses_a_real_wave_without_allow_real(db, tiny, tmp_path, capsys):
    real_wave_db(db, tiny)
    out = tmp_path / "out"
    assert export.main(["--db", str(db), "--out-dir", str(out)]) == 2
    assert "NOT flagged as mock" in capsys.readouterr().err
    assert not out.exists()


def test_export_never_writes_real_data_into_the_tracked_data_folder(db, tiny, capsys):
    real_wave_db(db, tiny)
    before = sorted(p.name for p in sitdb.DATA_DIR.iterdir())
    assert export.main(["--db", str(db), "--allow-real", "--out-dir", str(sitdb.DATA_DIR)]) == 2
    assert "tracked by git" in capsys.readouterr().err
    assert sorted(p.name for p in sitdb.DATA_DIR.iterdir()) == before


def test_real_export_defaults_to_the_git_ignored_folder(db, tiny, tmp_path, monkeypatch):
    real_wave_db(db, tiny)
    monkeypatch.setattr(sitdb, "REAL_DATA_DIR", tmp_path / "data_real")
    assert export.main(["--db", str(db), "--allow-real"]) == 0
    assert (tmp_path / "data_real" / "respondents.csv").exists()


def test_the_repository_ignores_databases_and_real_data_folders():
    ignore = (sitdb.REPO_DIR / ".gitignore").read_text()
    for pattern in ("*.db", "data_real/", "backend/private/", "new_data/"):
        assert pattern in ignore


def test_no_database_or_real_data_file_is_tracked_by_git():
    import subprocess
    tracked = subprocess.run(["git", "ls-files"], cwd=sitdb.REPO_DIR, capture_output=True, text=True).stdout.split("\n")
    # the invented test QSF is the one .qsf allowed in the repository
    tracked = [f for f in tracked if f and not f.startswith("backend/tests/fixtures/")]
    bad = [f for f in tracked
           if f.endswith((".db", ".sqlite", ".sqlite3", ".qsf")) or f.startswith(("data_real/", "backend/private/", "new_data/"))]
    assert not bad, bad
