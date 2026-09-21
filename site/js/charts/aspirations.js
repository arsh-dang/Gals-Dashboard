// View 5 (part 1): Aspirations, GALS vs everyone else. Same dot-plot-with-CI
// mechanics as the outcomes-by-activity view, since it's the same 1-4 scale
// and the same "activity types sit close together" reading problem - just
// two groups (did the respondent take part in GALS) instead of seven
// activity types.
//
// The mock differences are small and mixed in direction (roughly +/-0.2,
// by design - the generator has no notion that GALS should improve
// aspirations). The chart is built so that stays legible as "small": the
// difference is a plain muted number, not a bar, arrow, or colour-coded
// badge, and the CI whiskers - often overlapping - are what actually tell
// the reader whether a gap means anything.
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

  function render(container, rows, meta, colors) {
    container.innerHTML = '';
    const items = meta.aspirationItems;
    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    // The right margin holds the "Diff" column in both layouts.
    const margin = compact
      ? {
        top: 40, right: 52, bottom: 30, left: 18,
      }
      : {
        top: 40, right: 80, bottom: 8, left: 340,
      };
    const geo = U.rowGeometry({
      compact,
      keys: items,
      width,
      margin,
      wideRowHeight: 36,
      widePadding: 0.25,
      plotHeight: 22,
    });
    const { height, band } = geo;
    const bw = items.length ? band(items[0]).height : 0;
    const inset = compact ? 4 : 8;
    const sub = d3.scalePoint().domain(['gals', 'nonGals']).range([-bw / 2 + inset, bw / 2 - inset]);
    const diffX = width - margin.right + (compact ? 10 : 12);

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot comparing GALS participants to everyone else on future-in-STEM aspiration items');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);

    // Fixed axis, same bounds as every other outcome-scale chart - not
    // auto-scaled, since these group differences are exactly the kind of
    // small gap that auto-scaling would exaggerate.
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
        const b = band(item);
        svg.append('text')
          .attr('class', 'item-row-label')
          .attr('x', margin.left - 16)
          .attr('y', b.top + b.height / 2)
          .attr('text-anchor', 'end')
          .attr('dy', '0.32em')
          .text(truncate(item, 48))
          .append('title').text(item);

        svg.append('rect')
          .attr('class', 'row-band')
          .attr('x', margin.left).attr('width', width - margin.left - margin.right)
          .attr('y', b.top).attr('height', b.height)
          .attr('fill', i % 2 ? U.cssVar('--surface-sunken') : 'transparent')
          .attr('opacity', 0.5);
      });
    }

    const tip = U.tooltip();

    function drawGroup(item, key, label, color) {
      const itemRows = rows.filter((r) => r.item === item && (key === 'gals' ? r.didGals : !r.didGals));
      const summary = U.summarizeScores(itemRows);
      const suppressed = U.isSuppressed(itemRows.length);
      const b = band(item);
      const cy = b.top + b.height / 2 + sub(key);

      if (suppressed) {
        svg.append('text')
          .attr('x', x(2.5)).attr('y', cy)
          .attr('text-anchor', 'middle').attr('dy', '0.32em')
          .attr('fill', U.cssVar('--text-muted'))
          .style('font-size', '0.7rem')
          .text('×')
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>${truncate(item, 60)}<br>Suppressed: fewer than ${U.SMALL_CELL_THRESHOLD} respondents (n=${itemRows.length})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        return { summary: null, suppressed: true };
      }

      const ci = U.ciDisplayBounds(summary);
      if (ci) {
        svg.append('line')
          .attr('class', 'ci-whisker')
          .attr('x1', x(ci.low)).attr('x2', x(ci.high))
          .attr('y1', cy).attr('y2', cy)
          .attr('stroke', color).attr('stroke-width', 1.5).attr('opacity', 0.45);
      }
      svg.append('circle')
        .attr('cx', x(summary.mean)).attr('cy', cy).attr('r', 5)
        .attr('fill', color)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${label}, ${item}: average ${summary.mean.toFixed(2)} of 4, 4 is best, n=${summary.n}`)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>${truncate(item, 60)}<br>
          Average (1=No … 4=Yes a lot): ${U.formatScore(summary.mean)}<br>
          95% CI: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'not enough responses to estimate'}<br>
          n=${summary.n}`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      return { summary, suppressed: false };
    }

    items.forEach((item) => {
      const gals = drawGroup(item, 'gals', 'Took part in GALS', colors.gals);
      const nonGals = drawGroup(item, 'nonGals', 'Did not take part in GALS', colors.nonGals);
      const b = band(item);

      const diffLabel = svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', diffX)
        .attr('y', b.top + b.height / 2)
        .attr('dy', '0.32em')
        .style('fill', U.cssVar('--text-muted'));

      if (gals.suppressed || nonGals.suppressed || !gals.summary || !nonGals.summary) {
        diffLabel.text('–');
      } else {
        const diff = gals.summary.mean - nonGals.summary.mean;
        diffLabel.text(`${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`)
          .append('title').text('Difference: GALS average minus everyone-else average, on the raw 1-4 scale. Read this alongside the confidence intervals, not instead of them.');
      }
    });

    svg.append('text')
      .attr('class', 'axis-label')
      .attr('x', diffX)
      .attr('y', 12)
      .style('font-size', '0.65rem')
      .text('Diff');

    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.aspirations = { render };
})();
