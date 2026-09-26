#!/usr/bin/env python3
"""Load one survey wave into the database.

Two kinds of input:

  raw     a Qualtrics text export + numeric export + the survey definition (QSF).
          The reshaping is done by data/reshape_v3.py, unchanged in behaviour.
  tidy    a folder of already-reshaped CSVs (respondents.csv, activity_ratings.csv,
          ...): how the current mock data in ./data/ is loaded.

Examples
  python backend/ingest.py --wave-id mock-2026-a --survey-version v3 \\
      --tidy-dir data
  python backend/ingest.py --wave-id mock-2026-b --survey-version v3 \\
      --text new_data/mock_v3_text.csv --numeric new_data/mock_v3_numeric.csv \\
      --qsf backend/private/survey_v3.qsf

SYNTHETIC DATA ONLY. The input must have a sidecar <file>.meta.json containing
{"is_mock": true} (raw: next to the text export; tidy: <folder>/wave.meta.json)
and every ResponseId must start with R_MK, otherwise ingest refuses unless
--allow-real is passed. Real data belongs on Deakin-approved infrastructure only.

Everything is validated before anything is written, and a wave is loaded in one
transaction: a failure leaves the database exactly as it was. Exit codes: 0 loaded,
1 validation failed, 2 refused (mock guard, wave exists, bad arguments).
"""
import argparse
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import codebook
import sitdb
from sitdb import Refused, TABLE_COLUMNS, TABLE_ORDER

# The natural key of each child table, matching the UNIQUE constraints in schema.sql.
UNIQUE_KEYS = {
    "activity_ratings": ["ResponseId", "activity_type", "source_column"],
    "battery_selections": ["ResponseId", "activity_type", "battery", "item", "source_column"],
    "aspirations": ["ResponseId", "source_column"],
    "subject_career": ["ResponseId", "question", "item"],
    "open_text": ["ResponseId", "source_column"],
}
MAX_LISTED = 8  # examples shown per kind of problem


class Problem:
    """kind groups repeats in the report ("score out of range" x 40 rows)."""

    def __init__(self, table, where, message, kind=None):
        self.table, self.where, self.message = table, where, message
        self.kind = kind or message


# --- reading input --------------------------------------------------------------
def read_tidy(folder):
    tables, problems = {}, []
    for name in TABLE_ORDER:
        path = Path(folder) / f"{name}.csv"
        if not path.exists():
            problems.append(Problem(name, str(path), "required file is missing"))
            continue
        tables[name] = pd.read_csv(path, dtype=str, keep_default_na=False)
    return tables, problems


def stringify(tables):
    """reshape_v3 output -> all-text tables in CSV column order (same as reading
    the CSVs it would have written)."""
    out = {}
    for name in TABLE_ORDER:
        df = tables.get(name)
        if df is None or df.empty:
            out[name] = pd.DataFrame(columns=TABLE_COLUMNS[name])
            continue
        out[name] = df.reindex(columns=TABLE_COLUMNS[name]).fillna("").astype(str)
    return out


def check_raw_exports(text_df, numeric_df, QS, required):
    """Column-level checks on the two exports, before any reshaping."""
    problems = []
    for label, df in (("text export", text_df), ("numeric export", numeric_df)):
        missing = [c for c in required["raw_export"]["required_columns"] if c not in df.columns]
        for c in missing:
            problems.append(Problem(label, "header", f"required column {c} is missing"))
    if list(text_df.columns) != list(numeric_df.columns):
        problems.append(Problem("numeric export", "header", "columns differ from the text export"))
    if "ResponseId" in text_df.columns and "ResponseId" in numeric_df.columns:
        if list(text_df["ResponseId"]) != list(numeric_df["ResponseId"]):
            problems.append(Problem("numeric export", "ResponseId",
                                    "ResponseIds differ from the text export (or are in a different order)"))
    for c in text_df.columns:
        m = codebook.COLUMN_RE.match(c)
        if m and m.group(1) not in QS:
            problems.append(Problem("text export", c, f"unknown question id {m.group(1)}: not in the survey definition (QSF)"))
    return problems


