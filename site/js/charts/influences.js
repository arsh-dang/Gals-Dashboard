// View 5: subject choice and career choice influences, plus the smaller
// subject-interest and self-perception panels. All four are now split by
// gender rather than GALS participation (the programme-influence panel
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

  const SMALL_GENDER_GROUPS = ['Non-binary / third gender', 'Prefer not to say'];

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

  function luminance(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return 1;
    const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const textOn = (bg) => (luminance(bg) < 0.55 ? '#fff' : '#000');

  // --- Chart: a single multi-select question, split female vs male -------
  // Used for subject-choice influences, career-choice influences, subject
  // interest, and the self-perception items - same mechanics, different
  // data and accent colour per caller.
  //
  // One bar per item, split into a female segment and a male segment laid
  // end to end (female first, then male). Each segment's length is that
  // gender's OWN percentage - "share of that gender's respondents who
  // selected this item" - so the two segments are two independent numbers
  // placed next to each other, not two parts of a shared 100%. Every
  // segment carries its own value as a label directly on or next to it, so
  // a reader never has to infer a number from position on an axis: there
  // is deliberately no percentage axis under this chart, since one would
  // invite reading the bar as a stacked total, which it is not.
  function renderByGender(container, { rows, colors }) {
    container.innerHTML = '';

    const femaleIds = new Set(rows.filter((r) => r.gender === 'Female').map((r) => r.id));
    const maleIds = new Set(rows.filter((r) => r.gender === 'Male').map((r) => r.id));
    const femaleSuppressed = U.isSuppressed(femaleIds.size);
    const maleSuppressed = U.isSuppressed(maleIds.size);

    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
      <span class="legend__item"><span class="legend__swatch" style="background:${colors.female}"></span>Female (n=${femaleIds.size})</span>
      <span class="legend__item"><span class="legend__swatch" style="background:${colors.male}"></span>Male (n=${maleIds.size})</span>
    `;
    container.appendChild(legend);

    // Small groups still exist in the data and are still asked about here -
    // shown once per chart with the standard suppression badge, not
    // silently dropped from the respondent pool before anyone sees them.
    const smallGroupNotes = SMALL_GENDER_GROUPS.map((g) => {
      const n = new Set(rows.filter((r) => r.gender === g).map((r) => r.id)).size;
      return { group: g, n };
    }).filter((d) => d.n > 0);
    if (smallGroupNotes.length) {
      const note = document.createElement('p');
      note.className = 'card__note';
      note.style.marginTop = 'var(--space-2)';
      note.innerHTML = `<span class="badge-suppressed">Suppressed</span> ${smallGroupNotes.map((d) => `${d.group} (n=${d.n})`).join(', ')}: too few respondents to break down, not excluded from the survey.`;
      container.appendChild(note);
    }

    // pctOf's numerator is scoped by whatever rows it's given, so each
    // call must be pre-filtered to the matching gender - passing the full
    // `rows` for both and relying only on the denominator to differ would
    // count every gender's picks against a single gender's total.
    const femaleRows = rows.filter((r) => r.gender === 'Female');
    const maleRows = rows.filter((r) => r.gender === 'Male');
    const items = [...new Set(rows.map((r) => r.item))];
    const bars = items.map((item) => {
      const female = pctOf(femaleRows, item, femaleIds);
      const male = pctOf(maleRows, item, maleIds);
      return {
        item,
        female,
        male,
        femaleWidth: femaleSuppressed ? 0 : female.pct,
        maleWidth: maleSuppressed ? 0 : male.pct,
      };
    }).sort((a, b) => (b.femaleWidth + b.maleWidth) - (a.femaleWidth + a.maleWidth));

    const compact = U.isCompact(container, BY_GENDER_WIDE_MIN);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || BY_GENDER_WIDE_MIN, BY_GENDER_WIDE_MIN);
    const margin = compact
      ? {
        top: 4, right: 8, bottom: 4, left: 0,
      }
      : {
        top: 4, right: 16, bottom: 4, left: 220,
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

    // Domain covers the widest combined segment length across all rows,
    // with headroom for labels - not [0,1], since two segments placed end
    // to end can together exceed 1. This axis has no percentage meaning of
    // its own, so no ticks are drawn under it: a labelled scale would
    // invite reading the bar as a stacked total, which it is not.
    const maxCombined = d3.max(bars, (d) => d.femaleWidth + d.maleWidth) || 0.1;
    const x = d3.scaleLinear().domain([0, maxCombined * 1.35]).range([margin.left, width - margin.right]);

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', "Bar chart of percentage of respondents selecting each option, one bar per option split into a female segment and a male segment placed end to end; each segment is that gender's own percentage, not a shared total");

    const tip = U.tooltip();
    const zeroPx = x(0);

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

      if (femaleSuppressed && maleSuppressed) {
        svg.append('text')
          .attr('x', margin.left).attr('y', barMid)
          .attr('dy', '0.32em')
          .style('font-size', '0.68rem')
          .attr('fill', U.cssVar('--text-muted'))
          .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }

      let cursor = margin.left;
      [
        ['Female', d.female, d.femaleWidth, femaleSuppressed, colors.female],
        ['Male', d.male, d.maleWidth, maleSuppressed, colors.male],
      ].forEach(([genderLabel, val, segWidth, suppressed, color]) => {
        if (suppressed) {
          svg.append('text')
            .attr('x', cursor + 4).attr('y', barMid)
            .attr('dy', '0.32em')
            .style('font-size', '0.6rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`${genderLabel} suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
          cursor += 90;
          return;
        }
        if (segWidth <= 0) return;

        const segPx = x(segWidth) - zeroPx;
        const rectX = cursor;
        const denomSize = genderLabel === 'Female' ? femaleIds.size : maleIds.size;
        svg.append('rect')
          .attr('x', rectX).attr('width', segPx)
          .attr('y', bar.top).attr('height', bar.height)
          .attr('fill', color)
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', `${genderLabel}, ${label}: ${U.formatPct(val.pct)} (n=${val.n} of ${denomSize})`)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${genderLabel}</strong>${truncate(label, 60)}<br>${U.formatPct(val.pct)} (n=${val.n} of ${denomSize})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());

        const fitsInside = segPx >= 34;
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', fitsInside ? rectX + segPx / 2 : rectX + segPx + 4)
          .attr('y', barMid)
          .attr('dy', '0.32em')
          .attr('text-anchor', fitsInside ? 'middle' : 'start')
          .style('font-size', '0.66rem')
          .style('font-weight', fitsInside ? '600' : '400')
          // style, not attr: the .bar-label class rule outranks a fill
          // attribute, which left these dark grey on the magenta/teal
          // segments instead of the white textOn() picks for contrast.
          .style('fill', fitsInside ? textOn(color) : U.cssVar('--text-secondary'))
          .text(U.formatPct(val.pct));

        cursor += segPx;
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
      [['GALS', galsIds, didGalsColors.gals], ['Not GALS', nonGalsIds, didGalsColors.nonGals]].forEach(([groupLabel, subIds, color]) => {
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
    const margin = compact
      ? {
        top: 4, right: 44, bottom: 4, left: 0,
      }
      : {
        top: 8, right: 50, bottom: 8, left: 210,
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
      .attr('aria-label', 'Percentage of respondents citing STEM activities and programmes as an influence, split by GALS participation');

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
        svg.append('text')
          .attr('class', 'item-row-label')
          .attr('x', margin.left - 12).attr('y', b.top + b.height / 2)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .style('font-size', '0.7rem')
          .text(e.key);
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
          .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }
      svg.append('rect')
        .attr('x', margin.left).attr('width', Math.max(0, x(e.pct) - margin.left))
        .attr('y', b.top).attr('height', b.height)
        .attr('fill', e.color)
        .attr('tabindex', 0)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${e.key}</strong>${U.formatPct(e.pct)} picked STEM activities/programmes as an influence (n=${e.n} of ${e.denom})`, evt))
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
