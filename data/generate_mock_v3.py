"""
SIT Dashboard - mock data generator (v3 instrument)
-----------------------------------------------------
Reads the survey definition (SIT_PILOT__2_.qsf) and generates synthetic
responses shaped like a Qualtrics export: columns derived from the instrument,
three header rows, correct choice codes, correct branching.

All data is synthetic. No row corresponds to a real person.

Respondents are built from persona archetypes rather than random values, so
each girl's ratings, activity choices and free text hang together.

Usage:
    python generate_mock_v3.py [n_respondents]

Outputs:
    mock_v3_text.csv     choice labels
    mock_v3_numeric.csv  choice codes
"""

import json
import random
import re
import html
import sys
import csv
from datetime import datetime, timedelta

SEED = 20260817
random.seed(SEED)

QSF_PATH = "survey_v3.qsf"
N = int(sys.argv[1]) if len(sys.argv) > 1 else 160


def clean(t):
    t = re.sub(r"<[^>]+>", " ", str(t))
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


qsf = json.load(open(QSF_PATH))
ELS = qsf["SurveyElements"]
QS = {e["Payload"]["DataExportTag"]: e["Payload"]
      for e in ELS if e["Element"] == "SQ"}

# Question order as it appears in the survey blocks
BLOCK_ORDER = []
for e in ELS:
    if e["Element"] == "BL":
        payload = e["Payload"]
        groups = payload.values() if isinstance(payload, dict) else payload
        for g in groups:
            if isinstance(g, dict):
                for el in g.get("BlockElements", []):
                    if el.get("Type") == "Question":
                        BLOCK_ORDER.append(el["QuestionID"])
QID_TO_TAG = {q["QuestionID"]: tag for tag, q in QS.items()}
ORDERED_TAGS = []
for qid in BLOCK_ORDER:
    tag = QID_TO_TAG.get(qid)
    if tag and tag not in ORDERED_TAGS:
        ORDERED_TAGS.append(tag)
for tag in QS:
    if tag not in ORDERED_TAGS:
        ORDERED_TAGS.append(tag)


def choices(tag):
    q = QS[tag]
    ch = q.get("Choices", {})
    order = q.get("ChoiceOrder", sorted(ch, key=lambda x: int(x)))
    return [(str(c), clean(ch[str(c)]["Display"])) for c in order]


def statements(tag):
    """Matrix row items."""
    return choices(tag)


def scale(tag):
    """Matrix answer scale. Qualtrics exports these as POSITION (1..n)."""
    q = QS[tag]
    ans = q.get("Answers", {})
    order = q.get("AnswerOrder", sorted(ans, key=lambda x: int(x)))
    return [(str(i), clean(ans[str(a)]["Display"])) for i, a in enumerate(order, 1)]


def qtype(tag):
    q = QS[tag]
    return q["QuestionType"], q.get("Selector")


def has_other(tag):
    """Choice ids flagged as 'other, please specify' (they carry a TextEntry)."""
    q = QS[tag]
    out = []
    for cid, c in q.get("Choices", {}).items():
        if c.get("TextEntry") == "true" or "please specify" in clean(c.get("Display", "")).lower():
            out.append(str(cid))
    return out


# --------------------------------------------------------------- export columns
def export_columns():
    cols = ["StartDate", "EndDate", "Status", "IPAddress", "Progress",
            "Duration (in seconds)", "Finished", "RecordedDate", "ResponseId",
            "RecipientLastName", "RecipientFirstName", "RecipientEmail",
            "ExternalReference", "LocationLatitude", "LocationLongitude",
            "DistributionChannel", "UserLanguage"]
    for tag in ORDERED_TAGS:
        t, sel = qtype(tag)
        if t == "Matrix":
            for cid, _ in statements(tag):
                cols.append(f"{tag}_{cid}")
        elif t == "MC":
            cols.append(tag)
            for cid in has_other(tag):
                cols.append(f"{tag}_{cid}_TEXT")
        elif t == "TE":
            cols.append(tag)
        elif t == "DB":
            continue
    return cols


