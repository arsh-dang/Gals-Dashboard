// View 1: Participation overview.
//   (a) respondents per activity type - raw counts only, GALS is not framed
//       as a finding. Already "one chart, one comparison" (count per
//       activity), so this only needed the universal row layout, not a
//       content change.
//   (b) region x school-level list, school students only, with visible
//       suppression under the threshold. Used to be an eight-column grid;
//       a grid has nowhere left to shrink to on a phone, and forum feedback
//       was to replace it outright rather than maintain a second version
//       for narrow screens - so this is now the only version, at every
//       width: one row per region, expandable to its year levels.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const MARGIN = {
    top: 4, right: 40, bottom: 26, left: 0,
  };

  // Sorted horizontal bars - full activity names fit without truncation or
  // rotation, and with participation now roughly comparable across
  // activities (no single one dominating), sorting by count is what makes
  // the ordering itself informative. All seven always shown: this is a
  // fixed, complete taxonomy, not a ranked list with a long tail to hide.
  function renderActivityBars(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const counts = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => ({ key: a.key, n: U.countDistinctIds(ratings.filter((r) => r.activityType === a.key)) }))
      .sort((a, b) => b.n - a.n);

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(counts.map((d) => d.key), (key) => key, {
      width, margin, plotHeight: 20,
    });
    const { height, band } = geo;

    // Scaled to this call's own data, not a fixed floor shared with the
    // provider page - a 12-student school cohort on the same 0-120 axis as
    // the 180-respondent sample would shrink every bar to a sliver. This is
    // a count axis, not the 1-4 outcome scale, so fitting it to the data
    // here is the right call.
    const maxN = d3.max(counts, (d) => d.n) || 1;
    const step = maxN <= 20 ? 5 : 10;
    const xMax = Math.max(step, Math.ceil((maxN + step * 0.5) / step) * step);
    const x = d3.scaleLinear().domain([0, xMax]).range([margin.left, width - margin.right]);

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Sorted horizontal bar chart of respondent count by activity type');

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom + 6})`)
      .call(d3.axisBottom(x).ticks(4));
    U.drawRowShading(svg, geo.layout, width);
    U.drawRowGridlines(svg, geo.layout, x, x.ticks(4));
    counts.forEach((d) => U.drawStackedLabel(svg, geo.layout.rows.get(d.key), geo.layout));

    const tip = U.tooltip();

    svg.selectAll('rect.bar')
      .data(counts)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', margin.left)
      .attr('y', (d) => band(d.key).top)
      .attr('height', (d) => band(d.key).height)
      .attr('width', (d) => x(d.n) - margin.left)
      .attr('fill', (d) => colorScale(d.key))
      .attr('tabindex', 0)
      .attr('role', 'img')
      .attr('aria-label', (d) => `${d.key}: ${d.n} respondents`)
      .on('mouseenter focus', (evt, d) => {
        tip.show(`<strong>${d.key}</strong>${d.n} respondents`, evt);
      })
      .on('mousemove', (evt) => tip.move(evt))
      .on('mouseleave blur', () => tip.hide());

    svg.selectAll('text.bar-label')
      .data(counts)
      .join('text')
      .attr('class', 'bar-label')
      .attr('x', (d) => x(d.n) + 8)
      .attr('y', (d) => band(d.key).top + band(d.key).height / 2)
      .attr('dy', '0.32em')
      .text((d) => d.n);
  }

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  // One row per region (name, total students), expandable to that region's
  // year-level counts. Same suppression rule, same counts as the grid this
  // replaced - just one region's detail visible at a time instead of forty
  // eight cells competing for attention.
  function renderSuppressionList(container, respondents, meta) {
    container.innerHTML = '';
    const schoolRows = respondents.filter((r) => r.isSchoolStudent && r.schoolLevel);
    const regions = meta.regions.map((r) => r.key);

    const list = document.createElement('div');
    list.className = 'suppression-list';
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Respondent count by region and school year, school students only');

    regions.forEach((region) => {
      const regionRows = schoolRows.filter((r) => r.region === region);
      const total = regionRows.length;
      const levelsHere = YEAR_ORDER.filter((lvl) => regionRows.some((r) => r.schoolLevel === lvl));

      const details = document.createElement('details');
      details.className = 'suppression-list__region';
      details.setAttribute('role', 'listitem');

      const summary = document.createElement('summary');
      summary.innerHTML = `<span>${region}</span><span class="suppression-list__total">${total} student${total === 1 ? '' : 's'}</span>`;
      details.appendChild(summary);

      const rows = document.createElement('div');
      rows.className = 'suppression-list__years';
      if (!levelsHere.length) {
        const empty = document.createElement('p');
        empty.className = 'suppression-list__empty';
        empty.textContent = 'No school-year respondents recorded for this region in the current filter.';
        rows.appendChild(empty);
      }
      levelsHere.forEach((lvl) => {
        const n = regionRows.filter((r) => r.schoolLevel === lvl).length;
        const suppressed = U.isSuppressed(n);
        const row = document.createElement('div');
        row.className = 'suppression-list__row';
        const value = suppressed
          ? `<span class="badge-suppressed">n<${U.SMALL_CELL_THRESHOLD}</span>`
          : `<span class="suppression-list__count">${n}</span>`;
        row.innerHTML = `<span>${lvl}</span>${value}`;
        rows.appendChild(row);
      });
      details.appendChild(rows);
      list.appendChild(details);
    });

    container.appendChild(list);
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.renderActivityBars = renderActivityBars;
  window.SIT.charts.renderSuppressionList = renderSuppressionList;
})();
