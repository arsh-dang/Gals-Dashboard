# Wording review: STEM Impact Tracker dashboard

Status: **all rows applied** (approved as a whole), with the changes noted in the summary below. Suppressed results are worded "hidden for privacy" throughout, not "suppressed".

Original status: proposal only. Review each row, then reply with the IDs you approve, reject or want changed (for example "approve all except P12, A6 change to …").

Scope covered: `site/index.html`, `site/teacher.html`, `site/open-text.html`, `site/site.webmanifest`, `site/og-image.png`, `site/js/main.js`, `teacher-main.js`, `open-text-main.js`, `summary.js`, `utils.js` (incl. `LABEL_OVERRIDES`), every file in `site/js/charts/`, and the labels generated in `build/build.js`. I also read the CSV data to check what gender, region and answer values respondents actually have.

**Reason codes** (your seven categories): **1** gender assumptions, **2** gender category labels, **3** deficit framing, **4** background assumptions, **5** readability, **6** consistency, **7** accessibility of wording.

---

## 0. House style used in the proposals

Approve or change these first, because most rows follow from them.

| Ref | Decision | Why |
|---|---|---|
| G1 | **"program", not "programme".** Keep the proper name "Girls as Leaders in STEM program" exactly as it is. | Australian standard spelling is "program". The dashboard currently mixes both (27 uses of "programme"/"program"). |
| G2 | **"people who answered"** instead of "respondents". Use "students" only where the count is school students. | "Respondents" is survey jargon. Also, 33 of the 200 are post-school, so "students" is not always accurate. |
| G3 | **"activity"** for the seven activity types (not "activity type", "programs", "programmes"). | One name for one thing. |
| G4 | **"year level"** (not "school year" or "year"). | "This year" in the teacher summary currently reads as a calendar year. |
| G5 | Hidden small groups are called **"suppressed for privacy (fewer than 5 people)"**. Never "missing", "other" or "n<5". | Explains the reason in plain words. |
| G6 | Technical terms are replaced on the page and kept in the tooltip: **n** becomes "people", **95% CI** becomes "likely range", **Diff** becomes "Difference". | Audience is teachers, families and funders. |
| G7 | **"GALS"** is expanded on first use in each page section that uses it: "Girls as Leaders in STEM (GALS)". | Families will not know the acronym. |
| G8 | Gender groups use the **respondents' own labels** in one fixed order: Female, Male, Non-binary / third gender, Prefer not to say. | Currently ordered by group size in `meta.js`, and charts show only Female and Male. |

---

## 1. All pages: head, banner, navigation, footer

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| A1 | index.html | `<title>` | STEM Impact Tracker: Provider view | STEM Impact Tracker: Program overview | 5 (jargon), 6 |
| A2 | index/teacher/open-text.html | `meta description`, `og:description`, `twitter:description` (9 tags) | Prototype dashboard built on synthetic data for Deakin University's School of Education. Not a live reporting tool. | A prototype from Deakin University's School of Education showing how survey results about students in STEM activities could be reported. All numbers are made-up test data. | 5 |
| A3 | all three pages | `og:title`, `twitter:title` (6 tags) | STEM Impact Tracker - prototype dashboard (mock data) | STEM Impact Tracker: prototype with made-up data | 5, 6 (matches the `<title>` colon style) |
| A4 | og-image.png | text in image | Prototype dashboard (mock data) / Built on synthetic data for Deakin University's School of Education. Not a live reporting tool. | Prototype with made-up data / A prototype from Deakin University's School of Education. Not a live reporting tool. **(image needs regenerating)** | 5 |
| A5 | site.webmanifest | `description` | Prototype dashboard built on synthetic data for Deakin University's School of Education. | A prototype from Deakin University's School of Education. All numbers are made-up test data. | 5 |
| A6 | index.html | mock banner | Every number on this page is synthetic test data generated to build this dashboard. Real survey collection is pending Deakin ethics approval. Nothing here describes an actual programme or participant. | Every number on this page is made-up test data used to build the dashboard. The real survey has not started: it is waiting for Deakin ethics approval. Nothing here describes a real program, student or school. | 5, 6 (program) |
| A6b | teacher.html | mock banner, last sentence | Nothing here describes an actual student or school. | Nothing here describes a real student or school. | 5 |
| A6c | open-text.html | mock banner, last sentence | Nothing here describes an actual respondent. | Nothing here describes a real person who answered. | 5, 6 |
| A7 | all three pages | nav link | Provider view | Program overview | 5 |
| A7b | all three pages | nav link | Open-text responses | Written answers | 5 |
| A8 | index.html | banner subtitle | Provider view: participation and outcomes across STEM activities | Program overview: who took part in STEM activities and what students reported | 5, 7 |
| A8b | teacher.html | banner subtitle | Teacher view: your own school's cohort, in more detail | Teacher view: your school's students, in more detail | 5 (cohort) |
| A8c | open-text.html | banner subtitle | Open-text responses: filterable list, not charted | Written answers: a list you can filter, not a chart | 5 |
| A9 | teacher/open-text.html | home icon `title` and `aria-label` | Provider view (home) | Program overview (home) | 6 |
| A10 | all three pages | footer card heading | Data notes | About this dashboard | 6 (the icon that links here already says "About this dashboard") |
| A11 | index.html | Data notes bullet 2 | Groups of fewer than 5 respondents are suppressed and marked, never silently dropped. | To protect privacy, results based on fewer than 5 people are suppressed and marked. They are never quietly left out. | 5, G5 |
| A11b | index.html | Data notes bullet 3 | The scale runs 1 = No to 4 = Yes a lot; higher is better. | Answers are scored from 1 (No) to 4 (Yes a lot). A higher score means a more positive answer. | 5 |
| A11c | index.html | Data notes bullet 1 | All figures on this page are synthetic test data, generated to build the dashboard. Real survey collection is pending Deakin ethics approval. | (Same as A6, shortened) All numbers here are made-up test data. The real survey is waiting for Deakin ethics approval. | 5 |
| A11d | index.html | new Data notes bullet (**addition**) | (none) | GALS is the Girls as Leaders in STEM program, which is for girls. Results labelled "GALS" are about people who took part in that program. Other results include students of every gender. | 1, 5 |
| A12 | teacher.html | Data notes bullet 1 | School cohorts in this mock dataset are small, and most are well under the suppression threshold. Real collection may look different; this view is a first pass pending actual teacher feedback on what's useful. | Most schools in this made-up data have only a few students, so many results are suppressed. Real results may look different. This page is a first draft, and we want teachers' feedback on what is useful. | 5, 3 |
| A12b | teacher.html | Data notes bullet 2 (raw `school` / `school_level` values, "data contract", "reshape script", "7 rows, up from 1") | (long technical note) | **Remove from the public page and keep in README.** It is a note to the developers, not to teachers or families. | 5 |
| A12c | teacher.html, open-text.html | Data notes bullet (colours, `site/css/tokens.css`) | Colours follow the real Deakin Dashboard Style Guide (Nov 2025); see site/css/tokens.css for sourcing notes. | **Remove from the public page** (already in README). | 5 |
| A13 | utils.js:449 | footer date (`renderFooterDate`) | Data snapshot: 2026-09-21 | Data last updated: 21 Sep 2026 | 5 (Australian date format, plain words) |
| A14 | all three pages | footer | Contact: stem-impact-tracker@deakin.edu.au (placeholder) | No wording change. **Reminder:** the address and "(placeholder)" label need replacing before real use. | n/a |

