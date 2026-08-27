# Data contract

The dashboard reads four CSVs produced by `reshape_v3.py` from a Qualtrics
export. Do not read the raw export directly: it has each activity's battery in
separate columns, which makes cross-activity comparison impossible without
rebuilding the same chart five times.

## respondents.csv

One row per person.

| Column | Notes |
|---|---|
| `ResponseId` | Primary key |
| `StartDate`, `Finished` | Response metadata |
| `region` | One of six regional Victorian areas |
| `gender` | |
| `birth_year` | A dropdown label, not a number. Do not do arithmetic on it |
| `is_school_student` | Yes / No — drives which pathway questions were shown |
| `school`, `school_level` | Blank for post-school respondents |
| `adult1_occupation`, `adult2_occupation` | Coded categories; adult2 often blank |
| `activities_selected` | Comma-separated codes |
| `pathway` | Derived: School student / Post-school / Unknown |
| `n_activities` | Derived count |

## activity_ratings.csv

One row per person × activity × outcome item. **This is the table that makes the
dashboard possible** — activity type is a value here, not a column name.

| Column | Notes |
|---|---|
| `ResponseId` | Join key |
| `activity_type` | One of eight |
| `battery` | "outcomes" |
| `item` | The outcome statement |
| `response` | Label, e.g. "Yes a little" |
| `response_code` | 1–5 |
| `is_dont_know` | TRUE where the answer was "I do not know" |

## battery_selections.csv

One row per ticked item. Skills and identity are multi-select, so they are
frequencies, not averages.

| Column | Notes |
|---|---|
| `ResponseId`, `activity_type` | |
| `battery` | "skills" or "identity" |
| `item` | The selected item |

## open_text.csv

| Column | Notes |
|---|---|
| `ResponseId`, `question`, `source_column`, `response` | |

---

## The scale, and why it needs care

Responses run: **1 Yes a lot · 2 Yes a little · 3 Maybe · 4 No · 5 I do not know**

Three consequences:

**Lower is better.** 1 is the most positive answer. Any average therefore reads
backwards to a normal person. Either invert for display (`5 - score`) or label
axes explicitly. Never show a raw average without saying which direction is good.

**Position 5 is not part of the scale.** "I do not know" is a non-answer sitting
after the ordered options. Exclude it from every average. Including it would
drag results toward "worse" purely because someone was unsure.

**Report the unknown rate.** An item where a third of people answered "I do not
know" should not look like consensus. Surface the rate wherever it is material.

## Missing data is mostly structural

The survey branches heavily. Respondents only see batteries for activities they
selected, and the school and post-school paths ask different questions. So most
blank cells mean "not shown", not "declined to answer".

Never present completion rates against the full respondent count. Calculate
within the group actually shown the question, or the dashboard will report a
data quality problem that does not exist.

## Small cells

Region × school level × activity produces combinations with very few
respondents. The population is school-age children, so suppress groups under
five rather than displaying them, and show a "suppressed" badge so the omission
is visible rather than silent.
