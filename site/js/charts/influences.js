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
  const BY_GENDER_WIDE_MIN = 520;
  const PROGRAMME_WIDE_MIN = 480;

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function pctOf(rows, item, denomIds) {
    if (!denomIds.size) return { n: 0, pct: 0 };
    const n = new Set(rows.filter((r) => r.item === item).map((r) => r.id)).size;
    return { n, pct: n / denomIds.size };
  }

  // Fixed pixel gap reserved between the two segments (and after the last
  // one) for that segment's own label - forum feedback moved these outside
  // the bar entirely, since a value sitting on top of a fairly saturated
  // magenta/teal fill read fine to us but not to teachers glancing at it on
  // a phone. Wide enough for "100%" at the label's font size.
  const SEGMENT_LABEL_GAP = 30;

  // --- Chart: a single multi-select question, split by gender group -----
  // Used for subject-choice influences, career-choice influences, subject
  // interest, and the self-perception items - same mechanics, different
  // data and accent colour per caller.
  //
  // One bar per item, split into one segment per gender group laid end to
  // end (in GROUPS order). A group gets its own segment when at least
  // SMALL_CELL_THRESHOLD people in it answered the question; a smaller group
  // is named in a note as hidden for privacy (never dropped silently, never
  // called "other"), and its answers still count everywhere else. Each
  // segment's length is that group's OWN percentage - "share of that group's
  // people who selected this item" - so the segments are independent
  // numbers placed next to each other, not parts of a shared 100%. Every
  // segment carries its own value as a label, and there is deliberately no
  // percentage axis, since one would invite reading the bar as a stacked
  // total.
  function renderByGender(container, { rows, colors }) {
    container.innerHTML = '';

    const groups = GENDER_GROUPS.map((group) => {
      const groupRows = rows.filter((r) => r.gender === group);
      const ids = new Set(groupRows.map((r) => r.id));
      return {
        group, rows: groupRows, ids, size: ids.size, shown: ids.size > 0 && !U.isSuppressed(ids.size), color: colors[group],
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
      .map((g) => `<span class="legend__item"><span class="legend__swatch" style="background:${g.color}"></span>${g.group} (${g.size} people)</span>`)
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
      // A group can clear the threshold overall while a single option was
      // picked by only one to four of its people - that count is small enough
      // to identify someone, so it is hidden the same way as any small cell.
      const segments = shownGroups.map((g) => {
        const v = pctOf(g.rows, item, g.ids);
        return { group: g, ...v, hidden: v.n > 0 && U.isSuppressed(v.n) };
      });
      return { item, segments, total: segments.reduce((sum, seg) => sum + (seg.hidden ? 0 : seg.pct), 0) };
    }).sort((a, b) => b.total - a.total);

    const compact = U.isCompact(container, BY_GENDER_WIDE_MIN);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || BY_GENDER_WIDE_MIN, BY_GENDER_WIDE_MIN);
    // Right margin holds the trailing segment's label.
    const margin = compact
      ? {
        top: 4, right: 38, bottom: 4, left: 0,
      }
      : {
        top: 4, right: 42, bottom: 4, left: 220,
      };
    const geo = U.rowGeometry({
      compact,
      keys: bars.map((d) => d.item),
      labelFor: (key) => U.displayLabel(key),
      width,
      margin,
      wideRowHeight: 34,
      widePadding: 0.3,
      wideOuterPadding: 0.3,
      plotHeight: 18,
    });
    const { height, band } = geo;

    // The scale covers the widest combined bar and leaves room for every
    // segment's label gap, so the last segment never runs into the edge
    // however many groups are shown.
    const maxCombined = d3.max(bars, (d) => d.total) || 0.1;
    const plotPx = Math.max(60, width - margin.left - margin.right - SEGMENT_LABEL_GAP * (shownGroups.length - 1));
    const x = d3.scaleLinear().domain([0, maxCombined]).range([margin.left, margin.left + plotPx]);

    const top = bars[0];
    const topSummary = top ? `${U.displayLabel(top.item)} is picked most often (${top.segments.map((seg) => (seg.hidden ? `hidden for privacy for ${seg.group.group}` : `${U.formatPct(seg.pct)} ${seg.group.group}`)).join(', ')})` : '';
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `Bar chart of how often each option was picked, with one segment for each gender group (${shownGroups.map((g) => g.group).join(', ')}). Each segment is that group's own percentage, not a share of one total. ${topSummary}.`);

    const tip = U.tooltip();

    bars.forEach((d) => {
      const label = U.displayLabel(d.item);
      const b = band(d.item);
      // Wide rows keep some air above and below the bar inside each band;
      // a compact band is already just the bar.
      const bar = compact ? b : { top: b.top + b.height * 0.15, height: b.height * 0.7 };
      const barMid = bar.top + bar.height / 2;

      if (compact) {
        U.drawStackedLabel(svg, geo.layout.rows.get(d.item), geo.layout, { title: label });
      } else {
        svg.append('text')
          .attr('class', 'item-row-label')
          .style('font-size', '0.72rem')
          .attr('x', margin.left - 10).attr('y', barMid)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .text(truncate(label, 34))
          .append('title').text(label);
      }

      let cursor = margin.left;
      d.segments.forEach((seg) => {
        if (seg.hidden) {
          svg.append('text')
            .attr('x', cursor + 4).attr('y', barMid)
            .attr('dy', '0.32em')
            .attr('fill', U.cssVar('--text-muted'))
            .style('font-size', '0.7rem')
            .text('×')
            .attr('tabindex', 0)
            .attr('role', 'img')
            .attr('aria-label', `${seg.group.group}, ${label}: hidden for privacy, fewer than ${U.SMALL_CELL_THRESHOLD} people`)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${seg.group.group}</strong>${label}<br>Hidden for privacy: fewer than ${U.SMALL_CELL_THRESHOLD} people`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
          cursor += SEGMENT_LABEL_GAP;
          return;
        }
        if (seg.pct <= 0) {
          cursor += SEGMENT_LABEL_GAP;
          return;
        }
        const segPx = x(seg.pct) - x(0);
        const desc = `${seg.group.group}, ${label}: ${U.formatPct(seg.pct)} (${seg.n} of ${seg.group.size} people)`;
        svg.append('rect')
          .attr('x', cursor).attr('width', segPx)
          .attr('y', bar.top).attr('height', bar.height)
          .attr('fill', seg.group.color)
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', desc)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${seg.group.group}</strong>${label}<br>${U.formatPct(seg.pct)} (${seg.n} of ${seg.group.size} people)`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());

        // Outside the segment, in the gap reserved after it, so a value never
        // sits on a saturated fill.
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', cursor + segPx + 4)
          .attr('y', barMid)
          .attr('dy', '0.32em')
          .attr('text-anchor', 'start')
          .style('font-size', '0.66rem')
          .style('fill', U.cssVar('--text-secondary'))
          .text(U.formatPct(seg.pct));

        cursor += segPx + SEGMENT_LABEL_GAP;
      });
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${BY_GENDER_WIDE_MIN}px`;
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
