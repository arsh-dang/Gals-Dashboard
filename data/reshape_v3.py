"""
Reshape a v3 Qualtrics export into tidy long tables for Tableau.

The same batteries repeat per activity type. This turns activity type into a
dimension so one chart compares all activities.

Usage: python reshape_v3.py <export.csv> [numeric_export.csv]
"""
import sys, re, os, json, html
import pandas as pd

QSF = "survey_v3.qsf"
OUT = "tableau_v3"

def clean(t):
    t = re.sub(r"<[^>]+>", " ", str(t)); return re.sub(r"\s+", " ", html.unescape(t)).strip()

qsf = json.load(open(QSF))
QS = {e["Payload"]["DataExportTag"]: e["Payload"] for e in qsf["SurveyElements"] if e["Element"] == "SQ"}

Q9 = QS["Q9"]["Choices"]
ACTIVITY = {c: clean(Q9[c]["Display"]).split(" (")[0] for c in Q9}
ACTIVITY["general"] = "General STEM outcomes (not activity-specific)"

# outcomes matrix / skills / identity per activity code
BLOCKS = {
    "1": dict(out="Q15",  skl="Q16", idn="Q74"),
    "2": dict(out="Q36",  skl="Q37", idn="Q75"),
    "3": dict(out="Q104", skl="Q46", idn="Q76"),   # Q104 is the live Tech school matrix
    "4": dict(out="Q54",  skl="Q55", idn="Q77"),
    "5": dict(out="Q63",  skl="Q64", idn="Q78"),
    "6": dict(out="Q105", skl=None,  idn=None),
    "7": dict(out="Q106", skl=None,  idn=None),
    # Q107 has no display logic tied to a Q9 choice - it is a GENERAL outcomes
    # battery shown to everyone, not the "Other" activity. Reported separately.
    "general": dict(out="Q107", skl=None, idn=None),
}

def items(tag):
    ch = QS[tag].get("Choices", {})
    order = QS[tag].get("ChoiceOrder", sorted(ch, key=lambda x: int(x)))
    return {str(c): clean(ch[str(c)]["Display"]) for c in order}

def load(path):
    raw = pd.read_csv(path, dtype=str, keep_default_na=False)
    return raw.iloc[2:].reset_index(drop=True)

def main():
    d = load(sys.argv[1])
    dn = load(sys.argv[2]) if len(sys.argv) > 2 else None
    os.makedirs(OUT, exist_ok=True)

    # respondents
    resp = pd.DataFrame({
        "ResponseId": d["ResponseId"],
        "StartDate": d["StartDate"],
        "Finished": d["Finished"],
        "region": d.get("Q1", ""),
        "gender": d.get("Q2", ""),
        "language_other_than_english": d.get("Q7", ""),
        "birth_year": d.get("Q73", ""),
        "is_school_student": d.get("Q3", ""),
        "school": d.get("Q4", ""),
        "school_level": d.get("Q5", ""),
        "adult1_occupation": d.get("Q6", ""),
        "adult2_occupation": d.get("Q111", ""),
        "activities_selected": d.get("Q9", ""),
    })
    resp["pathway"] = resp.is_school_student.map(
        lambda v: "School student" if v.strip().lower() == "yes" else ("Post-school" if v.strip() else "Unknown"))
    resp["n_activities"] = resp.activities_selected.map(lambda v: len([x for x in v.split(",") if x.strip()]) if v.strip() else 0)

    # long ratings
    rows = []
    for code, b in BLOCKS.items():
        act = ACTIVITY.get(code, code)
        tag = b["out"]
        if not tag or tag not in QS: continue
        it = items(tag)
        for cid, label in it.items():
            col = f"{tag}_{cid}"
            if col not in d.columns: continue
            for i in d.index:
                v = d.at[i, col].strip()
                if not v: continue
                num = dn.at[i, col].strip() if dn is not None and col in dn.columns else ""
                dk = v.lower().startswith("i do not know")
                # Survey codes run 1 = Yes a lot .. 4 = No, with 5 = I do not know.
                # The team asked for a score where higher means more positive, so
                # `score` is reversed: 1 = No .. 4 = Yes a lot. Blank for "I do not
                # know", which is a non-answer rather than a middling one.
                score = ""
                if num.isdigit() and not dk:
                    score = 5 - int(num)
                rows.append(dict(ResponseId=d.at[i, "ResponseId"], activity_type=act,
                                 battery="outcomes", item=label, response=v,
                                 response_code=num, score=score,
                                 is_dont_know=dk,
                                 source_column=col))
    ratings = pd.DataFrame(rows)

    # multi-select batteries -> one row per ticked item
    picks = []
    for code, b in BLOCKS.items():
        act = ACTIVITY.get(code, code)
        for key, name in (("skl", "skills"), ("idn", "identity")):
            tag = b.get(key)
            if not tag or tag not in d.columns: continue
            it = items(tag)
            for i in d.index:
                v = d.at[i, tag].strip()
                if not v: continue
                for part in [p.strip() for p in v.split(",") if p.strip()]:
                    picks.append(dict(ResponseId=d.at[i, "ResponseId"], activity_type=act,
                                      battery=name, item=part, source_column=tag))
    selections = pd.DataFrame(picks)

    # open text
    ot = []
    for tag, q in QS.items():
        if q["QuestionType"] != "TE" or tag not in d.columns: continue
        label = clean(q["QuestionText"])[:120]
        for i in d.index:
            v = d.at[i, tag].strip()
            if v:
                ot.append(dict(ResponseId=d.at[i, "ResponseId"], question=label,
                               source_column=tag, response=v))
    open_text = pd.DataFrame(ot)

    for name, df in (("respondents", resp), ("activity_ratings", ratings),
                     ("battery_selections", selections), ("open_text", open_text)):
        df.to_csv(f"{OUT}/{name}.csv", index=False)
        print(f"  {name+'.csv':24s} {len(df):6d} rows")

    if not ratings.empty:
        print("\nActivities:", ", ".join(sorted(ratings.activity_type.unique())))

if __name__ == "__main__":
    main()
