// View 3: Skills and identity. Multi-select batteries have no meaningful
// average - each facet shows % of that activity's participants who
// selected each item. Denominator is the activity's actual respondent
// count (from ratings, which every participant appears in), not the
// selection rows themselves, since a multi-select respondent who ticked
// nothing would otherwise vanish from the denominator too.
(function () {
  'use strict';

  const U = window.SIT.utils;

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function activitiesWithBattery(meta) {
    return meta.activityTypesWithBattery.slice().sort((a, b) => {
      if (a === 'Girls as Leaders in STEM program') return 1;
      if (b === 'Girls as Leaders in STEM program') return -1;
      return a.localeCompare(b);
    });
  }

  function render(container, { selections, ratings, meta, battery, colorScale }) {
    container.innerHTML = '';
    const activities = activitiesWithBattery(meta);
    const items = [...new Set(selections.filter((s) => s.battery === battery).map((s) => s.item))].sort();

    const grid = document.createElement('div');
    grid.className = 'facet-grid';
    container.appendChild(grid);

    const tip = U.tooltip();

    activities.forEach((activityType) => {
      const denom = U.countDistinctIds(ratings.filter((r) => r.activityType === activityType));
      const cell = document.createElement('div');
      cell.className = 'facet-grid__cell';
      grid.appendChild(cell);

      const title = document.createElement('div');
      title.className = 'facet-grid__title';
      title.innerHTML = `<span>${activityType}</span><span class="facet-grid__n">n=${denom}</span>`;
      cell.appendChild(title);

      if (U.isSuppressed(denom)) {
        const badge = document.createElement('span');
        badge.className = 'badge-suppressed';
        badge.textContent = denom === 0 ? 'No respondents in current filter' : `Suppressed: n<${U.SMALL_CELL_THRESHOLD}`;
        cell.appendChild(badge);
        return;
      }

      const activitySelections = selections.filter((s) => s.activityType === activityType && s.battery === battery);
      // The facet-level denom clearing the threshold does not guarantee any
      // one item does - a filter can leave, say, 16 participants overall but
      // only 1 of them ticked a given item. Suppress per item too, same rule
      // as every other cell in the dashboard, so a single respondent's pick
      // is never shown as an identifiable bar/percentage.
      const bars = items.map((item) => {
        const n = U.countDistinctIds(activitySelections.filter((s) => s.item === item));
        return { item, n, pct: denom ? n / denom : 0, suppressed: U.isSuppressed(n) };
      }).sort((a, b) => {
        if (a.suppressed && b.suppressed) return 0;
        if (a.suppressed) return 1;
        if (b.suppressed) return -1;
        return b.pct - a.pct;
      });

      const width = 320;
      const rowH = 24;
      const margin = { top: 4, right: 44, bottom: 4, left: 148 };
      const height = margin.top + margin.bottom + bars.length * rowH;
      const svg = d3.select(cell).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `${battery === 'skills' ? 'Skills' : 'Identity'} selected by ${activityType} participants`)
        .style('min-width', '320px');

      const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
      const y = d3.scaleBand().domain(bars.map((d) => d.item)).range([margin.top, height - margin.bottom]).padding(0.25);

      svg.selectAll('text.label')
        .data(bars)
        .join('text')
        .attr('class', 'item-row-label')
        .style('font-size', '0.7rem')
        .attr('x', margin.left - 8)
        .attr('y', (d) => y(d.item) + y.bandwidth() / 2)
        .attr('dy', '0.32em')
        .attr('text-anchor', 'end')
        .text((d) => truncate(d.item, 24))
        .append('title').text((d) => d.item);

      const shown = bars.filter((d) => !d.suppressed);
      const hidden = bars.filter((d) => d.suppressed);

      svg.selectAll('rect.bar')
        .data(shown)
        .join('rect')
        .attr('x', margin.left)
        .attr('y', (d) => y(d.item))
        .attr('height', y.bandwidth())
        .attr('width', (d) => x(d.pct) - margin.left)
        .attr('fill', colorScale(activityType))
        .attr('tabindex', 0)
        .on('mouseenter focus', (evt, d) => tip.show(`<strong>${d.item}</strong>${U.formatPct(d.pct)} of ${activityType} participants (n=${d.n} of ${denom})`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());

      svg.selectAll('text.value')
        .data(shown)
        .join('text')
        .attr('class', 'bar-label')
        .attr('x', (d) => x(d.pct) + 6)
        .attr('y', (d) => y(d.item) + y.bandwidth() / 2)
        .attr('dy', '0.32em')
        .text((d) => U.formatPct(d.pct));

      svg.selectAll('text.suppressed-note')
        .data(hidden)
        .join('text')
        .attr('x', margin.left + 6)
        .attr('y', (d) => y(d.item) + y.bandwidth() / 2)
        .attr('dy', '0.32em')
        .style('font-size', '0.62rem')
        .attr('fill', U.cssVar('--text-muted'))
        .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`)
        .attr('tabindex', 0)
        .on('mouseenter focus', (evt, d) => tip.show(`<strong>${d.item}</strong>Suppressed: fewer than ${U.SMALL_CELL_THRESHOLD} respondents (n=${d.n})`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.skills = { render, activitiesWithBattery };
})();
