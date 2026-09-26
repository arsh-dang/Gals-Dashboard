# Backend: survey data store (work in progress)

Stores survey waves in a database and exports the same CSVs the dashboard build
reads. **Synthetic (mock) data only** - this repo is public. See
`docs/backend_design.md` (added later in this work) for the full design.

- `schema.sql`: the database schema, plain portable SQL.
- `private/`: **git-ignored.** Put the real Qualtrics survey definition here as
  `backend/private/survey_v3.qsf`. It stays out of the repo until it is confirmed
  that it can be public. The raw-export ingest takes the QSF path as an argument,
  so it can live anywhere; `backend/private/` is just where we expect it.
- `*.db` files are git-ignored. Never commit a database.
