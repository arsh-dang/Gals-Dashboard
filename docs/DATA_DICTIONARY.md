# Data dictionary

This lists every field in the six CSV files, the database tables, and the files
the site reads. It was written from `data/reshape_v3.py`, `build/build.js`,
`backend/schema.sql` and the survey definition. Allowed values were checked
against the current mock data (`data/*.csv`). Question numbers (Q15, Q104 and so
on) are the Qualtrics question ids from the survey definition.

All the data here is synthetic. A response id in the mock data starts with `R_MK`.

## 1. Qualtrics quirks a maintainer needs to know

**Three header rows.** A Qualtrics export has three rows before the data. Row 1
is the column names (`Q15_1`). Row 2 is the question text. Row 3 is a small JSON
label (`{"ImportId": "Q15_1"}`). `reshape_v3.py` reads the file with the first row
as the header and drops the next two rows. Keep all three rows in any file you
give it.

**Two exports of the same answers.** The text export holds answers as words
("Yes a little"). The numeric export holds them as codes. You need both. The
loader refuses if their columns or response ids differ.

**Codes and scores.** In the survey, the codes for the 4-point questions run
1 = Yes a lot, 2 = Yes a little, 3 = Maybe, 4 = No, 5 = I do not know. The
dashboard wants higher to be better, so `score = 5 - code` (1 = No, 2 = Maybe,
3 = Yes a little, 4 = Yes a lot). "I do not know" (code 5) has a blank `score`.

**Choice ids.** Inside a question, each option has an id that is not the same as
the code. In the numeric export a multi-select answer is a list of these ids
(`4,5,11`). The ids are looked up in the survey definition to get the wording.

**Multi-select answers.** The text export joins the ticked labels with commas.
Some labels contain commas ("I do not like maths, science or technology
subjects"), so you cannot split the text on commas. `reshape_v3.py` reads the
choice ids from the numeric export instead. **One place still splits on commas:**
`n_activities` (see the respondents table).

**Piped text.** A question's wording can contain another answer, written as
`${q://QID1/ChoiceGroup/SelectedChoices}` (the region the person chose). Three
questions do this: Q88, Q96 and Q99. `reshape_v3.py` replaces that one
placeholder with "your area" so all rows have the same question label. Any other
`${...}` is left as written and the loader prints a warning.

**Display logic.** Most questions are only shown to some people. School
questions are not shown to post-school respondents. Activity questions are only
shown to people who picked that activity. A question that was not shown exports
as a blank cell. The reshape step skips blank cells. It does not try to work out
who should have seen a question. So "missing" usually means "not asked", not
"skipped".

**Activity questions are repeated once for each activity.** Each activity has its
own copy of the outcomes table, the skills question and the identity question.
`reshape_v3.py` (`BLOCKS`) maps them to one activity name, so the activity is a
value in a column, not part of a column name.

| Activity (from Q9) | Outcomes | Skills | Identity |
|---|---|---|---|
| School club or lunchtime activity | Q15 | Q16 | Q74 |
| Competitions | Q36 | Q37 | Q75 |
| Tech school programs | Q104 | Q46 | Q76 |
| University programs | Q54 | Q55 | Q77 |
| Girls as Leaders in STEM program | Q63 | Q64 | Q78 |
| Online STEM activities | Q105 | none | none |
| Excursions | Q106 | none | none |
| General (not an activity) | Q107 | none | none |

The activity name is the Q9 option text up to the first " (". "Other (please
specify)" (the eighth Q9 option) has no outcomes table in the mapping.

**Q45 is ignored.** Q45 looks like a second, single-choice copy of the Tech school
outcomes question. The real table is Q104. See `docs/HANDOVER.md`.

**Q107 is the "general" outcomes table.** The code treats it as shown to
everyone. The survey file says it is shown only to people who typed in the "Other
(please specify)" activity box. That is unresolved. See `docs/QUESTIONS_FOR_ARSH.md`.

**Free text.** Every text-entry question in the survey becomes a row in
`open_text.csv` when it is filled in. That includes the school name (Q4) and the
two "what job does adult 1 / adult 2 do" questions.

**Response ids.** A `ResponseId` is unique within one survey wave, not across
waves. In the database the key is always `(wave_id, ResponseId)`.

## 2. The six CSV files (`data/*.csv`)

The dashboard reads these. The database tables have the same columns, plus
`wave_id` and `row_seq` (see section 3). Booleans are written `True` or `False`.
Blank means no value.

