// Teacher view: "this school" vs the overall sample, per outcome statement,
// collapsed across activity type. Coarser than the provider's outcomes-by-
// activity view on purpose - a teacher wants "are my students typical",
// not an activity breakdown they didn't design. Suppressed per item if the
// school's own n falls under the threshold, same rule as everywhere else.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const WIDE_MIN_WIDTH = 640;
  const SCALE_TICKS = [1, 2, 3, 4];

  function displayTickLabel(displayValue) {
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function render(container, { schoolRatings, allRatings, meta }) {
    container.innerHTML = '';
    const items = meta.outcomeItems;
    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    const margin = compact
      ? {
        top: 28, right: 30, bottom: 30, left: 18,
      }
      : {
        top: 28, right: 24, bottom: 16, left: 340,
      };
    const geo = U.rowGeometry({
      compact,
      keys: items.map((i) => i.item),
      width,
      margin,
      wideRowHeight: 30,
      widePadding: 0.2,
      plotHeight: 16,
      gap: 8,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot comparing this school\'s average outcome score to the overall sample, one row per outcome statement');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${margin.top - 6})`)
      .call(d3.axisTop(x).tickValues(SCALE_TICKS).tickFormat(displayTickLabel));

    if (compact) {
      U.drawCompactScaleFrame(svg, geo, x, {
        width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
      });
    } else {
      svg.selectAll('line.gridline')
        .data(SCALE_TICKS)
        .join('line')
        .attr('class', 'gridline')
        .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);

      items.forEach((item, i) => {
        const b = band(item.item);
        svg.append('text')
          .attr('class', 'item-row-label')
          .attr('x', margin.left - 16)
          .attr('y', b.top + b.height / 2)
          .attr('text-anchor', 'end')
          .attr('dy', '0.32em')
          .text(truncate(item.item, 48))
          .append('title').text(item.item);

        svg.append('rect')
          .attr('x', margin.left).attr('width', width - margin.left - margin.right)
          .attr('y', b.top).attr('height', b.height)
          .attr('fill', i % 2 ? U.cssVar('--surface-sunken') : 'transparent')
          .attr('opacity', 0.5);
      });
    }

    const tip = U.tooltip();
    const schoolColor = U.cssVar('--brand-primary');
    const benchmarkColor = U.cssVar('--text-muted');

    items.forEach((item) => {
      const b = band(item.item);
      const cy = b.top + b.height / 2;
      const benchRows = allRatings.filter((r) => r.item === item.item);
      const benchSummary = U.summarizeScores(benchRows);
      if (benchSummary.mean !== null) {
        const benchCi = U.ciDisplayBounds(benchSummary);
        if (benchCi) {
          svg.append('line')
            .attr('class', 'ci-whisker')
            .attr('x1', x(benchCi.low)).attr('x2', x(benchCi.high))
            .attr('y1', cy).attr('y2', cy)
            .attr('stroke', benchmarkColor)
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.4);
        }
        svg.append('path')
          .attr('d', d3.symbol().type(d3.symbolDiamond).size(50)())
          .attr('transform', `translate(${x(U.toDisplayScore(benchSummary.mean))},${cy})`)
          .attr('fill', benchmarkColor)
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>All respondents</strong>${truncate(item.item, 60)}<br>
            Average: ${U.formatScore(benchSummary.mean)}<br>
            95% CI: ${benchCi ? `${U.formatScore(benchCi.low)}–${U.formatScore(benchCi.high)}` : 'not enough responses to estimate'}<br>
            n=${benchSummary.n}`, evt))
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
          .on('mouseenter focus', (evt) => tip.show(`<strong>This school</strong>${truncate(item.item, 60)}<br>Suppressed: fewer than ${U.SMALL_CELL_THRESHOLD} students answered (n=${schoolRows.length})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        return;
      }

      const summary = U.summarizeScores(schoolRows);
      const ci = U.ciDisplayBounds(summary);
      if (ci) {
        svg.append('line')
          .attr('class', 'ci-whisker')
          .attr('x1', x(ci.low)).attr('x2', x(ci.high))
          .attr('y1', cy).attr('y2', cy)
          .attr('stroke', schoolColor)
          .attr('stroke-width', 2)
          .attr('opacity', 0.5);
      }
      svg.append('circle')
        .attr('cx', x(U.toDisplayScore(summary.mean)))
        .attr('cy', cy)
        .attr('r', 6)
        .attr('fill', schoolColor)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `This school, ${item.item}: average ${summary.mean.toFixed(2)} of 4, 4 is best, n=${summary.n}${ci ? `, 95% CI ${U.formatScore(ci.low)} to ${U.formatScore(ci.high)}` : ''}`)
        .on('mouseenter focus', (evt) => {
          tip.show(`<strong>This school</strong>${truncate(item.item, 60)}<br>
            Average (1=No … 4=Yes a lot): ${U.formatScore(summary.mean)}<br>
            95% CI: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'not enough responses to estimate'}<br>
            n=${summary.n}${summary.unknownN ? `<br><span class="tt-muted">${summary.unknownN} more answered "I do not know" (excluded)</span>` : ''}`, evt);
        })
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.teacherBenchmark = { render };
})();