COLUMNS = export_columns()

# ----------------------------------------------------- activity block mapping
def activity_of(tag):
    s = json.dumps(QS[tag].get("DisplayLogic", {}))
    m = re.findall(r"SelectableChoice[^\"]*?/(\d+)", s)
    return sorted(set(m))


ACTIVITY_QUESTIONS = {}   # activity code -> [tags shown only for it]
for tag in QS:
    codes = activity_of(tag)
    if len(codes) == 1:
        ACTIVITY_QUESTIONS.setdefault(codes[0], []).append(tag)

# ------------------------------------------------------------------- personas
ARCHETYPES = [
    dict(id="A1", label="Quietly capable, low confidence", pos=0.55,
         jobs=["A vet maybe", "Not sure yet", "Maybe a teacher", "A scientist"],
         mem=["Doing the experiments myself instead of watching the teacher do it.",
              "I liked that we could test our own ideas even when they didn't work.",
              "Being in a small group where I wasn't scared to say the wrong thing."],
         chg=["Longer, and less talking in front of everyone at the end.",
              "Maybe explain the words at the start, I didn't know some of them.",
              "More time to write up what we found."],
         subj=["I like science because we get to do experiments, and art.",
               "Science and English. Maths is okay but harder."]),
    dict(id="A2", label="Already keen, wants challenge", pos=0.85,
         jobs=["A software engineer", "A game developer", "A computer scientist"],
         mem=["Getting to build something that actually worked, not just learn about it.",
              "The coding part. I do a bit at home but this was harder.",
              "Meeting the mentor who works in tech, I asked her heaps of questions."],
         chg=["Make it harder. Some of it we already knew.",
              "More time on the building, less on the planning.",
              "Nothing really, but it went too fast."],
         subj=["Maths and digital technologies, I like solving things.",
               "Science and maths because they make sense to me."]),
    dict(id="A3", label="Hands-on maker", pos=0.62,
         jobs=["Maybe an engineer", "Something where I build things",
               "A carpenter or an engineer"],
         mem=["Making the model with real tools. It felt like proper work.",
              "We made something for our town that people could actually use.",
              "Using the 3D printer, I didn't know our school had one."],
         chg=["Less sitting down at the start before we got to build.",
              "More tools, we had to share.", "Nothing, I liked the making part."],
         subj=["Woodwork and design. I like making things with my hands.",
               "Design and tech, and PE."]),
    dict(id="A4", label="Environmentally driven", pos=0.72,
         jobs=["An environmental scientist", "A marine scientist",
               "Something protecting rivers"],
         mem=["Testing the water in the creek near us and finding what was in it.",
              "Learning science can fix real problems in our own town.",
              "The excursion where we surveyed the wetlands."],
         chg=["More field trips instead of classroom parts.",
              "The data tables at the start were confusing.",
              "Longer so we could finish properly."],
         subj=["Science, especially biology, and geography.",
               "I like science because it's about real things."]),
    dict(id="A5", label="Maths-anxious, socially confident", pos=0.50,
         jobs=["A nurse or maybe a doctor", "A paramedic",
               "Something in health, I didn't know that was STEM"],
         mem=["Finding out health jobs are STEM jobs, I thought STEM was just computers.",
              "Presenting our project, I liked explaining it to the parents.",
              "Organising my group and working out who did what."],
         chg=["More help with the maths parts.", "Smaller steps for the graphs.",
              "I would keep it the same but add more group work."],
         subj=["English and health. I don't really like maths.",
               "PE and English, and science sometimes."]),
    dict(id="A6", label="First in family toward STEM", pos=0.58,
         jobs=["Maybe an engineer", "Something with robots",
               "I want to go to uni now, maybe engineering"],
         mem=["Programming the robot to move on its own, I'd never done that.",
              "Going to the university campus, I'd never been to one.",
              "The mentor said she was first in her family to go to uni too."],
         chg=["Explain things more at the start, I didn't understand the words.",
              "More visits to the university.", "Nothing, it was good."],
         subj=["I like art and sport. Science is okay.",
               "Maths is alright, I like the puzzles."]),
    dict(id="A7", label="Creative, sees STEM as separate", pos=0.64,
         jobs=["A designer, maybe for apps", "An architect",
               "Design and technology together"],
         mem=["Designing how our project looked, not just how it worked.",
              "Finding out design is part of engineering too.",
              "Making the poster and the model together."],
         chg=["More of the design side and less coding.",
              "Better materials for the making part.", "I would add more art into it."],
         subj=["Art and media. I like making things look good.",
               "Visual arts, and design and tech."]),
    dict(id="A8", label="High achiever, career-focused", pos=0.90,
         jobs=["A doctor", "A biomedical scientist", "Medicine or research"],
         mem=["Talking to the women in STEM about their actual day to day jobs.",
              "The research part where we had to find real evidence.",
              "Going deeper than we do in normal class."],
         chg=["More time on the analysis, we rushed that bit.",
              "Harder content for people who want it.", "Nothing much, it was well run."],
         subj=["Maths methods and chemistry. I want to do medicine.",
               "Science and maths, they're my strongest."]),
    dict(id="A9", label="Disengaged at start, shifted", pos=0.42,
         jobs=["Maybe game design", "Something with computers",
               "I didn't think about it before but maybe IT"],
         mem=["It wasn't like normal school, we chose what our project was about.",
              "Making a game, I didn't know you could learn that at school.",
              "The teachers actually listened to our ideas."],
         chg=["Shorter instructions, they were too long.",
              "Let us pick our own groups.", "More choice about what we do."],
         subj=["None really. PE I guess.", "I like digital tech, the rest is boring."]),
    dict(id="A10", label="Rural, access barriers", pos=0.66,
         jobs=["A vet", "An agricultural scientist", "Something with animals and science"],
         mem=["Getting to do it here instead of travelling to the city.",
              "Learning the science behind farming, which is what my family does.",
              "The video call with the scientist who works with livestock."],
         chg=["Better internet, ours dropped out during the online session.",
              "More equipment, we had to share one set.", "Run it closer to us more often."],
         subj=["Agriculture and science. And PE.", "Science, and I like maths a bit."]),
]
ARCH_W = [0.11, 0.09, 0.10, 0.10, 0.11, 0.11, 0.09, 0.08, 0.10, 0.11]