### 2.1 `respondents.csv`: one row per person

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Qualtrics response id | text | `R_` followed by letters and digits | `ResponseId` (export metadata) |
| `StartDate` | When they started | text | `YYYY-MM-DD HH:MM:SS` | `StartDate` (export metadata) |
| `Finished` | Whether they finished the survey | True/False | `True`, `False` | `Finished` (export metadata) |
| `region` | Where they live | text | Ararat, Ballarat, Bendigo, Geelong, Gippsland, Warnambool (spelled as in the survey) | Q1 "Where do you live?" |
| `gender` | Gender they chose | text | Female, Male, Non-binary / third gender, Prefer not to say | Q2 "Are you:" |
| `language_other_than_english` | Whether they or family speak another language at home | text | Yes, No | Q7 |
| `birth_year` | Year of birth. The survey option is a year, one of 11 choices | whole number | 1900 to 2100 (mock data: 2008 to 2018) | Q73 "What year were you born?" |
| `is_school_student` | Currently at school | text | Yes, No | Q3 "Are you a school student?" |
| `school` | Name of their school. Free text. Should be blank for post-school respondents | text | any | Q4 "What is the name of your school?" |
| `school_level` | Year level. Should be blank for post-school respondents | text | Year 5 to Year 12, or blank | Q5 |
| `adult1_occupation` | What the first adult in the family does for work | text | 19 categories, for example "Healthcare, Nursing, & Medical Services", "Not sure", "Prefer not to say" | Q6 |
| `adult2_occupation` | Same, for an optional second adult | text | same 19 categories, often blank | Q111 |
| `activities_selected` | Activities they took part in | text | Q9 labels joined by commas. Labels contain commas, so do not split it | Q9 |
| `pathway` | Worked out: school student or not | text | School student, Post-school, Unknown | derived from `is_school_student`: Yes gives School student, any other value gives Post-school, blank gives Unknown |
| `n_activities` | Worked out: how many activities | whole number | 0 or more | derived from `activities_selected` by splitting on commas. **Wrong for many people** because some activity names contain commas. No chart uses it |
| `did_gals` | Worked out: took part in GALS | True/False | `True`, `False` | derived: True if the person has any outcomes row for "Girls as Leaders in STEM program" |

`build/build.js` ignores `school` and `school_level` for anyone whose
`is_school_student` is not Yes. It also ignores `birth_year`, the occupation
columns and `activities_selected`.

### 2.2 `activity_ratings.csv`: one row per person, activity and statement

This is the main table. The activity is a value in a column.

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Person | text | a `respondents` id | |
| `activity_type` | Which activity the statement was about | text | School club or lunchtime activity, Competitions, Tech school programs, University programs, Girls as Leaders in STEM program, Online STEM activities, Excursions, General STEM outcomes (not activity-specific) | Q9 option text (see the table in section 1) |
| `battery` | Which group of questions | text | `outcomes` (always) | fixed by `reshape_v3.py` |
| `item` | The statement | text | 12 statements, for example "More knowledgable about STEM" | the row labels of the outcomes table (Q15, Q36, ...) |
| `response` | The answer as words | text | Yes a lot, Yes a little, Maybe, No, I do not know | text export |
| `response_code` | The raw survey code | text | 1 = Yes a lot, 2 = Yes a little, 3 = Maybe, 4 = No, 5 = I do not know | numeric export. Kept for reference only |
| `score` | The answer as a score where higher is better | whole number | 1 to 4, or blank for "I do not know" | `5 - response_code` |
| `is_dont_know` | The answer was "I do not know" | True/False | `True`, `False` | text export |
| `source_column` | The export column this came from | text | for example `Q15_3` | export column name |

Three of the 12 statements appear in two wordings. The School club or lunchtime
activity block (Q15) uses one wording. The other blocks use the other.

| Other blocks | School club block (Q15) |
|---|---|
| More interested about learning about STEM | More interested in learning about STEM |
| More confident in communicating and sharing my ideas | More confident in sharing and communicating my ideas |
| More comfortable working in teams | More confident in working in teams |

### 2.3 `battery_selections.csv`: one row per option ticked

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Person | text | a `respondents` id | |
| `activity_type` | Activity | text | the five activities that have these questions (School club or lunchtime activity, Competitions, Tech school programs, University programs, Girls as Leaders in STEM program) | see section 1 |
| `battery` | Which question | text | `skills`, `identity` | Q16, Q37, Q46, Q55, Q64 (skills); Q74 to Q78 (identity) |
| `item` | The option ticked | text | skills: Communication, Creative thinking, Critical thinking, Design, Experimenting, Leadership, Problem solving, Responding flexibly to change, Teamwork. Identity: A STEM person, A designer, A good communicator, A leader, A problem solver, A team player | the option labels |
| `source_column` | The export column | text | for example `Q16` | export column name |

