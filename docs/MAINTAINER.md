# Maintainer guide

For whoever changes the code next. For the non-technical overview, read
`docs/HANDOVER.md` first. Field meanings are in `docs/DATA_DICTIONARY.md`.

Everything here was checked against the code. Commands were run on macOS with
Node 24 and Python 3.12. Windows and Linux were not tried.

## 1. Repository map

```
README.md                    Short intro and quick start
docs/                        Handover docs, plus backend_design.md
wording_review.md            Working document from the wording review (see 8)
build/build.js               CSV files -> site/data/*.js  (npm run build)
data/
  *.csv                      The six files the dashboard reads (generated; do not edit by hand)
  raw/                       Synthetic Qualtrics exports + a .meta.json marking them mock
  reshape_v3.py              Qualtrics export -> six tidy tables
  generate_mock_v3.py        Makes invented Qualtrics exports (see 3)
site/                        The whole dashboard. This folder is what gets published
  index.html teacher.html open-text.html
  css/ (tokens.css = colours and fonts, styles.css)
  js/ (main.js, teacher-main.js, open-text-main.js, summary.js, utils.js, charts/)
  data/                      Built files. Committed, and rebuilt by the deploy
  vendor/d3.min.js           The chart library, saved locally
backend/
  schema.sql                 Database tables (SQLite and PostgreSQL)
  ingest.py export.py        Load a wave / write the CSVs
  sitdb.py codebook.py       Shared code
  required_fields.yaml       What ingest insists on
  export_rules.yaml          What export blanks or drops
  verify_roundtrip.py        Proves ingest -> export -> build changes nothing
  private/                   Git-ignored. survey_v3.qsf goes here
  tests/                     pytest suite and fixtures
scripts/generate-icon-assets.js   Makes the icon and link-preview PNGs (see 6)
.github/workflows/deploy-pages.yml  Deploy to GitHub Pages
netlify.toml                 Old Netlify settings (still valid, not used by Pages)
.claude/                     Helper files for the Claude Code tool, not part of the product (see 8)
```

## 2. The build

`npm run build` runs `node build/build.js`. It has no dependencies, so no
`npm install` is needed. It does four things:

1. Reads `data/respondents.csv`, `activity_ratings.csv`, `aspirations.csv` and
   `subject_career.csv`. These are required. It also reads `battery_selections.csv`
   and `open_text.csv` if they exist, and `open_text_themes.csv` if you add it.
2. Joins each row to its respondent, blanks `school` and `school_level` for anyone
   who is not a school student, and works out counts for the pages.
3. Writes `site/data/*.js` and `meta.js`. `meta.js` holds the suppression
   threshold and a `generatedAt` timestamp.
4. Rewrites the `<script>` and stylesheet links in `site/*.html` to add
   `?v=<hash of the file>`. This stops a browser mixing a new page with an old
   script after a deploy. It only changes when a file's contents change.

The build prints `WARNING` when an influence option or question that it expects
is not in the data. It does not fail. Read the output.

## 3. The Python scripts

| Script | What it does |
|---|---|
| `data/reshape_v3.py` | `reshape(text, numeric, QS)` turns the two exports into six tables. Importable. Also runs from the command line. Question numbers and labels are hard-coded (`BLOCKS`, `MULTI_SETS`, `SINGLE_SETS`, `PIPED_TEXT`). |
| `data/generate_mock_v3.py` | Makes invented exports from the survey definition. Reads `survey_v3.qsf` from the current folder and writes two CSVs there. Not repeatable, and it does not match `data/raw/`. See `docs/QUESTIONS_FOR_ARSH.md`. |
| `backend/ingest.py` | Checks a wave, then loads it in one transaction. Two input modes: raw exports plus survey definition, or a folder of tidy CSVs (`--tidy-dir`). Refuses input not marked mock unless `--allow-real`. Prints a report of every problem it finds. |
| `backend/export.py` | Writes the six CSVs from the database, for one or more waves. Suppresses small groups by default, and does not with `--parity`. Refuses to write non-mock data into `data/`. |
| `backend/verify_roundtrip.py` | Loads `data/` into a temporary database, exports it, builds the site in a temporary copy, and checks nothing changed. Prints `RESULT: identical, the dashboard is unchanged`. |
| `backend/sitdb.py` | Paths, table layout, the database connection (SQLite or `postgresql://`), the mock-data check. |
| `backend/codebook.py` | Builds the `question_item` table from the survey definition. |
| `scripts/generate-icon-assets.js` | Makes the PNG icons and `og-image.png` from `site/favicon.svg` using Playwright. Not run this session, not part of the build. Its header says how to run it. |