SCHOOLS = {
    "Geelong": ["Bellarine PS", "Corio North PS", "Waurn Ponds PS", "Geelong West SC"],
    "Ballarat": ["Sebastopol PS", "Wendouree PS", "Ballarat East SC"],
    "Bendigo": ["Kangaroo Flat PS", "Eaglehawk PS", "Bendigo South SC"],
    "Warnambool": ["Merri River PS", "Warrnambool West PS", "Emmanuel SC"],
    "Gippsland": ["Traralgon East PS", "Moe South PS", "Latrobe Valley SC"],
    "Ararat": ["Ararat West PS", "Pyrenees PS", "Ararat SC"],
}
WHEN_TEXTS = ["Last year", "This year", "In year 6", "Earlier this year",
              "A couple of years ago", "Last term", "In primary school"]


def pick(opts, weights=None):
    return random.choices(opts, weights=weights, k=1)[0]


def rate(tag, positivity):
    """Pick a scale point. Position 5 is 'I do not know' - treated as non-response."""
    pts = scale(tag)
    if random.random() < 0.05:
        return pts[4]                      # I do not know
    # positivity 0-1 maps onto Yes a lot .. No (positions 1-4)
    weights = [
        positivity ** 2 * 1.6,
        positivity * 1.2,
        (1 - positivity) * 1.0,
        (1 - positivity) ** 2 * 1.2,
    ]
    return random.choices(pts[:4], weights=weights, k=1)[0]


