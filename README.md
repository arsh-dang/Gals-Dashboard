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
  skips the build step entirely — you're deploying the already-built output.
- **Connect a repo**: point a new Netlify site at this repository. It reads
  `netlify.toml` automatically and runs the build on every push, so the live
  site always reflects the latest `./data/` CSVs.

No environment variables or secrets are needed. No analytics or third-party
trackers are included, intentionally — see `data/` notes below.

## Data

- `data/respondents.csv`, `data/activity_ratings.csv`: required. See
  `.claude/skills/sit-dashboard/references/data-contract.md` for the schema.
- `data/battery_selections.csv`, `data/open_text.csv`: optional. The
  Skills-and-identity and Open-text views degrade to an explicit empty state
  (never invented data) when these aren't present.
- `data/open_text_themes.csv`: optional, only relevant once `open_text.csv`
  exists. Columns `ResponseId,question,theme` — populates the theme column
  on the open-text list once coding is done.

## A note on the mock-data banner

Every page carries a prominent mock-data banner at the top (not tucked in a
footer) because this dashboard is designed to be publicly reachable once
deployed. Anyone who finds the URL without context must not mistake invented
numbers for a real programme's results. Don't remove or downplay it when
customising the design.