Commands (run from the top folder, after the Python setup in `README.md`):

```
python backend/ingest.py --help
python backend/export.py --help
python backend/verify_roundtrip.py
```

The rules ingest applies are in `backend/required_fields.yaml`, with a checklist
at the top for when the survey changes. The rules export applies are in
`backend/export_rules.yaml`.

## 4. The site code

There is no framework. Each page loads plain scripts in order.

- `site/js/utils.js`: shared helpers. Colours, score maths, filtering, tooltips,
  the small-group rule, and `LABEL_OVERRIDES`. Also the chart building blocks
  used everywhere:
  - `labelGutter` and `drawWideLabel`: row labels measured in the real font,
    wrapped to two lines instead of cut off, full text in a tooltip, and the
    small "≈" badge for statements asked in two wordings;
  - `drawHiddenChip`: the grey "hidden" tag for results hidden for privacy,
    always in a fixed column at the right edge of a row, never in the plot;
  - `buildMarkerScale` and `markOutline`: simple solid shapes (circle, square,
    diamond, triangles, hexagon, pentagon), and a thin dark outline on light
    fills;
  - `setEmphasis`: fades every mark with class `series-mark` except one
    `data-key` (used by the "Highlight activity / region" selectors and by
    hovering or focusing a legend item).
- `site/js/main.js`: the Program overview page. Reads the built data, applies the
  filters, calls the charts.
- `site/js/teacher-main.js`: the Teacher view.
- `site/js/open-text-main.js`: the Written answers page.
- `site/js/summary.js`: writes the "What this shows" sentences. It compares two
  averages and only reports a gap when their 95% confidence intervals do not
  overlap. Nothing is written by an AI model.
- `site/js/charts/`: one file per chart family (participation, outcomes, skills,
  regional, aspirations, influences, teacher). The four gender charts
  (`influences.js`, `renderByGender`) are dot plots on a shared 0 to 100% axis.
- `site/js/section-nav.js`: highlights the current section in the sticky section
  nav on the overview. The links work without it.
- Page layout: slim header with the page tabs (`.site-header`, `.site-tabs`),
  the sticky section nav (`.section-nav`, overview only), KPIs and filters in one
  band (`.overview-bar`), white cards, then "About this dashboard" above a
  one-line footer. The makeover rules are at the end of `styles.css`, including
  the print stylesheet (`@media print`, and an `@page` margin box that prints
  the mock-data warning at the top of every page).
- Fonts: Open Sans is self-hosted in `site/vendor/fonts/` (Latin subset, SIL OFL,
  licence in `OFL.txt`). The site makes no request to any outside server.
- Colours: every colour comes from `tokens.css`. Yellow (`--series-5`) is not used
  for chart series, because it fails contrast for thin marks on white. Gender
  groups have fixed neutral colours and shapes, set once in `main.js`
  (`genderColors`).
- `site/css/tokens.css`: colours and fonts. `site/css/styles.css`: layout,
  including the phone layouts (below 640px).

Every colour is read from `tokens.css`. Do not write hex colours in JavaScript.

## 5. Tests

```
python -m pytest backend/tests
```

Result on a clean copy without the survey file: `80 passed, 3 skipped`. With the
file at `backend/private/survey_v3.qsf`: `83 passed`. Both were run.