---

## 2. Provider page (`index.html`, `main.js`, `summary.js`)

### 2a. Snapshot, filters, summary

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P1 | main.js:47-50 | KPI tiles | Respondents / Regions / Activity types / Schools represented | People who answered / Regions / Activities / Schools | 5, 6 |
| P1b | index.html:65 | KPI row `aria-label` | Sample snapshot | Survey at a glance | 5 |
| P2 | index.html:75-77 | school year filter | School year / All years (incl. post-school) | Year level / All year levels (including people who have left school) | 6 (G4), 4 |
| P2b | main.js:155,157 | filter status | Showing all 200 respondents / Showing 40 of 200 respondents | Showing all 200 people who answered / Showing 40 of 200 people who answered | 5, 6 |
| P3 | summary.js:138 | provider summary, gap found | Across 200 respondents, X scores higher than the rest of the programme on "…" (+0.31). | Across 200 people who answered, X scored higher than the other activities on "…" (0.31 points higher, out of 4). | 5, 6, 3 ("rest of the programme" wrongly treats GALS and the others as one program) |
| P3b | summary.js:139 | provider summary, no gap | Across 200 respondents, no activity's outcomes are distinguishable from the rest of the programme - differences seen are within what this sample size can support. | Across 200 people who answered, no activity stood out from the others. Any differences are too small to tell apart from chance with this many people. | 5 |

### 2b. Section 1: participation

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P4 | index.html:99 | section heading | Participation overview | Who took part | 5 |
| P5 | index.html:104-105 | card title / subtitle | How many respondents took part in each activity? / Respondent counts by activity type, sorted highest to lowest. | How many people answered about each activity? / Number of people who answered about each activity, from most to fewest. Many people took part in more than one activity, so the bars overlap. | 5, 6; also adds a missing caveat |
| P5b | index.html:111-112 | card note | Participation is broadly comparable across all seven activities; GALS is narrowly the largest. A general, non-activity-specific question appears separately in the Outcomes section below. | Similar numbers of people answered about each of the seven activities. GALS has slightly the most. A general question that is not about one activity is shown separately below. | 5, 6 |
| P6 | index.html:119-120 | card title / subtitle | Where do school-student respondents come from? / Respondent count by region and school year, school students only. | Which regions and year levels are the students from? / Number of school students who answered, by region and year level. | 5, 6 |
| P6b | index.html:129-130 | card note | Cells under 5 respondents are suppressed and marked, not dropped. Only Geelong has usable numbers across most year levels; read other regions as indicative. | Results for fewer than 5 people are suppressed for privacy and marked. Geelong has the most responses, so its results are the most complete. Other regions have fewer, so more of their results are hidden. Read those as a rough guide. | 3, 4 (regional students framed as "unusable"), 5, G5 |
| P7 | participation.js:147 | grid corner label | Region \ Year | Region / Year level | 5, 6 |
| P7b | participation.js:154 | grid column header | "Yr 5" | "Year 5" (or keep "Yr" visually and add `aria-label="Year 5"`) | 7 |
| P7c | participation.js:186 | grid cell badge | n=0 / n<5 | 0 / <5 (tooltip says "Suppressed for privacy: fewer than 5 people") | 5, G5, G6 |
| P7d | participation.js:200-208, 188 | grid tooltip and `aria-label` | Suppressed: fewer than 5 respondents | Suppressed for privacy: fewer than 5 people | 5, G5 |
| P7e | participation.js:103,105 | bar `aria-label` and tooltip | Sorted horizontal bar chart of respondent count by activity type (chart label); "X: 72 respondents" | See A-section alt text (AL1). Tooltip: "X: 72 people" | 5, 7 |
| P7f | participation.js:243 | region list total | 57 students | 57 students (no change) | n/a |
| P7g | participation.js:251 | empty state | No school-year respondents recorded for this region in the current filter. | No school students from this region match the current filters. | 5 |

