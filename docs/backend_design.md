# Backend design: survey data store

Status: first version. Built and tested on **synthetic data only**. Nothing here has
been reviewed by Deakin IT or an ethics committee.

## Before real data

Do these before any real student response is loaded anywhere. The first one is the
most important.

1. **The public site ships row-level records to the browser, so export suppression
   protects nothing on it.** `build/build.js` turns the CSVs into `site/data/*.js`,
   and the browser downloads every respondent's region, gender, school, year level,
   every rating and every free-text answer. Anyone can open the developer tools and
   read them. Blanking small groups in `export.py` (below) protects the exported
   *files*, but the site itself needs the individual rows to draw its charts and to
   apply its own "fewer than 5" rule in the browser. A real-data version must
   therefore **serve pre-aggregated, already-suppressed counts from Deakin
   infrastructure, not row-level CSVs**: the server computes each chart's numbers,
   drops any cell under the threshold, and only those totals reach the browser. The
   front end then needs a change too (it asks for aggregates instead of filtering
   rows itself). That work is not started; this design only keeps the door open.
2. **Ethics approval and data-sharing agreement.** The mock banner already says the
   real survey is waiting on Deakin ethics approval. Loading data for real is
   downstream of that, and the approval will say where data may live and who may see it.
3. **Approved infrastructure.** Real data is only loaded on Deakin-approved
   infrastructure, never on a developer laptop, never in this repository, never in
   GitHub Pages or Netlify. `ingest.py --allow-real` exists for that environment
   and prints this warning.
4. **Free text.** `open_text` can hold anything a child typed: names, schools,
   health information. It needs its own review (redaction or theme coding) before
   it is shown to anyone.
5. **Small-group rules beyond "n < 5".** Combinations of region, school, year level
   and gender can identify a student even when every single column passes. Decide the
   rules (which combinations, what threshold) with the ethics office; the rules in
   `backend/export_rules.yaml` are a starting point, not an approved policy.
6. **Retire the placeholder contact address and the mock-data banner** only when the
   above is done and the data really is real.

## What was built

```
backend/
  schema.sql            database schema, plain portable SQL
  ingest.py             load one survey wave (validate first, one transaction)
  export.py             write the dashboard's CSVs from the database
  required_fields.yaml  what ingest insists on (edit this, not the Python)
  export_rules.yaml     small-group suppression rules used by export
  codebook.py, sitdb.py shared code
  verify_roundtrip.py   proves ingest -> export -> build changes nothing
  tests/                pytest suite (synthetic fixtures + the current mock CSVs)
data/reshape_v3.py      Qualtrics export -> tidy tables (now importable)
```

Nothing under `site/` changed, and `build/build.js` is untouched: the dashboard is
still a static build fed by `data/*.csv`.

### Data flow

```
Qualtrics text export ─┐
numeric export ────────┼─> reshape_v3.reshape() ─> validate ─> database (one transaction)
survey definition QSF ─┘                                   │
(or already-reshaped CSVs) ───────────────────────────────┘
                                                            │
                          export.py (suppression, waves) <──┘
                                   │
                              data/*.csv ─> node build/build.js ─> site/data/*.js (unchanged)
```

### Commands

```bash
pip install -r backend/requirements.txt

# the current mock data (already reshaped CSVs in ./data/)
python backend/ingest.py --wave-id mock-2026-a --survey-version v3 --tidy-dir data

# a raw Qualtrics export; the QSF path is an argument (the real one lives locally in
# backend/private/survey_v3.qsf, which is git-ignored)
python backend/ingest.py --wave-id mock-2026-b --survey-version v3 \
    --text new_data/mock_v3_text.csv --numeric new_data/mock_v3_numeric.csv \
    --qsf backend/private/survey_v3.qsf

python backend/export.py                     # all waves -> data/, with suppression
python backend/export.py --waves mock-2026-a --parity   # unsuppressed, to compare
python backend/verify_roundtrip.py           # the diff check
python -m pytest backend/tests
```