| File | What it protects |
|---|---|
| `test_schema.py` | The database keys and checks (same id in two waves, orphan rows, score 1 to 4, deleting a wave). |
| `test_ingest.py` | Row counts, comma-labelled options staying whole, score reversal, re-loading refused, a crash leaving nothing behind, the post-school warning. |
| `test_validation.py` | Every kind of bad input fails clearly and writes nothing. |
| `test_mock_guard.py` | Real data cannot be loaded or exported by accident. Databases and the survey file are not tracked by git. |
| `test_export.py` | The export matches the CSVs byte for byte, and suppression works. |
| `test_reference.py` | The reshaper reproduces `backend/tests/fixtures/reference/` exactly, and `data/*.csv` equals it. Two of the three reproduction tests need the survey file and skip without it. |
| `test_build_labels.py` | Every exact-string label in `build/build.js` exists in the CSVs. |

To run the same tests on PostgreSQL (this was done once, with a local server):

```
SIT_TEST_POSTGRES="postgresql://user@/dbname?host=/path/to/socket&port=5432" python -m pytest backend/tests
```

Use an empty scratch database. Each test makes and drops its own schema.

There are no tests for the site code (the charts). Check them by looking at the
pages at 1400px, 768px and about 390px: no sideways scrolling, no cut-off
labels, no console errors. Tab through the page tabs, section nav, filters,
legends and "Show these numbers as a table" and check each shows a focus ring.

## 6. Deploy

Pushing to `main` runs `.github/workflows/deploy-pages.yml`. It checks out the
code, sets up Node 24, runs `npm ci`, runs `npm run build`, and publishes the
`site/` folder to GitHub Pages. It does not run the Python tests. The Pages
setting must be "Source: GitHub Actions". Whether it is set is not visible in the
code.

`netlify.toml` still describes the old Netlify setup (build command, publish
folder `site`, Node 20, and a rule that `/data/*` must be revalidated). It is not
used by Pages. Its comment says no analytics or trackers are to be added.

## 7. Fragile parts

Read this before changing anything. The first three cause silent problems.

1. **Exact-string lookups.** `build/build.js` finds questions and options by
   their exact text (the constants at the top). A relabel makes a chart draw
   nothing, and the build only warns. `test_build_labels.py` catches this. Run the
   tests after any change to labels or the reshape step.
2. **Question numbers are hard-coded in the reshaper.** A new survey version with
   different question ids needs edits to `BLOCKS`, `MULTI_SETS` and
   `SINGLE_SETS` in `data/reshape_v3.py`, and to `required_fields.yaml`.
3. **The site holds every person's answers.** `site/data/*.js` is public. This is
   fine for mock data only. See `docs/HANDOVER.md`, section 6.
4. **The reference files are byte-exact.** `backend/tests/fixtures/reference/`
   must equal `data/*.csv`. Changing the data or the reshaper changes them, so
   update both together and say why in the commit.
5. **The number 5 is written in several places.** See `docs/HANDOVER.md`,
   section 3.4.
6. **`n_activities` is wrong** for most rows (comma splitting). No chart uses it.
7. **The generator is not repeatable and does not match `data/raw/`.**
8. **`scripts/generate-icon-assets.js` contains the old preview text** and would
   overwrite the corrected `site/og-image.png`.
9. **Every build changes `site/data/meta.js`** (a timestamp) and, when a file
   changed, the `?v=` stamps in the HTML. So `git status` is rarely clean after a
   build. The deploy rebuilds anyway.
10. **Preview links.** The preview tags in the HTML head point at
    `galsdashboard.netlify.app`. (The fonts are self-hosted now, so there is no
    outside request from the page itself.)
11. **Multi-wave export.** Two waves exported together get prefixed response ids.
    The dashboard has no wave filter.
12. **PostgreSQL was tested once, on a local server.** Deakin's may differ.
13. **The teacher "sign in" is a drop-down**, not security.
14. **Labels are measured in the browser.** `U.measureText` uses a hidden SVG
    text element in the page font. The charts redraw once the font has loaded
    (`document.fonts.ready`). If the font files go missing, labels are measured
    in the fallback font and may wrap differently, but nothing is cut off.