### 2c. Section 2: outcomes by activity

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P8 | index.html:140 | section heading | Outcomes by activity | What students reported, by activity | 5 |
| P9 | index.html:142-144 | chart type buttons | Dot plot / Small multiples / Distribution | Compare activities / One panel per activity / Spread of answers (each button also gets a `title` with the chart-type name) | 5 (jargon) |
| P9b | index.html:147 | phone-only button | One activity | One activity (no change) | n/a |
| P10 | index.html:152 | card title | Which outcomes do participants report most positively, by activity? | Which results are most positive for each activity? | 5 |
| P10b | index.html:154, main.js:208 | subtitle, dot plot mode | Average score per activity on the survey's 1–4 scale (4 = Yes a lot is best; "I do not know" excluded). | Average score for each activity, from 1 (No) to 4 (Yes a lot). Higher is more positive. "I do not know" answers are left out. | 5 |
| P10c | main.js:209 | subtitle, small panels | Average score per outcome, one panel per activity, with outcomes in the same order in every panel. | Average score for each statement, with one panel per activity. Statements are in the same order in every panel. | 5 |
| P10d | main.js:210 | subtitle, distribution | Share of respondents giving each answer, per activity; "I do not know" is shown separately, outside the 100%. | Share of people giving each answer, for each activity. "I do not know" is shown separately and is not part of the 100%. | 5, 6 |
| P10e | main.js:213 | subtitle, one activity | Average score for the selected activity, on the survey's 1–4 scale, sorted best to worst. | Average score for the chosen activity, from 1 (No) to 4 (Yes a lot), highest to lowest. | 5, 3 ("best/worst" applied to students' answers) |
| P11 | index.html:163-166 | outcomes note | Faint lines are 95% confidence intervals: activities sit close together, so read a gap alongside its interval, not instead of it. "≈" flags an item that appears twice with near-identical wording; "×" marks a cell suppressed for fewer than 5 respondents. | The faint line on each dot shows the likely range for that average (a 95% confidence interval). Activities score close together, so when two lines overlap the difference may not be real. "≈" marks a statement asked in two similar wordings. "×" marks a result suppressed for privacy (fewer than 5 people). | 5, 7 (explains marks in words), G5 |
| P11b | outcomes.js:83,134 | row tag | ≈ wording variant of another row | ≈ Also asked in a similar wording (see the matching row) | 5 |
| P11c | outcomes.js:494 | distribution note | Centred on the Maybe / Yes a little midpoint; excludes "I do not know" from the 100% | Bars line up at the point between "Maybe" and "Yes a little", so you can see how many answered more or less positively. "I do not know" is not counted in the percentages. | 5 |
| P12 | index.html:181-185 | general outcomes card | General STEM outcomes (not activity-specific) / A separate question asked of everyone, not tied to any one activity - shown on its own rather than as an 8th activity above. | General STEM results (not about one activity) / A separate question asked of everyone. It is shown here on its own, not as an eighth activity. | 5, 6 |
| P12b | index.html:190 + main.js:236 | card note | Same scale and confidence intervals as above. n=177 in the current filter. | Same scoring and likely ranges as above. 177 people answered. | 5, G6 |
| P12c | build.js:12, meta.js | generated label `GENERAL_ACTIVITY_TYPE` | General STEM outcomes (not activity-specific) | General STEM results (not about one activity) | 5, 6 |

### 2d. Section 3: skills and identity

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P13 | index.html:200 | section heading | Skills and identity | Skills and how students see themselves | 5 |
| P13b | index.html:203 | toggle button | Identity | How I see myself (button) | 5 |
| P14 | index.html:208 | card title, skills | What skills do participants say they built, by activity? | What skills do students say they built, by activity? | 6 |
| P14b | main.js:308 | card title, identity | How do participants describe themselves after taking part, by activity? | How do students describe themselves after taking part, by activity? | 6 |
| P14c | index.html:210 | subtitle | Percentage of each activity's participants selecting each option (multi-select, so not an average). | Share of the students in each activity who picked each option. Students could pick more than one, so the shares can add up to more than 100%. | 5 |
| P14d | index.html:216-217 | note | Excursions, Online STEM activities and the general-outcomes block didn't ask these questions (a survey branch, not missing data), so they're not shown here. | Students in Excursions and Online STEM activities were not asked these questions, and neither were they asked in the general question. They are left out here on purpose. Nothing is missing. | 5 |
| P14e | main.js:295,299 | empty state | Skills and identity data is not available in this data drop / battery_selections.csv is missing from the current data drop (the script that produces it needs a survey definition file …) | This information is not available yet. (Keep the file names in the README.) | 5 |
| P14f | skills.js:37,86 | suppression text | Suppressed: n<5 / suppressed (n<5) | Suppressed for privacy (fewer than 5 people) | G5, G6 |
| P14g | skills.js:95,96 | bar tooltip and `aria-label` | X% of Activity participants (n=12 of 60) | X% of people in Activity (12 of 60) | 5, G6 |

