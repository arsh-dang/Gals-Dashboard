// View 3: Skills and identity. Multi-select batteries have no meaningful
// average - shows % of that activity's participants who selected each
// item. Used to draw one small panel per activity (up to seven at once);
// now one activity at a time (the same selector as Outcomes by activity),
// sorted bars, top 5 with "show all" - the same "one chart, one
// comparison" simplification applied everywhere else. Denominator is the
// activity's actual respondent count (from ratings, which every
// participant appears in), not the selection rows themselves, since a
// multi-select respondent who ticked nothing would otherwise vanish from
// the denominator too.
(function () {
  'use strict';

  const U = window.SIT.utils;

  const MARGIN = {
    top: 4, right: 44, bottom: 4, left: 0,
  };

  function activitiesWithBattery(meta) {
    return meta.activityTypesWithBattery.slice().sort((a, b) => {
      if (a === 'Girls as Leaders in STEM program') return 1;
      if (b === 'Girls as Leaders in STEM program') return -1;
      return a.localeCompare(b);
    });
  }

  function render(container, {
    selections, ratings, meta, battery, activityType, colorScale, expanded, onToggle,
  }) {
    container.innerHTML = '';
    const denom = U.countDistinctIds(ratings.filter((r) => r.activityType === activityType));

    if (U.isSuppressed(denom)) {
      const badge = document.createElement('span');
      badge.className = 'badge-suppressed';
      badge.textContent = denom === 0 ? 'No respondents in current filter' : `Suppressed: n<${U.SMALL_CELL_THRESHOLD}`;
      container.appendChild(badge);
      return;
    }

    const items = [...new Set(selections.filter((s) => s.battery === battery).map((s) => s.item))];
    const activitySelections = selections.filter((s) => s.activityType === activityType && s.battery === battery);
    // The activity's own n clearing the threshold doesn't guarantee any one
    // item does - suppress per item too, same rule as every other cell in
    // the dashboard, so a single respondent's pick is never shown as an
    // identifiable bar.
    const bars = items.map((item) => {
      const n = U.countDistinctIds(activitySelections.filter((s) => s.item === item));
      return {
        item, n, pct: denom ? n / denom : 0, suppressed: U.isSuppressed(n),
      };
    }).sort((a, b) => {
      if (a.suppressed && b.suppressed) return 0;
      if (a.suppressed) return 1;
      if (b.suppressed) return -1;
      return b.pct - a.pct;
    });
    const shownBars = expanded ? bars : bars.slice(0, 5);

    const width = Math.max(container.clientWidth || 320, 280);
    const margin = { ...MARGIN };
    const geo = U.rowLayout(shownBars.map((d) => d.item), (key) => U.displayLabel(key), {
      width, margin, plotHeight: 20,
    });
    const { height, band } = geo;

    const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', `${battery === 'skills' ? 'Skills' : 'Identity'} selected by ${activityType} participants, sorted highest to lowest`);

    const tip = U.tooltip();

    shownBars.forEach((d) => {
      const b = band(d.item);
      const label = U.displayLabel(d.item);
      U.drawStackedLabel(svg, geo.layout.rows.get(d.item), geo.layout, { title: label });
      if (d.suppressed) {
        svg.append('text')
          .attr('x', margin.left).attr('y', b.top + b.height / 2)
          .attr('dy', '0.32em')
          .style('font-size', '0.62rem')
          .attr('fill', U.cssVar('--text-muted'))
          .text(`suppressed (n<${U.SMALL_CELL_THRESHOLD})`);
        return;
      }
      svg.append('rect')
        .attr('x', margin.left).attr('width', x(d.pct) - margin.left)
        .attr('y', b.top).attr('height', b.height)
        .attr('fill', colorScale(activityType))
        .attr('tabindex', 0)
        .attr('role', 'img')
        .attr('aria-label', `${label}: ${U.formatPct(d.pct)} of ${activityType} participants, n=${d.n} of ${denom}`)
        .on('mouseenter focus', (evt) => tip.show(`<strong>${label}</strong>${U.formatPct(d.pct)} of ${activityType} participants (n=${d.n} of ${denom})`, evt))
        .on('mousemove', (evt) => tip.move(evt))
        .on('mouseleave blur', () => tip.hide());
      svg.append('text')
        .attr('class', 'bar-label')
        .attr('x', x(d.pct) + 6).attr('y', b.top + b.height / 2)
        .attr('dy', '0.32em')
        .text(U.formatPct(d.pct));
    });

    U.appendShowAllToggle(container, {
      totalCount: bars.length, shownCount: 5, expanded, onToggle,
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.skills = { render, activitiesWithBattery };
})();
