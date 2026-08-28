(function () {
  'use strict';

  const U = window.SIT.utils;
  const { openText, meta } = window.SIT_DATA;

  U.renderFooterDate('data-refreshed');

  if (!meta.openText.available) {
    document.getElementById('unavailable-message').style.display = '';
    return;
  }

  document.getElementById('open-text-content').style.display = '';

  const state = { question: '', region: '', activity: '' };

  const questionSelect = document.getElementById('filter-question');
  meta.openText.questions.forEach((q) => {
    const opt = document.createElement('option');
    opt.value = q;
    opt.textContent = q;
    questionSelect.appendChild(opt);
  });

  const regionSelect = document.getElementById('filter-region');
  meta.regions.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.key;
    opt.textContent = r.key;
    regionSelect.appendChild(opt);
  });

  const activitySelect = document.getElementById('filter-activity');
  meta.activityTypes
    .filter((a) => !meta.excludedActivityTypes.includes(a.key))
    .forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.key;
      opt.textContent = a.key;
      activitySelect.appendChild(opt);
    });

  questionSelect.addEventListener('change', () => { state.question = questionSelect.value; render(); });
  regionSelect.addEventListener('change', () => { state.region = regionSelect.value; render(); });
  activitySelect.addEventListener('change', () => { state.activity = activitySelect.value; render(); });
  document.getElementById('filter-reset').addEventListener('click', () => {
    state.question = '';
    state.region = '';
    state.activity = '';
    questionSelect.value = '';
    regionSelect.value = '';
    activitySelect.value = '';
    render();
  });

  function filteredRows() {
    return openText.filter((r) => {
      if (state.question && r.question !== state.question) return false;
      if (state.region && r.region !== state.region) return false;
      if (state.activity && !r.activityTypes.includes(state.activity)) return false;
      return true;
    });
  }

  function render() {
    const rows = filteredRows();
    document.getElementById('filter-status').textContent = `Showing ${rows.length} of ${openText.length} responses`;

    const container = document.getElementById('open-text-list');
    container.innerHTML = '';
    U.renderDataTable(container, {
      columns: [
        { label: 'Response', value: (d) => d.response },
        { label: 'Question', value: (d) => d.question },
        { label: 'Region', value: (d) => d.region || '—' },
        { label: 'School year', value: (d) => d.schoolLevel || '—' },
        { label: 'Activities (context)', value: (d) => (d.activityTypes.length ? d.activityTypes.join(', ') : '—') },
        { label: 'Theme', value: (d) => d.theme || 'Not yet coded' },
      ],
      rows,
    });
    // The data table is normally a <details> disclosure behind a chart;
    // here the table IS the content, so open it by default.
    const details = container.querySelector('details');
    if (details) details.open = true;
  }

  render();
})();