### 2e. Section 4: regions

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P15 | index.html:226 | section heading | Regional comparison | Comparing regions | 5 |
| P16 | index.html:230-232 | title / subtitle | How do outcomes compare across the six regions? / Average score per region, same scale as Outcomes above. | How do results compare across the six regions? / Average score for each region, scored the same way as above. | 5 |
| P16b | index.html:240-241 | note | Same confidence-interval reasoning as Outcomes above. "×" marks a cell suppressed for fewer than 5 respondents; most regions outside Geelong will show several. | The faint lines show likely ranges, as above. "×" marks a result suppressed for privacy (fewer than 5 people). Regions other than Geelong have fewer responses, so more of their results are suppressed. | 3, 4, 5, G5 |
| P16c | build data | region label "Warnambool" | Warnambool (also appears in the region filter, legends and tables) | Warrnambool (the town is spelled with two r's; the school in the same data is "Warrnambool West PS"). Fix in the source data or add a display override. **Please confirm where the typo comes from.** | 6 |

### 2f. Section 5: aspirations and subject choice

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P17 | index.html:251 | section heading | Aspirations and subject choice | Future plans and subject choice | 5 |
| P18 | index.html:255-257 | title / subtitle | Does taking part in GALS shift how girls see their future in STEM? / Compares GALS participants to everyone else, item by item, on the same scale as Outcomes above. | Do people who took part in GALS see their future in STEM differently? / Compares people who took part in Girls as Leaders in STEM (GALS) with people who did not, one statement at a time. Both groups are scored the same way as above. | 1 (the comparison group includes boys and non-binary students, so "girls" is wrong), 5, G7. Also drops the causal word "shift": this survey is a snapshot, not before-and-after. |
| P18b | index.html:265-267 | note | "Diff" is the GALS average minus the everyone-else average; in this mock data it's small and mixed in direction, which is expected. "×" marks a group/item suppressed for fewer than 5 respondents. | "Difference" is the GALS average minus the average for people who did not take part. In this made-up data the differences are small and go both ways. "×" marks a result suppressed for privacy (fewer than 5 people). | 5, 6 |
| P18c | aspirations.js:176, :167 | column heading and its tooltip | Diff / Difference: GALS average minus everyone-else average, on the raw 1-4 scale. Read this alongside the confidence intervals, not instead of them. | Difference / GALS average minus the average for people who did not take part, on the 1 to 4 scale. Check it against the likely ranges before reading anything into it. | 5, G6 |
| P18d | main.js:377-378, aspirations.js:151-152 | legend and dot labels | Took part in GALS (n=61) / Did not take part in GALS (n=139) | Took part in GALS (61 people) / Did not take part in GALS (139 people) | 5, G6 |
| P18e | main.js:385, influences.js:248 | table group and chart row label | Not GALS / "Subject choice - Not GALS" | Did not take part in GALS / "Subject choice - did not take part in GALS" | 3 ("Not GALS" frames non-participants as a lack), 6 (legend already says "Did not take part") |
| P18f | main.js:395 | table column | Aspiration statement | Statement | 5 |

**Gender split cards.** Four cards share the same pattern. Facts checked in the data: 125 Female, 62 Male, 6 Non-binary / third gender, 7 Prefer not to say; every GALS participant (61) is Female.

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P19 | index.html:277-278 | subject choice subtitle | Compares which influences matter more to female versus male students. Each bar splits into a female and male segment, sized to that gender's own percentage (multi-select, so these don't sum to 100%). | Compares what influences students who answered Female and students who answered Male. Each bar has one segment for each group, sized to that group's own percentage. Students could pick more than one option, so percentages do not add to 100%. | 1, 2, 5 |
| P19b | index.html:285-287 | note | Mock data only, not a result - and since every GALS participant is female, part of any gender gap here is a GALS-participation gap. A segment under 5 respondents shows "suppressed". | Made-up data only, not a result. Every GALS participant is Female, so part of any gap between the two groups may come from taking part in GALS. Groups with fewer than 5 people are suppressed for privacy. | 1, 5, G5 |
| P19c | index.html:296-297 | career subtitle | Compares which influences on future plans matter more to female versus male students. A separate question from subject choice above; segment length is each gender's own percentage (multi-select). | Compares what influences future plans for students who answered Female and students who answered Male. This is a separate question from subject choice above. Each segment is that group's own percentage. | 1, 2, 5 |
| P19d | index.html:303-305 | note | Mock data only, not a result - female includes all GALS participants, so part of the gap reflects programme participation. A segment under 5 respondents shows "suppressed". | Made-up data only, not a result. Everyone who took part in GALS answered Female, so part of any gap may come from GALS. Groups with fewer than 5 people are suppressed for privacy. | 1, 5, 6 |
| P19e | index.html:333-334 | subject interest subtitle | Compares subject interest between female and male students; segment length is each gender's own percentage (multi-select). | Compares subject interest between students who answered Female and students who answered Male. Each segment is that group's own percentage. | 1, 2, 5 |
| P19f | index.html:340-341, 358-359 | notes (2 cards) | Mock data only; female includes all GALS participants, so part of the gap reflects programme participation. | Made-up data only. Everyone who took part in GALS answered Female, so part of any gap may come from GALS. | 1, 5, 6 |
| P19g | influences.js:67-68 | legend | Female (n=125) / Male (n=62) (no swatch-independent cue) | Female (125 people) / Male (62 people). Legend stays text plus swatch, so colour is never the only cue. | 2, 5, G6 |
| P19h | influences.js:83 | small-group badge and note | [Suppressed] Non-binary / third gender (n=4), Prefer not to say (n=5): too few respondents to break down, not excluded from the survey. | Not shown separately (suppressed for privacy): Non-binary / third gender (4 people), Prefer not to say (5 people). Groups this small could identify individuals. Their answers are still part of the survey. | 2, 5, G5 (**see D1: the current badge is applied even when a group has 5 or more people**) |
| P19i | influences.js:188 | in-chart text | Female suppressed (n<5) | Female: suppressed for privacy (fewer than 5 people) | G5 |
| P19j | influences.js:142 | chart `aria-label` | Bar chart of percentage of respondents selecting each option, one bar per option split into a female segment and a male segment placed end to end; … | See AL3 (alt text that states the main point). | 1, 7 |
| P19k | influences.js:203,204 | segment tooltip and `aria-label` | Female, Label: 41% (n=12 of 30) | Female, Label: 41% (12 of 30 people) | 5, G6 |
| P20 | index.html:275, 294 | card titles | What helps students decide which subjects to choose? / What helps students decide what they might do in the future? | (no change: they say what the chart shows) | n/a |
| P21 | index.html:312 | card title | Do the STEM activities and programmes themselves shape these decisions? | How often do students name STEM activities and programs as an influence? | 5, 6, 7 (asks a cause-and-effect question the chart cannot answer) |
| P21b | index.html:315-316 | subtitle | How often "STEM activities and programmes" itself was picked as an influence, GALS participants versus everyone else. | How often students picked "STEM activities and programs" as an influence, comparing people who took part in GALS with people who did not. | 5, 6 |
| P21c | index.html:322-323 | note | Mock data only, not a result - real data may show a smaller gap, no gap, or one in the other direction. A group under 5 respondents shows "suppressed". | Made-up data only, not a result. Real data may show a smaller gap, no gap, or a gap the other way. Groups with fewer than 5 people are suppressed for privacy. | 5, G5 |
| P21d | influences.js:330 | tooltip | 34% picked STEM activities/programmes as an influence (n=…) | 34% picked STEM activities and programs as an influence (… of … people) | 6 |
| P21e | build.js:44 | generated label `PROGRAMME_INFLUENCE_LABEL` | STEM activities and programmes | STEM activities and programs | 6 (G1) |
| P22 | index.html:331 | card title | Which subjects are students interested in for Year 11 or 12? | (no change) | n/a |
| P23 | index.html:348 | card title | Why choose STEM subjects? (belonging and confidence) | Why do students want to choose STEM subjects? Belonging and confidence | 5, 7 |
| P23b | index.html:351-352 | subtitle | Compares how female and male students see their own belonging and ability in STEM subjects (not what influences a choice - hence the different tint). Segment length is each gender's own percentage. | Compares how students who answered Female and students who answered Male see their own belonging and ability in STEM subjects. This is about how they see themselves, not what influences a choice. It uses a different colour so you can tell the two apart at a glance. Each segment is that group's own percentage. | 1, 2, 5, 7 (colour alone should not carry the distinction; the title now does) |
| P24 | index.html:367-376 | jobs card title, status, note | What kind of jobs do students imagine doing in the future? / Free-text responses, browsable below - not charted. / Needs theme coding before it can be summarised. Whether and how to code these into themes is still open with the team; showing the raw responses rather than pre-judging that decision. | (title unchanged) / Written answers, listed below. Not charted. / These answers have not been grouped into themes yet, so they are shown as students wrote them. | 5 |
| P24b | main.js:450,482 | status and button | 146 responses / Show all 146 responses / Show fewer | (no change) | n/a |
| P24c | main.js:461-463 | table headings and empty cells | Response / Region / School year; N/A | Answer / Region / Year level; Not recorded | 5, 6 (G4) |

