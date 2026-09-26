# Front-end makeover: review

Branch `frontend-makeover`. Not merged, not pushed. `main` (and so the live site)
is unchanged.

The screenshots live in `review/before/` and `review/after/`. Those folders are
git-ignored, so the image links below only work on the machine that made them.
To make them again, check out each branch and take the same screenshots, or ask
for the script. Full pages are `review/{before,after}/<page>_<width>.png`. Close-ups
of each section are in `review/{before,after}/sections/`. Chart-by-chart pairs
from Part 1 are in `review/part1/`. A sample printed PDF is
`review/after/overview_print.pdf`.

## Checks

| Check | Result |
|---|---|
| `npm run build` | Runs, no warnings |
| `python -m pytest backend/tests` | 83 passed (with the private survey file); 80 passed, 3 skipped (without it) |
| `build/`, `data/`, `backend/`, tests changed? | No (`git diff main -- build data backend` is empty) |
| Horizontal scroll at 1400px, 768px, 390px | None, on all three pages |
| Clipped chart labels (text outside its chart), same widths | None |
| Console errors | None |
| Outside requests (checked in the browser) | None. Fonts are now self-hosted |
| Keyboard | Tab reaches the page tabs, section nav, filters, Reset, chart-type buttons, the highlight selector, legend items and "Show these numbers as a table", each with a visible focus ring |
| Legend hover or focus | Fades the other series; the highlight survives a filter change |
| Print (Chrome, A4) | 13 pages; the mock-data warning is in the top margin of every page; nav and filters hidden; panels and charts do not split |
| Contrast | Body and secondary text 7:1 or better, muted text 4.7:1, white on brand 5.9:1. Two failures fixed along the way (below) |

## Before and after

| Section | Before | After | What changed |
|---|---|---|---|
| Header and top of page | [before](before/sections/top_1400.png) · [phone](before/sections/top_390.png) | [after](after/sections/top_1400.png) · [phone](after/sections/top_390.png) | Slim header: title, one-line subtitle, page tabs and the About button. The "SIT" circle and the home icon (which repeated the first tab) are gone. On phones the tabs scroll sideways instead of wrapping under the title. Sticky section nav (Who took part, Outcomes, Skills, Regions, Future plans) that highlights the current section, and becomes a chip row on phones. KPIs are large numbers with small labels and no fill, next to the filter pane. Year level option shortened to "All year levels (incl. post-school)", with "No filters on" / "2 filters on" beside "Showing all 200 people who answered". |
| 1. Who took part | [before](before/sections/participation_1400.png) | [after](after/sections/participation_1400.png) | White card, bold question title. Activity names are no longer clipped. Region grid: 0 is plain, only 1 to 4 is hatched, one smooth teal ramp, and a key for all three. |
| 2. Outcomes | [before](before/sections/outcomes_1400.png) · [phone](before/sections/outcomes_390.png) | [after](after/sections/outcomes_1400.png) · [phone](after/sections/outcomes_390.png) | Simple solid shapes instead of the cross, star and "Y" glyphs; bigger dots with a thin outline on light colours; lighter confidence lines. "Highlight activity" selector, and legend items that fade the other series on hover, focus or click. The default is still the full comparison. Labels wrap instead of being cut off. "≈" is a small badge. Hidden results are a grey "hidden" tag at the right edge. Yellow is no longer used for a series. |
| 3. Skills | [before](before/sections/skills_1400.png) | [after](after/sections/skills_1400.png) | Labels wrap instead of being cut off. Colours follow the new series palette (no yellow). |
| 4. Regions | [before](before/sections/regional_1400.png) | [after](after/sections/regional_1400.png) | Same changes as Outcomes, with a "Highlight region" selector. |
| 5. Future plans | [before](before/sections/aspirations_1400.png) · [phone](before/sections/aspirations_390.png) | [after](after/sections/aspirations_1400.png) · [phone](after/sections/aspirations_390.png) | The four gender charts are dot plots on a shared 0 to 100% axis instead of end-to-end bars, with a numbers table. Gender colours are neutral (teal, burnt orange, blue, near-black) with a shape per group, the same on every chart. "Belonging and confidence" is a white card with a small "A different kind of question" label instead of a pink tint. The "STEM activities and programs" labels are no longer cut off. |
| About and footer | [before](before/sections/footer_1400.png) | [after](after/sections/footer_1400.png) | "About this dashboard" sits above the footer. The footer is one line: contact, data date, and "All numbers are made-up test data." |
| Teacher view: choose a school | [before](before/sections/teacher-gate_1400.png) · [phone](before/sections/teacher-gate_390.png) | [after](after/sections/teacher-gate_1400.png) · [phone](after/sections/teacher-gate_390.png) | No more large gaps between the three dropdowns. New header. |
| Teacher view: a school | [before](before/sections/teacher-school_1400.png) · [phone](before/sections/teacher-school_390.png) | [after](after/sections/teacher-school_1400.png) · [phone](after/sections/teacher-school_390.png) | White cards. "Spread of answers" says "University" (was "Universitys"), wraps long activity names, and says "not asked" where a wording was never asked. |
| Written answers | [before](before/sections/open-text_1400.png) | [after](after/sections/open-text_1400.png) | New header, white card, one-line footer. |