15. **"Never asked" is not "hidden".** A cell with 0 people (for example the
    School club wording of a statement for every other activity) shows nothing,
    or "not asked" in the "Spread of answers" view. Only 1 to 4 people get the
    grey "hidden" tag. Keep that distinction if you change the charts.
16. **The print warning uses a page margin box** (`@page { @top-center }`).
    Chrome and Edge support it; other browsers may print without it, but the
    full banner still prints on page 1.

## 8. Other files

- `wording_review.md`: the list of wording changes and open captions. Sections 0 to
  8 quote counts from the first mock dataset, so those numbers are stale. Section 9
  says which captions were checked against the current data.
- `.claude/skills/`: helper instructions for the Claude Code tool used during the
  project. The `sit-dashboard/references/data-contract.md` there is out of date
  (it describes the scale as 1 = Yes a lot, and lists fewer columns). Use
  `docs/DATA_DICTIONARY.md` instead. There is also a stray folder named
  `{scripts,references}` in `.claude/skills/sit-dashboard/`.
- `data/Deakin Dashboard Style Guide (NOV) 2025.pdf` and
  `data/Gals_MockData_Workbook.twbx`: reference files. Nothing reads them.
- `old_data/` is git-ignored and not part of the project.

## 9. Conventions

- Australian spelling ("program", "colour", "summarise").
- Show survey wording as it was asked. Change how it looks only in
  `LABEL_OVERRIDES`.
- Say "people who answered", not "respondents". Say "hidden for privacy" for
  suppressed results.
- Every page keeps its mock-data banner. Do not remove or shrink it. The site is
  public and anyone who finds it must not mistake made-up numbers for results.

## Appendix: notes carried over from the old README

These were in the old `README.md`. They are kept as written. Some wording
predates the wording review, and the numbers in the caption notes describe
earlier data.

### Notes moved off the dashboard footer

The on-page "Data notes" section is trimmed to the three things a principal or
teacher reading cold actually needs: it's synthetic data, groups under five are
suppressed, and the scale runs 1 = No to 4 = Yes a lot (higher is better). The
detail below is for whoever maintains this, so it's here instead:

- "General STEM outcomes (not activity-specific)" is a real question block
  asked of everyone, shown on its own in the Outcomes section. It is not a
  real 8th activity, so it's excluded from every activity and region
  comparison elsewhere on the page.
- Colours follow the real Deakin Dashboard Style Guide (Nov 2025); see
  `site/css/tokens.css` for sourcing notes on where each value comes from.
- The option "Subjects I need for a future job" displays on the page as
  "Knowing which subjects I need for a future job": a display-only override
  of the raw survey wording, requested by the team so it reads as being about
  knowing the requirement rather than the subjects themselves. The mapping
  lives in `site/js/utils.js` (`LABEL_OVERRIDES` / `U.displayLabel`) so future
  label overrides go in one place rather than being hardcoded at each point
  of display. The underlying survey text is unchanged and is still the
  join/sort key everywhere else in the pipeline.
- Source CSVs: `respondents.csv`, `activity_ratings.csv`,
  `battery_selections.csv`, `aspirations.csv`, `subject_career.csv` and
  `open_text.csv` from the reshaped Qualtrics export. If a future data drop
  removes any of these, the affected view shows an explicit empty state
  rather than stale or invented data.

### Moved here during the wording review

These were visible developer notes on the public pages and were removed from them:

- **Teacher page footer:** some respondents' raw `school` and `school_level` values in the source CSV contradict the data contract (populated on a Post-school row, which should be blank; the `school` value often looks like a leaked open-text answer). This recurred in the latest data drop (7 rows, up from 1). Worth flagging to whoever maintains the reshape script. Both fields are treated as blank rather than shown.
- **Teacher and open-text page footers:** colours follow the Deakin Dashboard Style Guide (Nov 2025); see `site/css/tokens.css` for sourcing notes.
- **Open-text page, "not available" state:** it appears when `open_text.csv` is missing from `./data/`. Columns are `ResponseId,question,source_column,response`; re-run `node build/build.js` after adding it. Theme coding slots in the same way with `open_text_themes.csv` (`ResponseId,question,theme`).
- **Skills and identity, "not available" state:** appears when `battery_selections.csv` is missing.

