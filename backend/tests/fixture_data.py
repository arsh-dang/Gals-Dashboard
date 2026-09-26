"""Builds the tiny synthetic survey used by the tests: a small QSF plus matching
text and numeric exports (12 invented respondents, ids R_MK...). Everything here
is made up; it exercises the same quirks as the real export (three header rows,
choice codes vs labels, a multi-select label that contains a comma, activity
batteries, a general battery, aspirations, free text) without needing the real
survey definition.

Run `python backend/tests/fixture_data.py` to regenerate tests/fixtures/.
"""
import csv
import json
import sys
from pathlib import Path

ANSWERS = {"Yes a lot": 1, "Yes a little": 2, "Maybe": 3, "No": 4, "I do not know": 5}
COMMA_LABEL = "Problem solving, and design"  # a label with a comma: the numeric split quirk

QUESTIONS = {  # tag: (type, selector, text, choices)
    "Q1": ("MC", "SAVR", "Where do you live?", ["Geelong", "Ballarat"]),
    "Q2": ("MC", "SAVR", "Are you:", ["Female", "Male", "Non-binary / third gender", "Prefer not to say"]),
    "Q3": ("MC", "SAVR", "Are you a school student?", ["Yes", "No"]),
    "Q4": ("MC", "SAVR", "Which school?", ["Alpha PS", "Beta SC", "Gamma PS"]),
    "Q5": ("MC", "SAVR", "Which year level?", ["Year 5", "Year 6"]),
    "Q6": ("MC", "SAVR", "Adult 1 occupation", ["Healthcare", "Education"]),
    "Q111": ("MC", "SAVR", "Adult 2 occupation", ["Healthcare", "Education"]),
    "Q7": ("MC", "SAVR", "Language other than English at home?", ["Yes", "No"]),
    "Q73": ("MC", "SAVR", "Birth year", ["2010", "2011"]),
    "Q9": ("MC", "MAVR", "Which activities have you done?", ["Competitions (for example a robotics day)", "Excursions"]),
    "Q15": ("Matrix", "Likert", "The activity helped me to be...", ["More knowledgable about STEM", "More confident in being a leader"]),
    "Q36": ("Matrix", "Likert", "The excursion helped me to be...", ["More knowledgable about STEM"]),
    "Q107": ("Matrix", "Likert", "In general, I feel...", ["More like a STEM person"]),
    "Q25": ("Matrix", "Likert", "About your future...", ["I can imagine a job that uses STEM", "A STEM job sounds like something I could do"]),
    "Q16": ("MC", "MAVR", "Skills built", ["Teamwork", "Creative thinking", COMMA_LABEL]),
    "Q74": ("MC", "MAVR", "I see myself as...", ["A leader", "A designer"]),
    "Q20": ("MC", "MAVR", "Subjects interested in", ["Mathematics", "Science", "Arts, humanities or social sciences"]),
    "Q26": ("MC", "MAVR", "What helps decide future plans", ["My family", "My teachers"]),
    "Q10": ("TE", None, "What did you enjoy most about the activity?", []),
    "Q102": ("TE", None, "Please specify what job adult 1 does", []),
}
COLUMNS = ["StartDate", "EndDate", "Status", "ResponseId", "Finished", "Q1", "Q2", "Q7", "Q73", "Q6", "Q111",
           "Q3", "Q4", "Q5", "Q9", "Q15_1", "Q15_2", "Q16", "Q74", "Q36_1", "Q107_1", "Q25_1", "Q25_2",
           "Q20", "Q26", "Q10", "Q102"]


def qsf():
    elements, block = [], []
    for n, (tag, (qtype, selector, text, choices)) in enumerate(QUESTIONS.items(), start=1):
        payload = {
            "DataExportTag": tag, "QuestionID": f"QID{n}", "QuestionText": text, "QuestionType": qtype,
            "Selector": selector, "Choices": {str(i): {"Display": c} for i, c in enumerate(choices, start=1)},
            "ChoiceOrder": [str(i) for i in range(1, len(choices) + 1)],
        }
        if qtype == "Matrix":
            payload["Answers"] = {str(c): {"Display": a} for a, c in ANSWERS.items()}
        elements.append({"Element": "SQ", "PrimaryAttribute": f"QID{n}", "Payload": payload})
        block.append({"Type": "Question", "QuestionID": f"QID{n}"})
    elements.append({"Element": "BL", "Payload": [{"Type": "Default", "Description": "Default Question Block", "ID": "BL_1", "BlockElements": block}]})
    return {"SurveyEntry": {"SurveyID": "SV_synthetic", "SurveyName": "SYNTHETIC TEST SURVEY"}, "SurveyElements": elements}


