"""Build codebook rows (the question_item table) for one survey version.

From a QSF when there is one (question text, item wording, block, scale and
activity all come from the survey definition), otherwise worked out from the
already-reshaped tables (no question text or scale, flagged codebook_source =
'tidy').
"""
import re
import sys

from sitdb import DATA_DIR

sys.path.insert(0, str(DATA_DIR))
import reshape_v3  # noqa: E402  (importable since the refactor; nothing runs at import)

COLUMNS = [
    "survey_version", "source_column", "question_id", "item_id", "item_label",
    "question_text", "question_type", "block", "scale", "battery", "activity_type",
    "codebook_source",
]
COLUMN_RE = re.compile(r"^(Q\d+)(?:_(.+))?$")


def _block_names(qsf):
    """QuestionID (QID12) -> block description."""
    names = {}
    for el in qsf["SurveyElements"]:
        if el["Element"] != "BL":
            continue
        payload = el["Payload"]
        blocks = payload.values() if isinstance(payload, dict) else payload
        for block in blocks:
            for be in block.get("BlockElements", []):
                if be.get("Type") == "Question":
                    names[be["QuestionID"]] = block.get("Description")
    return names


def _scale(question, tag, tags_scored):
    qtype, selector = question["QuestionType"], question.get("Selector")
    if qtype == "Matrix" and tag in tags_scored:
        return "likert4_dk"
    if qtype == "Matrix":
        return "matrix"
    if qtype == "MC":
        return "multi_select" if selector in ("MAVR", "MACOL", "MAHR") else "single_choice"
    if qtype == "TE":
        return "free_text"
    return qtype.lower()


def _tag_roles(QS):
    """tag -> (battery, activity name or None), from reshape_v3's own mapping so
    the codebook and the reshaping can never disagree about which is which."""
    activity = reshape_v3.activity_names(QS)
    roles = {}
    for code, b in reshape_v3.BLOCKS.items():
        for key, battery in (("out", "outcomes"), ("skl", "skills"), ("idn", "identity")):
            if b.get(key):
                roles[b[key]] = (battery, activity.get(code, code))
    roles[reshape_v3.ASPIRATIONS_MATRIX] = ("aspirations", None)
    return roles


def from_qsf(qsf, QS, survey_version, export_columns=()):
    """One row per question, per choice (Q15_3) and per real export column."""
    blocks = _block_names(qsf)
    roles = _tag_roles(QS)
    scored = {t for t, (battery, _a) in roles.items() if battery in ("outcomes", "aspirations")}
    rows = {}

    def add(source_column, tag, item_id, item_label):
        q = QS[tag]
        qid = q.get("QuestionID") or f"QID{re.sub(r'[^0-9]', '', tag)}"
        battery, activity = roles.get(tag, (None, None))
        rows[source_column] = dict(
            survey_version=survey_version, source_column=source_column, question_id=tag,
            item_id=item_id, item_label=item_label,
            question_text=reshape_v3.clean(q.get("QuestionText", "")),
            question_type=q["QuestionType"], block=blocks.get(qid),
            scale="free_text" if str(item_id or "").endswith("_TEXT") else _scale(q, tag, scored), battery=battery, activity_type=activity,
            codebook_source="qsf",
        )

    for tag, q in QS.items():
        add(tag, tag, None, None)
        for cid, choice in q.get("Choices", {}).items():
            add(f"{tag}_{cid}", tag, str(cid), reshape_v3.clean(choice.get("Display", "")))
    for col in export_columns:  # e.g. Q100_8_TEXT: real columns the choices don't cover
        m = COLUMN_RE.match(col)
        if m and m.group(1) in QS and col not in rows:
            add(col, m.group(1), m.group(2), None)
    return list(rows.values())


def from_tidy(tables, survey_version):
    """Best effort from reshaped tables: which column carries which item/activity."""
    rows = {}

    def add(col, **kw):
        if not col or col in rows:
            return
        m = COLUMN_RE.match(col)
        rows[col] = dict(
            survey_version=survey_version, source_column=col,
            question_id=m.group(1) if m else col, item_id=m.group(2) if m else None,
            item_label=kw.get("item_label"), question_text=kw.get("question_text"),
            question_type=None, block=None, scale=kw.get("scale"), battery=kw.get("battery"),
            activity_type=kw.get("activity_type"), codebook_source="tidy",
        )

    for r in tables["activity_ratings"].itertuples(index=False):
        add(r.source_column, item_label=r.item, scale="likert4_dk", battery=r.battery,
            activity_type=r.activity_type)
    for r in tables["aspirations"].itertuples(index=False):
        add(r.source_column, item_label=r.item, scale="likert4_dk", battery="aspirations")
    for r in tables["battery_selections"].itertuples(index=False):
        add(r.source_column, scale="multi_select", battery=r.battery, activity_type=r.activity_type)
    for r in tables["subject_career"].itertuples(index=False):
        add(r.source_column, question_text=r.question,
            scale="multi_select" if r.multi_select in (True, "True") else "single_choice")
    for r in tables["open_text"].itertuples(index=False):
        add(r.source_column, question_text=r.question, scale="free_text")
    return list(rows.values())
