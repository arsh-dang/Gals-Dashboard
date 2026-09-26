(function () {
  'use strict';

  const U = window.SIT.utils;
  const { respondents, ratings, selections, meta } = window.SIT_DATA;

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  // Excluded types (General STEM outcomes) must not be passed in here: they
  // still consumed a colour slot even though no chart ever displays them,
  // which pushed a real activity (University programs) into the same
  // series-7 slot reserved for GALS - both rendered identically everywhere
  // this scale was used, indistinguishable in the legend and every chart.
  const activityColorScale = U.buildActivityColorScale(
    meta.activityTypes.filter((a) => !meta.excludedActivityTypes.includes(a.key)).map((a) => a.key),
  );
  const regionColorScale = window.SIT.charts.regional.buildRegionColorScale(meta.regions.map((r) => r.key));
  // GALS is --series-7 everywhere it appears (activity charts via
  // buildActivityColorScale, and here) - it was brand-primary in the
  // GALS-split charts only, which meant the same category read as two
  // different colours depending which chart you were looking at.
  const didGalsColors = { gals: U.cssVar('--series-7'), nonGals: U.cssVar('--series-6') };
  // --series-3, not --series-7, so "Male" doesn't collide with the GALS
  // colour directly above it in this same section.
  const genderColors = {
    Female: U.cssVar('--series-2'),
    Male: U.cssVar('--series-3'),
    'Non-binary / third gender': U.cssVar('--series-4'),
    'Prefer not to say': U.cssVar('--series-8'),
  };

  const { aspirations, subjectCareer, openText } = window.SIT_DATA;

  const state = {
    region: '',
    schoolLevel: '',
    outcomesMode: 'average',
    mobileActivity: '',
    battery: 'skills',
    jobsExpanded: false,
  };
  const JOBS_PREVIEW_COUNT = 6;

  U.renderFooterDate('data-refreshed');

  // --- KPI snapshot: whole-sample orientation, independent of the filter
  // bar below (which already shows a filtered count in filter-status) - so
  // this doesn't need to re-render on every filter change.
  (function renderKpiRow() {
    const activityCount = meta.activityTypes.filter((a) => !meta.excludedActivityTypes.includes(a.key)).length;
    const tiles = [
      { value: meta.totalRespondents, label: 'People who answered' },
      { value: meta.regions.length, label: 'Regions' },
      { value: activityCount, label: 'Activities' },
      { value: meta.schools.length, label: 'Schools' },
    ];
    const row = document.getElementById('kpi-row');
    tiles.forEach((t) => {
      const tile = document.createElement('div');
      tile.className = 'kpi-tile';
      tile.innerHTML = `<div class="kpi__value">${t.value}</div><div class="kpi__label">${t.label}</div>`;
      row.appendChild(tile);
    });
  })();

  // --- Filter bar setup -----------------------------------------------
  const regionSelect = document.getElementById('filter-region');
  meta.regions.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.key;
    opt.textContent = `${r.key} (${r.respondentCount})`;
    regionSelect.appendChild(opt);
  });

  const schoolLevelSelect = document.getElementById('filter-school-level');
  const availableLevels = YEAR_ORDER.filter((lvl) => respondents.some((r) => r.schoolLevel === lvl));
  availableLevels.forEach((lvl) => {
    const opt = document.createElement('option');
    opt.value = lvl;
    opt.textContent = lvl;
    schoolLevelSelect.appendChild(opt);
  });

  // Mobile fallback for Outcomes by activity: seven overlapping series with
  // confidence intervals doesn't reflow into something a phone can read, so
  // instead of squeezing that chart, mobile picks one activity at a time
  // and shows a sorted list for it (see renderOutcomesMobile below).
  const outcomesActivitySelect = document.getElementById('outcomes-activity-select');
  const mobileActivities = window.SIT.charts.outcomes.activityKeysOrdered(meta);
  mobileActivities.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    outcomesActivitySelect.appendChild(opt);
  });
  state.mobileActivity = mobileActivities[0] || '';
  outcomesActivitySelect.addEventListener('change', () => {
    state.mobileActivity = outcomesActivitySelect.value;
    renderOutcomesMobile();
  });

  document.querySelectorAll('#threshold-label-1, #threshold-label-2, #threshold-label-3, #threshold-label-4, #threshold-label-5, #threshold-label-6, #threshold-label-7').forEach((el) => {
    el.textContent = meta.smallCellThreshold;
  });

  regionSelect.addEventListener('change', () => { state.region = regionSelect.value; renderAll(); });
  schoolLevelSelect.addEventListener('change', () => { state.schoolLevel = schoolLevelSelect.value; renderAll(); });
  document.getElementById('filter-reset').addEventListener('click', () => {
    state.region = '';
    state.schoolLevel = '';
    regionSelect.value = '';
    schoolLevelSelect.value = '';
    renderAll();
  });

  document.querySelectorAll('[data-outcomes-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.outcomesMode = btn.dataset.outcomesMode;
      document.querySelectorAll('[data-outcomes-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderOutcomes();
    });
  });

  // General-outcomes rows are real data, shipped like any other activity,
  // but excluded from every activity/region comparison since they aren't
  // tied to one. Chart modules stay generic (they just render what they're
  // given) - this is the one place that decides what gets excluded.
  function excludeGeneral(rows) {
    return rows.filter((r) => r.activityType !== meta.generalActivityType);
  }

  document.querySelectorAll('[data-battery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.battery = btn.dataset.battery;
      document.querySelectorAll('[data-battery]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderSkills();
    });
  });

  document.getElementById('jobs-imagined-toggle').addEventListener('click', () => {
    state.jobsExpanded = !state.jobsExpanded;
    renderJobsImagined();
  });

  // --- Filtered data accessors ------------------------------------------
  function filters() {
    return { region: state.region, schoolLevel: state.schoolLevel };
  }
  function filteredRatings() { return U.applyFilters(ratings, filters()); }
  function filteredSelections() { return U.applyFilters(selections, filters()); }
  function filteredRespondents() { return U.applyFilters(respondents, filters()); }
  function filteredAspirations() { return U.applyFilters(aspirations, filters()); }
  function filteredSubjectCareer() { return U.applyFilters(subjectCareer, filters()); }
  function filteredOpenText() { return U.applyFilters(openText, filters()); }

  function updateFilterStatus() {
    const n = U.countDistinctIds(filteredRespondents());
    const status = document.getElementById('filter-status');
    if (!state.region && !state.schoolLevel) {
      status.textContent = `Showing all ${respondents.length} people who answered`;
    } else {
      status.textContent = `Showing ${n} of ${respondents.length} people who answered`;
    }
  }

  // --- Summary layer: plain sentences above the charts --------------------
  function renderProviderSummary() {
    const rr = excludeGeneral(filteredRatings());
    const { sentences } = window.SIT.summary.buildProviderSummary({ ratings: rr, meta });
    const list = document.getElementById('provider-summary-list');
    list.innerHTML = '';
    sentences.forEach((s) => {
      const li = document.createElement('li');
      li.textContent = s;
      list.appendChild(li);
    });
  }

  // --- View 1: Participation ---------------------------------------------
  function renderParticipation() {
    const rr = filteredRatings();
    window.SIT.charts.renderActivityBars(document.getElementById('chart-participation-bars'), rr, meta, activityColorScale);

    const tableContainer = document.getElementById('table-participation-bars');
    tableContainer.innerHTML = '';
    const counts = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => ({ key: a.key, n: U.countDistinctIds(rr.filter((r) => r.activityType === a.key)) }))
      .sort((a, b) => b.n - a.n);
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Activity', value: (d) => d.key },
        { label: 'People who answered', value: (d) => d.n, align: 'right' },
      ],
      rows: counts,
    });

    window.SIT.charts.renderSuppressionGrid(document.getElementById('chart-suppression-grid'), filteredRespondents(), meta);
    window.SIT.charts.renderSuppressionList(document.getElementById('chart-suppression-list'), filteredRespondents(), meta);
  }

  // --- View 2: Outcomes ---------------------------------------------------
  const markerFor = U.buildMarkerScale(window.SIT.charts.outcomes.activityKeysOrdered(meta));
  const regionMarkerFor = U.buildMarkerScale(meta.regions.map((r) => r.key));

  function buildActivityLegend(container, activities) {
    container.innerHTML = '';
    activities.forEach((key) => {
      const item = document.createElement('span');
      item.className = 'legend__item';
      item.innerHTML = `${U.legendMarker(markerFor(key), activityColorScale(key))}${key}`;
      container.appendChild(item);
    });
  }

  // These replace the card subtitle in index.html on every render, so they
  // follow the same one-sentence, point-first caption style.
  const OUTCOMES_SUBTITLES = {
    average: 'Average score for each activity, from 1 (No) to 4 (Yes a lot). Higher is more positive. "I do not know" answers are left out.',
    smallMultiples: 'Average score for each statement, with one panel per activity. Statements are in the same order in every panel.',
    single: 'Average score for the chosen activity, from 1 (No) to 4 (Yes a lot), highest to lowest.',
    distribution: 'Share of people giving each answer, for each activity. "I do not know" is shown separately and is not part of the 100%.',
  };

  // Mobile fallback: one activity at a time, sorted best to worst, same
  // single-colour lollipop as the general-outcomes chart below (no new
  // chart code needed - it already IS "a sorted list with a value and a
  // small inline bar", just fed one activity's rows instead of the
  // general-outcomes block's).
  function renderOutcomesMobile() {
    const rr = excludeGeneral(filteredRatings()).filter((r) => r.activityType === state.mobileActivity);
    window.SIT.charts.outcomes.renderGeneral(document.getElementById('chart-outcomes-mobile'), rr, meta);
  }

  function renderOutcomes() {
    const rr = excludeGeneral(filteredRatings());
    const activities = window.SIT.charts.outcomes.activityKeysOrdered(meta);
    const chartEl = document.getElementById('chart-outcomes');
    document.getElementById('outcomes-subtitle').textContent = OUTCOMES_SUBTITLES[state.outcomesMode];
    const single = state.outcomesMode === 'single';
    document.getElementById('outcomes-multi').style.display = single ? 'none' : '';
    document.getElementById('outcomes-single').style.display = single ? '' : 'none';
    if (single) {
      renderOutcomesMobile();
      return;
    }

    const legendEl = document.getElementById('outcomes-activity-legend');
    const noteEl = document.getElementById('outcomes-note');
    const showLegendAndNote = state.outcomesMode !== 'distribution';
    noteEl.style.display = showLegendAndNote ? '' : 'none';

    if (state.outcomesMode === 'average') {
      window.SIT.charts.outcomes.renderAverage(chartEl, rr, meta, activityColorScale);
      buildActivityLegend(legendEl, activities);
    } else if (state.outcomesMode === 'smallMultiples') {
      window.SIT.charts.outcomes.renderSmallMultiples(chartEl, rr, meta, activityColorScale);
      legendEl.innerHTML = '';
    } else {
      window.SIT.charts.outcomes.renderDistribution(chartEl, rr, meta, activityColorScale);
      legendEl.innerHTML = '';
    }

    const tableContainer = document.getElementById('table-outcomes');
    tableContainer.innerHTML = '';
    const rows = meta.outcomeItems.flatMap((item) => window.SIT.charts.outcomes.cellsForItem(rr, item, activities));
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Statement', value: (d) => d.item },
        { label: 'Activity', value: (d) => d.activityType },
        { label: 'People', value: (d) => d.n, align: 'right' },
        { label: 'Average score (1 = No, 4 = Yes a lot)', value: (d) => (d.suppressed ? 'hidden for privacy' : U.formatScore(d.mean)), align: 'right' },
        {
          label: 'Likely range (95% confidence interval)',
          value: (d) => {
            if (d.suppressed) return '–';
            const ci = U.ciDisplayBounds(d);
            return ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'Too few people to estimate';
          },
          align: 'right',
        },
        { label: 'People who answered "I do not know"', value: (d) => (d.suppressed ? '–' : d.unknownN), align: 'right' },
      ],
      rows,
    });
  }

  // --- General STEM outcomes: shown once, not per activity/region --------
  function renderGeneralOutcomes() {
    const rr = filteredRatings().filter((r) => r.activityType === meta.generalActivityType);
    window.SIT.charts.outcomes.renderGeneral(document.getElementById('chart-general-outcomes'), rr, meta);
    const n = U.countDistinctIds(rr);
    document.getElementById('general-outcomes-n').textContent = `${n} people answered with the current filters.`;
  }

  // --- View 3: Skills and identity -----------------------------------------
  function renderSkills() {
    const container = document.getElementById('chart-skills');
    const title = document.getElementById('skills-title');
    const note = document.getElementById('skills-note');

    if (!meta.batterySelectionsAvailable) {
      title.textContent = 'This information is not available yet';
      container.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'card__note';
      msg.textContent = 'It will appear here once it has been added to the data.';
      container.appendChild(msg);
      note.style.display = 'none';
      return;
    }

    note.style.display = '';
    title.textContent = state.battery === 'skills'
      ? 'What skills do students say they built, by activity?'
      : 'How did students feel others saw them after taking part, by activity?';
    window.SIT.charts.skills.render(container, {
      selections: filteredSelections(),
      ratings: excludeGeneral(filteredRatings()),
      meta,
      battery: state.battery,
      colorScale: activityColorScale,
    });
  }

  // --- View 4: Regional comparison ------------------------------------------
  function renderRegional() {
    const rr = excludeGeneral(filteredRatings());
    window.SIT.charts.regional.render(document.getElementById('chart-regional'), rr, meta, regionColorScale);

    const legend = document.getElementById('regional-legend');
    legend.innerHTML = '';
    meta.regions.forEach((r) => {
      const item = document.createElement('span');
      item.className = 'legend__item';
      item.innerHTML = `${U.legendMarker(regionMarkerFor(r.key), regionColorScale(r.key))}${r.key}`;
      legend.appendChild(item);
    });

    const tableContainer = document.getElementById('table-regional');
    tableContainer.innerHTML = '';
    const rows = [];
    meta.outcomeItems.forEach((item) => {
      meta.regions.forEach((region) => {
        const cellRows = rr.filter((r) => r.item === item.item && r.region === region.key);
        const summary = U.summarizeScores(cellRows);
        rows.push({
          item: item.item,
          region: region.key,
          n: cellRows.length,
          suppressed: U.isSuppressed(cellRows.length),
          mean: summary.mean,
          ciMargin: summary.ciMargin,
          unknownN: summary.unknownN,
        });
      });
    });
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Statement', value: (d) => d.item },
        { label: 'Region', value: (d) => d.region },
        { label: 'People', value: (d) => d.n, align: 'right' },
        { label: 'Average score (1 = No, 4 = Yes a lot)', value: (d) => (d.suppressed ? 'hidden for privacy' : U.formatScore(d.mean)), align: 'right' },
        {
          label: 'Likely range (95% confidence interval)',
          value: (d) => {
            if (d.suppressed) return '–';
            const ci = U.ciDisplayBounds(d);
            return ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'Too few people to estimate';
          },
          align: 'right',
        },
      ],
      rows,
    });
  }

  // --- View 5: Aspirations and subject choice -------------------------------
  function renderAspirations() {
    const rows = filteredAspirations();
    window.SIT.charts.aspirations.render(document.getElementById('chart-aspirations'), rows, meta, didGalsColors);

    const legend = document.getElementById('aspirations-legend');
    legend.innerHTML = `
      <span class="legend__item"><span class="legend__swatch" style="background:${didGalsColors.gals}"></span>Took part in GALS (${meta.didGalsCounts.gals} people)</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${didGalsColors.nonGals}"></span>Did not take part in GALS (${meta.didGalsCounts.nonGals} people)</span>
    `;

    const tableContainer = document.getElementById('table-aspirations');
    tableContainer.innerHTML = '';
    const tableRows = [];
    meta.aspirationItems.forEach((item) => {
      [['gals', 'Took part in GALS'], ['nonGals', 'Did not take part in GALS']].forEach(([key, label]) => {
        const cellRows = rows.filter((r) => r.item === item && (key === 'gals' ? r.didGals : !r.didGals));
        const summary = U.summarizeScores(cellRows);
        tableRows.push({
          item, group: label, n: cellRows.length, suppressed: U.isSuppressed(cellRows.length), mean: summary.mean,
        });
      });
    });
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Statement', value: (d) => d.item },
        { label: 'Group', value: (d) => d.group },
        { label: 'People', value: (d) => d.n, align: 'right' },
        { label: 'Average score (1 = No, 4 = Yes a lot)', value: (d) => (d.suppressed ? 'hidden for privacy' : U.formatScore(d.mean)), align: 'right' },
      ],
      rows: tableRows,
    });
  }

  function questionRows(question) {
    return filteredSubjectCareer().filter((r) => r.question === question);
  }

  function renderSubjectChoiceInfluence() {
    window.SIT.charts.influences.renderByGender(document.getElementById('chart-subject-choice-influence'), {
      rows: questionRows(meta.subjectChoice.subjectQuestion),
      colors: genderColors,
    });
  }

  function renderCareerChoiceInfluence() {
    window.SIT.charts.influences.renderByGender(document.getElementById('chart-career-choice-influence'), {
      rows: questionRows(meta.subjectChoice.careerQuestion),
      colors: genderColors,
    });
  }

  function renderProgrammeInfluence() {
    const { subjectQuestion, careerQuestion } = meta.subjectChoice;
    window.SIT.charts.influences.renderProgrammeInfluence(document.getElementById('chart-programme-influence'), {
      subjectRows: questionRows(subjectQuestion),
      careerRows: questionRows(careerQuestion),
      meta,
      didGalsColors,
    });
  }

  function renderSubjectInterest() {
    window.SIT.charts.influences.renderByGender(document.getElementById('chart-subject-interest'), {
      rows: questionRows(meta.subjectChoice.subjectInterestQuestion),
      colors: genderColors,
    });
  }

  function renderSelfPerception() {
    window.SIT.charts.influences.renderByGender(document.getElementById('chart-self-perception'), {
      rows: questionRows(meta.subjectChoice.subjectPerceptionQuestion),
      colors: genderColors,
    });
  }

  function renderJobsImagined() {
    const rows = filteredOpenText().filter((r) => r.question === meta.subjectChoice.jobsImaginedQuestion);
    const container = document.getElementById('jobs-imagined-list');
    container.innerHTML = '';
    document.getElementById('jobs-imagined-status').textContent = `${rows.length} response${rows.length === 1 ? '' : 's'}`;

    // Restricted view by default - 146 rows dumped into one page is not
    // browsable, it's a wall of text. Expand/collapse instead of the usual
    // "Show data table" disclosure, since this list IS the card's content,
    // not optional detail behind a chart.
    const expanded = state.jobsExpanded || rows.length <= JOBS_PREVIEW_COUNT;
    const visibleRows = expanded ? rows : rows.slice(0, JOBS_PREVIEW_COUNT);

    U.renderDataTable(container, {
      columns: [
        { label: 'Answer', value: (d) => d.response },
        { label: 'Region', value: (d) => d.region || 'Not recorded' },
        { label: 'Year level', value: (d) => d.schoolLevel || 'Not recorded' },
      ],
      rows: visibleRows,
    });
    const details = container.querySelector('details');
    if (details) {
      details.open = true;
      const summary = details.querySelector('summary');
      if (summary) summary.style.display = 'none';
    }

    const more = document.getElementById('jobs-imagined-more');
    const toggle = document.getElementById('jobs-imagined-toggle');
    if (rows.length <= JOBS_PREVIEW_COUNT) {
      more.style.display = 'none';
    } else {
      more.style.display = '';
      toggle.textContent = state.jobsExpanded
        ? 'Show fewer'
        : `Show all ${rows.length} responses`;
    }
  }

  function renderAll() {
    updateFilterStatus();
    renderProviderSummary();
    renderParticipation();
    renderOutcomes();
    renderGeneralOutcomes();
    renderSkills();
    renderRegional();
    renderAspirations();
    renderSubjectChoiceInfluence();
    renderCareerChoiceInfluence();
    renderProgrammeInfluence();
    renderSubjectInterest();
    renderSelfPerception();
    renderJobsImagined();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 200);
  });

  renderAll();
})();
