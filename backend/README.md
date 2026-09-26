# Backend: survey data store

Stores survey waves in a database and exports the same CSVs the dashboard build
reads. **Synthetic (mock) data only** - this repo is public. Full design, commands
and the "before real data" checklist: [`docs/backend_design.md`](../docs/backend_design.md).

- `schema.sql` - database schema (plain, portable SQL)
- `ingest.py` - load a wave; validates everything first, one transaction
- `export.py` - write the dashboard CSVs, with small-group suppression
- `required_fields.yaml` - what ingest requires (edit this when the survey changes)
- `export_rules.yaml` - suppression rules
- `verify_roundtrip.py` - shows ingest -> export -> build leaves the site unchanged
- `private/` - **git-ignored.** The real survey definition goes here as
  `private/survey_v3.qsf`; it stays out of the repo until confirmed it can be public.
- `*.db` files and `data_real/` are git-ignored. Never commit a database.

```bash
pip install -r backend/requirements.txt
python -m pytest backend/tests        # works without the real QSF (two tests skip)
```

SQLite is the default; `--db postgresql://...` (needs `psycopg`) uses PostgreSQL, and
`SIT_TEST_POSTGRES=postgresql://... pytest backend/tests` runs the suite there.
