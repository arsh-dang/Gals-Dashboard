#!/usr/bin/env node
// Reads the reshaped survey CSVs and writes classic-script JS data files
// under site/data/. Deliberately not JSON+fetch: this is a double-click,
// file://-openable static site, and fetch() of local files is blocked by
// browser CORS. Classic <script src> has no such restriction.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OUT_DIR = path.join(__dirname, '..', 'site', 'data');

const SMALL_CELL_THRESHOLD = 5;

// Q107 is a generic, non-activity-specific outcomes battery shown to
// everyone - the reshape script now reports it under this label instead of
// posing as an 8th "Other" activity. Still excluded from every activity
// comparison (it isn't one), but shown separately, not dropped.
const GENERAL_ACTIVITY_TYPE = 'General STEM outcomes (not activity-specific)';
const EXCLUDED_ACTIVITY_TYPES = new Set([GENERAL_ACTIVITY_TYPE]);

// Three outcome items exist under two wordings each. In every case, six of
// the seven real activities use one wording and "School club or lunchtime
// activity" alone uses the other - a wording-revision artifact, not three
// coincidences. Kept separate per instruction (not silently merged), but
// paired here so the dashboard can place them adjacently and merge them
// later by flipping MERGE_DUPLICATE_ITEMS in the browser config.
const ITEM_WORDING_PAIRS = [
  ['More interested about learning about STEM', 'More interested in learning about STEM'],
  ['More confident in communicating and sharing my ideas', 'More confident in sharing and communicating my ideas'],
  ['More comfortable working in teams', 'More confident in working in teams'],
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (c === '\r') {
      i += 1;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += c;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.length === header.length && !(r.length === 1 && r[0] === ''))
    .map((r) => {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = r[idx]; });
      return obj;
    });
}

function readCsv(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const text = fs.readFileSync(filePath, 'utf8');
  return parseCsv(text);
}

function buildItemWordingMap() {
  const map = new Map();
  ITEM_WORDING_PAIRS.forEach(([a, b], idx) => {
    map.set(a, { pairId: idx, partner: b });
    map.set(b, { pairId: idx, partner: a });
  });
  return map;
}

