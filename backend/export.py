#!/usr/bin/env python3
"""Export waves from the database as the CSV files the dashboard build reads.

    python backend/export.py --db backend/sit.db                  # all waves -> data/
    python backend/export.py --db backend/sit.db --waves mock-2026-a
    python backend/export.py --db backend/sit.db --parity --out-dir /tmp/check

Writes respondents.csv, activity_ratings.csv, battery_selections.csv,
aspirations.csv, subject_career.csv and open_text.csv with the same columns, order
and formatting as before, so build/build.js needs no change.

Small-group suppression (backend/export_rules.yaml) is applied by default, so
identifiable values never leave the data layer: adult occupation and birth year
are blanked, open-text follow-ups to the occupation questions are dropped, and a
school / year level / gender / language value shared by fewer than 5 respondents
is blanked. --parity switches all of that off; it exists only to prove the
export reproduces the current dashboard data exactly.

More than one wave: ResponseIds are prefixed "<wave_id>:" because the same
Qualtrics id can appear in two waves and the dashboard build keys on ResponseId.

Real data: a wave that is not flagged as mock is only exported with --allow-real,
and then only into data_real/ (git-ignored), never into ./data/ (tracked).
"""
import argparse
import csv
import sys
from collections import Counter
from pathlib import Path

import sitdb
from sitdb import Refused, TABLE_COLUMNS, TABLE_ORDER


def fetch_waves(con, wanted):
    rows = con.execute(
        "SELECT wave_id, is_mock FROM survey_wave ORDER BY date_loaded, wave_id").fetchall()
    known = {w: bool(m) for w, m in rows}
    if not wanted:
        return [(w, bool(m)) for w, m in rows]
    missing = [w for w in wanted if w not in known]
    if missing:
        raise Refused(f"unknown wave(s): {', '.join(missing)}. Loaded waves: {', '.join(known) or 'none'}")
    return [(w, known[w]) for w in wanted]


def fetch_table(con, name, wave_ids):
    cols = TABLE_COLUMNS[name]
    out = []
    for wave_id in wave_ids:
        cur = con.execute(
            f"SELECT {', '.join(cols)} FROM {name} WHERE wave_id = ? ORDER BY row_seq", (wave_id,))
        for rec in cur:
            out.append((wave_id, {c: sitdb.to_csv(c, v) for c, v in zip(cols, rec)}))
    return out


# --- suppression ------------------------------------------------------------------
def apply_suppression(tables, rules):
    """tables: {name: [(wave_id, row_dict)]}. Blanks and drops in place. Returns a
    Counter describing what was changed."""
    min_cell = rules["min_cell"]
    changes = Counter()
    resp = tables["respondents"]

    # Group sizes are counted on the original values, per wave, before anything
    # is blanked, so the order of the rules cannot change the result.
    sizes = {}
    for rule in rules.get("small_cell_blanking", []):
        counts = Counter()
        for wave_id, r in resp:
            key = tuple(r[c] for c in rule["group_by"])
            if all(key):
                counts[(wave_id, key)] += 1
        sizes[rule["column"]] = counts

    for rule in rules.get("small_cell_blanking", []):
        col, counts = rule["column"], sizes[rule["column"]]
        for wave_id, r in resp:
            key = tuple(r[c] for c in rule["group_by"])
            if r[col] and all(key) and counts[(wave_id, key)] < min_cell:
                r[col] = ""
                changes[f"{col} blanked (group under {min_cell})"] += 1

    for col in rules.get("blank_columns", {}).get("respondents", []):
        for _w, r in resp:
            if r[col]:
                r[col] = ""
                changes[f"{col} blanked"] += 1

    phrases = [p.lower() for p in rules.get("drop_open_text_questions_containing", [])]
    kept = []
    for wave_id, r in tables["open_text"]:
        if any(p in r["question"].lower() for p in phrases):
            changes["open_text rows dropped (occupation follow-ups)"] += 1
        else:
            kept.append((wave_id, r))
    tables["open_text"] = kept
    return changes


# --- writing ----------------------------------------------------------------------
def write_csv(path, columns, rows):
    # csv's default minimal quoting, "\n" line endings: what pandas.to_csv wrote.
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(columns)
        for r in rows:
            w.writerow([r[c] for c in columns])


def run(args, out=None, err=None):
    out, err = out or sys.stdout, err or sys.stderr
    if not sitdb.is_postgres(args.db) and not Path(args.db).exists():
        raise Refused(f"database not found: {args.db}. Load a wave first with backend/ingest.py.")
    con = sitdb.connect(args.db)
    try:
        waves = fetch_waves(con, [w for w in (args.waves or "").split(",") if w])
        if not waves:
            raise Refused("the database has no waves to export")
        wave_ids = [w for w, _m in waves]
        real = [w for w, is_mock in waves if not is_mock]

        out_dir = Path(args.out_dir) if args.out_dir else (sitdb.REAL_DATA_DIR if real else sitdb.DATA_DIR)
        if real:
            if not args.allow_real:
                raise Refused(f"wave(s) {', '.join(real)} are NOT flagged as mock. Real data is only exported "
                              "with --allow-real, on Deakin-approved infrastructure.")
            print(sitdb.REAL_DATA_WARNING, file=err)
            resolved = out_dir.resolve()
            if resolved == sitdb.DATA_DIR.resolve() or sitdb.DATA_DIR.resolve() in resolved.parents:
                raise Refused(f"refusing to write real data into {out_dir}: that folder is tracked by git and "
                              "published. Use data_real/ (git-ignored) or a folder outside the repository.")

        tables = {name: fetch_table(con, name, wave_ids) for name in TABLE_ORDER}
        if len(wave_ids) > 1:
            print(f"note: {len(wave_ids)} waves exported together; ResponseIds are prefixed with the wave id.", file=err)
            for rows in tables.values():
                for wave_id, r in rows:
                    r["ResponseId"] = f"{wave_id}:{r['ResponseId']}"

        changes = Counter()
        if not args.parity:
            changes = apply_suppression(tables, sitdb.load_export_rules())

        out_dir.mkdir(parents=True, exist_ok=True)
        for name in TABLE_ORDER:
            write_csv(out_dir / f"{name}.csv", TABLE_COLUMNS[name], [r for _w, r in tables[name]])
            print(f"  {name + '.csv':24s} {len(tables[name]):6d} rows", file=out)
        mode = "PARITY (no suppression)" if args.parity else "suppressed"
        print(f"Exported {', '.join(wave_ids)} to {out_dir} [{mode}]", file=out)
        for what, n in sorted(changes.items()):
            print(f"  {what}: {n}", file=out)
        return {"waves": wave_ids, "out_dir": out_dir, "changes": changes}
    finally:
        con.close()


def build_parser():
    ap = argparse.ArgumentParser(description="Export waves as the CSVs the dashboard build reads.")
    ap.add_argument("--db", default=str(sitdb.DEFAULT_DB), help="SQLite file or a postgresql:// URL")
    ap.add_argument("--waves", help="comma-separated wave ids (default: all loaded waves)")
    ap.add_argument("--out-dir", help="default: data/ (mock waves) or data_real/ (real, with --allow-real)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--suppress", action="store_true", help="apply small-group suppression (the default)")
    mode.add_argument("--parity", action="store_true",
                      help="no suppression: only to check the export matches the current dashboard data")
    ap.add_argument("--allow-real", action="store_true",
                    help="export waves that are not flagged as mock (Deakin-approved infrastructure only)")
    return ap


def main(argv=None):
    args = build_parser().parse_args(argv)
    try:
        run(args)
        return 0
    except Refused as e:
        print(f"\n{e}\n", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