Every input needs a sidecar `<text export>.meta.json` (raw) or `<folder>/wave.meta.json`
(tidy) containing `{"is_mock": true}`, **and** every ResponseId must start with `R_MK`.
Otherwise ingest refuses unless `--allow-real` is passed.

### Where the real survey definition lives

The real `survey_v3.qsf` stays on the researcher's machine at
`backend/private/survey_v3.qsf`. That folder, `new_data/`, `*.db` and `data_real/` are
in `.gitignore`. It stays out of the repository until the supervisor confirms the
instrument can be public. Tests use a small invented QSF instead
(`backend/tests/fixtures/`, regenerated by `backend/tests/fixture_data.py`).

## Why SQLite now and PostgreSQL later

- **Now:** SQLite ships with Python, needs no server and no account, and a whole
  database is one file, so the team can build and test the schema with nothing to
  install or approve. It handles this data (about 17,000 rows per wave) easily.
- **Later:** a shared, access-controlled store on Deakin infrastructure will almost
  certainly be PostgreSQL (or another server database Deakin runs): concurrent
  users, backups, roles, audit logs.
- **Keeping the move cheap:** `schema.sql` uses only standard types and constraints
  (`VARCHAR`, `TEXT`, `INTEGER`, `DATE`, `BOOLEAN`, composite primary and foreign
  keys, `CHECK`, `ON DELETE CASCADE`). There is no `AUTOINCREMENT`, triggers or
  SQLite type tricks, and row order is an explicit `row_seq` column. **This has only
  been run on SQLite.** Trying it on a PostgreSQL instance is the first thing to do
  when one exists; expect small fixes, not a rewrite.
- The Python (`ingest.py`, `export.py`) uses `?` placeholders and `sqlite3`. Moving to
  PostgreSQL means swapping the connection (`psycopg`) and the placeholder style,
  both confined to `sitdb.connect` and the `execute` calls.

### Moving to Deakin infrastructure

1. Ask Deakin IT which database service, region and access model are approved.
2. Create the schema with `schema.sql` (fix any dialect differences).
3. Run ingest inside that environment against real exports (`--allow-real`), with
   the real QSF supplied there. The data never passes through a developer machine or
   this repository.
4. Replace the file-based `--db` argument with a connection string read from the
   environment, never from the repository.
5. Add roles: an *ingest* role that can write, a *read* role for the API, and no role
   that can do both. Turn on backups and audit logging.

## How a future API with Deakin SSO could sit on top

Not built. The intended shape, so today's choices do not block it:

- A small service (for example FastAPI) in front of the database. It **never returns
  row-level records**: every endpoint returns aggregates with small cells already
  removed (`GET /aggregates/outcomes?activity=...&region=...`). This is what
  "Before real data" item 1 needs. `export.py`'s suppression logic is the seed of that
  code.
- Login through Deakin single sign-on (OpenID Connect / SAML, whichever Deakin IT
  supports). The teacher view's "choose your school" step becomes a real check: a
  teacher's identity maps to the school(s) they may see, enforced on the server, so
  the school filter is no longer just a dropdown in the browser.