function main() {
  const respondentsRaw = readCsv('respondents.csv');
  const ratingsRaw = readCsv('activity_ratings.csv');

  // battery_selections.csv is missing from this data drop (the reshape
  // script that produces it needs survey_v3.qsf, which isn't present
  // either) - degrade to an empty, clearly-flagged dataset rather than
  // reusing the old file, whose ResponseIds belong to the previous 160-
  // respondent mock set and would silently mismatch the new 180.
  const SELECTIONS_PATH = path.join(DATA_DIR, 'battery_selections.csv');
  const selectionsRaw = fs.existsSync(SELECTIONS_PATH) ? readCsv('battery_selections.csv') : [];

  const respondentById = new Map();
  const respondents = respondentsRaw.map((r) => {
    const isSchoolStudent = r.is_school_student === 'Yes';
    // Contract says school/school_level are blank for post-school respondents.
    // One mock row broke that in the previous data drop - keep enforcing the
    // contract's rule over the raw cell defensively.
    const rec = {
      id: r.ResponseId,
      region: r.region,
      gender: r.gender,
      languageOtherThanEnglish: r.language_other_than_english === 'Yes',
      isSchoolStudent,
      school: isSchoolStudent ? (r.school || null) : null,
      schoolLevel: isSchoolStudent ? (r.school_level || null) : null,
      pathway: r.pathway,
      nActivities: Number(r.n_activities) || 0,
    };
    respondentById.set(rec.id, rec);
    return rec;
  });

  const wordingMap = buildItemWordingMap();

  // activity_ratings.csv now ships a `score` column: 1=No..4=Yes a lot,
  // higher is better, blank for "I do not know". Use it directly - no more
  // 5-minus-code inversion for display. `response_code` is the raw survey
  // value (1=Yes a lot) and is kept only for reference; never used for
  // charts. General-outcomes rows are NOT dropped here - they ship in
  // `ratings` like any other activity, and the frontend excludes them from
  // every activity/region comparison via meta.excludedActivityTypes, but
  // renders them on their own in a dedicated card.
  const ratings = ratingsRaw.map((r) => {
    const resp = respondentById.get(r.ResponseId);
    const isDontKnow = r.is_dont_know === 'True' || r.is_dont_know === 'TRUE';
    const wording = wordingMap.get(r.item) || null;
    return {
      id: r.ResponseId,
      activityType: r.activity_type,
      item: r.item,
      itemPairId: wording ? wording.pairId : null,
      response: r.response,
      score: r.score === '' ? null : Number(r.score),
      isDontKnow,
      region: resp ? resp.region : null,
      school: resp ? resp.school : null,
      schoolLevel: resp ? resp.schoolLevel : null,
      pathway: resp ? resp.pathway : null,
    };
  });

  // respondents.csv does not actually ship a did_gals column, despite the
  // brief describing one - derived instead from GALS activity participation
  // in activity_ratings.csv. This reproduces the ~60% rate described (111 of
  // 180 respondents here), so it's a reliable stand-in, not a guess.
  const galsParticipantIds = new Set(
    ratings.filter((r) => r.activityType === 'Girls as Leaders in STEM program').map((r) => r.id),
  );
  respondents.forEach((r) => { r.didGals = galsParticipantIds.has(r.id); });

  const selections = selectionsRaw
    .filter((r) => !EXCLUDED_ACTIVITY_TYPES.has(r.activity_type))
    .map((r) => {
      const resp = respondentById.get(r.ResponseId);
      return {
        id: r.ResponseId,
        activityType: r.activity_type,
        battery: r.battery,
        item: r.item,
        region: resp ? resp.region : null,
        school: resp ? resp.school : null,
        schoolLevel: resp ? resp.schoolLevel : null,
        pathway: resp ? resp.pathway : null,
      };
    });

  // --- aspirations.csv: a 10-item matrix about future-in-STEM, same score
  // convention as activity_ratings.csv (1=No..4=Yes a lot, blank/isDontKnow
  // excluded from averages). Not tied to any activity - the interesting cut
  // is didGals vs everyone else, not activity type.
  const aspirationsRaw = readCsv('aspirations.csv');
  const aspirations = aspirationsRaw.map((r) => {
    const resp = respondentById.get(r.ResponseId);
    const isDontKnow = r.is_dont_know === 'True' || r.is_dont_know === 'TRUE';
    return {
      id: r.ResponseId,
      item: r.item,
      score: r.score === '' ? null : Number(r.score),
      isDontKnow,
      region: resp ? resp.region : null,
      schoolLevel: resp ? resp.schoolLevel : null,
      pathway: resp ? resp.pathway : null,
      didGals: resp ? resp.didGals : false,
    };
  });

  // --- subject_career.csv: multi-select (and two single-choice) responses
  // about subject choice and career decisions, one row per ticked option.
  // `question` is kept exactly as supplied, including any "(post-school)"
  // suffix - checked against respondent pathway and confirmed that suffix
  // does NOT track who actually answered which wording (both pathways
  // answer both variants, in matching proportions). Grouping strictly by
  // the literal `question` string, as required, already keeps every
  // wording variant separate regardless of what drives the branching.
  const subjectCareerRaw = readCsv('subject_career.csv');
  const subjectCareer = subjectCareerRaw.map((r) => {
    const resp = respondentById.get(r.ResponseId);
    return {
      id: r.ResponseId,
      questionGroup: r.question_group,
      question: r.question,
      item: r.item,
      multiSelect: r.multi_select === 'True',
      region: resp ? resp.region : null,
      schoolLevel: resp ? resp.schoolLevel : null,
      pathway: resp ? resp.pathway : null,
      didGals: resp ? resp.didGals : false,
    };
  });

  // --- open_text.csv: optional. Not present in every data drop (branching
  // means most respondents never saw a free-text question), and the reshape
  // script that would produce it isn't in this drop either, so this reads it
  // if present and degrades to an empty, clearly-flagged dataset if not -
  // it never fabricates response text.
  //
  // Theme coding is a separate, optional join: an `open_text_themes.csv`
  // with columns ResponseId,question,theme, keyed the same way as
  // open_text.csv itself. Until that file exists every row's theme is null
  // and the UI shows "not yet coded" - the column is real, just unpopulated.
  const OPEN_TEXT_PATH = path.join(DATA_DIR, 'open_text.csv');
  const OPEN_TEXT_THEMES_PATH = path.join(DATA_DIR, 'open_text_themes.csv');

  const respondentActivities = new Map();
  ratings
    .filter((r) => !EXCLUDED_ACTIVITY_TYPES.has(r.activityType))
    .forEach((r) => {
      if (!respondentActivities.has(r.id)) respondentActivities.set(r.id, new Set());
      respondentActivities.get(r.id).add(r.activityType);
    });

  let openTextRaw = [];
  if (fs.existsSync(OPEN_TEXT_PATH)) {
    const text = fs.readFileSync(OPEN_TEXT_PATH, 'utf8');
    openTextRaw = parseCsv(text);
  }

  const themeByKey = new Map();
  if (fs.existsSync(OPEN_TEXT_THEMES_PATH)) {
    const text = fs.readFileSync(OPEN_TEXT_THEMES_PATH, 'utf8');
    parseCsv(text).forEach((r) => themeByKey.set(`${r.ResponseId}||${r.question}`, r.theme || null));
  }

  const openText = openTextRaw.map((r) => {
    const resp = respondentById.get(r.ResponseId);
    return {
      id: r.ResponseId,
      question: r.question,
      sourceColumn: r.source_column,
      response: r.response,
      region: resp ? resp.region : null,
      schoolLevel: resp ? resp.schoolLevel : null,
      pathway: resp ? resp.pathway : null,
      // Every activity this respondent has outcome ratings for - the survey
      // doesn't record which activity a free-text answer was about, so this
      // is "context", per the brief, not a claimed 1:1 link.
      activityTypes: respondentActivities.has(r.ResponseId) ? [...respondentActivities.get(r.ResponseId)] : [],
      theme: themeByKey.get(`${r.ResponseId}||${r.question}`) || null,
    };
  });

  // --- meta: counts the browser code would otherwise have to recompute on
  // every load, plus the facts the dashboard captions need to state.
  const activityRespondentIds = new Map();
  ratings.forEach((r) => {
    if (!activityRespondentIds.has(r.activityType)) activityRespondentIds.set(r.activityType, new Set());
    activityRespondentIds.get(r.activityType).add(r.id);
  });
  const activityTypes = [...activityRespondentIds.entries()]
    .map(([key, ids]) => ({ key, respondentCount: ids.size }))
    .sort((a, b) => (a.key === 'Girls as Leaders in STEM program' ? -1
      : b.key === 'Girls as Leaders in STEM program' ? 1
        : b.respondentCount - a.respondentCount));

  const activityTypesWithBattery = new Set(selections.map((s) => s.activityType));

  const regionCounts = new Map();
  respondents.forEach((r) => regionCounts.set(r.region, (regionCounts.get(r.region) || 0) + 1));
  const regions = [...regionCounts.entries()]
    .map(([key, count]) => ({ key, respondentCount: count }))
    .sort((a, b) => b.respondentCount - a.respondentCount);

  const schoolCounts = new Map();
  const schoolRegion = new Map();
  respondents.forEach((r) => {
    if (!r.school) return;
    schoolCounts.set(r.school, (schoolCounts.get(r.school) || 0) + 1);
    schoolRegion.set(r.school, r.region);
  });
  const schools = [...schoolCounts.entries()]
    .map(([key, count]) => ({ key, respondentCount: count, region: schoolRegion.get(key) }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const itemCounts = new Map();
  ratings
    .filter((r) => !EXCLUDED_ACTIVITY_TYPES.has(r.activityType))
    .forEach((r) => itemCounts.set(r.item, (itemCounts.get(r.item) || 0) + (r.isDontKnow ? 0 : 1)));
  const outcomeItems = [...itemCounts.keys()].map((item) => {
    const wording = wordingMap.get(item);
    return {
      item,
      pairId: wording ? wording.pairId : null,
      partner: wording ? wording.partner : null,
      answeredCount: itemCounts.get(item),
    };
  }).sort((a, b) => {
    // keep wording-variant pairs adjacent
    const ak = a.pairId !== null ? `p${a.pairId}` : a.item;
    const bk = b.pairId !== null ? `p${b.pairId}` : b.item;
    return ak.localeCompare(bk) || a.item.localeCompare(b.item);
  });

  const aspirationItems = [...new Set(aspirations.map((a) => a.item))];

  const subjectCareerQuestionMap = new Map();
  subjectCareer.forEach((r) => {
    if (!subjectCareerQuestionMap.has(r.question)) {
      subjectCareerQuestionMap.set(r.question, {
        question: r.question,
        questionGroup: r.questionGroup,
        multiSelect: r.multiSelect,
        respondentIds: new Set(),
      });
    }
    subjectCareerQuestionMap.get(r.question).respondentIds.add(r.id);
  });
  const subjectCareerQuestions = [...subjectCareerQuestionMap.values()].map((q) => ({
    question: q.question,
    questionGroup: q.questionGroup,
    multiSelect: q.multiSelect,
    respondentCount: q.respondentIds.size,
    galsCount: [...q.respondentIds].filter((id) => galsParticipantIds.has(id)).length,
    nonGalsCount: [...q.respondentIds].filter((id) => !galsParticipantIds.has(id)).length,
  }));

  const didGalsCounts = {
    gals: respondents.filter((r) => r.didGals).length,
    nonGals: respondents.filter((r) => !r.didGals).length,
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    totalRespondents: respondents.length,
    didGalsCounts,
    aspirationItems,
    subjectCareerQuestions,
    smallCellThreshold: SMALL_CELL_THRESHOLD,
    generalActivityType: GENERAL_ACTIVITY_TYPE,
    excludedActivityTypes: [...EXCLUDED_ACTIVITY_TYPES],
    batterySelectionsAvailable: selectionsRaw.length > 0,
    activityTypesWithBattery: [...activityTypesWithBattery],
    activityTypes,
    regions,
    schools,
    outcomeItems,
    // score: 1=No, 2=Maybe, 3=Yes a little, 4=Yes a lot - higher is better,
    // used directly with no inversion. "I do not know" isn't a scale
    // position here; it's carried separately as isDontKnow and excluded
    // from every average.
    scale: {
      order: [1, 2, 3, 4],
      labels: { 1: 'No', 2: 'Maybe', 3: 'Yes a little', 4: 'Yes a lot' },
      goodDirection: 'high',
    },
    openText: {
      available: openText.length > 0,
      count: openText.length,
      questions: [...new Set(openText.map((r) => r.question))].sort(),
      themesAvailable: themeByKey.size > 0,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const write = (name, value) => {
    fs.writeFileSync(
      path.join(OUT_DIR, name),
      `window.SIT_DATA = window.SIT_DATA || {};\nwindow.SIT_DATA.${name.replace('.js', '')} = ${JSON.stringify(value)};\n`,
    );
  };
  write('respondents.js', respondents);
  write('ratings.js', ratings);
  write('selections.js', selections);
  write('aspirations.js', aspirations);
  write('subjectCareer.js', subjectCareer);
  write('openText.js', openText);
  write('meta.js', meta);

  console.log(`Wrote ${respondents.length} respondents (${didGalsCounts.gals} GALS, ${didGalsCounts.nonGals} non-GALS), ${ratings.length} ratings, ${selections.length} selections, ${aspirations.length} aspiration ratings, ${subjectCareer.length} subject/career selections, ${openText.length} open-text responses.`);
  console.log(`Activity types (general outcomes excluded from comparison): ${activityTypes.map((a) => `${a.key} (${a.respondentCount})`).join(', ')}`);
  if (!openText.length) {
    console.log('No open_text.csv found in data/ - open-text.html will render its empty state.');
  }
  if (!selectionsRaw.length) {
    console.log('No battery_selections.csv found in data/ - skills-and-identity views will render their empty state.');
  }
}

main();
