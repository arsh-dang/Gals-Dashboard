// View 4: Regional comparison. Used to be 12 outcome items x 6 regions at
// once (a 72-point dot plot). Now: one outcome item selected at a time,
// six sorted bars - one question, answered across every region, readable
// anywhere. The full item x region table with exact confidence intervals
// is still behind "Show data table".
(function () {
  'use strict';

  const U = window.SIT.utils;

  const SCALE_TICKS = [1, 2, 3, 4];
  const MARGIN = {
    top: 4, right: 60, bottom: 30, left: 0,
  };

  function buildRegionColorScale(regions) {
    const vars = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6'];
    const map = new Map(regions.map((r, i) => [r, U.cssVar(vars[i % vars.length])]));
    return (r) => map.get(r) || U.cssVar('--text-muted');
  }

  function displayTickLabel(displayValue) {
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  // ratings should already be filtered to the selected item.
  function render(container, ratings, meta, regionColorScale, item) {
    container.innerHTML = '';
    const regions = meta.regions.map((r) => r.key);

    const rows = regions.map((region) => {
      const regionRows = ratings.filter((r) => r.region === region);
      const summary = U.summarizeScores(regionRows);
      return {
        region, n: regionRows.length, suppressed: U.isSuppressed(regionRows.length), ...summary,
      };
    }).sort((a, b) => {
      if (a.suppressed && b.suppressed) return 0;
      if (a.suppressed) return 1;
      if (b.suppressed) return -1;
      return b.mean - a.mean;
    });

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(rows.map((r) => r.region), (key) => key, {
      width, margin, plotHeight: 20,
    });
    const { height, band } = geo;

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Bar chart of average score for "${item}" by region, sorted highest to lowest`);

    U.drawScaleFrame(svg, geo, x, {
      width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
    });

    const tip = U.tooltip();
    let anyImprecise = false;

    rows.forEach((r) => {
      const b = band(r.region);
      const cy = b.top + b.height / 2;
      if (r.suppressed) {
        svg.append('text')
          .attr('x', margin.left).attr('y', cy)
          .attr('dy', '0.32em')
          .attr('fill', U.cssVar('--text-muted'))
          .style('font-size', '0.7rem')
          .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }
      const imprecise = U.isImprecise(r);
      if (imprecise) anyImprecise = true;
      svg.append('rect')
        .attr('x', x(1)).attr('width', Math.max(0, x(r.mean) - x(1)))
        .attr('y', b.top).attr('height', b.height)
        .attr('fill', regionColorScale(r.region))
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${r.region}, ${item}: average ${r.mean.toFixed(2)} of 4, 4 is best, n=${r.n}${imprecise ? ', confidence interval wide' : ''}`)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${r.region}</strong>${item}<br>
          Average (1=No … 4=Yes a lot): ${U.formatScore(r.mean)}<br>
          95% CI: ${U.formatScore(r.mean - r.ciMargin)}–${U.formatScore(r.mean + r.ciMargin)}<br>
          n=${r.n}`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(r.mean) + 6).attr('y', cy)
        .attr('dy', '0.32em')
        .text(`${U.formatScore(r.mean)}${imprecise ? ' †' : ''}`);
    });

    return { anyImprecise };
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.regional = { render, buildRegionColorScale };
})();
