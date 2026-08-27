// View 1: Participation overview.
//   (a) respondents per activity type - raw counts only, GALS is not framed
//       as a finding.
//   (b) region x school-level grid, school students only, with visible
//       suppression under the threshold.
(function () {
  'use strict';

  const U = window.SIT.utils;

  function renderActivityBars(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const width = container.clientWidth || 480;
    const height = 380;
    const margin = { top: 24, right: 20, bottom: 132, left: 90 };

    const counts = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => ({ key: a.key, n: U.countDistinctIds(ratings.filter((r) => r.activityType === a.key)) }))
      .sort((a, b) => (a.key === 'Girls as Leaders in STEM program' ? -1 : b.key === 'Girls as Leaders in STEM program' ? 1 : b.n - a.n));

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Bar chart of respondent count by activity type');

    const x = d3.scaleBand().domain(counts.map((d) => d.key)).range([margin.left, width - margin.right]).padding(0.3);
    const yMax = Math.max(170, Math.ceil((d3.max(counts, (d) => d.n) + 10) / 10) * 10);
    const y = d3.scaleLinear().domain([0, yMax]).range([height - margin.bottom, margin.top]);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .selectAll('text')
      .attr('transform', 'translate(-10,4) rotate(-40)')
      .style('text-anchor', 'end')
      .text((d) => (d.length > 20 ? `${d.slice(0, 19)}…` : d))
      .append('title').text((d) => d);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    svg.append('g')
      .selectAll('line.gridline')
      .data(y.ticks(5))
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', margin.left).attr('x2', width - margin.right)
      .attr('y1', (d) => y(d)).attr('y2', (d) => y(d));

    const tip = U.tooltip();

    svg.selectAll('rect.bar')
      .data(counts)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => x(d.key))
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.n))
      .attr('height', (d) => y(0) - y(d.n))
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
      .attr('x', (d) => x(d.key) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.n) - 6)
      .attr('text-anchor', 'middle')
      .text((d) => d.n);
  }

  const YEAR_ORDER = ['Year 5', 'Year 6', 'Year 7', 'Year 8', 'Year 9', 'Year 10', 'Year 11', 'Year 12'];

  function renderSuppressionGrid(container, respondents, meta) {
    container.innerHTML = '';
    const schoolRows = respondents.filter((r) => r.isSchoolStudent && r.schoolLevel);
    const levels = YEAR_ORDER.filter((lvl) => schoolRows.some((r) => r.schoolLevel === lvl));
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
    const shade = d3.scaleQuantize().domain([U.SMALL_CELL_THRESHOLD, maxCount]).range([
      U.cssVar('--ramp-1'), U.cssVar('--ramp-2'), U.cssVar('--ramp-3'), U.cssVar('--ramp-4'), U.cssVar('--ramp-5'),
    ]);

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
          cell.style.background = shade(n);
          const span = document.createElement('span');
          span.className = 'suppression-grid__count';
          span.textContent = n;
          cell.appendChild(span);
          cell.setAttribute('aria-label', `${region}, ${lvl}: ${n} respondents`);
        }
        cell.addEventListener('mouseenter', (evt) => {
          tip.show(suppressed
            ? `<strong>${region} · ${lvl}</strong>Suppressed — fewer than ${U.SMALL_CELL_THRESHOLD} respondents`
            : `<strong>${region} · ${lvl}</strong>${n} respondents`, evt);
        });
        cell.addEventListener('mousemove', (evt) => tip.move(evt));
        cell.addEventListener('mouseleave', () => tip.hide());
        cell.addEventListener('focus', (evt) => {
          tip.show(suppressed
            ? `<strong>${region} · ${lvl}</strong>Suppressed — fewer than ${U.SMALL_CELL_THRESHOLD} respondents`
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
