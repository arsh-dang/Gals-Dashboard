# Questions for Arsh

These are things that could not be worked out from the code, or that the code
contradicts. Each one says what was seen, why it matters and what is needed. The
numbers match the references in `docs/HANDOVER.md`.

Please answer before Friday if you can. The first seven matter most. The
numbers stay the same as in `docs/HANDOVER.md`, so they are grouped by topic and
not in order.

## Ownership and the survey file

**1. Who owns the repository, the Pages setting and the Netlify site?**
- Seen: the remote is `github.com/arsh-dang/Gals-Dashboard`, a personal account.
  The workflow needs Settings, Pages, Source set to "GitHub Actions". The HTML
  preview tags and `og-image` still point at `galsdashboard.netlify.app`.
- Matters: when you leave, the team may lose the ability to change or even see the
  live site.
- Need: who can push, who can change Pages settings, whether the repository will
  move to a team or Deakin account, and whether the Netlify site is still running
  and should be switched off. The reason given for leaving Netlify was that it was
  not picking up builds. That came from you, not the code. Please confirm.

**2. Which generator made `data/raw/`?**
- Seen: running `generate_mock_v3.py 200` from the repository gives different data
  from `data/raw/`:
  - about 57% of people took part in GALS, against 32.5% in `data/raw/`;
  - Q20 and Q21 have no answers at all, so the subject-interest and subject-choice
    charts would be empty (four tests then fail);
  - two runs in a row give different data, although the script sets
    `SEED = 20260817`. 194 of 241 columns differed.
- Matters: the mock data cannot be recreated or extended.
- Need: the version of the generator (and the command) that made `data/raw/` and
  the first mock dataset, added to the repository. The same goes for whatever
  script produced the first `data/*.csv`, which the old `reshape_v3.py` also did
  not match (its labels and comma handling were out of date).

**3. Is Q107 shown to everyone, or only to people who typed in "Other"?**
- Seen: the code and its comments treat Q107 as a "general" outcomes table shown
  to everyone. The survey file gives Q107 display logic "Q9 option 8 (Other),
  text response is not empty". That would show it only to people who typed an
  "Other" activity. In the mock data 179 of 200 answered it.
- Matters: the "General STEM outcomes" card may mean something different in the
  real survey.
- Need: what Q107 is meant to be, and whether the survey file is up to date.

**4. Can `survey_v3.qsf` go in the repository?**
- Seen: it is git-ignored because a supervisor has not yet confirmed it can be
  public. Without it the team cannot load a raw export, and three tests skip.
- Need: a decision, and where the team should keep it in the meantime. Its name
  inside is "SIT PILOT". Is v3 the final version, or a pilot that will change?

**5. Where did the first mock dataset come from?**
- Seen: the first 200 mock respondents (now `backend/tests/fixtures/mock_wave_a/`)
  are a different draw from `data/raw/`. No script in the repository produced
  them.
- Need: only to know if it matters. It is used as a test fixture and nothing else.

## Decisions that are not written down

**6. Why is the suppression threshold 5, and who approved it?**
- Seen: 5 is in `build/build.js`, `backend/export_rules.yaml` and in wording on the
  pages. No document gives the reason.
- Need: the source of the rule (ethics office, a Deakin standard, convention) so the
  next person can defend or change it.

**7. Ethics approval and where real data may live.**
- Seen: the banner says the real survey is waiting for Deakin ethics approval.
- Need: the approval status and reference, the name of the Deakin IT contact, and
  which system real data may be stored on. Nothing in the code answers this.

## Survey questions

**8. Q45 in the Tech school block.**
- Seen: Q45 is a single-choice copy of the Tech school outcomes question, with the
  answer options as its choices. It has the same display logic as Q104 (the real
  table). In the mock data 60 people answered both. The reshaper ignores Q45.
- Need: is Q45 in the live survey? If it is, do people answer it and Q104? It
  should probably be removed from the survey.

**9. Are "comfortable working in teams" and "confident in working in teams" the
same statement?**
- Seen: three outcome statements exist in two wordings. Two pairs differ only in
  word order. This one uses different words. The code treats it as one statement
  (`ITEM_WORDING_PAIRS` in `build/build.js`). Only the School club block uses
  "confident".
- Need: a decision from whoever owns the survey design.