# --- validation -----------------------------------------------------------------
def validate(tables, config, survey_version, known_columns):
    """Every check that can fail a load. Returns a list of Problem; nothing is written."""
    problems = []
    if survey_version not in config["survey_versions_accepted"]:
        problems.append(Problem("survey_wave", "--survey-version",
                                f"unexpected survey version {survey_version!r}; accepted: "
                                f"{', '.join(config['survey_versions_accepted'])} "
                                "(see the comment at the top of required_fields.yaml)"))
    lo, hi = config["score_range"]["min"], config["score_range"]["max"]
    line = lambda i: f"row {i + 2}"  # +2: header line, then 1-based

    usable = {}
    for name in TABLE_ORDER:
        df, spec = tables[name], config["tidy_tables"][name]
        missing = [c for c in spec["required_columns"] if c not in df.columns]
        for c in missing:
            problems.append(Problem(name, "header", f"required column {c} is missing"))
        if not missing:
            usable[name] = df

        for c in spec["not_blank"]:
            if c in df.columns:
                for i in df.index[df[c].str.strip() == ""]:
                    problems.append(Problem(name, line(i), f"{c} is blank", f"required value {c} is blank"))
        for c in spec["boolean_columns"]:
            if c in df.columns:
                bad = ~df[c].isin(["True", "False", "TRUE", "FALSE", "true", "false", ""])
                for i in df.index[bad]:
                    problems.append(Problem(name, line(i), f"{c} is {df.at[i, c]!r}, expected True or False", f"{c} is not True/False"))
        if "score" in df.columns:
            for i in df.index[df["score"] != ""]:
                v = df.at[i, "score"]
                try:
                    ok = lo <= int(v) <= hi and str(int(v)) == v
                except ValueError:
                    ok = False
                if not ok:
                    problems.append(Problem(name, line(i), f"score {v!r} is outside {lo}-{hi}", f"score outside {lo}-{hi}"))
    for c in ("birth_year", "n_activities"):
        df = tables["respondents"]
        if c in df.columns:
            for i in df.index[(df[c] != "") & ~df[c].str.fullmatch(r"\d+")]:
                problems.append(Problem("respondents", line(i), f"{c} {df.at[i, c]!r} is not a whole number", f"{c} is not a whole number"))

    if "respondents" in usable:
        resp = usable["respondents"]
        for i in resp.index[resp["ResponseId"].duplicated(keep=False) & (resp["ResponseId"] != "")]:
            problems.append(Problem("respondents", line(i), f"duplicate ResponseId {resp.at[i, 'ResponseId']}", "duplicate ResponseId"))
        ids = set(resp["ResponseId"])
        for name in UNIQUE_KEYS:
            if name in usable:
                df = usable[name]
                for i in df.index[~df["ResponseId"].isin(ids)]:
                    problems.append(Problem(name, line(i), f"ResponseId {df.at[i, 'ResponseId']} is not in respondents", "ResponseId not in respondents (orphan row)"))
    for name, key in UNIQUE_KEYS.items():
        if name in usable and all(c in usable[name].columns for c in key):
            df = usable[name]
            for i in df.index[df.duplicated(key, keep="first")]:
                problems.append(Problem(name, line(i), "duplicate of an earlier row on " + "+".join(key), "duplicate rows"))
    if known_columns is not None:
        for name in ("activity_ratings", "battery_selections", "aspirations", "subject_career", "open_text"):
            if name in usable:
                df = usable[name]
                for i in df.index[~df["source_column"].isin(known_columns)]:
                    problems.append(Problem(name, line(i), f"unknown question id / column {df.at[i, 'source_column']!r} (not in the codebook)", "unknown question id (not in the codebook)"))
    return problems


def print_report(problems, out=None):
    out = out or sys.stderr  # looked up at call time so redirected streams work
    """Group by table and kind so 5,000 bad rows read as a handful of lines."""
    print(f"\nVALIDATION FAILED: {len(problems)} problem(s). Nothing was written.\n", file=out)
    groups = defaultdict(list)
    for p in problems:
        groups[(p.table, p.kind)].append(p)
    for (table, kind), items in groups.items():
        count = f"  ({len(items)} rows)" if len(items) > 1 else ""
        print(f"  [{table}] {kind}{count}", file=out)
        for p in items[:MAX_LISTED]:
            print(f"      at {p.where}: {p.message}", file=out)
        if len(items) > MAX_LISTED:
            print(f"      ... and {len(items) - MAX_LISTED} more", file=out)
    print(file=out)


