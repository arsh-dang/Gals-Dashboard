"""Every label build/build.js looks up by exact string must exist in the exported CSVs.

build.js selects rows with strict string equality (a question wording, an activity
name, an item). If a relabel makes one of those miss, the chart it feeds silently
draws nothing. This reads the strings out of build.js itself and checks each one
against the CSVs, so the check cannot drift from the code it protects.
"""
import re

import pandas as pd
import pytest

import sitdb
from conftest import REFERENCE

BUILD_JS = (sitdb.REPO_DIR / "build" / "build.js").read_text(encoding="utf-8")


def strings(block):
    return re.findall(r"'([^']+)'", block)


def const_string(name):
    m = re.search(rf"const {name} = '([^']+)';", BUILD_JS)
    assert m, f"could not find const {name} in build.js (was it renamed? update this test)"
    return m.group(1)


def const_array(name):
    m = re.search(rf"const {name} = \[(.*?)\];", BUILD_JS, re.S)
    assert m, f"could not find const {name} in build.js"
    return strings(m.group(1))


def lookups():
    """Everything build.js looks up, as {what: (table, column, wanted values)}."""
    pairs = const_array("ITEM_WORDING_PAIRS")
    shared = re.findall(r"subject: '([^']+)', career: '([^']+)'", BUILD_JS)
    return {
        "question_wordings": [const_string(n) for n in (
            "SUBJECT_CHOICE_QUESTION", "CAREER_CHOICE_QUESTION", "SUBJECT_INTEREST_QUESTION", "SUBJECT_PERCEPTION_QUESTION")],
        "open_text_question": const_string("JOBS_IMAGINED_QUESTION"),
        "activities": [const_string("GENERAL_ACTIVITY_TYPE"), "Girls as Leaders in STEM program"],
        "wording_pair_items": pairs,
        "subject_items": [s for s, _c in shared] + const_array("SUBJECT_ONLY_INFLUENCES"),
        "career_items": [c for _s, c in shared] + const_array("CAREER_ONLY_INFLUENCES"),
    }


def missing(folder):
    """Labels build.js needs that the CSVs in `folder` do not contain."""
    read = lambda n: pd.read_csv(f"{folder}/{n}.csv", dtype=str, keep_default_na=False)
    sc, ot, ar = read("subject_career"), read("open_text"), read("activity_ratings")
    want = lookups()
    out = []
    for q in want["question_wordings"]:
        if q not in set(sc.question):
            out.append(f"subject_career question: {q!r}")
    if want["open_text_question"] not in set(ot.question):
        out.append(f"open_text question: {want['open_text_question']!r}")
    for a in want["activities"]:
        if a not in set(ar.activity_type):
            out.append(f"activity_ratings activity_type: {a!r}")
    for i in want["wording_pair_items"]:
        if i not in set(ar["item"]):
            out.append(f"activity_ratings item: {i!r}")
    subject_q, career_q = const_string("SUBJECT_CHOICE_QUESTION"), const_string("CAREER_CHOICE_QUESTION")
    for i in want["subject_items"]:
        if i not in set(sc[sc.question == subject_q]["item"]):
            out.append(f"option {i!r} under {subject_q!r}")
    for i in want["career_items"]:
        if i not in set(sc[sc.question == career_q]["item"]):
            out.append(f"option {i!r} under {career_q!r}")
    return out


def test_the_parser_found_what_it_should():
    want = lookups()
    assert len(want["question_wordings"]) == 4 and len(want["wording_pair_items"]) == 6
    assert len(want["subject_items"]) == 10 and len(want["career_items"]) == 11


@pytest.mark.parametrize("folder", [sitdb.DATA_DIR, REFERENCE], ids=["data/", "reference/"])
def test_every_label_build_js_looks_up_exists_in_the_csvs(folder):
    assert missing(folder) == []


def test_a_relabel_is_caught(tmp_path):
    """The old, stale wording ("What helps decide future plans" with no suffix) empties a chart."""
    for name in ("subject_career", "open_text", "activity_ratings"):
        df = pd.read_csv(REFERENCE / f"{name}.csv", dtype=str, keep_default_na=False)
        if name == "subject_career":
            df["question"] = df["question"].str.replace(" (school students)", "", regex=False)
        df.to_csv(tmp_path / f"{name}.csv", index=False)
    problems = missing(tmp_path)
    assert any("What helps decide future plans (school students)" in p for p in problems)
