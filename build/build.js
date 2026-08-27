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

// Activity type dropped entirely: "Other" is not a real 8th program. All 134
// of its rows come from Q107, a single generic overall-STEM-outcomes battery
// that the reshape script bucketed under activity_type="Other". Keeping it
// would make it look like the second-biggest program in participation charts.
const EXCLUDED_ACTIVITY_TYPES = new Set(['Other']);

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
  const selectionsRaw = readCsv('battery_selections.csv');

  const respondentById = new Map();
  const respondents = respondentsRaw.map((r) => {
    const isSchoolStudent = r.is_school_student === 'Yes';
    // Contract says school/school_level are blank for post-school respondents.
    // One mock row breaks that (a stray open-text-looking value in `school`
    // and a populated `school_level` on a Post-school row) - trust the
    // contract's rule over the raw cell rather than surfacing the leak.
    const rec = {
      id: r.ResponseId,
      region: r.region,
      gender: r.gender,
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

  const ratings = ratingsRaw
    .filter((r) => !EXCLUDED_ACTIVITY_TYPES.has(r.activity_type))
    .map((r) => {
      const resp = respondentById.get(r.ResponseId);
      const isDontKnow = r.is_dont_know === 'True' || r.is_dont_know === 'TRUE';
      const code = Number(r.response_code);
      const wording = wordingMap.get(r.item) || null;
      return {
        id: r.ResponseId,
        activityType: r.activity_type,
        item: r.item,
        itemPairId: wording ? wording.pairId : null,
        response: r.response,
        code,
        score: isDontKnow ? null : code, // excluded from every average, per contract
        isDontKnow,
        region: resp ? resp.region : null,
        school: resp ? resp.school : null,
        schoolLevel: resp ? resp.schoolLevel : null,
        pathway: resp ? resp.pathway : null,
      };
    });

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
  ratings.forEach((r) => {
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
  ratings.forEach((r) => itemCounts.set(r.item, (itemCounts.get(r.item) || 0) + (r.isDontKnow ? 0 : 1)));
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

  const meta = {
    generatedAt: new Date().toISOString(),
    totalRespondents: respondents.length,
    smallCellThreshold: SMALL_CELL_THRESHOLD,
    excludedActivityTypes: [...EXCLUDED_ACTIVITY_TYPES],
    activityTypesWithBattery: [...activityTypesWithBattery],
    activityTypes,
    regions,
    schools,
    outcomeItems,
    scale: {
      order: [1, 2, 3, 4],
      labels: { 1: 'Yes a lot', 2: 'Yes a little', 3: 'Maybe', 4: 'No', 5: 'I do not know' },
      goodDirection: 'low',
      dontKnowCode: 5,
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
  write('openText.js', openText);
  write('meta.js', meta);

  console.log(`Wrote ${respondents.length} respondents, ${ratings.length} ratings, ${selections.length} selections, ${openText.length} open-text responses.`);
  console.log(`Activity types (Other excluded): ${activityTypes.map((a) => `${a.key} (${a.respondentCount})`).join(', ')}`);
  if (!openText.length) {
    console.log('No open_text.csv found in data/ - open-text.html will render its empty state.');
  }
}

main();
