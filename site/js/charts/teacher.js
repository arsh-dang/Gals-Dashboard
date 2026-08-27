// Teacher view: "this school" vs the overall sample, per outcome statement,
// collapsed across activity type. Coarser than the provider's outcomes-by-
// activity view on purpose - a teacher wants "are my students typical",
// not an activity breakdown they didn't design. Suppressed per item if the
// school's own n falls under the threshold, same rule as everywhere else.
(function () {
  'use strict';

  const U = window.SIT.utils;

  function displayTickLabel(displayValue) {
    const code = 5 - displayValue;
    return window.SIT_DATA.meta.scale.labels[code];
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function render(container, { schoolRatings, allRatings, meta }) {
    container.innerHTML = '';
    const items = meta.outcomeItems;
    const width = Math.max(container.clientWidth || 640, 640);
    const rowHeight = 30;
    const margin = { top: 28, right: 24, bottom: 16, left: 340 };
    const height = margin.top + margin.bottom + items.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot comparing this school\'s average outcome score to the overall sample, one row per outcome statement');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(items.map((i) => i.item)).range([margin.top, height - margin.bottom]).paddingInner(0.2);

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

    items.forEach((item, i) => {
      svg.append('text')
        .attr('class', 'item-row-label')
        .attr('x', margin.left - 16)
        .attr('y', y(item.item) + y.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .text(truncate(item.item, 48))
        .append('title').text(item.item);

      svg.append('rect')
        .attr('x', margin.left).attr('width', width - margin.left - margin.right)
        .attr('y', y(item.item)).attr('height', y.bandwidth())
        .attr('fill', i % 2 ? U.cssVar('--surface-sunken') : 'transparent')
        .attr('opacity', 0.5);
    });

    const tip = U.tooltip();
    const schoolColor = U.cssVar('--brand-primary');
    const benchmarkColor = U.cssVar('--text-muted');

    items.forEach((item) => {
      const cy = y(item.item) + y.bandwidth() / 2;
      const benchRows = allRatings.filter((r) => r.item === item.item);
      const benchSummary = U.summarizeScores(benchRows);
      if (benchSummary.mean !== null) {
        svg.append('path')
          .attr('d', d3.symbol().type(d3.symbolDiamond).size(50)())
          .attr('transform', `translate(${x(U.toDisplayScore(benchSummary.mean))},${cy})`)
          .attr('fill', benchmarkColor)
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>All respondents</strong>${truncate(item.item, 60)}<br>Average: ${U.formatScore(benchSummary.mean)} (n=${benchSummary.n})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
      }

      const schoolRows = schoolRatings.filter((r) => r.item === item.item);
      const suppressed = U.isSuppressed(schoolRows.length);
      if (suppressed) {
        svg.append('text')
          .attr('x', x(2.5)).attr('y', cy)
          .attr('text-anchor', 'middle').attr('dy', '0.32em')
          .attr('fill', U.cssVar('--text-muted'))
          .style('font-size', '0.7rem')
          .text('×')
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>This school</strong>${truncate(item.item, 60)}<br>Suppressed — fewer than ${U.SMALL_CELL_THRESHOLD} students answered (n=${schoolRows.length})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        return;
      }

      const summary = U.summarizeScores(schoolRows);
      svg.append('circle')
        .attr('cx', x(U.toDisplayScore(summary.mean)))
        .attr('cy', cy)
        .attr('r', 6)
        .attr('fill', schoolColor)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `This school, ${item.item}: average ${summary.mean.toFixed(2)} of 4, 1 is best, n=${summary.n}`)
        .on('mouseenter focus', (evt) => {
          tip.show(`<strong>This school</strong>${truncate(item.item, 60)}<br>
            Average (raw scale, 1=Yes a lot … 4=No): ${U.formatScore(summary.mean)}<br>
            n=${summary.n}${summary.unknownN ? `<br><span class="tt-muted">${summary.unknownN} more answered "I do not know" (excluded)</span>` : ''}`, evt);
        })
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });

    container.querySelector('svg').style.minWidth = '640px';
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.teacherBenchmark = { render };
})();
