// Teacher view: "this school" vs the overall sample, per outcome statement,
// collapsed across activity type. Sorted by size of gap (largest first),
// top 5 by default - the same simplification as every other chart, so a
// teacher sees the outcomes their cohort differs most on, not twelve rows
// in survey order. Suppressed per item if the school's own n falls under
// the threshold, same rule as everywhere else.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const SCALE_TICKS = [1, 2, 3, 4];
  const MARGIN = {
    top: 4, right: 60, bottom: 30, left: 0,
  };

  function displayTickLabel(displayValue) {
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  function render(container, {
    schoolRatings, allRatings, meta, expanded, onToggle,
  }) {
    container.innerHTML = '';
    const items = meta.outcomeItems;

    const rowsData = items.map((item) => {
      const schoolRows = schoolRatings.filter((r) => r.item === item.item);
      const benchRows = allRatings.filter((r) => r.item === item.item);
      const school = U.summarizeScores(schoolRows);
      const bench = U.summarizeScores(benchRows);
      school.suppressed = U.isSuppressed(school.n);
      const diff = !school.suppressed && school.mean !== null && bench.mean !== null
        ? school.mean - bench.mean : null;
      return {
        item: item.item, school, bench, diff,
      };
    }).sort((a, b) => {
      const av = a.diff === null ? -1 : Math.abs(a.diff);
      const bv = b.diff === null ? -1 : Math.abs(b.diff);
      return bv - av;
    });
    const shownRows = expanded ? rowsData : rowsData.slice(0, 5);

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(shownRows.map((r) => r.item), (key) => key, {
      width, margin, plotHeight: 34,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Bar chart comparing this school\'s average outcome score to the overall sample, largest gap first');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    U.drawScaleFrame(svg, geo, x, {
      width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
    });

    const tip = U.tooltip();
    const schoolColor = U.cssVar('--brand-primary');
    const benchmarkColor = U.cssVar('--text-muted');

    shownRows.forEach((r) => {
      const rowBand = band(r.item);

      if (r.bench.mean !== null) {
        const b = U.subBand(rowBand, 0, 2);
        const cy = b.top + b.height / 2;
        const impreciseBench = U.isImprecise(r.bench);
        svg.append('rect')
          .attr('x', x(1)).attr('width', Math.max(0, x(r.bench.mean) - x(1)))
          .attr('y', b.top).attr('height', b.height)
          .attr('fill', benchmarkColor)
          .attr('opacity', 0.55)
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>All respondents</strong>${r.item}<br>
            Average: ${U.formatScore(r.bench.mean)}<br>
            95% CI: ${U.formatScore(r.bench.mean - r.bench.ciMargin)}–${U.formatScore(r.bench.mean + r.bench.ciMargin)}<br>
            n=${r.bench.n}`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', x(r.bench.mean) + 6).attr('y', cy)
          .attr('dy', '0.32em')
          .text(`${U.formatScore(r.bench.mean)}${impreciseBench ? ' †' : ''} (all)`);
      }

      const sb = U.subBand(rowBand, 1, 2);
      const scy = sb.top + sb.height / 2;
      if (r.school.suppressed) {
        svg.append('text')
          .attr('x', 0).attr('y', scy)
          .attr('dy', '0.32em')
          .style('font-size', '0.62rem')
          .attr('fill', U.cssVar('--text-muted'))
          .text(`This school: suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }
      const impreciseSchool = U.isImprecise(r.school);
      svg.append('rect')
        .attr('x', x(1)).attr('width', Math.max(0, x(r.school.mean) - x(1)))
        .attr('y', sb.top).attr('height', sb.height)
        .attr('fill', schoolColor)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `This school, ${r.item}: average ${r.school.mean.toFixed(2)} of 4, n=${r.school.n}${impreciseSchool ? ', confidence interval wide' : ''}`)
        .on('mouseenter focus', (evt) => tip.show(`<strong>This school</strong>${r.item}<br>
          Average (1=No … 4=Yes a lot): ${U.formatScore(r.school.mean)}<br>
          95% CI: ${U.formatScore(r.school.mean - r.school.ciMargin)}–${U.formatScore(r.school.mean + r.school.ciMargin)}<br>
          n=${r.school.n}`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(r.school.mean) + 6).attr('y', scy)
        .attr('dy', '0.32em')
        .text(`${U.formatScore(r.school.mean)}${impreciseSchool ? ' †' : ''} (school)`);
    });

    U.appendShowAllToggle(container, {
      totalCount: rowsData.length, shownCount: 5, expanded, onToggle,
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.teacherBenchmark = { render };
})();