The skills question is "The activity helped me develop my skills in...". The
identity question is "The activity helped me to feel that other people saw me
as...".

### 2.4 `aspirations.csv`: one row per person and statement

The 10 statements in Q25 "Thinking about your future, how much do you agree with
the following statements?". Scoring is the same as in `activity_ratings.csv`.

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Person | text | a `respondents` id | |
| `item` | The statement | text | 10 statements, for example "A STEM job sounds like something I could do" | Q25 row labels |
| `response` | The answer as words | text | Yes a lotI, Yes a little, Maybe, No, I do not know. **"Yes a lotI" is a typo in the survey itself** (Q25 option 1). It appears in 516 rows | text export |
| `response_code` | Raw code | text | 1 to 5, as above | numeric export |
| `score` | Score, higher is better | whole number | 1 to 4, or blank | `5 - response_code` |
| `is_dont_know` | Answer was "I do not know" | True/False | `True`, `False` | text export |
| `source_column` | The export column | text | `Q25_1` to `Q25_10` | export column name |

### 2.5 `subject_career.csv`: one row per option picked

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Person | text | a `respondents` id | |
| `question_group` | Theme | text | Subject selection, Career aspirations | set in `reshape_v3.py` |
| `question` | Short name of the question. **The dashboard finds questions by this exact text** | text | the 13 names in the table below | set in `reshape_v3.py` (`MULTI_SETS`, `SINGLE_SETS`) |
| `item` | The option picked | text | the option wording | option labels |
| `multi_select` | Whether the person could pick more than one | True/False | `True`, `False` | |
| `source_column` | The export column | text | for example `Q21` | export column name |

| `source_column` | `question` | Group | Multi |
|---|---|---|---|
| Q20 | Subjects interested in studying in Year 11 or 12 | Subject selection | yes |
| Q21 | What helps decide which subjects to choose | Subject selection | yes |
| Q22 | Why choosing STEM subjects feels hard (current students) | Subject selection | yes |
| Q108 | Reasons for wanting to choose STEM subjects (current students) | Subject selection | yes |
| Q109 | Reasons they chose STEM subjects (looking back) | Subject selection | yes |
| Q110 | Reasons they did not choose STEM subjects (looking back) | Subject selection | yes |
| Q82 | What helped them decide to take those subjects (looking back) | Subject selection | yes |
| Q83 | Reasons they decided against STEM subjects (looking back) | Subject selection | yes |
| Q26 | What helps decide future plans (school students) | Career aspirations | yes |
| Q91 | What helps decide which jobs to do | Career aspirations | yes |
| Q89 | What would help to know more about STEM careers | Career aspirations | yes |
| Q90 | Do you think you will study STEM in the future? | Career aspirations | no |
| Q96 | How much do you know about local STEM jobs? | Career aspirations | no |

