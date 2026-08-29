// View 5 (part 2): Subject selection and career aspirations. Multi-select
// (and two single-choice) batteries, not tied to an activity, split by
// did_gals rather than pooled - same frequency-not-average logic as
// Skills and identity, but with two independent denominators per question
// (GALS / not GALS) instead of one per activity.
//
// Every distinct `question` string is its own facet, including the ones
// suffixed "(post-school)" - grouping strictly by that literal string is
// what keeps wording variants from being pooled together, regardless of
// what actually determines who saw which wording (checked: it is not
// respondent pathway in this data - both pathways answer both variants in
// closely matching proportions, so a pathway-based filter would be wrong
// here, not just redundant).
(function () {
  'use strict';

  const U = window.SIT.utils;

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function render(container, { rows, meta, questionGroup, colors }) {
    container.innerHTML = '';
    const questions = meta.subjectCareerQuestions.filter((q) => q.questionGroup === questionGroup);

    const grid = document.createElement('div');
    grid.className = 'facet-grid';
    container.appendChild(grid);

    const tip = U.tooltip();

    questions.forEach((q) => {
      const cell = document.createElement('div');
      cell.className = 'facet-grid__cell';
      grid.appendChild(cell);

      const qRows = rows.filter((r) => r.question === q.question);
      const galsIds = new Set(qRows.filter((r) => r.didGals).map((r) => r.id));
      const nonGalsIds = new Set(qRows.filter((r) => !r.didGals).map((r) => r.id));
      const galsSuppressed = U.isSuppressed(galsIds.size);
      const nonGalsSuppressed = U.isSuppressed(nonGalsIds.size);

      const title = document.createElement('div');
      title.className = 'facet-grid__title';
      title.innerHTML = `<span>${truncate(q.question, 46)}</span><span class="facet-grid__n">GALS n=${galsIds.size} · other n=${nonGalsIds.size}</span>`;
      cell.appendChild(title);

      if (galsSuppressed && nonGalsSuppressed) {
        const badge = document.createElement('span');
        badge.className = 'badge-suppressed';
        badge.textContent = `Suppressed: both groups under ${U.SMALL_CELL_THRESHOLD}`;
        cell.appendChild(badge);
        return;
      }

      const items = [...new Set(qRows.map((r) => r.item))];
      const bars = items.map((item) => {
        const galsN = new Set(qRows.filter((r) => r.item === item && r.didGals).map((r) => r.id)).size;
        const nonGalsN = new Set(qRows.filter((r) => r.item === item && !r.didGals).map((r) => r.id)).size;
        return {
          item,
          galsPct: galsIds.size ? galsN / galsIds.size : 0,
          nonGalsPct: nonGalsIds.size ? nonGalsN / nonGalsIds.size : 0,
          galsN,
          nonGalsN,
        };
      }).sort((a, b) => (b.galsPct + b.nonGalsPct) - (a.galsPct + a.nonGalsPct));

      const width = 340;
      const rowH = galsSuppressed || nonGalsSuppressed ? 20 : 32;
      const margin = {
        top: 4, right: 40, bottom: 4, left: 150,
      };
      const height = margin.top + margin.bottom + bars.length * rowH;
      const svg = d3.select(cell).append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'img')
        .attr('aria-label', `${q.question}: percentage selecting each option, GALS vs other respondents`);

      const x = d3.scaleLinear().domain([0, 1]).range([margin.left, width - margin.right]);
      const y = d3.scaleBand().domain(bars.map((d) => d.item)).range([margin.top, height - margin.bottom]).padding(0.3);
      const sub = d3.scaleBand().domain(galsSuppressed || nonGalsSuppressed ? ['solo'] : ['gals', 'nonGals'])
        .range([0, y.bandwidth()]).padding(0.15);

      bars.forEach((d) => {
        svg.append('text')
          .attr('class', 'item-row-label')
          .style('font-size', '0.68rem')
          .attr('x', margin.left - 8).attr('y', y(d.item) + y.bandwidth() / 2)
          .attr('text-anchor', 'end').attr('dy', '0.32em')
          .text(truncate(d.item, 26))
          .append('title').text(d.item);

        const series = [];
        if (!galsSuppressed) series.push({ key: 'gals', pct: d.galsPct, n: d.galsN, denom: galsIds.size, color: colors.gals, label: 'GALS' });
        if (!nonGalsSuppressed) series.push({ key: 'nonGals', pct: d.nonGalsPct, n: d.nonGalsN, denom: nonGalsIds.size, color: colors.nonGals, label: 'Not GALS' });

        series.forEach((s) => {
          const subKey = series.length === 1 ? 'solo' : s.key;
          const barY = y(d.item) + sub(subKey);
          const rect = svg.append('rect')
            .attr('x', margin.left).attr('width', Math.max(0, x(s.pct) - margin.left))
            .attr('y', barY).attr('height', sub.bandwidth())
            .attr('fill', s.color)
            .attr('tabindex', 0);
          rect.on('mouseenter focus', (evt) => tip.show(`<strong>${s.label}</strong>${truncate(d.item, 60)}<br>${U.formatPct(s.pct)} (n=${s.n} of ${s.denom})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
          svg.append('text')
            .attr('class', 'bar-label')
            .attr('x', x(s.pct) + 6).attr('y', barY + sub.bandwidth() / 2)
            .attr('dy', '0.32em')
            .style('font-size', '0.65rem')
            .text(U.formatPct(s.pct));
        });
      });

      if (galsSuppressed || nonGalsSuppressed) {
        const note = document.createElement('p');
        note.className = 'card__note';
        note.style.marginTop = '2px';
        note.textContent = galsSuppressed
          ? `GALS suppressed for this question: n<${U.SMALL_CELL_THRESHOLD}. Showing "not GALS" only.`
          : `"Not GALS" suppressed for this question: n<${U.SMALL_CELL_THRESHOLD}. Showing GALS only.`;
        cell.appendChild(note);
      }
    });
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.subjectCareer = { render };
})();
