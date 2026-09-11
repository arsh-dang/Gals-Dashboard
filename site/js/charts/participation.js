// View 1: Participation overview.
//   (a) respondents per activity type - raw counts only, GALS is not framed
//       as a finding.
//   (b) region x school-level grid, school students only, with visible
//       suppression under the threshold.
(function () {
  'use strict';

  const U = window.SIT.utils;

  // Sorted horizontal bars, generously spaced - full activity names fit
  // without truncation or rotation, and with participation now roughly
  // comparable across activities (no single one dominating), sorting by
  // count is what makes the ordering itself informative.
  function renderActivityBars(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const width = Math.max(container.clientWidth || 640, 480);
    const margin = { top: 12, right: 40, bottom: 32, left: 210 };

    const counts = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => ({ key: a.key, n: U.countDistinctIds(ratings.filter((r) => r.activityType === a.key)) }))
      .sort((a, b) => b.n - a.n);

    const rowHeight = 40;
    const height = margin.top + margin.bottom + counts.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Sorted horizontal bar chart of respondent count by activity type');

    // Scaled to this call's own data, not a fixed floor shared with the
    // provider page - a 12-student school cohort on the same 0-120 axis as
    // the 180-respondent sample would shrink every bar to a sliver. This is
    // a count axis, not the 1-4 outcome scale the "fixed axis" rule is
    // about, so fitting it to the data here is the right call, not the trap.
    const maxN = d3.max(counts, (d) => d.n) || 1;
    const step = maxN <= 20 ? 5 : 10;
    const xMax = Math.max(step, Math.ceil((maxN + step * 0.5) / step) * step);
    const x = d3.scaleLinear().domain([0, xMax]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(counts.map((d) => d.key)).range([margin.top, height - margin.bottom]).padding(0.35);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.selectAll('line.gridline')
      .data(x.ticks(5))
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    svg.selectAll('text.row-label')
      .data(counts)
      .join('text')
      .attr('class', 'item-row-label')
      .attr('x', margin.left - 12)
      .attr('y', (d) => y(d.key) + y.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dy', '0.32em')
      .text((d) => d.key);

    const tip = U.tooltip();

    svg.selectAll('rect.bar')
      .data(counts)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', margin.left)
      .attr('y', (d) => y(d.key))
      .attr('height', y.bandwidth())
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
      .attr('y', (d) => y(d.key) + y.bandwidth() / 2)
      .attr('dy', '0.32em')
      .text((d) => d.n);

    // Without this, the SVG (no width attr of its own, just a viewBox)
    // shrinks to fit a narrow phone's card width instead of keeping this
    // chart's designed width and letting .chart-scroll handle the overflow
    // - every other single-chart renderer in this dashboard sets the same
    // floor on its own SVG for that reason; this one had been missed.
    container.querySelector('svg').style.minWidth = '480px';
  }

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  function renderSuppressionGrid(container, respondents, meta) {
    container.innerHTML = '';
    const schoolRows = respondents.filter((r) => r.isSchoolStudent && r.schoolLevel);
    // Always show every year level, not just ones with current respondents,
    // so a future data update that adds Year 11/12 students shows up here
    // with no code change - an empty year reads as a suppressed "n=0" cell
    // rather than a missing column.
    const levels = YEAR_ORDER;
    const regions = meta.regions.map((r) => r.key);

    const grid = document.createElement('div');
    grid.className = 'suppression-grid';
    grid.style.gridTemplateColumns = `10rem repeat(${levels.length}, 1fr)`;
    grid.setAttribute('role', 'table');
    grid.setAttribute('aria-label', 'Respondent count by region and school year, school students only');

    const corner = document.createElement('div');
    corner.className = 'suppression-grid__cell suppression-grid__cell--header';
    corner.textContent = 'Region \\ Year';
    grid.appendChild(corner);
    levels.forEach((lvl) => {
      const h = document.createElement('div');
      h.className = 'suppression-grid__cell suppression-grid__cell--header';
      h.textContent = lvl.replace('Year ', 'Yr ');
      grid.appendChild(h);
    });

    const maxCount = d3.max(regions, (region) => d3.max(levels, (lvl) => schoolRows.filter((r) => r.region === region && r.schoolLevel === lvl).length))
 || 1;
    const rampColors = [U.cssVar('--ramp-1'), U.cssVar('--ramp-2'), U.cssVar('--ramp-3'), U.cssVar('--ramp-4'), U.cssVar('--ramp-5')];
    const shade = d3.scaleQuantize().domain([U.SMALL_CELL_THRESHOLD, maxCount]).range(rampColors);
    // The top two ramp steps are dark enough that the brand-teal number
    // reads as low-contrast (ramp-5 is nearly the same colour as the text
    // itself) - switch to white text on those cells instead of a fixed
    // colour for every shade.
    const textColorFor = (bg) => (rampColors.indexOf(bg) >= 3 ? U.cssVar('--text-inverse') : U.cssVar('--brand-primary'));

    const tip = U.tooltip();

    regions.forEach((region) => {
      const rowLabel = document.createElement('div');
      rowLabel.className = 'suppression-grid__cell suppression-grid__cell--header';
      rowLabel.style.justifyContent = 'flex-start';
      rowLabel.textContent = region;
      grid.appendChild(rowLabel);

      levels.forEach((lvl) => {
        const n = schoolRows.filter((r) => r.region === region && r.schoolLevel === lvl).length;
        const cell = document.createElement('div');
        const suppressed = U.isSuppressed(n);
        cell.className = `suppression-grid__cell${suppressed ? ' suppression-grid__cell--suppressed' : ''}`;
        cell.tabIndex = 0;
        if (suppressed) {
          const badge = document.createElement('span');
          badge.className = 'badge-suppressed';
          badge.textContent = n === 0 ? 'n=0' : `n<${U.SMALL_CELL_THRESHOLD}`;
          cell.appendChild(badge);
          cell.setAttribute('aria-label', `${region}, ${lvl}: suppressed, fewer than ${U.SMALL_CELL_THRESHOLD} respondents`);
        } else {
          const bg = shade(n);
          cell.style.background = bg;
          const span = document.createElement('span');
          span.className = 'suppression-grid__count';
          span.style.color = textColorFor(bg);
          span.textContent = n;
          cell.appendChild(span);
          cell.setAttribute('aria-label', `${region}, ${lvl}: ${n} respondents`);
        }
        cell.addEventListener('mouseenter', (evt) => {
          tip.show(suppressed
            ? `<strong>${region} · ${lvl}</strong>Suppressed: fewer than ${U.SMALL_CELL_THRESHOLD} respondents`
            : `<strong>${region} · ${lvl}</strong>${n} respondents`, evt);
        });
        cell.addEventListener('mousemove', (evt) => tip.move(evt));
        cell.addEventListener('mouseleave', () => tip.hide());
        cell.addEventListener('focus', (evt) => {
          tip.show(suppressed
            ? `<strong>${region} · ${lvl}</strong>Suppressed: fewer than ${U.SMALL_CELL_THRESHOLD} respondents`
            : `<strong>${region} · ${lvl}</strong>${n} respondents`, evt);
        });
        cell.addEventListener('blur', () => tip.hide());
        grid.appendChild(cell);
      });
    });

    container.appendChild(grid);
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.renderActivityBars = renderActivityBars;
  window.SIT.charts.renderSuppressionGrid = renderSuppressionGrid;
})();
