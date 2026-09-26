// View 5: subject choice and career choice influences, plus the smaller
// subject-interest and self-perception panels. All four are now split by
// gender group rather than GALS participation (the programme-influence panel
// below keeps its GALS split - that one wasn't part of the change).
//
// Denominator for every percentage is the distinct respondent count for
// the relevant question (not per-item), since a multi-select respondent
// who ticked nothing would otherwise silently vanish from the
// denominator. The female/male comparison is the one asked for; non-binary
// and prefer-not-to-say groups are still computed and shown with the same
// suppression marker as any small group when they exist in the data,
// rather than being quietly filtered out before anyone sees the count.
(function () {
  'use strict';

  const U = window.SIT.utils;

  // The labels respondents chose, in one fixed order everywhere they appear.
  const GENDER_GROUPS = ['Female', 'Male', 'Non-binary / third gender', 'Prefer not to say'];

  // Below these container widths each chart moves its labels above the
  // bars (see U.rowGeometry) instead of keeping a 210-220px label gutter.
  const BY_GENDER_WIDE_MIN = 560;
  const PROGRAMME_WIDE_MIN = 480;

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function pctOf(rows, item, denomIds) {
    if (!denomIds.size) return { n: 0, pct: 0 };
    const n = new Set(rows.filter((r) => r.item === item).map((r) => r.id)).size;
    return { n, pct: n / denomIds.size };
  }

  // --- Chart: a single multi-select question, compared across gender groups
  // Used for subject-choice influences, career-choice influences, subject
  // interest, and the self-perception items - same mechanics, different data.
  //
  // A dot plot on one shared 0-100% axis: one row per option, one dot per
  // gender group, and a thin line joining the dots so the gap between groups
  // is what the eye reads. Each dot is that group's OWN percentage ("share of
  // that group's people who selected this option"). An earlier version laid
  // the groups' bars end to end, which read as one stacked total (54% + 67%
  // looked like a single 121% bar); a shared axis makes that misreading
  // impossible.
  //
  // A group gets dots when at least SMALL_CELL_THRESHOLD people in it answered
  // the question; a smaller group is named in a note as hidden for privacy
  // (never dropped silently, never called "other"). A single option picked by
  // one to four people of a shown group is hidden too, as a grey "hidden" tag
  // in the right-hand column, never as a mark on the axis.
  function renderByGender(container, { rows, colors }) {
    container.innerHTML = '';

    const markerFor = U.buildMarkerScale(GENDER_GROUPS);
    const groups = GENDER_GROUPS.map((group) => {
      const groupRows = rows.filter((r) => r.gender === group);
      const ids = new Set(groupRows.map((r) => r.id));
      return {
        group, rows: groupRows, ids, size: ids.size, shown: ids.size > 0 && !U.isSuppressed(ids.size), color: colors[group], marker: markerFor(group),
      };
    });
    const shownGroups = groups.filter((g) => g.shown);
    const hiddenGroups = groups.filter((g) => g.size > 0 && !g.shown);

    if (!shownGroups.length) {
      const msg = document.createElement('span');
      msg.className = 'badge-suppressed';
      msg.textContent = `Hidden for privacy: fewer than ${U.SMALL_CELL_THRESHOLD} people in each group`;
      container.appendChild(msg);
      return;
    }

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = shownGroups
      .map((g) => `<span class="legend__item">${U.legendMarker(g.marker, g.color)}${g.group} (${g.size} people)</span>`)
      .join('');
    container.appendChild(legend);

    if (hiddenGroups.length) {
      const note = document.createElement('p');
      note.className = 'card__note';
      note.style.marginTop = 'var(--space-2)';
      note.innerHTML = `<span class="badge-suppressed">Hidden for privacy</span> ${hiddenGroups.map((g) => g.group).join(', ')}: fewer than ${U.SMALL_CELL_THRESHOLD} people, so not shown on their own. Their answers still count in the rest of the survey.`;
      container.appendChild(note);
    }

    const items = [...new Set(rows.map((r) => r.item))];
    const bars = items.map((item) => {
      const points = shownGroups.map((g) => {
        const v = pctOf(g.rows, item, g.ids);
        return { group: g, ...v, hidden: v.n > 0 && U.isSuppressed(v.n) };
      });
      const visible = points.filter((p) => !p.hidden);
      return { item, points, sortKey: visible.length ? d3.mean(visible, (p) => p.pct) : -1 };
    }).sort((a, b) => b.sortKey - a.sortKey);

    const compact = U.isCompact(container, BY_GENDER_WIDE_MIN);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || BY_GENDER_WIDE_MIN, BY_GENDER_WIDE_MIN);
    const labels = bars.map((d) => U.displayLabel(d.item));
    const gutter = compact ? 0 : U.labelGutter(labels, 12, { min: 160, max: Math.round(width * 0.36) });
    // The right margin is the fixed column for "hidden" tags.
    const margin = compact
      ? {
        top: 26, right: 70, bottom: 30, left: 8,
      }
      : {
        top: 26, right: 90, bottom: 8, left: gutter,
      };
    const geo = U.rowGeometry({
      compact,
      keys: bars.map((d) => d.item),
      labelFor: (key) => U.displayLabel(key),
      width,
      margin,
      wideRowHeight: 34,
      widePadding: 0.2,
      plotHeight: 14,
    });
    const { height, band } = geo;

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const ticks = [0, 0.25, 0.5, 0.75, 1];
    const pctFormat = d3.format('.0%');

    const top = bars[0];
    const topSummary = top ? `${U.displayLabel(top.item)} is picked most often (${top.points.map((p) => (p.hidden ? `hidden for privacy for ${p.group.group}` : `${U.formatPct(p.pct)} ${p.group.group}`)).join(', ')})` : '';
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Dot plot of how often each option was picked, one dot per gender group (${shownGroups.map((g) => g.group).join(', ')}) on a shared 0 to 100% scale. Each dot is that group's own percentage. ${topSummary}.`);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${margin.top - 6})`)
      .call(d3.axisTop(x).tickValues(ticks).tickFormat(pctFormat));

    const tip = U.tooltip();

    if (compact) {
      U.drawCompactScaleFrame(svg, geo, x, {
        width, height, margin, ticks, tickFormat: pctFormat,
      });
    } else {
      svg.selectAll('line.gridline')
        .data(ticks)
        .join('line')
        .attr('class', 'gridline')
        .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);
      bars.forEach((d, i) => {
        const b = band(d.item);
        if (i % 2) {
          svg.append('rect')
            .attr('x', margin.left).attr('width', width - margin.left - margin.right)
            .attr('y', b.top - 4).attr('height', b.height + 8)
            .attr('fill', U.cssVar('--surface-sunken'))
            .attr('opacity', 0.5);
        }
        U.drawWideLabel(svg, {
          x: margin.left, yMid: b.top + b.height / 2, text: U.displayLabel(d.item), gutter, fontPx: 12,
        });
      });
    }

    bars.forEach((d) => {
      const label = U.displayLabel(d.item);
      const b = band(d.item);
      const cy = b.top + b.height / 2;
      const visible = d.points.filter((p) => !p.hidden);
      const hidden = d.points.filter((p) => p.hidden);

      if (visible.length > 1) {
        svg.append('line')
          .attr('class', 'dot-connector')
          .attr('x1', x(d3.min(visible, (p) => p.pct))).attr('x2', x(d3.max(visible, (p) => p.pct)))
          .attr('y1', cy).attr('y2', cy);
      }
      visible.forEach((p) => {
        const desc = `${p.group.group}, ${label}: ${U.formatPct(p.pct)} (${p.n} of ${p.group.size} people)`;
        svg.append('path')
          .attr('transform', `translate(${x(p.pct)},${cy})`)
          .attr('d', U.markerPath(p.group.marker, 5.5))
          .attr('fill', p.group.color)
          .attr('stroke', U.markOutline(p.group.color))
          .attr('stroke-width', 1)
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', desc)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${p.group.group}</strong>${label}<br>${U.formatPct(p.pct)} (${p.n} of ${p.group.size} people)`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
      });
      if (hidden.length) {
        U.drawHiddenChip(svg, {
          x: width - margin.right + 12, yMid: cy, count: hidden.length, total: hidden.length, names: hidden.map((p) => p.group.group), context: label, tip,
        });
      }
    });

    if (!compact) svg.node().style.minWidth = `${BY_GENDER_WIDE_MIN}px`;

    // The exact numbers, as a table, like every other chart on the page.
    const table = document.createElement('div');
    container.appendChild(table);
    U.renderDataTable(table, {
      columns: [
        { label: 'Option', value: (r) => U.displayLabel(r.item) },
        ...shownGroups.map((g, i) => ({
          label: `${g.group} (${g.size} people)`,
          value: (r) => (r.points[i].hidden ? 'hidden for privacy' : `${U.formatPct(r.points[i].pct)} (${r.points[i].n})`),
          align: 'right',
        })),
      ],
      rows: bars,
    });
  }

  // --- Programme influence, called out on its own, by did_gals ------------
  // Unchanged split - the team asked to change the other four charts to
  // gender, not this one.
  function renderProgrammeInfluence(container, {
    subjectRows, careerRows, meta, didGalsColors,
  }) {
    container.innerHTML = '';
    const { programmeInfluenceLabel, sharedInfluences } = meta.subjectChoice;
    const programmePair = sharedInfluences.find((i) => i.canonical === programmeInfluenceLabel);

    const groups = [
      { label: 'Subject choice', rows: subjectRows, item: programmePair.subject },
      { label: 'Career choice', rows: careerRows, item: programmePair.career },
    ];

    const entries = [];
    groups.forEach((g) => {
      const galsIds = new Set(g.rows.filter((r) => r.didGals).map((r) => r.id));
      const nonGalsIds = new Set(g.rows.filter((r) => !r.didGals).map((r) => r.id));
      [['Took part in GALS', galsIds, didGalsColors.gals], ['Did not take part in GALS', nonGalsIds, didGalsColors.nonGals]].forEach(([groupLabel, subIds, color]) => {
        const suppressed = U.isSuppressed(subIds.size);
        const n = suppressed ? 0 : new Set(g.rows.filter((r) => r.item === g.item && subIds.has(r.id)).map((r) => r.id)).size;
        entries.push({
          key: `${g.label} - ${groupLabel}`,
          suppressed,
          n,
          denom: subIds.size,
          pct: suppressed || !subIds.size ? 0 : n / subIds.size,
          color,
        });
      });
    });

    const compact = U.isCompact(container, PROGRAMME_WIDE_MIN);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || PROGRAMME_WIDE_MIN, PROGRAMME_WIDE_MIN);
    const gutter = compact ? 0 : U.labelGutter(entries.map((e) => e.key), 12, { min: 160, max: 300, pad: 14 });
    const margin = compact
      ? {
        top: 4, right: 44, bottom: 4, left: 0,
      }
      : {
        top: 8, right: 50, bottom: 8, left: gutter,
      };
    const geo = U.rowGeometry({
      compact,
      keys: entries.map((e) => e.key),
      width,
      margin,
      wideRowHeight: 32,
      widePadding: 0.4,
      plotHeight: 16,
    });
    const { height, band } = geo;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Bar chart of how often students picked "STEM activities and programs" as an influence, for people who took part in GALS and people who did not');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const ticks = [0, 0.25, 0.5, 0.75, 1];

    if (compact) {
      U.drawRowGridlines(svg, geo.layout, x, ticks);
      entries.forEach((e) => U.drawStackedLabel(svg, geo.layout.rows.get(e.key), geo.layout));
    } else {
      svg.selectAll('line.gridline')
        .data(ticks)
        .join('line')
        .attr('class', 'gridline')
        .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
        .attr('y1', margin.top).attr('y2', height - margin.bottom);
      entries.forEach((e) => {
        const b = band(e.key);
        U.drawWideLabel(svg, {
          x: margin.left, yMid: b.top + b.height / 2, text: e.key, gutter, fontPx: 12, pad: 14,
        });
      });
    }

    const tip = U.tooltip();

    entries.forEach((e) => {
      const b = band(e.key);
      const mid = b.top + b.height / 2;
      if (e.suppressed) {
        svg.append('text')
          .attr('x', margin.left + 8).attr('y', mid)
          .attr('dy', '0.32em')
          .style('font-size', '0.65rem')
          .attr('fill', U.cssVar('--text-muted'))
          .text(`hidden for privacy`);
        return;
      }
      svg.append('rect')
        .attr('x', margin.left).attr('width', Math.max(0, x(e.pct) - margin.left))
        .attr('y', b.top).attr('height', b.height)
        .attr('fill', e.color)
        .attr('tabindex', 0)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${e.key}</strong>${U.formatPct(e.pct)} picked STEM activities and programs as an influence (${e.n} of ${e.denom} people)`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(e.pct) + 6).attr('y', mid)
        .attr('dy', '0.32em')
        .text(U.formatPct(e.pct));
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${PROGRAMME_WIDE_MIN}px`;
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.influences = { renderByGender, renderProgrammeInfluence };
})();
