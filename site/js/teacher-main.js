(function () {
  'use strict';

  const U = window.SIT.utils;
  const { respondents, ratings, selections, meta } = window.SIT_DATA;

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  // Excluded types (general outcomes) must not take a colour slot - same
  // fix as main.js: unfiltered, University programs lands on the colour
  // reserved for GALS and the two become indistinguishable.
  const activityColorScale = U.buildActivityColorScale(
    meta.activityTypes.filter((a) => !meta.excludedActivityTypes.includes(a.key)).map((a) => a.key),
  );
  U.renderFooterDate('data-refreshed');

  const state = { region: '', school: '', schoolLevel: '', battery: 'skills' };

  const regionSelect = document.getElementById('filter-region');
  const schoolSelect = document.getElementById('filter-school');
  const schoolLevelSelect = document.getElementById('filter-school-level');

  meta.regions.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.key;
    opt.textContent = r.key;
    regionSelect.appendChild(opt);
  });

  function populateSchoolOptions() {
    const current = state.school;
    schoolSelect.innerHTML = '<option value="">Choose your school…</option>';
    meta.schools
      .filter((s) => !state.region || s.region === state.region)
      .forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = `${s.key} (${s.respondentCount})`;
        schoolSelect.appendChild(opt);
      });
    // Keep the current school selected if it's still in the filtered list;
    // a region change that excludes it clears the pick instead of silently
    // showing another school's data under the old label.
    const stillValid = [...schoolSelect.options].some((o) => o.value === current);
    schoolSelect.value = stillValid ? current : '';
    state.school = schoolSelect.value;
  }

  function populateSchoolLevelOptions() {
    schoolLevelSelect.innerHTML = '<option value="">All years at this school</option>';
    if (!state.school) {
      schoolLevelSelect.disabled = true;
      return;
    }
    const levels = YEAR_ORDER.filter((lvl) => respondents.some((r) => r.school === state.school && r.schoolLevel === lvl));
    levels.forEach((lvl) => {
      const opt = document.createElement('option');
      opt.value = lvl;
      opt.textContent = lvl;
      schoolLevelSelect.appendChild(opt);
    });
    schoolLevelSelect.disabled = levels.length === 0;
  }

  populateSchoolOptions();

  document.querySelectorAll('#threshold-label-1, #threshold-label-2, #threshold-label-suppressed').forEach((el) => {
    el.textContent = meta.smallCellThreshold;
  });

  regionSelect.addEventListener('change', () => {
    state.region = regionSelect.value;
    populateSchoolOptions();
    state.schoolLevel = '';
    populateSchoolLevelOptions();
    render();
  });

  schoolSelect.addEventListener('change', () => {
    state.school = schoolSelect.value;
    state.schoolLevel = '';
    populateSchoolLevelOptions();
    render();
  });

  schoolLevelSelect.addEventListener('change', () => { state.schoolLevel = schoolLevelSelect.value; render(); });

  document.getElementById('filter-reset').addEventListener('click', () => {
    state.region = '';
    state.school = '';
    state.schoolLevel = '';
    regionSelect.value = '';
    populateSchoolOptions();
    populateSchoolLevelOptions();
    render();
  });

  document.querySelectorAll('[data-battery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.battery = btn.dataset.battery;
      document.querySelectorAll('[data-battery]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderSkills();
    });
  });

  let schoolRatings = [];
  let schoolSelections = [];

  // General-outcomes rows aren't tied to an activity, so they'd otherwise
  // mix into "this school" and "all respondents" per-item averages
  // alongside real activity-specific answers from the same students.
  function excludeGeneral(rows) {
    return rows.filter((r) => r.activityType !== meta.generalActivityType);
  }

  function renderSkills() {
    const title = document.getElementById('skills-title');
    title.textContent = state.battery === 'skills'
      ? 'What skills do your students say they built, by activity?'
      : 'How do your students describe themselves after taking part, by activity?';
    window.SIT.charts.skills.render(document.getElementById('chart-teacher-skills'), {
      selections: schoolSelections,
      ratings: schoolRatings,
      meta,
      battery: state.battery,
      colorScale: activityColorScale,
    });
  }

  function render() {
    const gate = document.getElementById('teacher-gate');
    const gateTitle = document.getElementById('gate-title');
    const gateSubtitle = document.getElementById('gate-subtitle');
    const suppressedMsg = document.getElementById('suppressed-message');
    const content = document.getElementById('teacher-content');
    const status = document.getElementById('filter-status');

    if (!state.school) {
      gate.classList.remove('teacher-gate--active');
      gateTitle.textContent = 'Sign in to your cohort';
      gateSubtitle.textContent = 'Select your region and school to view your students\' results. This identifies your cohort; it isn\'t a secured login, since there\'s no real account behind this mock dataset.';
      suppressedMsg.style.display = 'none';
      content.style.display = 'none';
      status.textContent = '';
      return;
    }

    gate.classList.add('teacher-gate--active');
    gateTitle.textContent = `Signed in: ${state.school}`;
    gateSubtitle.textContent = `${state.region || meta.schools.find((s) => s.key === state.school).region}. Narrow by year below, or switch school.`;

    const cohortFilters = { school: state.school, schoolLevel: state.schoolLevel };
    schoolRatings = U.applyFilters(ratings, cohortFilters);
    schoolSelections = U.applyFilters(selections, cohortFilters);
    const n = U.countDistinctIds(schoolRatings);
    const levelSuffix = state.schoolLevel ? `, ${state.schoolLevel}` : '';
    status.textContent = `${n} student${n === 1 ? '' : 's'} at ${state.school}${levelSuffix}`;

    if (U.isSuppressed(n)) {
      suppressedMsg.style.display = '';
      content.style.display = 'none';
      document.getElementById('suppressed-badge').textContent = `${state.school}${levelSuffix}: n=${n}, suppressed`;
      return;
    }

    suppressedMsg.style.display = 'none';
    content.style.display = '';

    document.getElementById('snapshot-title').textContent = `How many of your ${n} students took part in each activity?`;

    window.SIT.charts.outcomes.renderDistribution(document.getElementById('chart-teacher-outcomes'), schoolRatings, meta, activityColorScale);

    window.SIT.charts.renderActivityBars(document.getElementById('chart-teacher-participation'), schoolRatings, meta, activityColorScale);

    renderSkills();

    window.SIT.charts.teacherBenchmark.render(document.getElementById('chart-teacher-benchmark'), {
      schoolRatings: excludeGeneral(schoolRatings),
      allRatings: excludeGeneral(ratings),
      meta,
    });
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });

  render();
})();
