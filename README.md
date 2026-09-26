# STEM Impact Tracker

A prototype dashboard for a survey about students' participation in STEM
activities, including the Girls as Leaders in STEM (GALS) program. It was built
for Deakin University's School of Education.

**Every number in it is made-up test data.** It is a prototype, not a live
reporting tool. The real survey has not started. It is waiting for Deakin ethics
approval. Do not put real student data in this repository.

Live prototype: <https://arsh-dang.github.io/Gals-Dashboard/>

## What it shows

There are three pages.

**Program overview** (`site/index.html`), for program providers and funders:

1. Who took part: how many people answered about each activity, and a table of
   region by year level.
2. What students reported, by activity: how positive the answers were for 12
   statements, in three chart types. There is also a separate card for a general
   question that is not about one activity.
3. Skills, and how students felt others saw them.
4. A comparison of the six regions.
5. Future plans and subject choice: GALS participants against everyone else,
   what influences subject and job choices (split by gender group), and a list
   of jobs students imagine doing.

**Teacher view** (`site/teacher.html`): a teacher picks a school and sees that
school's answers in detail. Schools with fewer than 5 students are hidden. This
is not a real login.

**Written answers** (`site/open-text.html`): a list of free-text answers that
you can filter by question, region and activity.

Results based on fewer than 5 people are always hidden and marked.

## Quick start

You need Node.js 18 or newer. This was tested with Node 24 on macOS.

```
git clone https://github.com/arsh-dang/Gals-Dashboard.git
cd Gals-Dashboard
npm run build
python3 -m http.server 8000 --directory site
```

Then open <http://localhost:8000> in a browser. You can also double-click
`site/index.html`. It works without a server.

`npm run build` reads the CSV files in `data/` and writes `site/data/*.js`. Run
it again whenever the CSVs change. It always changes a timestamp in
`site/data/meta.js`, so `git status` shows a few modified files after a build.
That is normal.

## Running the tests

The tests cover the data pipeline in `backend/`. They need Python 3.12.

```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m pytest backend/tests
```

Without the private survey file the result is `80 passed, 3 skipped`. The three
skipped tests need `backend/private/survey_v3.qsf`, which is not in this
repository. See `docs/MAINTAINER.md`.

## Where to read next

| If you want to... | Read |
|---|---|
| Understand what exists and how to do common jobs | `docs/HANDOVER.md` |
| Know what every data field means | `docs/DATA_DICTIONARY.md` |
| Change the code, or fix something fragile | `docs/MAINTAINER.md` |
| See what is still unclear | `docs/QUESTIONS_FOR_ARSH.md` |
| Read the database design and the "before real data" checklist | `docs/backend_design.md` |
| See the list of wording changes | `wording_review.md` |

## Licence and use

No licence file is in this repository. Ask the team before reusing the code.