# --- writing --------------------------------------------------------------------
def insert_table(con, wave_id, name, df):
    cols = TABLE_COLUMNS[name]
    sql = (f"INSERT INTO {name} (wave_id, row_seq, {', '.join(cols)}) "
           f"VALUES ({', '.join(['?'] * (len(cols) + 2))})")
    rows = ((wave_id, seq, *[sitdb.to_db(c, v) for c, v in zip(cols, rec)])
            for seq, rec in enumerate(df[cols].itertuples(index=False, name=None)))
    con.executemany(sql, rows)


def sync_codebook(con, survey_version, rows, source):
    """First load of a version stores its codebook. A QSF codebook replaces a
    best-effort ('tidy') one; a QSF codebook already stored is never overwritten."""
    exists = con.execute("SELECT 1 FROM survey_version WHERE survey_version = ?", (survey_version,)).fetchone()
    if not exists:
        con.execute("INSERT INTO survey_version (survey_version, description) VALUES (?, ?)",
                    (survey_version, None))
    stored = {r[0] for r in con.execute(
        "SELECT DISTINCT codebook_source FROM question_item WHERE survey_version = ?", (survey_version,))}
    if "qsf" in stored or (stored == {"tidy"} and source == "tidy"):
        return "kept the existing codebook"
    if stored:
        con.execute("DELETE FROM question_item WHERE survey_version = ?", (survey_version,))
    cols = codebook.COLUMNS
    con.executemany(
        f"INSERT INTO question_item ({', '.join(cols)}) VALUES ({', '.join(['?'] * len(cols))})",
        [tuple(r[c] for c in cols) for r in rows])
    return f"stored a {source} codebook ({len(rows)} rows)"


def stored_codebook_columns(con, survey_version):
    """source_columns of a QSF codebook already in the database, or None."""
    rows = con.execute(
        "SELECT source_column FROM question_item WHERE survey_version = ? AND codebook_source = 'qsf'",
        (survey_version,)).fetchall()
    return {r[0] for r in rows} or None


def load_wave(con, wave, tables, codebook_rows, codebook_source, replace):
    """One transaction for the whole wave."""
    con.execute("BEGIN")
    try:
        if replace:
            con.execute("DELETE FROM survey_wave WHERE wave_id = ?", (wave["wave_id"],))
        note = sync_codebook(con, wave["survey_version"], codebook_rows, codebook_source)
        con.execute(
            "INSERT INTO survey_wave (wave_id, survey_version, collection_start, collection_end, "
            "source_file, date_loaded, is_mock, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (wave["wave_id"], wave["survey_version"], wave.get("collection_start"),
             wave.get("collection_end"), wave["source_file"], wave["date_loaded"],
             1 if wave["is_mock"] else 0, wave.get("notes")))
        for name in TABLE_ORDER:
            insert_table(con, wave["wave_id"], name, tables[name])
        con.execute("COMMIT")
        return note
    except BaseException:
        con.execute("ROLLBACK")
        raise


# --- command line -----------------------------------------------------------------
def build_parser():
    ap = argparse.ArgumentParser(description="Load one survey wave into the database (mock data only).")
    ap.add_argument("--db", default=str(sitdb.DEFAULT_DB), help="database file (default backend/sit.db)")
    ap.add_argument("--wave-id", required=True, help="short label for this wave, e.g. mock-2026-a")
    ap.add_argument("--survey-version", required=True, help="instrument version, e.g. v3")
    src = ap.add_argument_group("input: raw Qualtrics export")
    src.add_argument("--text", help="text export (choice labels)")
    src.add_argument("--numeric", help="numeric export (choice codes)")
    ap.add_argument("--qsf", help="Qualtrics survey definition; required with --text, optional with --tidy-dir "
                                  "(the real one lives in backend/private/, git-ignored)")
    ap.add_argument("--tidy-dir", help="folder of already-reshaped CSVs (e.g. data)")
    ap.add_argument("--meta", help="sidecar metadata file (default: <text export>.meta.json or <tidy dir>/wave.meta.json)")
    ap.add_argument("--period-start"), ap.add_argument("--period-end"), ap.add_argument("--notes")
    ap.add_argument("--replace", action="store_true", help="replace the wave if it already exists")
    ap.add_argument("--allow-real", action="store_true",
                    help="load input that is not flagged as mock (Deakin-approved infrastructure only)")
    return ap