Wording conventions used on the pages: "program" (Australian spelling), "people who answered" instead of "respondents", "year level", and small results are "hidden for privacy (fewer than 5 people)". See `wording_review.md` for the full list of changes.

### Caption reasoning (trimmed from the page)

The on-page captions were cut to one or two sentences each for the Friday
forum audience (teachers and principals reading cold, on their own devices,
with about ten seconds per chart). Where a sentence was cut rather than just
shortened, the fuller version is kept here rather than lost:

- **Participation by activity**: check whether any one activity dominates
  the chart, and do not caption a "largest" activity unless the gap is real.
  Early data drops had GALS dominating the chart outright, which read as a
  headline finding it wasn't (a sampling artifact of who was easiest to
  recruit early on, not a program effect). Re-check after each regeneration.
- **Outcomes by activity**: the "≈" wording-variant tag exists because three
  outcome statements appear twice with near-identical phrasing - a survey
  artifact (one activity's question block used slightly different wording
  than the rest), not missing or duplicated data. Shown as separate adjacent
  rows so the pattern is visible instead of looking like a gap.
- **Regional comparison**: a region with few responses can show suppressed
  cells. If a whole region looks empty, that is the honest state of the
  sample (thin regional recruitment), not a rendering gap - check that
  region's response count first. How many cells are suppressed changes
  whenever the data does, so don't quote a number.
- **Aspirations (GALS vs everyone else)**: the "Diff" column's confidence
  intervals usually overlap. That overlap is the honest signal that this
  sample size cannot support a claim of significance either way - read the
  difference alongside the interval, not instead of it. The mock generator
  has no built-in assumption that GALS improves aspirations, so expect small
  differences that go in both directions, not a rendering issue. Check the
  size and direction of the gaps after each regeneration rather than relying
  on a remembered figure.
- **Subject-choice / career-choice / subject-interest / self-perception
  (all four gender-split charts)**: female respondents include every GALS
  participant, since GALS is a girls' programme. Any gender gap across the
  whole sample therefore partly reflects who took part in the programme
  rather than gender alone - and that confound doesn't go away with real
  data either, so any gender comparison here should always be read alongside
  programme participation, not instead of it.
- **Programme influence panel**: gets its own panel because "the STEM
  activities and programmes" option appears in both the subject-choice and
  career-choice questions, and is the closest thing in the survey to a
  direct measure of the programmes' own influence - otherwise it would sit
  as one row among ten and be easy to miss. The gap shown is built into the
  mock data so the panel has something to show; real data may show a smaller
  gap, no gap, or a gap in the other direction.
- **Self-perception card tint** (superseded: the card is now white with a small
  "A different kind of question" label): shown on a pink-tinted card, not the same
  white as the influence charts above it, because it's a different kind of
  question (self-image, not what influences a decision) - the tint is a
  glance-level signal of that, not a lighter version of the same chart.

### Icons and link-preview image

`site/favicon.svg` is the hand-authored source for every icon. The PNGs
(`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png`) are
committed binaries, not generated during the Netlify build - regenerating
them needs Playwright (a full browser download), which isn't worth adding as
a build dependency for an asset that only changes when the design does.
Regenerate them after editing `favicon.svg` or the preview text with:

```
npm install --no-save playwright
node scripts/generate-icon-assets.js
```

### A note on the mock-data banner

Every page carries a prominent mock-data banner at the top (not tucked in a
footer) because this dashboard is designed to be publicly reachable once
deployed. Anyone who finds the URL without context must not mistake invented
numbers for a real programme's results. Don't remove or downplay it when
customising the design.