def multi_select(tag, positivity):
    """Multi-select: more positive personas tick more items."""
    opts = [o for o in choices(tag) if "please specify" not in o[1].lower()]
    if not opts:
        return []
    n = max(1, min(len(opts), round(random.gauss(positivity * len(opts) * 0.55, 1.2))))
    picks = random.sample(opts, n)
    picks.sort(key=lambda p: int(p[0]))
    return picks


def answer(tag, arch, pool=None):
    t, sel = qtype(tag)
    if t == "Matrix":
        return {cid: rate(tag, arch["pos"] + random.uniform(-0.12, 0.12))
                for cid, _ in statements(tag)}
    if t == "MC" and sel == "MAVR":
        return multi_select(tag, arch["pos"])
    if t == "MC":
        opts = [o for o in choices(tag) if "please specify" not in o[1].lower()]
        return pick(opts) if opts else ("", "")
    if t == "TE":
        return ("", random.choice(pool or arch["mem"]))
    return ("", "")


# ------------------------------------------------------------ build respondent
LOCATIONS = choices("Q1")
BIRTH_YEARS = choices("Q73")
SCHOOL_LEVELS = choices("Q5")
OCCUPATIONS = [o for o in choices("Q6") if "please specify" not in o[1].lower()]


def build():
    arch = pick(ARCHETYPES, ARCH_W)
    loc = pick(LOCATIONS, [0.30, 0.20, 0.16, 0.14, 0.12, 0.08])
    r = {"_arch": f"{arch['id']} {arch['label']}"}
    r["Q1"] = loc
    is_student = random.random() < 0.84

    # Decide GALS participation first - it constrains gender, since GALS is a
    # girls' program. Roughly 55% of respondents come through GALS.
    did_gals = random.random() < 0.55

    # Q2 is gender. GALS participants are female; everyone else is a mix.
    if did_gals:
        r["Q2"] = ("2", "Female")
    else:
        r["Q2"] = pick(choices("Q2"), [0.46, 0.44, 0.05, 0.05])
    # Q7 is "language other than English at home", not gender.
    if "Q7" in QS:
        r["Q7"] = pick(choices("Q7"), [0.22, 0.78])
    r["Q73"] = pick(BIRTH_YEARS)
    r["Q6"] = pick(OCCUPATIONS)
    if "Q111" in QS and random.random() < 0.72:
        r["Q111"] = pick([o for o in choices("Q111")
                          if "please specify" not in o[1].lower()])
    r["Q3"] = ("1", "Yes") if is_student else ("2", "No")

    if is_student:
        r["Q5"] = pick(SCHOOL_LEVELS[:6], [0.20, 0.22, 0.20, 0.18, 0.12, 0.08])
        r["Q4"] = ("", random.choice(SCHOOLS[loc[1]]))
    elif "Q79" in QS:
        r["Q79"] = answer("Q79", arch)

    if "Q8" in QS:
        r["Q8"] = answer("Q8", arch)

    # activities: GALS for the 55% who came through it, plus a spread of others
    all_acts = choices("Q9")
    gals = [a for a in all_acts if a[0] == "5"]
    others = [a for a in all_acts if a[0] != "5" and "please specify" not in a[1].lower()]
    picks = (gals if did_gals else []) + random.sample(others, random.randint(1, 3))
    picks.sort(key=lambda p: int(p[0]))
    r["Q9"] = picks
    chosen = {p[0] for p in picks}

    # answer every question gated on a chosen activity
    for code in chosen:
        for tag in ACTIVITY_QUESTIONS.get(code, []):
            if tag in r:
                continue
            t, sel = qtype(tag)
            txt = clean(QS[tag]["QuestionText"]).lower()
            if t == "TE":
                pool = (WHEN_TEXTS if "when" in txt else
                        arch["chg"] if "change" in txt else arch["mem"])
                r[tag] = answer(tag, arch, pool)
            else:
                r[tag] = answer(tag, arch)

    # remaining questions gated on the pathway
    for tag in QS:
        if tag in r or tag == "Q9":
            continue
        codes = activity_of(tag)
        if codes:
            continue                        # activity-gated, not selected
        t, sel = qtype(tag)
        txt = clean(QS[tag]["QuestionText"]).lower()
        student_only = any(k in txt for k in ["school", "year 11", "subject"])
        if is_student and "course" in txt and "school" not in txt:
            continue
        if not is_student and student_only and "left school" not in txt:
            continue
        if random.random() < 0.12:          # some skipped
            continue
        if t == "TE":
            pool = (arch["subj"] if "subject" in txt else
                    arch["jobs"] if "job" in txt or "career" in txt else arch["mem"])
            r[tag] = answer(tag, arch, pool)
        else:
            r[tag] = answer(tag, arch)
    return r


