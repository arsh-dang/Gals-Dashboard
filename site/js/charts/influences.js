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

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function pctOf(rows, item, denomIds) {
    if (!denomIds.size) return { n: 0, pct: 0 };
    const n = new Set(rows.filter((r) => r.item === item).map((r) => r.id)).size;
    return { n, pct: n / denomIds.size };
  }

  // --- Chart: a single multi-select question, split female vs male -------
  // Used for subject-choice influences, career-choice influences, subject
  // interest, and the self-perception items - same mechanics, different
  // data and accent colour per caller.
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
    const bars = items.map((item) => ({
      item,
      female: pctOf(femaleRows, item, femaleIds),
      male: pctOf(maleRows, item, maleIds),
    })).sort((a, b) => (b.female.pct + b.male.pct) - (a.female.pct + a.male.pct));

    const width = Math.max(container.clientWidth || 520, 480);
    const rowHeight = 36;
    const margin = {
      top: 4, right: 46, bottom: 4, left: 220,
    };
    const height = margin.top + margin.bottom + bars.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Percentage of respondents selecting each option, female compared to male');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(bars.map((d) => d.item)).range([margin.top, height - margin.bottom]).padding(0.3);
    const sub = d3.scaleBand().domain(['female', 'male']).range([0, y.bandwidth()]).padding(0.15);

    svg.selectAll('line.gridline')
      .data([0, 0.25, 0.5, 0.75, 1])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    const tip = U.tooltip();

    bars.forEach((d) => {
      svg.append('text')
        .attr('class', 'item-row-label')
        .style('font-size', '0.72rem')
        .attr('x', margin.left - 10).attr('y', y(d.item) + y.bandwidth() / 2)
        .attr('text-anchor', 'end').attr('dy', '0.32em')
        .text(truncate(d.item, 34))
        .append('title').text(d.item);

      [['female', d.female, femaleSuppressed, colors.female, 'Female'], ['male', d.male, maleSuppressed, colors.male, 'Male']].forEach(([key, val, suppressed, color, label]) => {
        const barY = y(d.item) + sub(key);
        if (suppressed) {
          svg.append('text')
            .attr('x', margin.left + 8).attr('y', barY + sub.bandwidth() / 2)
            .attr('dy', '0.32em')
            .style('font-size', '0.62rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
          return;
        }
        svg.append('rect')
          .attr('x', margin.left).attr('width', Math.max(0, x(val.pct) - margin.left))
          .attr('y', barY).attr('height', sub.bandwidth())
          .attr('fill', color)
          .attr('tabindex', 0)
          .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>${truncate(d.item, 60)}<br>${U.formatPct(val.pct)} (n=${val.n})`, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
        svg.append('text')
          .attr('class', 'bar-label')
          .attr('x', x(val.pct) + 6).attr('y', barY + sub.bandwidth() / 2)
          .attr('dy', '0.32em')
          .style('font-size', '0.68rem')
          .text(U.formatPct(val.pct));
      });
    });

    container.querySelector('svg').style.minWidth = '520px';
  }

  // --- Programme influence, called out on its own, by did_gals ------------
  // Unchanged split - the team asked to change the other four charts to
  // gender, not this one.
  function renderProgrammeInfluence(container, { subjectRows, careerRows, meta, didGalsColors }) {
    container.innerHTML = '';
    const { programmeInfluenceLabel, sharedInfluences } = meta.subjectChoice;
    const programmePair = sharedInfluences.find((i) => i.canonical === programmeInfluenceLabel);

    const groups = [
      { label: 'Subject choice', rows: subjectRows, item: programmePair.subject },
      { label: 'Career choice', rows: careerRows, item: programmePair.career },
    ];

    const width = Math.max(container.clientWidth || 520, 480);
    const rowHeight = 32;
    const margin = {
      top: 8, right: 50, bottom: 4, left: 210,
    };
    const height = margin.top + margin.bottom + groups.length * 2 * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Percentage of respondents citing STEM activities and programmes as an influence, split by GALS participation');

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    svg.selectAll('line.gridline')
      .data([0, 0.25, 0.5, 0.75, 1])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    const tip = U.tooltip();
    let rowIndex = 0;

    groups.forEach((g) => {
      const galsIds = new Set(g.rows.filter((r) => r.didGals).map((r) => r.id));
      const nonGalsIds = new Set(g.rows.filter((r) => !r.didGals).map((r) => r.id));

      [['GALS', galsIds, didGalsColors.gals], ['Not GALS', nonGalsIds, didGalsColors.nonGals]].forEach(([label, subIds, color]) => {
        const barY = margin.top + rowIndex * rowHeight;
        const suppressed = U.isSuppressed(subIds.size);
        svg.append('text')
          .attr('class', 'item-row-label')
          .attr('x', margin.left - 12).attr('y', barY + rowHeight / 2 - 8)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .style('font-size', '0.7rem')
          .text(`${g.label} - ${label}`);

        if (suppressed) {
          svg.append('text')
            .attr('x', margin.left + 8).attr('y', barY + rowHeight / 2 - 8)
            .attr('dy', '0.32em')
            .style('font-size', '0.65rem')
            .attr('fill', U.cssVar('--text-muted'))
            .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        } else {
          const n = new Set(g.rows.filter((r) => r.item === g.item && subIds.has(r.id)).map((r) => r.id)).size;
          const pct = n / subIds.size;
          svg.append('rect')
            .attr('x', margin.left).attr('width', Math.max(0, x(pct) - margin.left))
            .attr('y', barY - 8).attr('height', rowHeight - 14)
            .attr('fill', color)
            .attr('tabindex', 0)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${g.label} - ${label}</strong>${U.formatPct(pct)} picked STEM activities/programmes as an influence (n=${n} of ${subIds.size})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
          svg.append('text')
            .attr('class', 'bar-label')
            .attr('x', x(pct) + 6).attr('y', barY + rowHeight / 2 - 15)
            .attr('dy', '0.32em')
            .text(U.formatPct(pct));
        }
        rowIndex += 1;
      });
    });

    container.querySelector('svg').style.minWidth = '420px';
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.influences = { renderByGender, renderProgrammeInfluence };
})();
