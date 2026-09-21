// View 5 (part 1): Aspirations, GALS vs everyone else. Same bar-chart
// mechanics as the outcomes view, two series (GALS / not GALS) - already
// within the two-series limit, so the simplification here is sorting by
// size of gap (largest first) and defaulting to the top 5 rather than all
// ten, plus a "†" marker instead of a confidence-interval line for any bar
// whose interval is wide.
//
// The mock differences are small and mixed in direction (roughly +/-0.2,
// by design - the generator has no notion that GALS should improve
// aspirations). "Diff" stays a plain muted number, not a bar, arrow, or
// colour-coded badge, so a small number still reads as small.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const SCALE_TICKS = [1, 2, 3, 4];
  const MARGIN = {
    top: 4, right: 70, bottom: 30, left: 0,
  };

  function displayTickLabel(displayValue) {
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  function render(container, rows, meta, colors, expanded, onToggle) {
    container.innerHTML = '';
    const items = meta.aspirationItems;

    const rowsData = items.map((item) => {
      const galsRows = rows.filter((r) => r.item === item && r.didGals);
      const nonGalsRows = rows.filter((r) => r.item === item && !r.didGals);
      const gals = U.summarizeScores(galsRows);
      const nonGals = U.summarizeScores(nonGalsRows);
      gals.suppressed = U.isSuppressed(gals.n);
      nonGals.suppressed = U.isSuppressed(nonGals.n);
      const diff = !gals.suppressed && !nonGals.suppressed && gals.mean !== null && nonGals.mean !== null
        ? gals.mean - nonGals.mean : null;
      return {
        item, gals, nonGals, diff,
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
    const diffX = width - margin.right + 14;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Bar chart comparing GALS participants to everyone else on future-in-STEM aspiration items, largest gap first');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    U.drawScaleFrame(svg, geo, x, {
      width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
    });

    svg.append('text')
      .attr('class', 'axis-label')
      .attr('x', diffX)
      .attr('y', 10)
      .style('font-size', '0.65rem')
      .text('Diff');

    const tip = U.tooltip();

    function drawGroup(rowBand, summary, index, label, color) {
      const b = U.subBand(rowBand, index, 2);
      const cy = b.top + b.height / 2;
      if (summary.suppressed) {
        svg.append('text')
          .attr('x', 0).attr('y', cy)
          .attr('dy', '0.32em')
          .style('font-size', '0.62rem')
          .attr('fill', U.cssVar('--text-muted'))
          .text(`${label}: suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }
      const imprecise = U.isImprecise(summary);
      svg.append('rect')
        .attr('x', x(1)).attr('width', Math.max(0, x(summary.mean) - x(1)))
        .attr('y', b.top).attr('height', b.height)
        .attr('fill', color)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${label}: average ${summary.mean.toFixed(2)} of 4, n=${summary.n}${imprecise ? ', confidence interval wide' : ''}`)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>
          Average (1=No … 4=Yes a lot): ${U.formatScore(summary.mean)}<br>
          95% CI: ${U.formatScore(summary.mean - summary.ciMargin)}–${U.formatScore(summary.mean + summary.ciMargin)}<br>
          n=${summary.n}`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(summary.mean) + 6).attr('y', cy)
        .attr('dy', '0.32em')
        .text(`${U.formatScore(summary.mean)}${imprecise ? ' †' : ''}`);
    }

    shownRows.forEach((r) => {
      const b = band(r.item);
      drawGroup(b, r.gals, 0, 'Took part in GALS', colors.gals);
      drawGroup(b, r.nonGals, 1, 'Did not take part in GALS', colors.nonGals);

      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', diffX)
        .attr('y', b.top + b.height / 2)
        .attr('dy', '0.32em')
        .style('fill', U.cssVar('--text-muted'))
        .text(r.diff === null ? '–' : `${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(2)}`)
        .append('title').text('Difference: GALS average minus everyone-else average, on the raw 1-4 scale. Read this alongside the confidence intervals, not instead of them.');
    });

    U.appendShowAllToggle(container, {
      totalCount: rowsData.length, shownCount: 5, expanded, onToggle,
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.aspirations = { render };
})();