# ------------------------------------------------------------------- rendering
def render(val, numeric):
    if val is None:
        return ""
    if isinstance(val, list):
        return ",".join(v[0] if numeric else v[1] for v in val)
    code, label = val
    return code if (numeric and code) else label


rows_text, rows_num = [], []
start = datetime(2026, 9, 14, 9, 0)

for i in range(N):
    r = build()
    t0 = start + timedelta(days=random.randint(0, 28), minutes=random.randint(0, 420))
    dur = random.randint(300, 1900)
    finished = random.random() < 0.89
    meta = {
        "StartDate": t0.strftime("%Y-%m-%d %H:%M:%S"),
        "EndDate": (t0 + timedelta(seconds=dur)).strftime("%Y-%m-%d %H:%M:%S"),
        "Status": "IP Address",
        "IPAddress": "",
        "Progress": "100" if finished else str(random.choice([24, 47, 71])),
        "Duration (in seconds)": str(dur),
        "Finished": "True" if finished else "False",
        "RecordedDate": (t0 + timedelta(seconds=dur + 4)).strftime("%Y-%m-%d %H:%M:%S"),
        "ResponseId": f"R_MK{i:04d}{random.randint(100, 999)}",
        "DistributionChannel": "anonymous",
        "UserLanguage": "EN",
    }
    for numeric, sink in ((False, rows_text), (True, rows_num)):
        row = []
        for col in COLUMNS:
            if col in meta:
                row.append(meta[col])
                continue
            m = re.fullmatch(r"(Q\d+)_(\d+)", col)
            if m and m.group(1) in r and isinstance(r[m.group(1)], dict):
                row.append(render(r[m.group(1)].get(m.group(2)), numeric))
            elif col in r:
                row.append(render(r[col], numeric))
            else:
                row.append("")
        sink.append(row)

# header rows
label_row, import_row = [], []
for col in COLUMNS:
    m = re.fullmatch(r"(Q\d+)_(\d+)", col)
    if m and m.group(1) in QS and QS[m.group(1)]["QuestionType"] == "Matrix":
        base = clean(QS[m.group(1)]["QuestionText"])
        items = dict(statements(m.group(1)))
        label_row.append(f"{base} - {items.get(m.group(2), '')}")
    elif col in QS:
        label_row.append(clean(QS[col]["QuestionText"]))
    else:
        label_row.append(col)
    import_row.append(json.dumps({"ImportId": col}))

for fname, rows in (("mock_v3_text.csv", rows_text), ("mock_v3_numeric.csv", rows_num)):
    with open(fname, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        w.writerow(label_row)
        w.writerow(import_row)
        w.writerows(rows)

print(f"Generated {N} synthetic respondents against {QSF_PATH}")
print(f"  columns: {len(COLUMNS)}")
print(f"  mock_v3_text.csv / mock_v3_numeric.csv")
