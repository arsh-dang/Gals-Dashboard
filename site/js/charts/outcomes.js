// View 2: Outcomes by activity - the most important view. Two renderers for
// the same underlying cells (item x activity), so the two can be compared:
// an average (Cleveland dot plot, one column of dots per activity per item
// row) and a distribution (small-multiple stacked bars, one facet per item).
//
// Both exclude "I do not know" from every average, both fix their axis
// bounds instead of auto-scaling, and both suppress any item x activity
// cell with fewer than the small-cell threshold of respondents rather than
// silently averaging or stacking a handful of answers.
(function () {
  'use strict';

  const U = window.SIT.utils;

  function activityKeysOrdered(meta) {
    return meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => a.key)
      .sort((a, b) => (a === 'Girls as Leaders in STEM program' ? 1 : b === 'Girls as Leaders in STEM program' ? -1 : a.localeCompare(b)));
  }

  function cellsForItem(ratings, item, activities) {
    return activities.map((activityType) => {
      const rows = ratings.filter((r) => r.item === item.item && r.activityType === activityType);
      const summary = U.summarizeScores(rows);
      return {
        item: item.item,
        pairId: item.pairId,
        activityType,
        n: rows.length,
        suppressed: U.isSuppressed(rows.length),
        ...summary,
        display: U.toDisplayScore(summary.mean),
      };
    });
  }

  function displayTickLabel(displayValue) {
    const code = 5 - displayValue;
    return window.SIT_DATA.meta.scale.labels[code];
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function renderAverage(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const activities = activityKeysOrdered(meta);
    const items = meta.outcomeItems;
    const width = Math.max(container.clientWidth || 640, 640);
    const rowHeight = 34;
    const margin = { top: 28, right: 24, bottom: 36, left: 340 };
    const height = margin.top + margin.bottom + items.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot of average outcome score by activity type, one row per outcome statement');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(items.map((i) => i.item)).range([margin.top, height - margin.bottom]).paddingInner(0.15);
    const sub = d3.scalePoint().domain(activities).range([-y.bandwidth() / 2 + 8, y.bandwidth() / 2 - 8]);

    // Fixed axis, explicit direction - not auto-scaled, per the skill note
    // that the activity types sit within a fraction of a point of each other.
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${margin.top - 6})`)
      .call(d3.axisTop(x).tickValues([1, 2, 3, 4]).tickFormat(displayTickLabel));

    svg.selectAll('line.gridline')
      .data([1, 2, 3, 4])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    const rowLabels = svg.append('g');
    items.forEach((item) => {
      const g = rowLabels.append('g').attr('transform', `translate(0,${y(item.item) + y.bandwidth() / 2})`);
      g.append('text')
        .attr('class', 'item-row-label')
        .attr('x', margin.left - 16)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .text(truncate(item.item, 48))
        .append('title').text(item.item);
      if (item.pairId !== null) {
        g.append('text')
          .attr('class', 'pair-tag')
          .attr('x', margin.left - 16)
          .attr('dy', '1.3em')
          .attr('text-anchor', 'end')
          .text(`≈ wording variant of another row`);
      }
    });

    // faint band separators
    svg.selectAll('rect.row-band')
      .data(items)
      .join('rect')
      .attr('class', 'row-band')
      .attr('x', margin.left).attr('width', width - margin.left - margin.right)
      .attr('y', (d) => y(d.item))
      .attr('height', y.bandwidth())
      .attr('fill', (_d, i) => (i % 2 ? U.cssVar('--surface-sunken') : 'transparent'))
      .attr('opacity', 0.5);

    const tip = U.tooltip();
    const cellData = items.flatMap((item) => cellsForItem(ratings, item, activities));

    const dotG = svg.append('g');
    cellData.forEach((cell) => {
      const cy = y(cell.item) + y.bandwidth() / 2 + sub(cell.activityType);
      if (cell.suppressed) {
        dotG.append('text')
          .attr('x', x(2.5)).attr('y', cy)
          .attr('text-anchor', 'middle').attr('dy', '0.32em')
          .attr('fill', U.cssVar('--text-muted'))
          .style('font-size', '0.7rem')
          .text('×')
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${cell.activityType}</strong>${truncate(cell.item, 60)}<br>Suppressed — fewer than ${U.SMALL_CELL_THRESHOLD} respondents (n=${cell.n})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        return;
      }
      const ci = U.ciDisplayBounds(cell);
      const tooltipHtml = `<strong>${cell.activityType}</strong>${truncate(cell.item, 60)}<br>
            Average (raw scale, 1=Yes a lot … 4=No): ${U.formatScore(cell.mean)}<br>
            95% CI: ${ci ? `${U.formatScore(5 - ci.high)}–${U.formatScore(5 - ci.low)}` : 'not enough responses to estimate'}<br>
            n=${cell.n}${cell.unknownN ? `<br><span class="tt-muted">${cell.unknownN} more answered "I do not know" (excluded)</span>` : ''}`;

      if (ci) {
        dotG.append('line')
          .attr('class', 'ci-whisker')
          .attr('x1', x(ci.low)).attr('x2', x(ci.high))
          .attr('y1', cy).attr('y2', cy)
          .attr('stroke', colorScale(cell.activityType))
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.45);
      }

      dotG.append('circle')
        .attr('cx', x(cell.display))
        .attr('cy', cy)
        .attr('r', 5)
        .attr('fill', colorScale(cell.activityType))
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${cell.activityType}, ${cell.item}: average ${cell.mean.toFixed(2)} of 4, 1 is best, n=${cell.n}${ci ? `, 95% CI ${U.formatScore(5 - ci.high)} to ${U.formatScore(5 - ci.low)}` : ''}`)
        .on('mouseenter focus', (evt) => tip.show(tooltipHtml, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });

    container.querySelector('svg').style.minWidth = '640px';
  }

  function renderDistribution(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const activities = activityKeysOrdered(meta);
    const items = meta.outcomeItems;

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-pos-strong')}"></span>Yes a lot</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-pos-weak')}"></span>Yes a little</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-neg-weak')}"></span>Maybe</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-neg-strong')}"></span>No</span>
      <span class="legend__item"><span class="legend__swatch legend__swatch--hatched"></span>I do not know (excluded from the bar, shown separately)</span>
    `;
    container.appendChild(legend);

    const grid = document.createElement('div');
    grid.className = 'facet-grid';
    container.appendChild(grid);

    const colors = {
      1: U.cssVar('--likert-pos-strong'),
      2: U.cssVar('--likert-pos-weak'),
      3: U.cssVar('--likert-neg-weak'),
      4: U.cssVar('--likert-neg-strong'),
    };
    const tip = U.tooltip();
    const stack = d3.stack().keys(['1', '2', '3', '4']).value((d, key) => d.counts[key] / (d.total - d.counts.dontKnow || 1));

    items.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'facet-grid__cell';
      const title = document.createElement('div');
      title.className = 'facet-grid__title';
      title.innerHTML = `<span>${truncate(item.item, 42)}${item.pairId !== null ? ' <span class="pair-tag">≈ variant</span>' : ''}</span>`;
      cell.appendChild(title);
      grid.appendChild(cell);

      const rowsData = activities.map((activityType) => {
        const rows = ratings.filter((r) => r.item === item.item && r.activityType === activityType);
        const counts = U.distributionCounts(rows);
        return { activityType, counts, total: rows.length, suppressed: U.isSuppressed(rows.length) };
      });

      const width = 320;
      const rowH = 22;
      const margin = { top: 4, right: 8, bottom: 4, left: 118 };
      const height = margin.top + margin.bottom + rowsData.length * rowH;
      const svg = d3.select(cell).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `Response distribution for "${item.item}" by activity type`);

      const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
      const y = d3.scaleBand().domain(rowsData.map((d) => d.activityType)).range([margin.top, height - margin.bottom]).padding(0.25);

      rowsData.forEach((d) => {
        svg.append('text')
          .attr('x', margin.left - 8).attr('y', y(d.activityType) + y.bandwidth() / 2)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .attr('class', 'item-row-label')
          .style('font-size', '0.68rem')
          .text(truncate(d.activityType.replace(' program', '').replace(' or lunchtime activity', ''), 20));

        if (d.suppressed) {
          svg.append('rect')
            .attr('x', margin.left).attr('width', width - margin.left - margin.right)
            .attr('y', y(d.activityType)).attr('height', y.bandwidth())
            .attr('fill', U.cssVar('--surface-sunken'))
            .attr('stroke', U.cssVar('--border-subtle'));
          svg.append('text')
            .attr('x', margin.left + 6).attr('y', y(d.activityType) + y.bandwidth() / 2)
            .attr('dy', '0.32em')
            .style('font-size', '0.62rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
          return;
        }

        const known = d.total - d.counts.dontKnow;
        const segments = stack([d]);
        segments.forEach((seg) => {
          const key = seg.key;
          const [y0, y1] = seg[0];
          const rect = svg.append('rect')
            .attr('x', x(y0)).attr('width', Math.max(0, x(y1) - x(y0)))
            .attr('y', y(d.activityType)).attr('height', y.bandwidth())
            .attr('fill', colors[key])
            .attr('tabindex', 0);
          rect.on('mouseenter focus', (evt) => {
            const pct = known ? d.counts[key] / known : 0;
            tip.show(`<strong>${d.activityType}</strong>${window.SIT_DATA.meta.scale.labels[key]}: ${U.formatPct(pct)} (n=${d.counts[key]} of ${known})`, evt);
          }).on('mousemove', (evt) => tip.move(evt)).on('mouseleave blur', () => tip.hide());
        });

        if (d.counts.dontKnow > 0) {
          const rate = d.counts.dontKnow / d.total;
          const dkWidth = 14;
          svg.append('rect')
            .attr('x', width - margin.right - dkWidth).attr('width', dkWidth)
            .attr('y', y(d.activityType)).attr('height', y.bandwidth())
            .attr('fill', 'transparent')
            .attr('stroke', U.cssVar('--likert-unknown'))
            .attr('stroke-width', 2)
            .attr('tabindex', 0)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${d.activityType}</strong>"I do not know": ${U.formatPct(rate)} of respondents (n=${d.counts.dontKnow})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
        }
      });

      const note = document.createElement('div');
      note.style.fontSize = 'var(--text-caption)';
      note.style.color = 'var(--text-muted)';
      note.style.marginTop = '2px';
      note.textContent = '% of respondents who answered (excludes "I do not know" from the 100%)';
      cell.appendChild(note);
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.outcomes = {
    activityKeysOrdered,
    cellsForItem,
    renderAverage,
    renderDistribution,
  };
})();
