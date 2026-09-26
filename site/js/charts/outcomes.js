// View 2: Outcomes by activity - the most important view. Three renderers
// over the same underlying cells (item x activity), so the team can compare
// which reads best - they hadn't seen alternatives to the stacked bar
// before, and it's easier to choose from real examples than descriptions:
//   - average, dot plot: one row per outcome, one coloured dot per activity
//   - average, small multiples: one panel per activity, same item order in
//     every panel so a row lines up across panels
//   - distribution: diverging stacked bars, centred on the Maybe/Yes-a-little
//     midpoint - the one place stacking still works, because the four
//     answers are ordered and split evenly either side of a centre
//
// All three exclude "I do not know" from every average, fix their axis
// bounds instead of auto-scaling, and suppress any item x activity cell
// under the small-cell threshold rather than plotting a handful of answers.
//
// Narrow screens: the dot plot and general lollipop switch to a stacked
// layout (label above each row, see U.rowGeometry) below WIDE_MIN_WIDTH;
// the two facet views draw every panel at its grid cell's real width.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const WIDE_MIN_WIDTH = 640;
  const COMPACT_MARGIN = {
    top: 28, right: 68, bottom: 30, left: 18,
  };
  const SCALE_TICKS = [1, 2, 3, 4];
  const FACET_LABEL_FONT = 11;
  const LABEL_FONT = 12;

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

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  // --- Average: dot plot -----------------------------------------------
  function renderAverage(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const activities = activityKeysOrdered(meta);
    const items = meta.outcomeItems;
    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    const gutter = compact ? 0 : U.labelGutter(items.map((i) => i.item), LABEL_FONT, { min: 200, max: 300 });
    const margin = compact ? COMPACT_MARGIN : {
      top: 28, right: 96, bottom: 36, left: gutter,
    };
    // Compact: each activity's dot sits on its own line (legend order) in a
    // band under the label, so seven dots stay separable on a narrow plot
    // even when their averages tie.
    const geo = U.rowGeometry({
      compact,
      keys: items.map((i) => i.item),
      width,
      margin,
      wideRowHeight: 38,
      widePadding: 0.1,
      plotHeight: activities.length * 6 + 6,
      noteFor: (key) => (items.find((i) => i.item === key).pairId !== null ? '≈ Also asked in a similar wording (see the matching row)' : null),
    });
    const { height, band } = geo;
    const bw = items.length ? band(items[0].item).height : 0;
    const inset = compact ? 4 : 8;
    const sub = d3.scalePoint().domain(activities).range([-bw / 2 + inset, bw / 2 - inset]);
    const dotR = compact ? 4 : 5;
    const markerFor = U.buildMarkerScale(activities);

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot of average scores for each statement, by activity. Activities score close together');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);

    // Fixed axis, explicit direction - not auto-scaled, since the activity
    // types sit within a fraction of a point of each other.
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

      const labelTip = U.tooltip();
      items.forEach((item) => {
        const b = band(item.item);
        U.drawWideLabel(svg, {
          x: margin.left, yMid: b.top + b.height / 2, text: item.item, gutter, fontPx: LABEL_FONT, badge: item.pairId !== null, tip: labelTip,
        });
      });

      svg.selectAll('rect.row-band')
        .data(items)
        .join('rect')
        .attr('class', 'row-band')
        .attr('x', margin.left).attr('width', width - margin.left - margin.right)
        .attr('y', (d) => band(d.item).top)
        .attr('height', bw)
        .attr('fill', (_d, i) => (i % 2 ? U.cssVar('--surface-sunken') : 'transparent'))
        .attr('opacity', 0.5);
    }

    const tip = U.tooltip();
    const cellData = items.flatMap((item) => cellsForItem(ratings, item, activities));

    const dotG = svg.append('g');
    // Results hidden for privacy get one grey tag per row in a fixed right-hand
    // column, never a mark in the plotting area.
    items.forEach((item) => {
      const hiddenHere = cellData.filter((c) => c.item === item.item && c.suppressed && c.n > 0).map((c) => c.activityType);
      // n = 0 means that wording was never asked of that activity, not hidden.
      if (!hiddenHere.length) return;
      const b = band(item.item);
      U.drawHiddenChip(svg, {
        x: width - margin.right + 10, yMid: b.top + b.height / 2, count: hiddenHere.length, total: activities.length, names: hiddenHere, context: item.item, tip,
      });
    });
    cellData.forEach((cell) => {
      const b = band(cell.item);
      const cy = b.top + b.height / 2 + sub(cell.activityType);
      if (cell.suppressed) return;
      const ci = U.ciDisplayBounds(cell);
      const tooltipHtml = `<strong>${cell.activityType}</strong>${cell.item}<br>
            Average (1=No … 4=Yes a lot): ${U.formatScore(cell.mean)}<br>
            Likely range: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'too few people to estimate a range'}<br>
            ${cell.n} people${cell.unknownN ? `<br><span class="tt-muted">${cell.unknownN} more answered "I do not know" (left out of the average)</span>` : ''}`;

      if (ci) {
        dotG.append('line')
          .attr('class', 'ci-whisker')
          .attr('x1', x(ci.low)).attr('x2', x(ci.high))
          .attr('y1', cy).attr('y2', cy)
          .attr('stroke', colorScale(cell.activityType))
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.45);
      }

      dotG.append('path')
        .attr('transform', `translate(${x(cell.display)},${cy})`)
        .attr('d', U.markerPath(markerFor(cell.activityType), dotR))
        .attr('fill', colorScale(cell.activityType))
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${cell.activityType}, ${cell.item}: average ${cell.mean.toFixed(2)} of 4, higher is more positive, ${cell.n} people${ci ? `, likely range ${U.formatScore(ci.low)} to ${U.formatScore(ci.high)}` : ''}`)
        .on('mouseenter focus', (evt) => tip.show(tooltipHtml, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
  }

  // --- Average: small multiples ------------------------------------------
  // One panel per activity, but every panel keeps the SAME item order, so a
  // row lines up across panels - the point of small multiples is comparing
  // across the grid, not just reading one panel in isolation.
  function renderSmallMultiples(container, ratings, meta, colorScale) {
    container.innerHTML = '';
    const activities = activityKeysOrdered(meta);
    const items = meta.outcomeItems;

    // Endpoints only: at a panel's plot width the two middle scale labels
    // run into their neighbours. The gridlines still mark all four points.
    const ruler = document.createElement('div');
    ruler.className = 'small-multiples-ruler';
    ruler.innerHTML = `<span>${meta.scale.labels[1]}</span><span>${meta.scale.labels[4]}</span>`;
    container.appendChild(ruler);

    const grid = document.createElement('div');
    grid.className = 'facet-grid';
    container.appendChild(grid);

    // Every cell goes in first so the grid settles its column width; each
    // panel is then drawn at that real width (1:1, no scaling) rather than a
    // fixed 320 units shrunk or overflowing to fit.
    const facets = activities.map((activityType) => {
      const cell = document.createElement('div');
      cell.className = 'facet-grid__cell';
      const denom = U.countDistinctIds(ratings.filter((r) => r.activityType === activityType));
      const title = document.createElement('div');
      title.className = 'facet-grid__title';
      title.innerHTML = `<span>${activityType}</span><span class="facet-grid__n">${denom} people</span>`;
      cell.appendChild(title);
      grid.appendChild(cell);
      return { activityType, cell };
    });
    if (!facets.length) return;

    const tip = U.tooltip();
    const width = U.contentWidth(facets[0].cell, 320);
    // Phone-width panels wrap each label onto two lines instead of cutting it
    // off - truncated, several outcome wordings are indistinguishable.
    const rowHeight = 28;
    // Labels get just over half the panel: the plot only needs room for four
    // scale positions, and item wording is what tells two rows apart.
    const margin = {
      top: 4, right: 62, bottom: 4, left: Math.round(width * 0.5),
    };
    const height = margin.top + margin.bottom + items.length * rowHeight;
    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);

    // Line the shared ruler up with the first panel's actual plot area.
    const cellStyle = getComputedStyle(facets[0].cell);
    ruler.style.marginLeft = `${parseFloat(cellStyle.paddingLeft) + parseFloat(cellStyle.borderLeftWidth) + margin.left}px`;
    ruler.style.maxWidth = `${width - margin.left - margin.right}px`;

    facets.forEach(({ activityType, cell }) => {
      const svg = d3.select(cell).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `Average scores for each statement, for ${activityType}`);

      svg.selectAll('line.gridline')
        .data(SCALE_TICKS)
        .join('line')
        .attr('class', 'gridline')
        .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);

      items.forEach((item, i) => {
        const cy = margin.top + i * rowHeight + rowHeight / 2;
        U.drawWideLabel(svg, {
          x: margin.left + 8, yMid: cy, text: item.item, gutter: margin.left + 8, fontPx: FACET_LABEL_FONT, pad: 16, tip,
        });

        const rows = ratings.filter((r) => r.item === item.item && r.activityType === activityType);
        const summary = U.summarizeScores(rows);
        const suppressed = U.isSuppressed(rows.length);

        if (suppressed) {
          U.drawHiddenChip(svg, {
            x: width - margin.right + 8, yMid: cy, count: 1, total: 1, names: [activityType], context: item.item, tip,
          });
          return;
        }

        const ci = U.ciDisplayBounds(summary);
        if (ci) {
          svg.append('line')
            .attr('class', 'ci-whisker')
            .attr('x1', x(ci.low)).attr('x2', x(ci.high))
            .attr('y1', cy).attr('y2', cy)
            .attr('stroke', colorScale(activityType))
            .attr('stroke-width', 1.5)
            .attr('opacity', 0.45);
        }
        svg.append('circle')
          .attr('cx', x(summary.mean)).attr('cy', cy).attr('r', 4)
          .attr('fill', colorScale(activityType))
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', `${item.item}: average ${summary.mean.toFixed(2)} of 4, higher is more positive, ${summary.n} people`)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${activityType}</strong>${item.item}<br>
            Average (1=No … 4=Yes a lot): ${U.formatScore(summary.mean)}<br>
            Likely range: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'too few people to estimate a range'}<br>
            ${summary.n} people`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
      });
    });
  }

  // --- Distribution: diverging stacked bars --------------------------------
  // Centred on the Maybe/Yes-a-little midpoint: No and Maybe stack leftward
  // from centre, Yes a little and Yes a lot stack rightward. "I do not know"
  // sits outside the diverging axis as a separate marker, same as before -
  // it's a non-answer, not a fifth scale position.
  function renderDistribution(container, ratings, meta) {
    container.innerHTML = '';
    const activities = activityKeysOrdered(meta);
    const items = meta.outcomeItems;

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-neg-strong')}"></span>No</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-neg-weak')}"></span>Maybe</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-pos-weak')}"></span>Yes a little</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${U.cssVar('--likert-pos-strong')}"></span>Yes a lot</span>
      <span class="legend__item"><span class="legend__swatch legend__swatch--hatched"></span>I do not know (excluded, shown separately)</span>
    `;
    container.appendChild(legend);

    const grid = document.createElement('div');
    grid.className = 'facet-grid';
    container.appendChild(grid);

    const colors = {
      1: U.cssVar('--likert-neg-strong'),
      2: U.cssVar('--likert-neg-weak'),
      3: U.cssVar('--likert-pos-weak'),
      4: U.cssVar('--likert-pos-strong'),
    };
    const tip = U.tooltip();

    // Cells first, then draw at the settled cell width - same reasoning as
    // the small multiples above. The panel title is the full item wording
    // and wraps, rather than being cut at a fixed character count.
    const facets = items.map((item) => {
      const cell = document.createElement('div');
      cell.className = 'facet-grid__cell';
      const title = document.createElement('div');
      title.className = 'facet-grid__title';
      title.innerHTML = `<span>${item.item}${item.pairId !== null ? ' <span class="pair-tag">≈ variant</span>' : ''}</span>`;
      cell.appendChild(title);
      grid.appendChild(cell);
      return { item, cell };
    });
    if (!facets.length) return;

    const width = U.contentWidth(facets[0].cell, 320);
    const rowH = 26;
    const shortName = (a) => a.replace(' program', '').replace(' or lunchtime activity', '');
    const margin = {
      top: 4, right: 8, bottom: 4, left: Math.min(150, Math.round(width * 0.42)),
    };
    // Fixed -100%..100% domain on every facet - not auto-scaled to each
    // item's own max, so bar length means the same thing everywhere.
    const x = d3.scaleLinear().domain([-1, 1]).range([margin.left, width - margin.right]);

    facets.forEach(({ item, cell }) => {
      const rowsData = activities.map((activityType) => {
        const rows = ratings.filter((r) => r.item === item.item && r.activityType === activityType);
        const counts = U.distributionCounts(rows);
        return {
          activityType, counts, total: rows.length, suppressed: U.isSuppressed(rows.length),
        };
      });

      const height = margin.top + margin.bottom + rowsData.length * rowH;
      const svg = d3.select(cell).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `Answers to "${item.item}" for each activity, from No to Yes a lot`);

      svg.append('line')
        .attr('class', 'gridline')
        .attr('x1', x(0)).attr('x2', x(0))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);

      const yScale = d3.scaleBand().domain(rowsData.map((d) => d.activityType)).range([margin.top, height - margin.bottom]).padding(0.25);

      rowsData.forEach((d) => {
        const rowY = yScale(d.activityType);

        U.drawWideLabel(svg, {
          x: margin.left + 8, yMid: rowY + yScale.bandwidth() / 2, text: shortName(d.activityType), gutter: margin.left + 8, fontPx: FACET_LABEL_FONT, pad: 16, title: d.activityType,
        });

        if (d.suppressed) {
          svg.append('rect')
            .attr('x', margin.left).attr('width', width - margin.left - margin.right)
            .attr('y', rowY).attr('height', yScale.bandwidth())
            .attr('fill', U.cssVar('--surface-sunken'))
            .attr('stroke', U.cssVar('--border-subtle'));
          svg.append('text')
            .attr('x', margin.left + 6).attr('y', rowY + yScale.bandwidth() / 2)
            .attr('dy', '0.32em')
            .style('font-size', '0.62rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`hidden for privacy`);
          return;
        }

        const known = d.total - d.counts.dontKnow;
        const p = (key) => (known ? d.counts[key] / known : 0);
        const pNo = p(1);
        const pMaybe = p(2);
        const pLittle = p(3);
        const pLot = p(4);

        // Left half (negative): Maybe sits against the centre line, No sits
        // further out - the two "worse" answers, ordered by how bad.
        const segsLeft = [
          { key: 2, x0: -pMaybe, x1: 0 },
          { key: 1, x0: -(pMaybe + pNo), x1: -pMaybe },
        ];
        // Right half (positive): Yes a little against centre, Yes a lot
        // further out - mirrors the left half.
        const segsRight = [
          { key: 3, x0: 0, x1: pLittle },
          { key: 4, x0: pLittle, x1: pLittle + pLot },
        ];

        [...segsLeft, ...segsRight].forEach((seg) => {
          const x0px = x(seg.x0);
          const x1px = x(seg.x1);
          const rect = svg.append('rect')
            .attr('x', Math.min(x0px, x1px)).attr('width', Math.abs(x1px - x0px))
            .attr('y', rowY).attr('height', yScale.bandwidth())
            .attr('fill', colors[seg.key])
            .attr('tabindex', 0);
          rect.on('mouseenter focus', (evt) => {
            const pct = p(seg.key);
            tip.show(`<strong>${d.activityType}</strong>${meta.scale.labels[seg.key]}: ${U.formatPct(pct)} (${d.counts[seg.key]} of ${known} people)`, evt);
          }).on('mousemove', (evt) => tip.move(evt)).on('mouseleave blur', () => tip.hide());
        });

        if (d.counts.dontKnow > 0) {
          const rate = d.counts.dontKnow / d.total;
          const dkWidth = 14;
          svg.append('rect')
            .attr('x', width - margin.right - dkWidth).attr('width', dkWidth)
            .attr('y', rowY).attr('height', yScale.bandwidth())
            .attr('fill', 'transparent')
            .attr('stroke', U.cssVar('--likert-unknown'))
            .attr('stroke-width', 2)
            .attr('tabindex', 0)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${d.activityType}</strong>"I do not know": ${U.formatPct(rate)} of people (${d.counts.dontKnow})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
        }
      });

      const note = document.createElement('div');
      note.style.fontSize = 'var(--text-caption)';
      note.style.color = 'var(--text-muted)';
      note.style.marginTop = '2px';
      note.textContent = 'Bars line up at the point between "Maybe" and "Yes a little", so you can see how many answered more or less positively. "I do not know" is not counted in the percentages.';
      cell.appendChild(note);
    });
  }

  // --- General STEM outcomes: one group, not split by activity -----------
  // Sorted lollipop, single colour - there's no activity dimension to
  // encode with colour here, so sorting best-to-worst is what makes this
  // readable instead.
  function renderGeneral(container, ratings, meta) {
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

    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    const gutter = compact ? 0 : U.labelGutter(rows.map((r) => r.item), LABEL_FONT, { min: 200, max: 300 });
    const margin = compact ? COMPACT_MARGIN : {
      top: 28, right: 96, bottom: 8, left: gutter,
    };
    const geo = U.rowGeometry({
      compact,
      keys: rows.map((r) => r.item),
      width,
      margin,
      wideRowHeight: 36,
      widePadding: 0.25,
      plotHeight: 14,
      gap: 8,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Chart of average scores for the general STEM question, from highest to lowest');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const color = U.cssVar('--brand-accent');

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
    }

    const tip = U.tooltip();

    rows.forEach((r) => {
      const b = band(r.item);
      const cy = b.top + b.height / 2;
      if (!compact) {
        U.drawWideLabel(svg, {
          x: margin.left, yMid: cy, text: r.item, gutter, fontPx: LABEL_FONT, badge: r.pairId !== null, tip,
        });
      }

      if (r.suppressed) {
        U.drawHiddenChip(svg, {
          x: width - margin.right + 10, yMid: cy, count: 1, total: 1, names: ['All people who answered'], context: r.item, tip,
        });
        return;
      }

      const ci = U.ciDisplayBounds(r);
      svg.append('line')
        .attr('x1', x(1)).attr('x2', x(r.mean))
        .attr('y1', cy).attr('y2', cy)
        .attr('stroke', color).attr('stroke-width', 1.5).attr('opacity', 0.35);

      if (ci) {
        svg.append('line')
          .attr('class', 'ci-whisker')
          .attr('x1', x(ci.low)).attr('x2', x(ci.high))
          .attr('y1', cy).attr('y2', cy)
          .attr('stroke', color).attr('stroke-width', 1.5).attr('opacity', 0.45);
      }

      svg.append('circle')
        .attr('cx', x(r.mean)).attr('cy', cy).attr('r', 5)
        .attr('fill', color)
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${r.item}: average ${r.mean.toFixed(2)} of 4, higher is more positive, ${r.n} people`)
        .on('mouseenter focus', (evt) => tip.show(`${r.item}<br>
          Average (1=No … 4=Yes a lot): ${U.formatScore(r.mean)}<br>
          Likely range: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'too few people to estimate a range'}<br>
          ${r.n} people`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.outcomes = {
    activityKeysOrdered,
    cellsForItem,
    renderAverage,
    renderSmallMultiples,
    renderDistribution,
    renderGeneral,
  };
})();
