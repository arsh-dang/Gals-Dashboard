(function () {
  'use strict';

  const U = window.SIT.utils;
  const { ratings, selections, meta } = window.SIT_DATA;

  const activityColorScale = U.buildActivityColorScale(meta.activityTypes.map((a) => a.key));

  const state = { school: '', battery: 'skills' };

  const schoolSelect = document.getElementById('filter-school');
  meta.schools.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = `${s.key} (${s.respondentCount})`;
    schoolSelect.appendChild(opt);
  });

  document.querySelectorAll('#threshold-label-1, #threshold-label-2, #threshold-label-suppressed').forEach((el) => {
    el.textContent = meta.smallCellThreshold;
  });

  schoolSelect.addEventListener('change', () => { state.school = schoolSelect.value; render(); });

  document.querySelectorAll('[data-battery]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.battery = btn.dataset.battery;
      document.querySelectorAll('[data-battery]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderSkills();
    });
  });

  let schoolRatings = [];
  let schoolSelections = [];

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
    const noSchoolMsg = document.getElementById('no-school-message');
    const suppressedMsg = document.getElementById('suppressed-message');
    const content = document.getElementById('teacher-content');
    const status = document.getElementById('filter-status');

    if (!state.school) {
      noSchoolMsg.style.display = '';
      suppressedMsg.style.display = 'none';
      content.style.display = 'none';
      status.textContent = '';
      return;
    }

    schoolRatings = ratings.filter((r) => r.school === state.school);
    schoolSelections = selections.filter((s) => s.school === state.school);
    const n = U.countDistinctIds(schoolRatings);
    status.textContent = `${n} student${n === 1 ? '' : 's'} at ${state.school}`;

    if (U.isSuppressed(n)) {
      noSchoolMsg.style.display = 'none';
      suppressedMsg.style.display = '';
      content.style.display = 'none';
      document.getElementById('suppressed-badge').textContent = `${state.school}: n=${n}, suppressed`;
      return;
    }

    noSchoolMsg.style.display = 'none';
    suppressedMsg.style.display = 'none';
    content.style.display = '';

    document.getElementById('snapshot-title').textContent = `How many of your ${n} students took part in each activity?`;

    window.SIT.charts.renderActivityBars(document.getElementById('chart-teacher-participation'), schoolRatings, meta, activityColorScale);

    window.SIT.charts.teacherBenchmark.render(document.getElementById('chart-teacher-benchmark'), {
      schoolRatings,
      allRatings: ratings,
      meta,
    });

    window.SIT.charts.outcomes.renderDistribution(document.getElementById('chart-teacher-outcomes'), schoolRatings, meta, activityColorScale);

    renderSkills();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  });

  render();
})();