def run(args, out=None, err=None):
    out, err = out or sys.stdout, err or sys.stderr
    warn = lambda m: print(m, file=err)
    config = sitdb.load_required_fields()

    raw = bool(args.text or args.numeric)
    if raw == bool(args.tidy_dir):
        raise Refused("give either --text and --numeric (with --qsf), or --tidy-dir")
    if raw and not (args.text and args.numeric and args.qsf):
        raise Refused("raw mode needs --text, --numeric and --qsf")

    con = sitdb.connect(args.db)
    try:
        if con.execute("SELECT 1 FROM survey_wave WHERE wave_id = ?", (args.wave_id,)).fetchone() and not args.replace:
            raise Refused(f"wave {args.wave_id!r} already exists. Pass --replace to reload it "
                          "(this deletes that wave's data and loads the new input in one transaction).")

        qsf = QS = None
        if args.qsf:
            if not Path(args.qsf).exists():
                raise Refused(f"QSF not found: {args.qsf}")
            qsf, QS = codebook.reshape_v3.load_qsf(args.qsf)

        # --- read the input ---------------------------------------------------
        if raw:
            for p in (args.text, args.numeric):
                if not Path(p).exists():
                    raise Refused(f"input not found: {p}")
            text_df = codebook.reshape_v3.load(args.text)
            numeric_df = codebook.reshape_v3.load(args.numeric)
            problems = check_raw_exports(text_df, numeric_df, QS, config)
            source_file = Path(args.text).name
            meta_path = args.meta or f"{args.text}.meta.json"
            ids = text_df["ResponseId"] if "ResponseId" in text_df.columns else []
        else:
            if not Path(args.tidy_dir).is_dir():
                raise Refused(f"folder not found: {args.tidy_dir}")
            tidy, problems = read_tidy(args.tidy_dir)
            source_file = Path(args.tidy_dir).resolve().name
            meta_path = args.meta or str(Path(args.tidy_dir) / "wave.meta.json")
            ids = tidy["respondents"]["ResponseId"] if "respondents" in tidy and "ResponseId" in tidy["respondents"].columns else []
        if problems:
            print_report(problems, err)
            return 1

        # --- mock guard (before anything is reshaped or written) -----------------
        meta = sitdb.load_meta(meta_path)
        is_mock = sitdb.check_mock_guard(meta, meta_path, ids, args.allow_real, warn)

        # --- reshape (raw only) and validate -------------------------------------
        if raw:
            tables = stringify(codebook.reshape_v3.reshape(text_df, numeric_df, QS))
            cb_rows = codebook.from_qsf(qsf, QS, args.survey_version, export_columns=text_df.columns)
            cb_source = "qsf"
        else:
            tables = {n: tidy[n] for n in TABLE_ORDER}
            cb_rows = codebook.from_tidy(tables, args.survey_version)
            cb_source = "qsf" if qsf else "tidy"
            if qsf:
                cb_rows = codebook.from_qsf(qsf, QS, args.survey_version,
                                            export_columns={r["source_column"] for r in cb_rows})
        if cb_source == "qsf":
            known = {r["source_column"] for r in cb_rows}
        else:
            known = stored_codebook_columns(con, args.survey_version)
            if known is None:
                warn("note: no QSF codebook for this survey version, so question ids in the data "
                     "cannot be checked. Pass --qsf to enable that check.")
        problems = validate(tables, config, args.survey_version, known)
        if problems:
            print_report(problems, err)
            return 1

        # --- write ------------------------------------------------------------------
        wave = dict(
            wave_id=args.wave_id, survey_version=args.survey_version,
            collection_start=args.period_start or meta.get("collection_start"),
            collection_end=args.period_end or meta.get("collection_end"),
            source_file=source_file, is_mock=is_mock, notes=args.notes or meta.get("notes"),
            date_loaded=datetime.now(timezone.utc).isoformat(timespec="seconds"))
        note = load_wave(con, wave, tables, cb_rows, cb_source, args.replace)
        print(f"Loaded wave {args.wave_id!r} ({args.survey_version}, {'mock' if is_mock else 'NOT MOCK'}); {note}.", file=out)
        for name in TABLE_ORDER:
            print(f"  {name:20s} {len(tables[name]):6d} rows", file=out)
        return 0
    finally:
        con.close()


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        return run(args)
    except Refused as e:
        print(f"\n{e}\n", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