## Commits on the branch

1. Fix clipped and truncated chart labels, and the overlapping ≈ note
2. Gender charts as shared-axis dot plots; hidden results as a right-hand tag
3. Compact teacher school form; separate zero from hidden in the region grid
4. Self-host Open Sans instead of loading it from Google Fonts
5. Layout makeover: slim header, sticky section nav, white cards, lighter KPIs
6. Charts: simple shapes, lighter CIs, highlight a series, neutral gender colours
7. Print: mock-data warning in every page's top margin; keep panels whole
8. Accessibility: readable mock-data label and footer reminder
9. Docs: MAINTAINER, HANDOVER and QUESTIONS updated for the new front end

## Things found and fixed along the way

- **The "Mock data." label in the banner failed contrast** (orange on cream,
  2.8:1). It is burnt orange now (5:1). The banner is otherwise the same size and
  position.
- **"Universitys"** in the "Spread of answers" view (a text-shortening bug).
- **Wordings never asked of an activity were marked as hidden.** The School club
  block uses its own wording for three statements, so every other activity had
  zero answers on those rows and showed a × as if results were hidden. Zero is
  now shown as nothing, or "not asked". Only 1 to 4 people get the "hidden" tag.
- **Captions that described the old marks.** Where a fix changed a mark, the
  sentence describing it changed with it: "×" became the grey "hidden" tag, the
  gender captions say "dot" instead of "segment", and the Belonging and
  confidence subtitle says it is "labelled" instead of "a different colour". No
  other caption was touched.

## What I chose not to do, and why

- **Card subtitles are not cut to one line.** Several subtitles are two or three
  sentences. Shortening them means rewriting captions, which the brief rules out
  except where a fix required it. They are styled as secondary text instead. The
  wording review is the place to shorten them.
- **The pages are taller, not shorter.** Desktop overview: about 7,600px before,
  8,500px after. Phone: 13,600px before, 15,200px after. Labels now wrap instead of
  being cut off, the gender charts have an axis, and sections have more space. The
  sticky section nav is what makes the length manageable. If height matters more
  than breathing room, `.view-grid` gap and row heights are the places to tighten.
- **Skills bars, the "STEM activities and programs" chart and "Spread of
  answers" keep the greyed "hidden for privacy" text** in place of a missing bar,
  rather than the right-hand tag. They never had the floating ×, and the brief
  allows a greyed marker in place of the mark.
- **No highlight selector on the small-multiples, distribution or gender
  charts.** Small multiples and distribution already show one activity per panel.
  The gender charts have two or three series.
- **The print warning uses a page margin box** (`@page { @top-center }`). Chrome
  and Edge print it on every page. Firefox and Safari may not, but the full banner
  still prints on page 1. A fixed-position banner was tried first; Chrome placed it
  over the content.
- **The `.claude/` design tokens copy was not updated.** It is a helper file for
  the coding tool, not part of the site.
- **No README screenshots existed**, so there were none to update.
