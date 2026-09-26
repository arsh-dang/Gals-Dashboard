// View 1: Participation overview.
//   (a) respondents per activity type - raw counts only, GALS is not framed
//       as a finding.
//   (b) region x school-level grid, school students only, with visible
//       suppression under the threshold.
(function () {
  'use strict';

  const U = window.SIT.utils;

  // Narrower than this, activity names move above their bars instead of
  // taking a 210px gutter (see U.rowGeometry).
  const WIDE_MIN_WIDTH = 480;

  // Sorted horizontal bars, generously spaced - full activity names fit
  // without truncation or rotation, and with participation now roughly
  // comparable across activities (no single one dominating), sorting by
  // count is what makes the ordering itself informative.
  function renderActivityBars(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const counts = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => ({ key: a.key, n: U.countDistinctIds(ratings.filter((r) => r.activityType === a.key)) }))
      .sort((a, b) => b.n - a.n);

    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    // Sized from the longest activity name, so no name is ever clipped.
    const gutter = compact ? 0 : U.labelGutter(counts.map((d) => d.key), 13, { min: 150, max: 300, pad: 14 });
    const margin = compact
      ? {
        top: 4, right: 36, bottom: 28, left: 4,
      }
      : {
        top: 12, right: 40, bottom: 32, left: gutter,
      };
    const geo = U.rowGeometry({
      compact,
      keys: counts.map((d) => d.key),
      width,
      margin,
      wideRowHeight: 40,
      widePadding: 0.35,
      wideOuterPadding: 0.35,
      plotHeight: 18,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', counts.length ? `Bar chart of how many people answered about each activity. ${counts[0].key} has the most (${counts[0].n}) and ${counts[counts.length - 1].key} has the fewest (${counts[counts.length - 1].n})` : 'Bar chart of how many people answered about each activity');

    // Scaled to this call's own data, not a fixed floor shared with the
    // provider page - a 12-student school cohort on the same 0-120 axis as
    // the 180-respondent sample would shrink every bar to a sliver. This is
    // a count axis, not the 1-4 outcome scale the "fixed axis" rule is
    // about, so fitting it to the data here is the right call, not the trap.
    const maxN = d3.max(counts, (d) => d.n) || 1;
    const step = maxN <= 20 ? 5 : 10;
    const xMax = Math.max(step, Math.ceil((maxN + step * 0.5) / step) * step);
    const x = d3.scaleLinear().domain([0, xMax]).range([margin.left, width - margin.right]);
    const tickCount = compact ? 4 : 5;

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(tickCount));

    if (compact) {
      U.drawRowGridlines(svg, geo.layout, x, x.ticks(tickCount));
      counts.forEach((d) => U.drawStackedLabel(svg, geo.layout.rows.get(d.key), geo.layout));
    } else {
      svg.selectAll('line.gridline')
        .data(x.ticks(tickCount))
        .join('line')
        .attr('class', 'gridline')
        .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);

      counts.forEach((d) => {
        U.drawWideLabel(svg, {
          x: margin.left, yMid: band(d.key).top + band(d.key).height / 2, text: d.key, gutter, fontPx: 13, pad: 14,
        });
      });
    }

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
      .attr('aria-label', (d) => `${d.key}: ${d.n} people`)
      .on('mouseenter focus', (evt, d) => {
        tip.show(`<strong>${d.key}</strong>${d.n} people`, evt);
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

    // Wide layout only: holds its designed width and lets .chart-scroll
    // absorb any overflow. The compact layout is drawn at the container's
    // own width, so it never needs to scroll.
    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
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
    // The column template lives in styles.css (it narrows on phones); only
    // the number of year columns comes from here.
    grid.style.setProperty('--level-count', String(levels.length));
    grid.setAttribute('role', 'table');
    grid.setAttribute('aria-label', 'Table of how many school students answered, by region and year level. Counts under 5 are hidden for privacy');

    const corner = document.createElement('div');
    corner.className = 'suppression-grid__cell suppression-grid__cell--header';
    corner.textContent = 'Region / Year level';
    grid.appendChild(corner);
    levels.forEach((lvl) => {
      const h = document.createElement('div');
      h.className = 'suppression-grid__cell suppression-grid__cell--header';
      // The "Yr" prefix is hidden on a phone, where eight columns only leave
      // room for the number; the corner cell already says these are years.
      h.innerHTML = `<span class="suppression-grid__year-prefix" aria-hidden="true">Yr </span>${lvl.replace('Year ', '')}`;
      h.setAttribute('aria-label', lvl);
      grid.appendChild(h);
    });

    const maxCount = d3.max(regions, (region) => d3.max(levels, (lvl) => schoolRows.filter((r) => r.region === region && r.schoolLevel === lvl).length))
 || 1;
    // One monotonic ramp between the lightest and darkest steps of the
    // guide's teal gradient, interpolated in Lab so each extra student is
    // always a little darker. (The five fixed steps were not monotonic to the
    // eye: step 2 is brighter than step 3, so 6 looked stronger than 7.)
    const ramp = d3.interpolateLab(U.cssVar('--ramp-1'), U.cssVar('--ramp-5'));
    const tFor = (n) => (maxCount > U.SMALL_CELL_THRESHOLD ? (n - U.SMALL_CELL_THRESHOLD) / (maxCount - U.SMALL_CELL_THRESHOLD) : 1);
    const shade = (n) => ramp(0.15 + 0.85 * tFor(n));
    // White text once the background is dark enough for it (4.5:1).
    const textColorFor = (bg) => (d3.lab(bg).l < 55 ? U.cssVar('--text-inverse') : U.cssVar('--text-primary'));

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
        const zero = n === 0;
        const suppressed = !zero && U.isSuppressed(n);
        cell.className = `suppression-grid__cell${suppressed ? ' suppression-grid__cell--suppressed' : ''}${zero ? ' suppression-grid__cell--zero' : ''}`;
        cell.tabIndex = 0;
        if (zero) {
          // Zero means nobody answered: nothing to hide, so not hatched.
          cell.innerHTML = '<span aria-hidden="true">0</span>';
          cell.setAttribute('aria-label', `${region}, ${lvl}: no students`);
        } else if (suppressed) {
          const badge = document.createElement('span');
          badge.className = 'badge-suppressed';
          badge.textContent = `<${U.SMALL_CELL_THRESHOLD}`;
          cell.appendChild(badge);
          cell.setAttribute('aria-label', `${region}, ${lvl}: hidden for privacy, fewer than ${U.SMALL_CELL_THRESHOLD} people`);
        } else {
          const bg = shade(n);
          cell.style.background = bg;
          const span = document.createElement('span');
          span.className = 'suppression-grid__count';
          span.style.color = textColorFor(bg);
          span.textContent = n;
          cell.appendChild(span);
          cell.setAttribute('aria-label', `${region}, ${lvl}: ${n} people`);
        }
        const cellTip = zero ? 'No students'
          : suppressed ? `Hidden for privacy: fewer than ${U.SMALL_CELL_THRESHOLD} people` : `${n} people`;
        cell.addEventListener('mouseenter', (evt) => tip.show(`<strong>${region} · ${lvl}</strong>${cellTip}`, evt));
        cell.addEventListener('mousemove', (evt) => tip.move(evt));
        cell.addEventListener('mouseleave', () => tip.hide());
        cell.addEventListener('focus', (evt) => tip.show(`<strong>${region} · ${lvl}</strong>${cellTip}`, evt));
        cell.addEventListener('blur', () => tip.hide());
        grid.appendChild(cell);
      });
    });

    container.appendChild(grid);

    // Key: what the shading, the hatching and a plain 0 each mean.
    const key = document.createElement('div');
    key.className = 'legend suppression-grid__key';
    const lo = shade(U.SMALL_CELL_THRESHOLD);
    const hi = shade(maxCount);
    key.innerHTML = `
      <span class="legend__item"><span class="suppression-grid__key-ramp" style="background:linear-gradient(90deg, ${lo}, ${hi})"></span>${U.SMALL_CELL_THRESHOLD} to ${Math.max(maxCount, U.SMALL_CELL_THRESHOLD)} students (darker = more)</span>
      <span class="legend__item"><span class="suppression-grid__key-swatch suppression-grid__cell--suppressed"><span class="badge-suppressed">&lt;${U.SMALL_CELL_THRESHOLD}</span></span>Hidden for privacy (1 to ${U.SMALL_CELL_THRESHOLD - 1} students)</span>
      <span class="legend__item"><span class="suppression-grid__key-swatch suppression-grid__cell--zero">0</span>No students</span>`;
    container.appendChild(key);
  }

  // Phone version of the same region x year data: eight columns don't fit,
  // so each region is a row a reader opens to see its year levels, instead
  // of trying to shrink a grid that has nowhere left to shrink to. Same
  // suppression rule, same counts - just one region visible at a time.
  function renderSuppressionList(container, respondents, meta) {
    container.innerHTML = '';
    const schoolRows = respondents.filter((r) => r.isSchoolStudent && r.schoolLevel);
    const regions = meta.regions.map((r) => r.key);

    const list = document.createElement('div');
    list.className = 'suppression-list';
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', 'Table of how many school students answered, by region and year level. Counts under 5 are hidden for privacy');

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
        empty.textContent = 'No school students from this region match the current filters.';
        rows.appendChild(empty);
      }
      levelsHere.forEach((lvl) => {
        const n = regionRows.filter((r) => r.schoolLevel === lvl).length;
        const suppressed = U.isSuppressed(n);
        const row = document.createElement('div');
        row.className = 'suppression-list__row';
        const value = suppressed
          ? `<span class="badge-suppressed" title="Hidden for privacy: fewer than ${U.SMALL_CELL_THRESHOLD} people">&lt;${U.SMALL_CELL_THRESHOLD}</span>`
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
  window.SIT.charts.renderSuppressionGrid = renderSuppressionGrid;
  window.SIT.charts.renderSuppressionList = renderSuppressionList;
})();
