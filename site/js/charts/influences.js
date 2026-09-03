// View 5, restructured: what influences subject choice and career choice.
// Two subject_career.csv questions ask essentially the same thing at
// different horizons ("what helps you choose subjects" / "what helps you
// choose your future") with overlapping but differently-worded options.
// meta.subjectChoice (built in build/build.js) supplies the hand-authored
// mapping between them - there's no shared key in the data to match on.
//
// Denominator for every percentage here is the distinct respondent count
// for the relevant QUESTION (not per-item), since a multi-select
// respondent who ticked nothing would otherwise silently vanish from the
// denominator. Suppression is evaluated per question (and per did_gals
// subgroup for the programme panel), independently for subject vs career,
// since one side can have enough respondents while the other doesn't.
(function () {
  'use strict';

  const U = window.SIT.utils;

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function pctOf(rows, item, denomIds) {
    if (!denomIds.size) return { n: 0, pct: 0 };
    const n = new Set(rows.filter((r) => r.item === item).map((r) => r.id)).size;
    return { n, pct: n / denomIds.size };
  }

  // --- Chart 1: shared influences, subject choice vs career choice --------
  function renderComparison(container, { subjectRows, careerRows, meta, colors }) {
    container.innerHTML = '';
    const { sharedInfluences, subjectOnlyInfluences, careerOnlyInfluences } = meta.subjectChoice;

    const subjectIds = new Set(subjectRows.map((r) => r.id));
    const careerIds = new Set(careerRows.map((r) => r.id));
    const subjectSuppressed = U.isSuppressed(subjectIds.size);
    const careerSuppressed = U.isSuppressed(careerIds.size);

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend__item"><span class="legend__swatch" style="background:${colors.subject}"></span>Shapes subject choice (n=${subjectIds.size})</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${colors.career}"></span>Shapes career choice (n=${careerIds.size})</span>
    `;
    container.appendChild(legend);

    const rows = sharedInfluences.map((inf) => ({
      canonical: inf.canonical,
      subject: pctOf(subjectRows, inf.subject, subjectIds),
      career: pctOf(careerRows, inf.career, careerIds),
    })).sort((a, b) => (b.subject.pct + b.career.pct) - (a.subject.pct + a.career.pct));

    const width = Math.max(container.clientWidth || 640, 640);
    const rowHeight = 40;
    const margin = {
      top: 8, right: 50, bottom: 4, left: 230,
    };
    const height = margin.top + margin.bottom + rows.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Grouped bar chart comparing what influences subject choice against what influences career choice');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(rows.map((r) => r.canonical)).range([margin.top, height - margin.bottom]).padding(0.3);
    const sub = d3.scaleBand().domain(['subject', 'career']).range([0, y.bandwidth()]).padding(0.15);

    svg.selectAll('line.gridline')
      .data([0, 0.25, 0.5, 0.75, 1])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    const tip = U.tooltip();

    rows.forEach((r) => {
      svg.append('text')
        .attr('class', 'item-row-label')
        .attr('x', margin.left - 12).attr('y', y(r.canonical) + y.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dy', '0.32em')
        .text(truncate(r.canonical, 34))
        .append('title').text(r.canonical);

      [['subject', r.subject, subjectSuppressed, colors.subject, 'Subject choice'], ['career', r.career, careerSuppressed, colors.career, 'Career choice']].forEach(([key, val, suppressed, color, label]) => {
        const barY = y(r.canonical) + sub(key);
        if (suppressed) {
          svg.append('text')
            .attr('x', margin.left + 8).attr('y', barY + sub.bandwidth() / 2)
            .attr('dy', '0.32em')
            .style('font-size', '0.65rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
          return;
        }
        svg.append('rect')
          .attr('x', margin.left).attr('width', Math.max(0, x(val.pct) - margin.left))
          .attr('y', barY).attr('height', sub.bandwidth())
          .attr('fill', color)
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>${r.canonical}<br>${U.formatPct(val.pct)} (n=${val.n})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', x(val.pct) + 6).attr('y', barY + sub.bandwidth() / 2)
          .attr('dy', '0.32em')
          .text(U.formatPct(val.pct));
      });
    });

    container.querySelector('svg').style.minWidth = '560px';

    // --- Separated group: options with no equivalent on the other side.
    // Shown below the comparison, not folded in, so nothing is silently
    // dropped and the shared-axis comparison above stays honest (every row
    // in it is a real like-for-like match).
    const divider = document.createElement('div');
    divider.className = 'influences-divider';
    divider.innerHTML = '<p class="card__note" style="margin-top:0;">Options that exist for only one of the two questions - not part of the comparison above, since there is nothing to compare them against.</p>';
    container.appendChild(divider);

    const uniqueGrid = document.createElement('div');
    uniqueGrid.className = 'influences-unique-grid';
    container.appendChild(uniqueGrid);

    function renderUniqueList(title, items, rowsData, ids, suppressed, color) {
      const box = document.createElement('div');
      box.className = 'influences-unique-box';
      const h = document.createElement('h4');
      h.textContent = title;
      box.appendChild(h);
      if (suppressed) {
        const badge = document.createElement('span');
        badge.className = 'badge-suppressed';
        badge.textContent = `Suppressed: n<${U.SMALL_CELL_THRESHOLD}`;
        box.appendChild(badge);
        uniqueGrid.appendChild(box);
        return;
      }
      const list = items.map((item) => ({ item, ...pctOf(rowsData, item, ids) }))
        .sort((a, b) => b.pct - a.pct);
      list.forEach((d) => {
        const line = document.createElement('div');
        line.className = 'influences-unique-line';
        line.innerHTML = `<span class="influences-unique-label">${d.item}</span><span class="influences-unique-bar-track"><span class="influences-unique-bar" style="width:${(d.pct * 100).toFixed(1)}%;background:${color}"></span></span><span class="influences-unique-pct">${U.formatPct(d.pct)}</span>`;
        box.appendChild(line);
      });
      uniqueGrid.appendChild(box);
    }

    renderUniqueList('Subject choice only', subjectOnlyInfluences, subjectRows, subjectIds, subjectSuppressed, colors.subject);
    renderUniqueList('Career choice only', careerOnlyInfluences, careerRows, careerIds, careerSuppressed, colors.career);
  }

  // --- Chart 2: programme influence, called out on its own, by did_gals --
  function renderProgrammeInfluence(container, { subjectRows, careerRows, meta, subjectColors, didGalsColors }) {
    container.innerHTML = '';
    const { programmeInfluenceLabel, sharedInfluences } = meta.subjectChoice;
    const programmePair = sharedInfluences.find((i) => i.canonical === programmeInfluenceLabel);

    const groups = [
      { label: 'Subject choice', rows: subjectRows, item: programmePair.subject, color: subjectColors.subject },
      { label: 'Career choice', rows: careerRows, item: programmePair.career, color: subjectColors.career },
    ];

    const width = Math.max(container.clientWidth || 520, 480);
    const rowHeight = 32;
    const margin = {
      top: 8, right: 50, bottom: 4, left: 210,
    };
    const height = margin.top + margin.bottom + groups.length * 2 * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Percentage of respondents citing STEM activities and programmes as an influence, split by GALS participation');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    svg.selectAll('line.gridline')
      .data([0, 0.25, 0.5, 0.75, 1])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    const tip = U.tooltip();
    let rowIndex = 0;

    groups.forEach((g) => {
      const ids = new Set(g.rows.map((r) => r.id));
      const galsIds = new Set(g.rows.filter((r) => r.didGals).map((r) => r.id));
      const nonGalsIds = new Set(g.rows.filter((r) => !r.didGals).map((r) => r.id));

      [['GALS', galsIds, didGalsColors.gals], ['Not GALS', nonGalsIds, didGalsColors.nonGals]].forEach(([label, subIds, color]) => {
        const barY = margin.top + rowIndex * rowHeight;
        const suppressed = U.isSuppressed(subIds.size);
        svg.append('text')
          .attr('class', 'item-row-label')
          .attr('x', margin.left - 12).attr('y', barY + rowHeight / 2 - 8)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .style('font-size', '0.7rem')
          .text(`${g.label} - ${label}`);

        if (suppressed) {
          svg.append('text')
            .attr('x', margin.left + 8).attr('y', barY + rowHeight / 2 - 8)
            .attr('dy', '0.32em')
            .style('font-size', '0.65rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        } else {
          const n = new Set(g.rows.filter((r) => r.item === g.item && subIds.has(r.id)).map((r) => r.id)).size;
          const pct = n / subIds.size;
          svg.append('rect')
            .attr('x', margin.left).attr('width', Math.max(0, x(pct) - margin.left))
            .attr('y', barY - 8).attr('height', rowHeight - 14)
            .attr('fill', color)
            .attr('tabindex', 0)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${g.label} - ${label}</strong>${U.formatPct(pct)} picked STEM activities/programmes as an influence (n=${n} of ${subIds.size})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
          svg.append('text')
            .attr('class', 'bar-label')
            .attr('x', x(pct) + 6).attr('y', barY + rowHeight / 2 - 15)
            .attr('dy', '0.32em')
            .text(U.formatPct(pct));
        }
        rowIndex += 1;
      });
    });

    container.querySelector('svg').style.minWidth = '420px';
  }

  // --- Chart 3 (both panels): a single multi-select question, no GALS
  // split, sorted frequency bars - reused for subject interest and for the
  // belonging/confidence items, styled by the caller to stay visually
  // distinct from the influence-comparison charts above.
  function renderSingleQuestion(container, { rows, color }) {
    container.innerHTML = '';
    const ids = new Set(rows.map((r) => r.id));
    const suppressed = U.isSuppressed(ids.size);

    if (suppressed) {
      const badge = document.createElement('span');
      badge.className = 'badge-suppressed';
      badge.textContent = `Suppressed: n<${U.SMALL_CELL_THRESHOLD}`;
      container.appendChild(badge);
      return;
    }

    const items = [...new Set(rows.map((r) => r.item))];
    const bars = items.map((item) => pctOf(rows, item, ids)).map((d, i) => ({ ...d, item: items[i] }))
      .sort((a, b) => b.pct - a.pct);

    const width = Math.max(container.clientWidth || 480, 420);
    const rowHeight = 26;
    const margin = {
      top: 4, right: 46, bottom: 4, left: 190,
    };
    const height = margin.top + margin.bottom + bars.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Percentage of respondents selecting each option');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(bars.map((d) => d.item)).range([margin.top, height - margin.bottom]).padding(0.28);

    const tip = U.tooltip();

    bars.forEach((d) => {
      svg.append('text')
        .attr('class', 'item-row-label')
        .style('font-size', '0.72rem')
        .attr('x', margin.left - 10).attr('y', y(d.item) + y.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dy', '0.32em')
        .text(truncate(d.item, 34))
        .append('title').text(d.item);

      svg.append('rect')
        .attr('x', margin.left).attr('width', Math.max(0, x(d.pct) - margin.left))
        .attr('y', y(d.item)).attr('height', y.bandwidth())
        .attr('fill', color)
        .attr('tabindex', 0)
        .on('mouseenter focus', (evt) => tip.show(`${truncate(d.item, 60)}<br>${U.formatPct(d.pct)} (n=${d.n} of ${ids.size})`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(d.pct) + 6).attr('y', y(d.item) + y.bandwidth() / 2)
        .attr('dy', '0.32em')
        .text(U.formatPct(d.pct));
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.influences = { renderComparison, renderProgrammeInfluence, renderSingleQuestion };
})();
