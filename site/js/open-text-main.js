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

  const PAGE_SIZE = 50;
  const state = { question: '', region: '', activity: '', page: 0 };

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

  questionSelect.addEventListener('change', () => { state.question = questionSelect.value; state.page = 0; render(); });
  regionSelect.addEventListener('change', () => { state.region = regionSelect.value; state.page = 0; render(); });
  activitySelect.addEventListener('change', () => { state.activity = activitySelect.value; state.page = 0; render(); });
  document.getElementById('filter-reset').addEventListener('click', () => {
    state.question = '';
    state.region = '';
    state.activity = '';
    state.page = 0;
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

  // A real data drop runs into the thousands of rows - unpaginated, that's
  // an unusable wall of text (and slow to render) regardless of how well
  // the filters narrow it down. 50 rows per page keeps the list scannable.
  function render() {
    const rows = filteredRows();
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.min(state.page, totalPages - 1);
    const start = state.page * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    const status = document.getElementById('filter-status');
    if (rows.length === 0) {
      status.textContent = `Showing 0 of ${openText.length} responses`;
    } else {
      status.textContent = `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, rows.length)} of ${rows.length} responses (filtered from ${openText.length} total)`;
    }

    const container = document.getElementById('open-text-list');
    container.innerHTML = '';
    U.renderDataTable(container, {
      columns: [
        { label: 'Response', value: (d) => d.response },
        { label: 'Question', value: (d) => d.question },
        { label: 'Region', value: (d) => d.region || 'N/A' },
        { label: 'School year', value: (d) => d.schoolLevel || 'N/A' },
        { label: 'Activities (context)', value: (d) => (d.activityTypes.length ? d.activityTypes.join(', ') : 'N/A') },
        { label: 'Theme', value: (d) => d.theme || 'Not yet coded' },
      ],
      rows: pageRows,
    });
    // The data table is normally a <details> disclosure behind a chart;
    // here the table IS the content, so force it open and hide the
    // "Show data table" toggle - leaving it visible would suggest this is
    // optional supporting detail rather than the whole page.
    const details = container.querySelector('details');
    if (details) {
      details.open = true;
      const summary = details.querySelector('summary');
      if (summary) summary.style.display = 'none';
    }

    renderPager(totalPages);
  }

  function renderPager(totalPages) {
    const pager = document.getElementById('open-text-pager');
    pager.innerHTML = '';
    if (totalPages <= 1) return;

    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'pager__button';
    prev.textContent = 'Previous';
    prev.disabled = state.page === 0;
    prev.addEventListener('click', () => { state.page -= 1; render(); });

    const status = document.createElement('span');
    status.className = 'pager__status';
    status.textContent = `Page ${state.page + 1} of ${totalPages}`;

    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'pager__button';
    next.textContent = 'Next';
    next.disabled = state.page >= totalPages - 1;
    next.addEventListener('click', () => { state.page += 1; render(); });

    pager.appendChild(prev);
    pager.appendChild(status);
    pager.appendChild(next);
  }

  render();
})();