def respondents():
    """12 invented respondents as {column: (text, numeric)}. Group sizes are chosen so
    suppression has something to do: Female 6 (kept), Male 4, one Non-binary, one
    Prefer-not-to-say (all under 5); Gamma PS has 1 student; language 'Yes' has 3."""
    rows = []
    for i in range(12):
        if i < 6:    gender, region, school, level = 1, 1, 1, 1      # Female, Geelong, Alpha PS, Year 5
        elif i < 10: gender, region, school, level = 2, 2, 2, 2      # Male, Ballarat, Beta SC, Year 6
        elif i == 10: gender, region, school, level = 3, 2, 2, 2     # Non-binary
        else:        gender, region, school, level = 4, 2, 3, 1      # Prefer not to say, Gamma PS, Year 5
        lang = 1 if i in (0, 1, 6) else 2
        does_excursion = i % 2 == 0
        acts = [1] + ([2] if does_excursion else [])
        codes = {"Q1": region, "Q2": gender, "Q7": lang, "Q73": 1 + i % 2, "Q6": 1 + i % 2, "Q111": 2 - i % 2,
                 "Q3": 1, "Q4": school, "Q5": level}
        rows.append((i, codes, acts))
    return rows


def write(folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    qs = qsf()
    (folder / "tiny_survey.qsf").write_text(json.dumps(qs), encoding="utf-8")
    choice_text = {tag: {str(i): c for i, c in enumerate(v[3], start=1)} for tag, v in QUESTIONS.items()}
    rows_text, rows_num = [], []
    for i, codes, acts in respondents():
        t, n = {c: "" for c in COLUMNS}, {c: "" for c in COLUMNS}
        rid = f"R_MK{i + 1:04d}"
        for d in (t, n):
            d.update(StartDate=f"2026-09-{14 + i:02d} 10:00:00", EndDate=f"2026-09-{14 + i:02d} 10:10:00",
                     Status="0", ResponseId=rid, Finished="True")
        for tag, code in codes.items():
            t[tag], n[tag] = choice_text[tag][str(code)], str(code)
        t["Q9"] = ",".join(choice_text["Q9"][str(a)] for a in acts)
        n["Q9"] = ",".join(str(a) for a in acts)
        for col, ans in (("Q15_1", i % 4 + 1), ("Q15_2", (i + 1) % 5 + 1), ("Q107_1", (i + 2) % 5 + 1),
                         ("Q25_1", i % 4 + 1), ("Q25_2", (i + 3) % 5 + 1)) + ((("Q36_1", i % 3 + 1),) if 2 in acts else ()):
            label = [k for k, v in ANSWERS.items() if v == ans][0]
            t[col], n[col] = label, str(ans)
        picks = {"Q16": ["1", "3"], "Q74": ["1", "2"], "Q20": ["2", "3"], "Q26": ["1"]}
        for tag, ids in picks.items():
            n[tag] = ",".join(ids)
            t[tag] = ",".join(choice_text[tag][x] for x in ids)  # text export: labels joined by commas
        if i % 3 == 0:
            t["Q10"] = n["Q10"] = f"Invented answer number {i + 1}."
        t["Q102"] = n["Q102"] = "Made-up job"
        rows_text.append(t), rows_num.append(n)
    qtext = {c: (QUESTIONS[c.split("_")[0]][2] if c.split("_")[0] in QUESTIONS else c) for c in COLUMNS}
    for name, rows in (("tiny_text.csv", rows_text), ("tiny_numeric.csv", rows_num)):
        with open(folder / name, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f, lineterminator="\n")
            w.writerow(COLUMNS)
            w.writerow([qtext[c] for c in COLUMNS])
            w.writerow([json.dumps({"ImportId": c}) for c in COLUMNS])
            for r in rows:
                w.writerow([r[c] for c in COLUMNS])
    (folder / "tiny_text.csv.meta.json").write_text(
        json.dumps({"is_mock": True, "notes": "Synthetic test fixture."}), encoding="utf-8")


if __name__ == "__main__":
    write(Path(__file__).parent / "fixtures")
    print("wrote", Path(__file__).parent / "fixtures", file=sys.stderr)
