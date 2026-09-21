// View 2: Outcomes by activity - the most important view, and the one that
// most needed simplifying. It used to show 12 outcome items x 7 activities
// at once (a dot plot with seven overlapping series and 84 confidence
// intervals) - technically complete, but a reader had to pick which of 84
// points to look at, which is not a chart doing its job.
//
// Now: one activity selected at a time (default GALS), shown as sorted
// horizontal bars - one programme's profile, readable at a glance. A
// "compare" selector adds a second activity as a second bar per item, two
// series maximum, never seven. The full 7-activity, 12-item table with
// exact confidence intervals is still available behind "Show data table" -
// nothing computed before is gone, only what's drawn by default.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const SCALE_TICKS = [1, 2, 3, 4];
  const MARGIN = {
    top: 4, right: 60, bottom: 30, left: 0,
  };
  const IMPRECISE_MARK = '†';

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
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  function itemSummary(ratings, itemText, activityType) {
    return U.summarizeScores(ratings.filter((r) => r.item === itemText && r.activityType === activityType));
  }

  // One row per outcome item, one or two bars per row (primary activity,
  // optional comparison). Sorted by the primary activity's score, since
  // that's the profile being read - a comparison activity's own ranking
  // isn't the point of this view.
  function renderBySeries(container, {
    ratings, meta, items, primary, compare, colorFor, expanded, onToggle,
  }) {
    container.innerHTML = '';
    const seriesCount = compare ? 2 : 1;

    const rowsData = items.map((item) => {
      const primarySummary = itemSummary(ratings, item.item, primary);
      const compareSummary = compare ? itemSummary(ratings, item.item, compare) : null;
      primarySummary.suppressed = U.isSuppressed(primarySummary.n);
      if (compareSummary) compareSummary.suppressed = U.isSuppressed(compareSummary.n);
      return {
        item: item.item, pairId: item.pairId, primarySummary, compareSummary,
      };
    }).sort((a, b) => {
      const av = a.primarySummary.suppressed || a.primarySummary.mean === null ? -Infinity : a.primarySummary.mean;
      const bv = b.primarySummary.suppressed || b.primarySummary.mean === null ? -Infinity : b.primarySummary.mean;
      return bv - av;
    });

    const shownRows = expanded ? rowsData : rowsData.slice(0, 5);

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(shownRows.map((r) => r.item), (key) => key, {
      width,
      margin,
      plotHeight: seriesCount === 2 ? 34 : 20,
      noteFor: (key) => (items.find((i) => i.item === key).pairId !== null ? '≈ wording variant of another row' : null),
    });
    const { height, band } = geo;

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', compare
        ? `Horizontal bar chart comparing ${primary} and ${compare} on each outcome statement`
        : `Horizontal bar chart of average outcome score for ${primary}, sorted highest to lowest`);

    U.drawScaleFrame(svg, geo, x, {
      width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
    });

    const tip = U.tooltip();
    let anyImprecise = false;

    shownRows.forEach((r) => {
      const rowBand = band(r.item);
      const series = [
        { label: primary, summary: r.primarySummary, color: colorFor(primary) },
      ];
      if (compare) series.push({ label: compare, summary: r.compareSummary, color: colorFor(compare) });

      series.forEach((s, i) => {
        const b = U.subBand(rowBand, i, seriesCount);
        const cy = b.top + b.height / 2;
        if (s.summary.suppressed) {
          svg.append('text')
            .attr('x', margin.left).attr('y', cy)
            .attr('dy', '0.32em')
            .style('font-size', '0.65rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`${seriesCount === 2 ? `${s.label}: ` : ''}suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
          return;
        }
        const imprecise = U.isImprecise(s.summary);
        if (imprecise) anyImprecise = true;
        svg.append('rect')
          .attr('x', x(1)).attr('width', Math.max(0, x(s.summary.mean) - x(1)))
          .attr('y', b.top).attr('height', b.height)
          .attr('fill', s.color)
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', `${s.label}, ${r.item}: average ${s.summary.mean.toFixed(2)} of 4, 4 is best, n=${s.summary.n}${imprecise ? ', confidence interval wide' : ''}`)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${s.label}</strong>${r.item}<br>
            Average (1=No … 4=Yes a lot): ${U.formatScore(s.summary.mean)}<br>
            95% CI: ${U.formatScore(s.summary.mean - s.summary.ciMargin)}–${U.formatScore(s.summary.mean + s.summary.ciMargin)}<br>
            n=${s.summary.n}`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', x(s.summary.mean) + 6).attr('y', cy)
          .attr('dy', '0.32em')
          .text(`${U.formatScore(s.summary.mean)}${imprecise ? ` ${IMPRECISE_MARK}` : ''}`);
      });
    });

    U.appendShowAllToggle(container, {
      totalCount: rowsData.length, shownCount: 5, expanded, onToggle,
    });

    return { anyImprecise };
  }

  // --- General STEM outcomes: one group, not split by activity -----------
  // Sorted bar list, single colour - there's no activity dimension to
  // encode with colour here, so sorting best-to-worst is what makes this
  // readable instead. Same top-5-then-show-all as every other list chart.
  function renderGeneral(container, ratings, meta, expanded, onToggle) {
    container.innerHTML = '';
    const rows = meta.outcomeItems.map((item) => {
      const itemRows = ratings.filter((r) => r.item === item.item);
      const summary = U.summarizeScores(itemRows);
      return {
        item: item.item, pairId: item.pairId, n: itemRows.length, suppressed: U.isSuppressed(itemRows.length), ...summary,
      };
    }).sort((a, b) => {
      if (a.suppressed && b.suppressed) return 0;
      if (a.suppressed) return 1;
      if (b.suppressed) return -1;
      return b.mean - a.mean;
    });
    const shownRows = expanded ? rows : rows.slice(0, 5);

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(shownRows.map((r) => r.item), (key) => key, {
      width, margin, plotHeight: 18,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Bar chart of average score for the general STEM outcomes question, sorted best to worst');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const color = U.cssVar('--brand-accent');

    U.drawScaleFrame(svg, geo, x, {
      width, height, margin, ticks: SCALE_TICKS, tickFormat: displayTickLabel,
    });

    const tip = U.tooltip();
    let anyImprecise = false;

    shownRows.forEach((r) => {
      const b = band(r.item);
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
        .attr('fill', color)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${r.item}: average ${r.mean.toFixed(2)} of 4, 4 is best, n=${r.n}${imprecise ? ', confidence interval wide' : ''}`)
        .on('mouseenter focus', (evt) => tip.show(`${r.item}<br>
          Average (1=No … 4=Yes a lot): ${U.formatScore(r.mean)}<br>
          95% CI: ${U.formatScore(r.mean - r.ciMargin)}–${U.formatScore(r.mean + r.ciMargin)}<br>
          n=${r.n}`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(r.mean) + 6).attr('y', cy)
        .attr('dy', '0.32em')
        .text(`${U.formatScore(r.mean)}${imprecise ? ` ${IMPRECISE_MARK}` : ''}`);
    });

    U.appendShowAllToggle(container, {
      totalCount: rows.length, shownCount: 5, expanded, onToggle,
    });

    return { anyImprecise };
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.outcomes = {
    activityKeysOrdered,
    cellsForItem,
    renderBySeries,
    renderGeneral,
    IMPRECISE_MARK,
  };
})();