### 2g. Tables, tooltips and shared strings (used on every page)

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| P25 | utils.js:408 | table toggle | Show data table | Show these numbers as a table | 5, 7 |
| P26 | main.js:188 | column heading | Respondents | People who answered | 5 |
| P26b | main.js:210, 353, 397 | column heading | n | People | G6 |
| P26c | main.js:211, 355, 398 | column heading | Average (4=best, 1=worst) | Average score (1 = No, 4 = Yes a lot) | 3 ("worst" for students' answers), 5 |
| P26d | main.js:212 | column heading | 95% CI | Likely range (95% confidence interval) | 5, G6 |
| P26e | main.js:270,361 | table cell | n too small | Too few people to estimate | 5 |
| P26f | main.js:210, 355, 398 | table cell | suppressed | Suppressed for privacy | G5 |
| P26g | main.js:214 | column heading | "I do not know" | People who answered "I do not know" | 5 |
| P26h | main.js:352, 352 | column heading | Outcome statement | Statement | 5 |
| P27 | outcomes.js:172, 326, 611; regional.js:129; aspirations.js:143; teacher.js:116,160 | tooltip line | 95% CI: 2.8–3.4 / not enough responses to estimate | Likely range: 2.8 to 3.4 / Too few people to estimate a range | 5, G6 |
| P27b | regional.js:130; teacher.js:161 | tooltip line | n=40 … 5 more answered "I do not know" (excluded) | 40 people … 5 more answered "I do not know" (left out of the average) | 5, G6 |
| P27c | outcomes.js:164,302; regional.js:119; aspirations.js:121; teacher.js:132 | tooltip | Suppressed: fewer than 5 respondents (n=3) | Suppressed for privacy: fewer than 5 people | G5 |
| P27d | outcomes.js:436 | in-chart text | suppressed (n<5) | suppressed for privacy | G5 |

---

## 3. Teacher page (`teacher.html`, `teacher-main.js`, `summary.js`, `charts/teacher.js`)

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| T1 | teacher.html:66 | badge | Teacher access | Teacher view | 5 (there is no access control; see T2) |
| T2 | teacher.html:67, teacher-main.js:156 | gate title | Sign in to your cohort | Choose your school | 5, 7 (nobody signs in here) |
| T2b | teacher.html:69-70, teacher-main.js:157 | gate subtitle | Select your region and school to view your students' results. This identifies your cohort; it isn't a secured login, since there's no real account behind this mock dataset. | Choose your region and school to see your students' results. This is not a login. Anyone can choose any school in this made-up data. | 5 |
| T2c | teacher-main.js:165 | gate title once chosen | Signed in: Waurn Ponds PS | Showing: Waurn Ponds PS | 5 |
| T2d | teacher-main.js:166 | gate subtitle once chosen | Geelong. Narrow by year below, or switch school. | Geelong. Choose a year level below, or switch school. | 6 (G4) |
| T3 | teacher.html:80-82, 88 | filter labels | Your school / Choose your school… / School year / All years at this school | (no change) / (no change) / Year level / All year levels at this school | 6 (G4) |
| T3b | teacher.html:91 | button | Switch school | (no change) | n/a |
| T4 | teacher-main.js:173 | filter status | 12 students at Waurn Ponds PS, Year 7 | (no change) | n/a |
| T5 | teacher.html:100-102 | suppressed card | Fewer than 5 respondents are recorded at this school in the current data. To avoid identifying individual students, no breakdown is shown below that threshold. This matches the suppression rule used throughout the provider dashboard. | Fewer than 5 students at this school answered, so no results are shown. This protects students from being identified. The same rule applies on every page. | 5, G5 |
| T5b | teacher-main.js:178 | suppressed badge | Waurn Ponds PS, Year 7: n=3, suppressed | Waurn Ponds PS, Year 7: 3 students, suppressed for privacy | G5, G6 |
| T6 | summary.js:89 | summary, suppressed | Fewer than 5 of your students answered this year, so no summary is shown here - the same rule that suppresses small cells throughout this dashboard. | Fewer than 5 of your students in this year level answered, so no summary is shown. The same privacy rule applies to every result on this dashboard. | 5, 6 ("this year" reads as a calendar year) |
| T6b | summary.js:101 | summary, no gap | Your students' STEM outcomes are similar to the regional average - no outcome differs by more than this sample size can support. | Your students' answers are similar to the regional average. Any differences are too small to tell apart from chance with this many students. | 5 |
| T6c | summary.js:106 | summary, gap | Your students report higher STEM outcomes overall than the regional average. | Your students gave higher scores overall than the regional average. (Mixed case: "Your students' scores are higher on some statements and lower on others compared with the regional average.") | 5, 3 |
| T6d | summary.js:108 | summary, largest gap | The largest gap is on "…" (+0.31 vs the regional average). | The biggest difference is on "…": 0.31 points higher (out of 4) than the regional average. | 5 |
| T6e | summary.js:110 | summary, count | 12 of your students answered these questions. (bug: "1 of your student answered") | 12 of your students answered these questions. / 1 of your students answered these questions. | 5 (grammar) |
| T6f | summary.js:68-71 | baseline labels | regional average / overall average | average for your region / average for all schools | 5 |
| T7 | teacher.html:123 | section heading | Response detail | Your students' answers in detail | 5 |
| T7b | teacher.html:127-131 | card title / subtitle | What did your students actually say, per activity and outcome? / Full response distribution, not just the average: one panel per outcome statement, one bar per activity your students took part in. This is the primary view here: your own cohort's actual answers, not a programme-level summary. | What did your students say about each activity? / Every answer, not just the average: one panel for each statement, with one bar for each activity your students took part in. These are your own students' answers, not a summary of the whole program. | 5, 6 |
| T8 | teacher.html:142 | section heading | Your cohort | Your students | 5 |
| T8b | teacher.html:146-147, teacher-main.js:185 | title / subtitle | How many of your students took part in each activity? / Respondent counts by activity type, this school only. (title in JS: "How many of your 12 students took part in each activity?") | (title unchanged) / Number of students who answered about each activity, at this school only. | 5, 6 |
| T8c | teacher.html:152-153 | note | Counts under 5 are suppressed and marked the same way as the provider dashboard: a small school cohort in a single activity is still identifiable. | Counts under 5 are suppressed for privacy and marked. At a small school, even a few students in one activity could be identified. | 5, G5 |
| T9 | teacher.html:169-171, teacher-main.js:119-120 | title / subtitle | What skills do your students say they built, by activity? / How do your students describe themselves after taking part, by activity? / Multi-select: students could tick more than one, so these are frequencies, not averages. | (titles unchanged) / Students could pick more than one option, so these show how many students picked each one, not averages. | 5 |
| T10 | teacher.html:182, 185 | heading / summary | For context / How does your cohort compare to the overall programme? (optional) | For comparison / How do your students compare with all students? (optional) | 5, 6 |
| T10b | teacher.html:187-193 | title / subtitle | Is your cohort's average response typical of the overall sample? / Average score per outcome statement, your school (●) against all respondents (◆), on the survey's 1–4 scale. 4 = Yes a lot is the best answer; "I do not know" is excluded. This collapses across activity type; use the detail above for an activity-by-activity view. Closed by default: your own cohort's detail is the point of this page, not how it stacks up against the programme. | Are your students' average answers typical? / Average score for each statement: your school (● circle) and all students who answered (◆ diamond). Scores run from 1 (No) to 4 (Yes a lot). "I do not know" answers are left out. This mixes all activities together. For each activity, see the detail above. | 5, 7 (shapes named in words), 6 |
| T10c | teacher.html:196-199 | note | "×" marks an outcome statement with fewer than 5 of your students answering: suppressed, not plotted. The diamond (all respondents) is shown even where your school's dot is suppressed, since it draws on the full sample. The faint line through each mark is a 95% confidence interval. With cohort sizes this small, treat any gap from the diamond as indicative, not conclusive. | "×" means fewer than 5 of your students answered that statement, so it is suppressed for privacy. The diamond is still shown, because it uses everyone's answers. The faint line through each mark is the likely range (95% confidence interval). With this few students, treat any gap as a rough guide only. | 5, G5, G6 |
| T11 | teacher.js:132,114; 156-161 | tooltips and `aria-label` | This school … All respondents … n=… | This school … All people who answered … (people, not n) | 5, 6, G6 |

---

## 4. Open-text page (`open-text.html`, `open-text-main.js`)

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| O1 | open-text.html:66-67 | intro | Free-text survey answers, shown as a filterable list rather than charted, since they aren't structured data. Region and activity are shown as context, not as a claimed link to a specific programme. | Written answers from the survey, shown as a list you can filter, not as a chart. Region and activity are shown for context. They do not mean the answer was about that activity. | 5, 6 |
| O2 | open-text.html:72-88 | "unavailable" card | No open-text responses in this data drop / open_text.csv is not present in ./data/ … reshape_v3.py … ResponseId,question,source_column,response … | **Public wording:** "Written answers are not available yet." Move all file and column names to the README. | 5 |
| O3 | open-text.html:108 | filter label | Activity (context) | Activity (for context) | 5 |
| O4 | open-text.html:119-122 | card title / subtitle | Responses / "Activities" lists every activity this respondent has outcome ratings for. The survey doesn't record which activity a free-text answer was specifically about. | Answers / "Activities" lists every activity this person answered about. The survey does not record which activity a written answer was about. | 5, 6 |
| O5 | open-text-main.js:82 | status | Showing 1 to 25 of 3317 responses (filtered from 3317 total) | Showing 1 to 25 of 3,317 answers | 5 (thousands separator; drop "filtered from" when no filter is on) |
| O6 | open-text-main.js:92,94 | table cells | N/A / Not yet coded / Theme | Not recorded / Not grouped yet / Theme | 5 |
| O7 | open-text-main.js:120,131 | pager | Previous / Next / Page 2 of 14 | (no change) | n/a |

---

## 5. Alt text and chart labels (category 7)

Today each chart's `aria-label` names the chart type ("Dot plot of …") but does not say what the chart found. Proposal: build each label from the data at render time, one sentence stating the main point, so a screen reader user gets the finding as well as the chart type. Templates below use the filtered data.

| ID | File | Chart | Current | Proposed (template) |
|---|---|---|---|---|
| AL1 | participation.js:50 | Activity bars | Sorted horizontal bar chart of respondent count by activity type | Bar chart of how many people answered about each activity. {Activity} has the most ({n}) and {Activity} has the fewest ({n}). |
| AL1b | participation.js:143, 231 | Region by year grid and list | Respondent count by region and school year, school students only | Table of how many school students answered, by region and year level. {Region} has the most ({n}). Counts under 5 are suppressed for privacy. |
| AL2 | outcomes.js:94 | Dot plot | Dot plot of average outcome score by activity type, one row per outcome statement | Dot plot of average scores for each statement, by activity. Scores are between {min} and {max} out of 4, and most activities are close together. |
| AL2b | outcomes.js:261,405 | Small panels, distribution | Average outcome scores for {activity} / Response distribution for "{item}" by activity type, diverging around Maybe / Yes a little | Average scores for {activity}: highest for "{item}" ({score} of 4), lowest for "{item}" ({score}). / Answers to "{item}" for each activity, from No to Yes a lot. |
| AL2c | outcomes.js:538 | General outcomes lollipop | Lollipop chart of average score for the general STEM outcomes question, sorted best to worst | Chart of average scores for the general STEM question, from highest to lowest. Highest: "{item}" ({score} of 4). |
| AL2d | skills.js:72 | Skills bars | Skills selected by {activity} participants, sorted highest to lowest | {Skill} was picked most often by people in {activity} ({pct}). Bar chart of how often each skill was picked, highest to lowest. |
| AL3 | influences.js:142 | Gender-split bars | Bar chart of percentage of respondents selecting each option, one bar per option split into a female segment and a male segment placed end to end; … | Bar chart of how often each option was picked, shown for students who answered Female and students who answered Male. The most-picked option is "{item}" ({Female %} Female, {Male %} Male). |
| AL3b | influences.js:285 | Programme influence | Percentage of respondents citing STEM activities and programmes as an influence, split by GALS participation | Bar chart of how often students picked "STEM activities and programs" as an influence, for people who took part in GALS ({pct}) and people who did not ({pct}). |
| AL4 | regional.js:61 | Regional dot plot | Dot plot of average outcome score by region, one row per outcome statement | Dot plot of average scores for each statement, by region. {Region} scores highest on average and {Region} lowest. Some regions have suppressed results. |
| AL4b | aspirations.js:60 | Aspirations dot plot | Dot plot comparing GALS participants to everyone else on future-in-STEM aspiration items | Dot plot comparing people who took part in GALS with people who did not, on statements about the future in STEM. The largest difference is on "{item}" ({diff} points). |
| AL4c | teacher.js:49 | Teacher benchmark | Dot plot comparing this school's average outcome score to the overall sample, one row per outcome statement | Dot plot comparing this school's average scores with all students, for each statement. |
| AL5 | all dot plots | Legend | Colours identify the activity or region. The legend is colour plus text, but the dots themselves rely on colour alone. | See **D3** (design decision, not wording). At minimum, each dot's `aria-label` and tooltip already name the activity or region. |
| AL6 | index.html:147 etc. | Toggle groups | Outcomes chart type / Skills or identity battery | Choose the chart type / Choose skills or how students see themselves ("battery" is survey jargon) |

---

## 6. `LABEL_OVERRIDES` and build-time labels

| ID | File | Location | Current | Proposed | Reason |
|---|---|---|---|---|---|
| L1 | utils.js:52-54 | `LABEL_OVERRIDES` | "Subjects I need for a future job" is displayed as "Knowing which subjects I need for a future job" | **No change proposed, but see D6.** This is the one place the dashboard already displays different wording from the questionnaire. | n/a |
| L2 | build.js:475 | scale labels | No / Maybe / Yes a little / Yes a lot | No change: these are the survey's answer options. | n/a |
| L3 | build.js:47-54 | canonical influence names (used to pair the subject and career questions; check whether shown) | Career advisers, Own ability, being good at it, Family, Teachers, Friends, Role models in STEM | No change unless they appear on screen. They currently do not (the charts show the original survey wording). | n/a |
| L4 | build.js:12 | `GENERAL_ACTIVITY_TYPE` | General STEM outcomes (not activity-specific) | See P12c. | 5, 6 |
| L5 | build.js:44 | `PROGRAMME_INFLUENCE_LABEL` | STEM activities and programmes | See P21e. | 6 |

I found no other labels generated in `build.js` that reach the screen. Its other text is console output for whoever runs the build.

---

## 7. Decisions needed (not only wording)

| ID | Issue | Why it matters | Suggested action |
|---|---|---|---|
| D1 | The "Suppressed" badge under the gender charts (`influences.js:75-85`) is shown for **any** non-empty small group, without checking the threshold of 5. In the data, "Prefer not to say" has 5, 7, 6 and 6 people across the four questions, so it is **at or above** the threshold but is labelled "too few respondents". "Non-binary / third gender" has 3 to 4, so it is below. | The label can be wrong. It also means "Prefer not to say" could be shown as its own group when it clears the threshold. | Decide: (a) show every gender group that clears the threshold, and suppress only those under 5, or (b) keep Female and Male only and describe the rest honestly as "not shown separately to protect privacy". Row P19h assumes (b). |
| D2 | The GALS versus everyone-else comparison mixes two things: GALS is girls-only, and the comparison group includes boys and non-binary students. | Any gap may reflect gender, not GALS. The notes say this, but the card title asks a "does GALS make a difference" question. | Consider comparing GALS participants with girls who did not take part (64 Female, not in GALS). This is an analysis change, so I have not made it. |
| D3 | Dot plots with 6 or 7 colours rely on colour alone to tell activities or regions apart. | Fails "do not rely on colour alone". | Options: label the sub-lines directly, use marker shapes, or add a "highlight one" selector. The phone "One activity" view already avoids the problem. |
| D4 | The data has `language_other_than_english` (46 people), but nothing on the dashboard uses it or mentions it. There is no disability question at all. | Category 4. | Nothing to reword. Raise with the team whether it should be reported, and whether disability should be asked. |
| D5 | The og-image (A4) contains text baked into a PNG. | Needs regenerating rather than editing text. | I can regenerate it after approval. |
| D6 | The existing override L1 displays wording that differs from the question asked. Its code comment says each override belongs in the Data notes, but it is not listed there now. | You asked that quoted survey wording is shown as asked. | Keep it and disclose it (add a Data notes line: "One answer option is shown as 'Knowing which subjects I need for a future job' to make its meaning clearer"), or remove it. |
| D7 | Section names in the nav ("Provider view") and chart-type names ("Dot plot", "Small multiples") are used in emails and the team's own conversations. | Renaming them changes shared vocabulary. | Approve or reject A1, A7, A8, P9 as a group. |

---

## 8. Survey wording to raise with the team

These come from the questionnaire. They are **unchanged** in the dashboard and are listed for the survey team only.

| ID | Item as asked | Issue | Suggestion |
|---|---|---|---|
| S1 | Gender options: Female / Male / Non-binary / third gender / Prefer not to say | Options mix sex-style and gender-style terms. There is no way for a student to describe themselves in their own words. | Consider "Girl / Boy / Non-binary / I use a different term (please say) / Prefer not to say", or add a self-describe field. |
| S2 | "Advise from my family", "Advise from teachers", "Career advise from teachers or career advisors", "Getting advise from teachers or career advisers" | "Advise" is the verb. The noun is "advice". Appears in the subject, career and STEM-careers questions, and in chart labels on screen. | Change to "Advice". |
| S3 | "Other (please specfiy)" | Typo ("specify"). Appears as a bar label on screen. | Fix the typo. |
| S4 | "career advisors" and "Career advisers" in the same question set | Two spellings for one thing. | Pick one (Australian usage accepts both; "advisers" is the more common). |
| S5 | "STEM activities/ programs as mentioned in previous questions" and "STEM activities and programs mentioned…" | Stray space after the slash, and the subject and career versions are worded differently. Also both items say "programs" while the dashboard label says "programmes". | Use identical wording in both questions. |
| S6 | "Role models/ influencers" and "Role models (e.g. a STEM person I know)" | Different wording and spacing for the same idea. "Influencers" may mean different things to a Year 5 and a Year 12 student. | Align the wording. |
| S7 | "More knowledgable about STEM" | Spelling: "knowledgeable". | Fix the spelling. |
| S8 | "More interested about learning about STEM" / "More interested in learning about STEM"; "More confident in communicating and sharing my ideas" / "…sharing and communicating…"; "More comfortable working in teams" / "More confident in working in teams" | Three items exist in two wordings each. "Interested about" is ungrammatical. This is why the dashboard has the "≈" marker. | Standardise to one wording per item. |
| S9 | "More like a STEM person"; identity option "A STEM person" | Can suggest there is one kind of "STEM person". Students who do not see themselves that way may feel excluded. | Consider "More like someone who could work in STEM" or similar. |
| S10 | "I feel these subjects are more suitable for boys" (in the data, shown for students who decided against STEM) | Reasonable to measure a stereotype, but it is asked as a personal reason, and "more suitable for boys" is the only gendered option. Non-binary students have no comparable option. | Consider "I feel people like me are not expected to do these subjects". |
| S11 | Scale: No / Maybe / Yes a little / Yes a lot, with "I do not know" | "Maybe" is treated as the midpoint between No and Yes a little. Some students will read "Maybe" as "unsure", not as "somewhere between". | Confirm this is intended, since the dashboard averages these as 1 to 4. |
| S12 | "Why choosing STEM subjects feels hard (current students)" (question group, in the data, not currently charted) | Framing the whole question around difficulty. The options are worded neutrally ("I do not feel encouraged…"). | If it is charted later, title the chart neutrally, for example "What makes choosing STEM subjects harder for some students?" |
| S13 | Region option "Warnambool" | Spelling; see P16c. | Check the source list. |
| S14 | Answer options such as "Business, Finance, Management, & Legal" for "adult 1 / adult 2" occupation | Neutral about family structure ("adult 1/2"), which is good. Not shown on the dashboard. | No change. Noted as a positive. |

---

## What happens after you review

Reply with the IDs to approve, reject or edit. I will then:

1. Apply only approved rows, editing text in place, without touching survey item wording.
2. Run `npm run build`.
3. Check every view (provider, teacher, open-text) on desktop and at 375px wide for rendering errors and horizontal overflow, including the wording changes in tooltips and `aria-label`s.
4. Send a short summary of what changed.

---

## 9. Captions that quote a number or ranking: still true on the new dataset?

The dashboard now runs on wave `mock-2026-b` (`data/raw/`, see `docs/backend_design.md`),
which is a different mock population from the one the captions were written against.
Nothing below has been rewritten yet; this is the list to decide from. Figures are
from `data/*.csv` (200 people: 116 Female, 73 Male, 6 Non-binary / third gender,
5 Prefer not to say; GALS 65).

**Needs a change (no longer true)** - N1 to N5 have since been rewritten to say what to look for rather than quote a ranking or count; nothing else in this section was touched.

| ID | Where | Text | Why it is no longer true |
|---|---|---|---|
| N1 | index.html, participation note | "Similar numbers of people answered about each of the seven activities. **GALS (Girls as Leaders in STEM) has slightly the most.**" | GALS has 65 people, tied for fifth of seven (with Excursions). The most is **School club or lunchtime activity (77)**, then University programs (75), Competitions and Online STEM activities (69 each), Excursions and GALS (65), Tech school programs (60). "Similar" is still fair (60 to 77), but the GALS claim is wrong. |
| N2 | index.html, regional card note | "Regions other than Geelong have fewer responses, so **more of their results are hidden**." | In the regional chart no result is hidden for any region: every region has at least 5 answers on all 12 statements. The claim is true only of the region-by-year-level grid (see T3). |
| N3 | README, "Caption reasoning": participation | "GALS is narrowly the largest single activity, but participation across all seven is broadly comparable" | Same as N1. |
| N4 | README, "Caption reasoning": regional | "most regions outside Geelong show several suppressed cells" | Same as N2: none in the regional chart. |
| N5 | README, "Caption reasoning": aspirations | "small, mixed-direction gap (roughly ±0.2)" | Differences run from -0.31 to +0.14, and 7 of 10 are negative. Still small and still mixed, but not "±0.2". |

**Still true**

| ID | Where | Text | Evidence |
|---|---|---|---|
| T1 | index.html, participation subtitle | "Many people took part in more than one activity, so the bars overlap." | 86% took part in more than one; median 4. |
| T2 | index.html, region card note | "Geelong has the most responses, so its results are the most complete." | Geelong 54 (Ballarat 41, Bendigo 35, Gippsland 25, Warnambool 24, Ararat 21). |
| T3 | index.html, region card note | "Other regions have fewer, so more of their results are hidden." (the region-by-year-level grid) | Cells with at least 5 school students, of 6 year levels: Geelong 5, Ballarat 4, Bendigo 3, Gippsland 1, Warnambool 1, Ararat 0. |
| T4 | index.html, gender cards' notes and About text | "Every GALS participant answered Female" / "Everyone who took part in GALS answered Female" | 65 of 65. |
| T5 | index.html, skills note | "Students in Excursions and Online STEM activities were not asked these questions, and neither were they asked in the general question." | Skills and identity answers exist only for Competitions, GALS, School club, Tech school and University programs. |
| T6 | index.html, aspirations note | "In this made-up data the differences are small and go both ways." | Range -0.31 to +0.14 (3 positive, 7 negative); every confidence interval overlaps. |
| T7 | index.html, programme-influence note and README | (a gap is built into the mock data) | GALS 42% v 19% for subject choice, 49% v 24% for future plans. |
| T8 | teacher.html, About | "Most schools in this made-up data have only a few students, so many results are hidden." | 18 of 19 schools have 5 to 13 students, and 104 of 126 school-by-activity counts (83%) are under 5. Fine as written; an older wording ("most schools well under the threshold") would have been wrong. |
| T9 | throughout | "six regions", "seven activities", "an eighth activity" | 6 regions, 7 activities plus the general question. |

**Depends on the data at the time (already computed live, so cannot go stale)**

- The provider and teacher "What this shows" sentences (which activity or school stands out, or that none does; the count of people).
- The gender charts' legend counts and their "hidden for privacy" note. Note for the current data: "Prefer not to say" has 5, 4, 5 and 3 people across the four questions and "Non-binary / third gender" has 4, 5, 5 and 4, so which group is shown or hidden **differs from chart to chart**.
- KPI tiles, filter counts, the jobs-answers count.

**Also stale, in the older sections of this file** (kept as history): the counts quoted in sections 0 to 8 (for example "125 Female", "Prefer not to say has 5, 7, 6 and 6") describe the first mock dataset.