- Roles: provider (all aggregates), teacher (their own school's aggregates), researcher
  (approved wider access), each logged.
- The database is already keyed by `wave_id` and `survey_version`, so endpoints can
  filter by wave without schema changes.

## Adding a new survey wave (same survey version)

1. Export the text and numeric CSVs from Qualtrics.
2. Put them somewhere git-ignored; add the sidecar `.meta.json` (mock only in this repo).
3. `python backend/ingest.py --wave-id <label> --survey-version v3 --text ... --numeric ... --qsf ...`
4. Read the validation report if it fails; fix the export, not the database. A failed
   load writes nothing.
5. To redo a wave: `--replace`. To remove one, delete its `survey_wave` row (cascades).
6. `python backend/export.py --waves <label>` (or all waves) and rebuild.

Multi-wave exports prefix ResponseIds with the wave id (`w1:R_...`) because the same
Qualtrics id can occur in two waves and the dashboard keys on ResponseId. The dashboard
has no wave selector: pooling waves is a decision for the team, not a side effect.

## Adding a new survey version

Follow the checklist at the top of `backend/required_fields.yaml`:

1. New version number (`v4`); add it to `survey_versions_accepted`.
2. Ingest with the new `--qsf`. The codebook (`question_item`) for that version is
   built from it, so `v3` and `v4` labels coexist.
3. Update `raw_export.required_columns` if columns changed.
4. Update `data/reshape_v3.py` if the new version moves questions between activities or
   batteries (its `BLOCKS` table). Copy it to `reshape_v4.py` if both versions must
   stay loadable.
5. Run the tests, then load a small mock wave before anything else.
6. If the dashboard has to show something new, that is `build/build.js` and `site/`.

## Linking a student's responses across waves (later)

Not built and not designed in detail. If the research needs the same student followed
over time:

- **It needs ethics approval.** Linking answers over time creates a longitudinal
  profile of a child, which is a different risk from anonymous one-off surveys and
  must be covered in the consent and the approval.
- **Do not link on ResponseId, name, email or date of birth.** ResponseId is unique
  only within a wave. The schema deliberately has no student identifier column.
- **Use a de-identified linkage key held separately from the survey data.** A
  separate, tightly controlled table maps *(wave_id, ResponseId)* to a random
  `linkage_key`; the survey tables never contain identifying details. The mapping
  is produced by whoever holds the real identifiers (school or Deakin), stored on
  separate infrastructure with separate access, and joined only for approved
  analysis. If the key store is lost or leaked, the survey data alone still
  identifies nobody.
- Small-group rules must be re-thought: someone in a group of 20 in one wave may be
  unique when six waves are combined.

## Deliberately not built yet

- Any web API, authentication or hosting (depends on Deakin IT and ethics decisions).
- Pre-aggregated data and any change to the front end (see "Before real data" 1).
- A PostgreSQL connection or migration scripts.
- Linkage across waves.
- Theme coding of open text (`open_text_themes.csv` is still a manual step).
- Moving `LABEL_OVERRIDES` (in `site/js/utils.js`), the wording pairs and question
  names hard-coded in `build/build.js`, into the codebook. **Later clean-up:** labels
  should live in `question_item`; today they are still in code.
- A wave selector or comparison across waves on the dashboard.

## Findings while building

- **`data/reshape_v3.py` was not the script that produced the current `data/*.csv`.**
  Run with the real QSF and the new mock exports it gives a different mock population
  (a different random draw, only one ResponseId in common). The current CSVs stay as
  wave `mock-2026-a`; the reshaped `new_data/` exports load as `mock-2026-b`.
- **The script split multi-select answers on commas in the *text* export.** Options
  such as "I do not like maths, science or technology subjects" were cut into
  fragments and duplicated rows, which the new duplicate-key check caught (65 wrong
  rows in the new mock data). It now reads the *numeric* export (choice ids) and looks
  the labels up in the QSF, as the design intended. The other five tables are
  byte-for-byte unchanged; the current `data/*.csv` already had the whole labels.
- **Two quirks named in the brief are not in `reshape_v3.py`:** piped text and
  display-logic gating. Piped text (`${...}`) appears only in three *question* texts
  (kept as written in the codebook); the reshaper does not use it. Questions hidden by
  display logic export as blank cells and are skipped as blanks, so there is no
  explicit gating step. If either needs handling, that is new work.
- `question_item` for a tidy-only load (no QSF) has item labels but no question text,
  block or type; it is marked `codebook_source = 'tidy'` and is replaced the first
  time a QSF is supplied for that version.
