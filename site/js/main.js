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
  const genderColors = { female: U.cssVar('--series-2'), male: U.cssVar('--series-3') };

  const { aspirations, subjectCareer, openText } = window.SIT_DATA;

  const state = {
    region: '',
    schoolLevel: '',
    outcomesMode: 'average',
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
      { value: meta.totalRespondents, label: 'Respondents' },
      { value: meta.regions.length, label: 'Regions' },
      { value: activityCount, label: 'Activity types' },
      { value: meta.schools.length, label: 'Schools represented' },
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
      status.textContent = `Showing all ${respondents.length} respondents`;
    } else {
      status.textContent = `Showing ${n} of ${respondents.length} respondents`;
    }
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
        { label: 'Respondents', value: (d) => d.n, align: 'right' },
      ],
      rows: counts,
    });

    window.SIT.charts.renderSuppressionGrid(document.getElementById('chart-suppression-grid'), filteredRespondents(), meta);
  }

  // --- View 2: Outcomes ---------------------------------------------------
  function buildActivityLegend(container, activities) {
    container.innerHTML = '';
    activities.forEach((key) => {
      const item = document.createElement('span');
      item.className = 'legend__item';
      item.innerHTML = `<span class="legend__swatch" style="background:${activityColorScale(key)}"></span>${key}`;
      container.appendChild(item);
    });
  }

  const OUTCOMES_SUBTITLES = {
    average: 'Average score per activity, on the survey\'s 1–4 scale. 4 = Yes a lot is the best answer; "I do not know" is excluded from every average.',
    smallMultiples: 'Average score per outcome, one panel per activity. Every panel lists outcomes in the same order, so a row lines up across panels. Same 1–4 scale, 4 = Yes a lot is best.',
    distribution: '% of respondents choosing each answer, per activity, split around the Maybe / Yes a little midpoint. "I do not know" is shown separately, not folded into the 100%.',
  };

  function renderOutcomes() {
    const rr = excludeGeneral(filteredRatings());
    const activities = window.SIT.charts.outcomes.activityKeysOrdered(meta);
    const chartEl = document.getElementById('chart-outcomes');
    document.getElementById('outcomes-subtitle').textContent = OUTCOMES_SUBTITLES[state.outcomesMode];

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
        { label: 'Outcome statement', value: (d) => d.item },
        { label: 'Activity', value: (d) => d.activityType },
        { label: 'n', value: (d) => d.n, align: 'right' },
        { label: 'Average (4=best, 1=worst)', value: (d) => (d.suppressed ? 'suppressed' : U.formatScore(d.mean)), align: 'right' },
        {
          label: '95% CI',
          value: (d) => {
            if (d.suppressed) return '–';
            const ci = U.ciDisplayBounds(d);
            return ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'n too small';
          },
          align: 'right',
        },
        { label: '"I do not know"', value: (d) => (d.suppressed ? '–' : d.unknownN), align: 'right' },
      ],
      rows,
    });
  }

  // --- General STEM outcomes: shown once, not per activity/region --------
  function renderGeneralOutcomes() {
    const rr = filteredRatings().filter((r) => r.activityType === meta.generalActivityType);
    window.SIT.charts.outcomes.renderGeneral(document.getElementById('chart-general-outcomes'), rr, meta);
    const n = U.countDistinctIds(rr);
    document.getElementById('general-outcomes-n').textContent = `n=${n} in the current filter.`;
  }

  // --- View 3: Skills and identity -----------------------------------------
  function renderSkills() {
    const container = document.getElementById('chart-skills');
    const title = document.getElementById('skills-title');
    const note = document.getElementById('skills-note');

    if (!meta.batterySelectionsAvailable) {
      title.textContent = 'Skills and identity data is not available in this data drop';
      container.innerHTML = '';
      const msg = document.createElement('p');
      msg.className = 'card__note';
      msg.textContent = 'battery_selections.csv is missing from the current data drop (the script that produces it needs a survey definition file that isn\'t present either). This view will populate automatically once it\'s added and the site is rebuilt.';
      container.appendChild(msg);
      note.style.display = 'none';
      return;
    }

    note.style.display = '';
    title.textContent = state.battery === 'skills'
      ? 'What skills do participants say they built, by activity?'
      : 'How do participants describe themselves after taking part, by activity?';
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
      item.innerHTML = `<span class="legend__swatch" style="background:${regionColorScale(r.key)}"></span>${r.key}`;
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
        { label: 'Outcome statement', value: (d) => d.item },
        { label: 'Region', value: (d) => d.region },
        { label: 'n', value: (d) => d.n, align: 'right' },
        { label: 'Average (4=best, 1=worst)', value: (d) => (d.suppressed ? 'suppressed' : U.formatScore(d.mean)), align: 'right' },
        {
          label: '95% CI',
          value: (d) => {
            if (d.suppressed) return '–';
            const ci = U.ciDisplayBounds(d);
            return ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'n too small';
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
      <span class="legend__item"><span class="legend__swatch" style="background:${didGalsColors.gals}"></span>Took part in GALS (n=${meta.didGalsCounts.gals})</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${didGalsColors.nonGals}"></span>Did not take part in GALS (n=${meta.didGalsCounts.nonGals})</span>
    `;

    const tableContainer = document.getElementById('table-aspirations');
    tableContainer.innerHTML = '';
    const tableRows = [];
    meta.aspirationItems.forEach((item) => {
      [['gals', 'GALS'], ['nonGals', 'Not GALS']].forEach(([key, label]) => {
        const cellRows = rows.filter((r) => r.item === item && (key === 'gals' ? r.didGals : !r.didGals));
        const summary = U.summarizeScores(cellRows);
        tableRows.push({
          item, group: label, n: cellRows.length, suppressed: U.isSuppressed(cellRows.length), mean: summary.mean,
        });
      });
    });
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Aspiration statement', value: (d) => d.item },
        { label: 'Group', value: (d) => d.group },
        { label: 'n', value: (d) => d.n, align: 'right' },
        { label: 'Average (4=best, 1=worst)', value: (d) => (d.suppressed ? 'suppressed' : U.formatScore(d.mean)), align: 'right' },
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
        { label: 'Response', value: (d) => d.response },
        { label: 'Region', value: (d) => d.region || 'N/A' },
        { label: 'School year', value: (d) => d.schoolLevel || 'N/A' },
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
