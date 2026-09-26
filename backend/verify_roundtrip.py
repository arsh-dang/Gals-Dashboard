#!/usr/bin/env python3
"""Prove the database round trip leaves the dashboard unchanged.

  1. load the mock CSVs in ./data/ into a throwaway database,
  2. export them again (--parity: no suppression),
  3. check the six CSVs are byte-for-byte identical to ./data/*.csv,
  4. run the real build (node build/build.js) on a scratch copy of the project fed
     with the exported CSVs, and check the site/data/*.js files it writes are
     identical to the ones in the repository (the only allowed difference is the
     generatedAt timestamp in meta.js, and the asset-hash stamps derived from it).

Nothing in the repository is modified. Exit code 0 = identical.
"""
import difflib
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import export
import ingest
import sitdb

TABLES = list(sitdb.TABLE_COLUMNS)


def normalise(text):
    text = re.sub(r'"generatedAt":"[^"]*"', '"generatedAt":"<time>"', text)
    return re.sub(r"\?v=[0-9a-f]{10}", "?v=<hash>", text)


def main():
    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        db = tmp / "check.db"
        meta = tmp / "wave.meta.json"  # ./data/ holds mock data only; ingest still wants it flagged
        meta.write_text('{"is_mock": true}', encoding="utf-8")
        code = ingest.main(["--db", str(db), "--wave-id", "roundtrip-check", "--survey-version", "v3",
                            "--tidy-dir", str(sitdb.DATA_DIR), "--meta", str(meta)])
        if code != 0:
            return code
        exported = tmp / "exported"
        export.main(["--db", str(db), "--parity", "--out-dir", str(exported)])

        print("\nCSV check (exported vs ./data):")
        for name in TABLES:
            same = (exported / f"{name}.csv").read_bytes() == (sitdb.DATA_DIR / f"{name}.csv").read_bytes()
            ok &= same
            print(f"  {'IDENTICAL' if same else 'DIFFERS  '} {name}.csv")

        # Scratch copy of the project so the build cannot touch the real site/.
        proj = tmp / "project"
        (proj / "data").mkdir(parents=True)
        shutil.copytree(sitdb.REPO_DIR / "build", proj / "build")
        shutil.copytree(sitdb.REPO_DIR / "site", proj / "site")
        for name in TABLES:
            shutil.copy(exported / f"{name}.csv", proj / "data" / f"{name}.csv")
        for extra in sitdb.DATA_DIR.glob("*.csv"):  # any other CSV the build may read
            if not (proj / "data" / extra.name).exists():
                shutil.copy(extra, proj / "data" / extra.name)
        subprocess.run(["node", "build/build.js"], cwd=proj, check=True, capture_output=True)

        print("\nBuilt-site check (site/data/*.js from exported CSVs vs the repository's):")
        files = sorted(p.name for p in (sitdb.REPO_DIR / "site" / "data").glob("*.js"))
        for f in files:
            a = normalise((sitdb.REPO_DIR / "site" / "data" / f).read_text(encoding="utf-8"))
            b = normalise((proj / "site" / "data" / f).read_text(encoding="utf-8"))
            ok &= a == b
            print(f"  {'IDENTICAL' if a == b else 'DIFFERS  '} site/data/{f}")
            if a != b:
                for line in list(difflib.unified_diff(a.splitlines(), b.splitlines(), lineterm="", n=0))[:6]:
                    print("      " + line[:160])
        for page in sorted((sitdb.REPO_DIR / "site").glob("*.html")):
            a = normalise(page.read_text(encoding="utf-8"))
            b = normalise((proj / "site" / page.name).read_text(encoding="utf-8"))
            ok &= a == b
            print(f"  {'IDENTICAL' if a == b else 'DIFFERS  '} site/{page.name} (asset stamps ignored)")
    print("\nRESULT:", "identical, the dashboard is unchanged" if ok else "DIFFERENCES FOUND")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
