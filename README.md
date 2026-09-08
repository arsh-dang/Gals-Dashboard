# STEM Impact Tracker

A static dashboard reporting on a survey of school-age girls' participation in
STEM activities (GALS and related programmes), for two audiences: programme
providers/funders (`site/index.html`) and individual teachers
(`site/teacher.html`), plus a filterable open-text response list
(`site/open-text.html`).

**All data on every view is synthetic mock data.** Real survey collection is
pending Deakin ethics approval.

## Running locally

The build step reads the CSVs in `./data/` and writes classic-script JS data
files into `site/data/` (no `fetch`/JSON, so the site works when opened
directly via `file://`, with no server):

```
node build/build.js
```

Then open `site/index.html` by double-clicking it, or serve the `site/`
folder with any static file server if you prefer:

```
npx serve site
```

Re-run `node build/build.js` any time the CSVs in `./data/` change.

## Deploying to Netlify

`netlify.toml` at the project root already sets the build command
(`npm run build`, which runs `node build/build.js`) and the publish directory
(`site`), so either of Netlify's standard flows works with no extra setup:

- **Drag-and-drop**: run `node build/build.js` locally, then drag the `site/`
  folder onto [app.netlify.com/drop](https://app.netlify.com/drop). This
  skips the build step entirely: you're deploying the already-built output.
- **Connect a repo**: point a new Netlify site at this repository. It reads
  `netlify.toml` automatically and runs the build on every push, so the live
  site always reflects the latest `./data/` CSVs.

No environment variables or secrets are needed. No analytics or third-party
trackers are included, intentionally; see `data/` notes below.

## Data

- `data/respondents.csv`, `data/activity_ratings.csv`, `data/aspirations.csv`,
  `data/subject_career.csv`: required. See
  `.claude/skills/sit-dashboard/references/data-contract.md` for the schema.
  `respondents.csv` should include a `did_gals` column; if a future drop omits
  it, the build falls back to deriving it from GALS activity participation.
- `data/battery_selections.csv`, `data/open_text.csv`: optional. The
  Skills-and-identity and Open-text views degrade to an explicit empty state
  (never invented data) when these aren't present.
- `data/open_text_themes.csv`: optional, only relevant once `open_text.csv`
  exists. Columns `ResponseId,question,theme` populate the theme column
  on the open-text list once coding is done.

## Notes moved off the dashboard footer

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

## Caption reasoning (trimmed from the page)

The on-page captions were cut to one or two sentences each for the Friday
forum audience (teachers and principals reading cold, on their own devices,
with about ten seconds per chart). Where a sentence was cut rather than just
shortened, the fuller version is kept here rather than lost:

- **Participation by activity**: GALS is narrowly the largest single
  activity, but participation across all seven is broadly comparable now -
  worth noting because early data drops had GALS dominating the chart
  outright, which read as a headline finding it wasn't (a sampling artifact
  of who was easiest to recruit early on, not a program effect).
- **Outcomes by activity**: the "≈" wording-variant tag exists because three
  outcome statements appear twice with near-identical phrasing - a survey
  artifact (one activity's question block used slightly different wording
  than the rest), not missing or duplicated data. Shown as separate adjacent
  rows so the pattern is visible instead of looking like a gap.
- **Regional comparison**: most regions outside Geelong show several
  suppressed cells. That's the honest state of this sample (thin regional
  recruitment), not a rendering gap - worth saying plainly if someone asks
  why a whole region looks empty.
- **Aspirations (GALS vs everyone else)**: the "Diff" column's confidence
  intervals usually overlap. That overlap is the honest signal that this
  sample size cannot support a claim of significance either way - read the
  difference alongside the interval, not instead of it. The mock generator
  has no built-in assumption that GALS improves aspirations, so the small,
  mixed-direction gap (roughly ±0.2) is expected, not a rendering issue.
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
- **Self-perception card tint**: shown on a pink-tinted card, not the same
  white as the influence charts above it, because it's a different kind of
  question (self-image, not what influences a decision) - the tint is a
  glance-level signal of that, not a lighter version of the same chart.

## Icons and link-preview image

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

## A note on the mock-data banner

Every page carries a prominent mock-data banner at the top (not tucked in a
footer) because this dashboard is designed to be publicly reachable once
deployed. Anyone who finds the URL without context must not mistake invented
numbers for a real programme's results. Don't remove or downplay it when
customising the design.