**10. Should the wording pairs be merged?**
- Seen: a comment in `build/build.js` says they can be merged "by flipping
  `MERGE_DUPLICATE_ITEMS`". No such setting exists anywhere in the code.
- Need: whether merging is wanted. It would be new work.

**11. Is "one activity per chart" still a design rule?**
- Seen: one comparison per chart was built (commit `03f869d`) and then reversed
  (`3896c9c`) because the charts were too simple. The dashboard now shows all
  activities together. Phones also get a "One activity" button.
- Need: confirmation that the current design is the one to keep, so the team does
  not redo the simplification.

**13. Typos and inconsistencies in the survey itself.**
- Seen: Q25's first answer is "Yes a lotI" (516 rows). Others: "Advise" for
  "advice", "Other (please specfiy)", "advisors" and "advisers" in the same
  question set, "knowledgable", "interested about learning", and the region
  "Warnambool" (a school in the same data is "Warrnambool West PS").
- Matters: the dashboard shows survey wording as asked, so these appear on the
  live site.
- Need: whether the survey can be corrected. If it is, `build/build.js` and
  `data/reshape_v3.py` must change with it, or charts empty.

**17. Identity wording (fixed, please confirm).**
- Seen: the identity question asks "The activity helped me to feel that other
  people saw me as...". An earlier plain-language rewrite called it "How I see
  myself", which said something different.
- Done: the button now reads "How others saw them", the section heading is
  "Skills, and how students felt others saw them", and the card title is "How did
  students feel others saw them after taking part, by activity?".
- Need: confirmation that this wording is right.

**21. What happens to people who choose "Other (please specify)" as an activity?**
- Seen: Q9 option 8 has no outcomes table in the reshaper. There are no such
  people in the mock data.
- Need: how the real survey routes them, and whether the dashboard should show
  them.

## Data and code problems found

**12. Is loading the fonts from Google acceptable?**
- Seen: `site/css/tokens.css` imports Open Sans from `fonts.googleapis.com`. Every
  visitor's browser contacts Google. The project says "no analytics", which is
  true, but this is still an outside request.
- Need: a decision. The fix is to save the font file in `site/vendor/`. That has
  not been done.

**14. Why do post-school respondents have a school name in the mock data?**
- Seen: 45 of 49 do, and 38 also have a year level. The "school" is a sentence
  from a free-text answer. The dashboard ignores it and the loader warns.
- Need: the cause in the generator, if you know it. It looks like free-text
  answers being written into the school-name column.

**15. Should `n_activities` be fixed?**
- Seen: it is worked out by splitting the activity list on commas, but some
  activity names contain commas. 115 of 200 values are too high (largest stored 8,
  largest real 4). No chart uses it.
- Need: a decision. Fixing it changes `data/reshape_v3.py`, and the saved reference
  output would have to change with it.

**16. Should school names be removed from the free-text export?**
- Seen: `open_text` contains the school-name question (Q4, 196 rows) and the two
  "what job does adult 1 / 2 do" questions. `backend/export_rules.yaml` drops the
  job questions in suppressed mode, but not the school name. So a school that was
  hidden in the respondents file is still named in the open-text file.
- Need: a decision, and the same for the Written answers page, which shows every
  question.

**18. Preview links and the icon script.**
- Seen: page preview tags (`og:url`, `og:image`) use the Netlify address.
  `scripts/generate-icon-assets.js` still holds the old preview text and would
  overwrite the corrected `site/og-image.png`.
- Need: the address the previews should use, and permission to update the script.

**19. Is the contact address real?**
- Seen: every page footer says `stem-impact-tracker@deakin.edu.au (placeholder)`.
- Need: a real address, or removing it.

**20. What should stay in the repository?**
- Seen: `wording_review.md` at the top (its numbers are stale), the `.claude/`
  folder (helper files for a coding tool; its data contract is out of date; one
  stray folder named `{scripts,references}`), and two reference files in `data/`
  (a style guide PDF and a Tableau workbook).
- Need: which to keep, move to `docs/`, or delete.

**22. How should teachers sign in?**
- Seen: the Teacher view has a school drop-down and no login. This is stated on
  the page.
- Need: what real access should look like, for the real-data plan. This depends on
  Deakin IT and ethics (questions 6 and 7).