The dashboard uses Q20, Q21, Q26 and Q108 (four gender charts and the "STEM
activities and programs" influence chart). The others are in the file but not charted.

### 2.6 `open_text.csv`: one row per free-text answer

| Column | Meaning | Type | Allowed values | Source |
|---|---|---|---|---|
| `ResponseId` | Person | text | a `respondents` id | |
| `question` | The question wording, tidied to one line and cut at 120 characters | text | 19 different wordings, from 28 export columns, in the current data | the question text in the survey definition. Piped text is replaced (see section 1) |
| `source_column` | The export column | text | for example `Q28` | export column name |
| `response` | What the person typed | text | anything | text export |

The dashboard finds the "jobs" question by its exact text, "What kind of jobs do
you imagine you might do in the future?" (Q28). Some questions appear twice under
different columns, for example "What made you change your mind?" (Q30 and Q95).

Free text can hold personal detail. In the mock data it includes the school
name (Q4) and what adults do for work (Q101, Q103).

## 3. Database tables (`backend/schema.sql`)

The same design works on SQLite and PostgreSQL.

### 3.1 `survey_version`

| Column | Meaning | Type |
|---|---|---|
| `survey_version` | Version of the questionnaire, for example `v3`. Primary key | text |
| `description` | Free note | text |

### 3.2 `question_item`: the codebook

One row per exported column, built from the survey definition. Primary key
`(survey_version, source_column)`.

| Column | Meaning | Type |
|---|---|---|
| `survey_version` | Version | text |
| `source_column` | Export column, for example `Q15_3` or `Q16` | text |
| `question_id` | Question, for example `Q15` | text |
| `item_id` | Choice id inside the question, if any | text |
| `item_label` | Statement or option wording | text |
| `question_text` | Question wording (piped text replaced) | text |
| `question_type` | Qualtrics type: `MC`, `Matrix`, `TE` | text |
| `block` | The survey block | text |
| `scale` | `likert4_dk`, `multi_select`, `single_choice`, `free_text`, `matrix` | text |
| `battery` | `outcomes`, `skills`, `identity`, `aspirations`, or blank | text |
| `activity_type` | Activity it belongs to, or blank | text |
| `codebook_source` | `qsf` (from the survey definition) or `tidy` (worked out from the data, less detail) | text |

### 3.3 `survey_wave`: one row per loaded batch

| Column | Meaning | Type |
|---|---|---|
| `wave_id` | Short name you choose, for example `mock-2026-b`. Primary key | text |
| `survey_version` | Version used | text |
| `collection_start`, `collection_end` | Collection period | date, optional |
| `source_file` | File name only, never a full path | text |
| `date_loaded` | When it was loaded (UTC, ISO 8601) | text |
| `is_mock` | True only if the file was marked mock **and** every id starts with `R_MK` | True/False |
| `notes` | Free note | text |

Deleting a wave row deletes all of its data.

### 3.4 The six data tables

`respondents`, `activity_ratings`, `battery_selections`, `aspirations`,
`subject_career` and `open_text` have the columns in section 2, plus:

| Column | Meaning | Type |
|---|---|---|
| `wave_id` | Which wave. Foreign key to `survey_wave` | text |
| `row_seq` | Position in the source file, so the export keeps the order | whole number |

Differences from the CSV files:

- `Finished`, `did_gals`, `is_dont_know` and `multi_select` are true/false values.
- `birth_year`, `n_activities` and `score` are whole numbers, or empty (NULL).
- A blank cell in the CSV is empty (NULL) in the database.
- `score` must be 1 to 4 or empty. The database rejects anything else.

Keys: `respondents` has `(wave_id, ResponseId)`. The other five link to it with
`(wave_id, ResponseId)`, and each has a unique key on its natural columns (for
example `(wave_id, ResponseId, activity_type, source_column)` for
`activity_ratings`). That is why the loader rejects duplicates.

## 4. Files the site reads (`site/data/*.js`)

`npm run build` writes these from the CSVs. They are JavaScript, not JSON, so the
site works when opened from disk. They are built by `build/build.js`. Field names
are in camel case.

| File | Holds | Fields |
|---|---|---|
| `respondents.js` | one record per person | `id`, `region`, `gender`, `languageOtherThanEnglish`, `isSchoolStudent`, `school`, `schoolLevel`, `pathway`, `nActivities`, `didGals` |
| `ratings.js` | one per rating | `id`, `activityType`, `item`, `itemPairId`, `response`, `score`, `isDontKnow`, `region`, `school`, `schoolLevel`, `pathway` |
| `selections.js` | one per skill or identity pick | `id`, `activityType`, `battery`, `item`, `region`, `school`, `schoolLevel`, `pathway` |
| `aspirations.js` | one per aspiration rating | `id`, `item`, `score`, `isDontKnow`, `region`, `schoolLevel`, `pathway`, `didGals` |
| `subjectCareer.js` | one per option picked | `id`, `questionGroup`, `question`, `item`, `multiSelect`, `region`, `schoolLevel`, `pathway`, `didGals`, `gender` |
| `openText.js` | one per free-text answer | `id`, `question`, `sourceColumn`, `response`, `region`, `schoolLevel`, `pathway`, `activityTypes`, `theme` |
| `meta.js` | counts and settings the pages need | including `generatedAt`, `totalRespondents`, `smallCellThreshold`, `activityTypes`, `regions`, `schools`, `outcomeItems`, `scale`, `subjectChoice` |

Two things to know:

- These files contain every person's answers. Anyone who opens the site can read
  them. See "before real data" in `docs/HANDOVER.md`.
- `theme` in `openText.js` is filled from an optional file
  `data/open_text_themes.csv` (columns `ResponseId,question,theme`). That file does
  not exist yet, so every theme is empty.
