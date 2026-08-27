---
name: sit-dashboard
description: Build or modify the STEM Impact Tracker dashboard for Deakin's School of Education - a web dashboard showing survey results about girls' participation in STEM activities. Use when working on the SIT dashboard, GALS reporting, STEM Impact Tracker views, or any chart built from the reshaped Qualtrics survey data. Covers the data contract, Deakin design language, chart conventions, and the survey-specific traps that make naive charts wrong.
---

# SIT Impact Tracker dashboard

## What this is

A dashboard reporting on a survey of school-age girls about their participation
in STEM activities: school clubs, competitions, tech school programs, university
programs, the GALS program, and a few others. It exists so two audiences can see
whether the programs are working.

**STEM program providers** need programme-level evidence: is this working, where,
for whom, and can it go in a funder report. They read it top-down and want
headline numbers with enough backing to be credible.

**Teachers** need their own cohort: how did my students respond, and what do I do
differently next term. They filter to themselves and want detail.

Same data, different framing. When a design decision is ambiguous, ask which
audience the view serves. If the answer is "both", it usually serves neither.

## Before writing code

Read `references/data-contract.md`. The survey has three traps that make
plausible-looking charts wrong:

1. **The scale runs backwards.** 1 is the *best* answer. An unlabelled average
   reads inverted.
2. **"I do not know" sits at position 5, outside the ordered scale.** Averaging
   it in penalises uncertainty as though it were negativity.
3. **Blank usually means "not shown", not "skipped".** The survey branches
   heavily, so completion rates against the full sample are meaningless.

Then read `references/design-tokens.css` and import it. Never hardcode a colour.

## Design language

The token file carries a working palette, but **it is a placeholder**. The real
values live in Deakin's staff wiki colour palette and the Education Analytics
dashboard style guide. Substitute them in `:root` and the whole project updates.
Flag this to the user if they have not already done it — shipping a
university-branded dashboard in invented colours is the kind of thing that gets
noticed late and costs rework.

Typography is Open Sans, per Deakin brand guidance for web.

The house style is restrained: white cards on a light background, a deep navy
brand colour used sparingly for emphasis, generous whitespace, and no decorative
chrome. The data is the interface. If a visual element is not carrying
information, remove it.

## Chart conventions

**One question per chart.** Give every chart a plain-language title that states
the question it answers — "Which activities built the most STEM confidence?" not
"Average score by activity type". If a chart needs a paragraph to explain, it is
two charts.

**Fix your axes.** The activity types sit within a fraction of a point of each
other. An auto-scaled axis turns a trivial difference into a dramatic-looking
one, which is actively misleading for a non-technical audience. Set explicit
bounds.

**Show what the number rests on.** Put respondent counts in tooltips. An average
of four responses and an average of four hundred should not look identical.

**Prefer distributions to averages for Likert data.** "62% said yes a lot" is
more honest and more persuasive than "average 1.8". Averaging an ordinal scale
is a convenience, not a truth. Offer the average as a secondary view.

**Multi-select batteries are frequencies.** Skills and identity questions allow
multiple answers, so there is no average. Show percentage of participants who
selected each item, partitioned by activity, since raw counts mislead when
activity groups differ in size.

**Suppress small cells.** The respondents are children in small regional
cohorts. Groups under five get suppressed with a visible badge, not silently
dropped.

## Accessibility

Not optional here — the audience includes teachers and funders on varied
hardware, and this is a university project.

- Colour never the sole encoding. Pair with position, label, or pattern.
- The categorical palette avoids red/green pairs. Keep it that way.
- 4.5:1 contrast minimum for text.
- Every chart has a text alternative: a caption stating the takeaway, or a data
  table behind a disclosure.
- Keyboard navigable. Interactive elements get visible focus.
- Respect `prefers-reduced-motion`.

## Technical approach

Static site unless there is a reason otherwise. The data is a periodic CSV
export, not a live feed, so a build step that reads CSVs and emits JSON is
simpler and more robust than a server.

- Vanilla JS or a light framework. This does not need React.
- Charts: D3 for control, or Chart.js if speed matters more than precision.
- Parse CSVs at build time, not in the browser.
- No analytics, no third-party trackers. The subject matter is children's survey
  responses; keep the dependency surface minimal.

## Mock versus real data

Development runs on synthetic data. Real collection is pending ethics approval.

**Any build using mock data must say so on screen** — use the `.banner-mock`
style. A screenshot of a dashboard showing invented results about a real
programme will eventually reach someone who does not know it is fake, and that is
a serious problem. Make it impossible to mistake.

## Working notes

Build the provider view first. It is the simpler brief and the funder reporting
need is concrete, whereas getting the teacher view right needs actual teacher
input.

Prefer rough and real over polished and speculative. The team cannot say what is
useful until they see something that is not. Ship four honest charts and ask,
rather than building twelve and guessing.
