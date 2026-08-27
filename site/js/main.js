(function () {
  'use strict';

  const U = window.SIT.utils;
  const { respondents, ratings, selections, meta } = window.SIT_DATA;

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  const activityColorScale = U.buildActivityColorScale(meta.activityTypes.map((a) => a.key));
  const regionColorScale = window.SIT.charts.regional.buildRegionColorScale(meta.regions.map((r) => r.key));

  const state = {
    region: '',
    schoolLevel: '',
    outcomesMode: 'average',
    battery: 'skills',
  };

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

  document.querySelectorAll('#threshold-label-1, #threshold-label-2, #threshold-label-3').forEach((el) => {
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

  document.querySelectorAll('[data-battery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.battery = btn.dataset.battery;
      document.querySelectorAll('[data-battery]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderSkills();
    });
  });

  // --- Filtered data accessors ------------------------------------------
  function filters() {
    return { region: state.region, schoolLevel: state.schoolLevel };
  }
  function filteredRatings() { return U.applyFilters(ratings, filters()); }
  function filteredSelections() { return U.applyFilters(selections, filters()); }
  function filteredRespondents() { return U.applyFilters(respondents, filters()); }

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
      const isGals = key === 'Girls as Leaders in STEM program';
      item.innerHTML = `<span class="legend__swatch" style="background:${activityColorScale(key)}"></span>${key}${isGals ? ' (all respondents)' : ''}`;
      container.appendChild(item);
    });
  }

  function renderOutcomes() {
    const rr = filteredRatings();
    const activities = window.SIT.charts.outcomes.activityKeysOrdered(meta);
    const chartEl = document.getElementById('chart-outcomes');
    const subtitle = document.getElementById('outcomes-subtitle');

    if (state.outcomesMode === 'average') {
      subtitle.textContent = 'Average score per activity, on the survey\'s 1–4 scale. 1 = Yes a lot is the best answer; "I do not know" is excluded from every average.';
      window.SIT.charts.outcomes.renderAverage(chartEl, rr, meta, activityColorScale);
      buildActivityLegend(document.getElementById('outcomes-activity-legend'), activities);
    } else {
      subtitle.textContent = '% of respondents choosing each answer, per activity. "I do not know" is shown separately, not folded into the 100%.';
      window.SIT.charts.outcomes.renderDistribution(chartEl, rr, meta, activityColorScale);
      document.getElementById('outcomes-activity-legend').innerHTML = '';
    }

    const tableContainer = document.getElementById('table-outcomes');
    tableContainer.innerHTML = '';
    const rows = meta.outcomeItems.flatMap((item) => window.SIT.charts.outcomes.cellsForItem(rr, item, activities));
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Outcome statement', value: (d) => d.item },
        { label: 'Activity', value: (d) => d.activityType },
        { label: 'n', value: (d) => d.n, align: 'right' },
        { label: 'Average (1=best, 4=worst)', value: (d) => (d.suppressed ? 'suppressed' : U.formatScore(d.mean)), align: 'right' },
        { label: '"I do not know"', value: (d) => (d.suppressed ? '–' : d.unknownN), align: 'right' },
      ],
      rows,
    });
  }

  // --- View 3: Skills and identity -----------------------------------------
  function renderSkills() {
    const title = document.getElementById('skills-title');
    title.textContent = state.battery === 'skills'
      ? 'What skills do participants say they built, by activity?'
      : 'How do participants describe themselves after taking part, by activity?';
    window.SIT.charts.skills.render(document.getElementById('chart-skills'), {
      selections: filteredSelections(),
      ratings: filteredRatings(),
      meta,
      battery: state.battery,
      colorScale: activityColorScale,
    });
  }

  // --- View 4: Regional comparison ------------------------------------------
  function renderRegional() {
    const rr = filteredRatings();
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
          unknownN: summary.unknownN,
        });
      });
    });
    U.renderDataTable(tableContainer, {
      columns: [
        { label: 'Outcome statement', value: (d) => d.item },
        { label: 'Region', value: (d) => d.region },
        { label: 'n', value: (d) => d.n, align: 'right' },
        { label: 'Average (1=best, 4=worst)', value: (d) => (d.suppressed ? 'suppressed' : U.formatScore(d.mean)), align: 'right' },
      ],
      rows,
    });
  }

  function renderAll() {
    updateFilterStatus();
    renderParticipation();
    renderOutcomes();
    renderSkills();
    renderRegional();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderAll, 200);
  });

  renderAll();
})();
