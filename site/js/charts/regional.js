// View 4: Regional comparison. Same dot-plot mechanics as the outcomes
// average view, but the column of dots is regions instead of activity
// types. Suppression applies per region x item cell - this is exactly the
// small-cell scenario the brief calls out (five of six regions have thin
// samples once you narrow by item/activity).
(function () {
  'use strict';

  const U = window.SIT.utils;

  function buildRegionColorScale(regions) {
    const vars = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6'];
    const map = new Map(regions.map((r, i) => [r, U.cssVar(vars[i % vars.length])]));
    return (r) => map.get(r) || U.cssVar('--text-muted');
  }

  function displayTickLabel(displayValue) {
    const code = 5 - displayValue;
    return window.SIT_DATA.meta.scale.labels[code];
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function render(container, ratings, meta, regionColorScale) {
    container.innerHTML = '';
    const regions = meta.regions.map((r) => r.key);
    const items = meta.outcomeItems;
    const width = Math.max(container.clientWidth || 640, 640);
    const rowHeight = 34;
    const margin = { top: 28, right: 24, bottom: 16, left: 340 };
    const height = margin.top + margin.bottom + items.length * rowHeight;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot of average outcome score by region, one row per outcome statement');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);
    const y = d3.scaleBand().domain(items.map((i) => i.item)).range([margin.top, height - margin.bottom]).paddingInner(0.15);
    const sub = d3.scalePoint().domain(regions).range([-y.bandwidth() / 2 + 8, y.bandwidth() / 2 - 8]);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${margin.top - 6})`)
      .call(d3.axisTop(x).tickValues([1, 2, 3, 4]).tickFormat(displayTickLabel));

    svg.selectAll('line.gridline')
      .data([1, 2, 3, 4])
      .join('line')
      .attr('class', 'gridline')
      .attr('x1', (d) => x(d)).attr('x2', (d) => x(d))
      .attr('y1', margin.top).attr('y2', height - margin.bottom);

    items.forEach((item, i) => {
      svg.append('text')
        .attr('class', 'item-row-label')
        .attr('x', margin.left - 16)
        .attr('y', y(item.item) + y.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em')
        .text(truncate(item.item, 48))
        .append('title').text(item.item);

      svg.append('rect')
        .attr('x', margin.left).attr('width', width - margin.left - margin.right)
        .attr('y', y(item.item)).attr('height', y.bandwidth())
        .attr('fill', i % 2 ? U.cssVar('--surface-sunken') : 'transparent')
        .attr('opacity', 0.5);
    });

    const tip = U.tooltip();

    items.forEach((item) => {
      regions.forEach((region) => {
        const rows = ratings.filter((r) => r.item === item.item && r.region === region);
        const summary = U.summarizeScores(rows);
        const cy = y(item.item) + y.bandwidth() / 2 + sub(region);
        const suppressed = U.isSuppressed(rows.length);

        if (suppressed) {
          svg.append('text')
            .attr('x', x(2.5)).attr('y', cy)
            .attr('text-anchor', 'middle').attr('dy', '0.32em')
            .attr('fill', U.cssVar('--text-muted'))
            .style('font-size', '0.7rem')
            .text('×')
            .attr('tabindex', 0)
            .on('mouseenter focus', (evt) => tip.show(`<strong>${region}</strong>${truncate(item.item, 60)}<br>Suppressed — fewer than ${U.SMALL_CELL_THRESHOLD} respondents (n=${rows.length})`, evt))
            .on('mousemove', (evt) => tip.move(evt))
            .on('mouseleave blur', () => tip.hide());
          return;
        }

        const display = U.toDisplayScore(summary.mean);
        svg.append('circle')
          .attr('cx', x(display)).attr('cy', cy).attr('r', 5)
          .attr('fill', regionColorScale(region))
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', `${region}, ${item.item}: average ${summary.mean.toFixed(2)} of 4, 1 is best, n=${summary.n}`)
          .on('mouseenter focus', (evt) => {
            tip.show(`<strong>${region}</strong>${truncate(item.item, 60)}<br>
              Average (raw scale, 1=Yes a lot … 4=No): ${U.formatScore(summary.mean)}<br>
              n=${summary.n}${summary.unknownN ? `<br><span class="tt-muted">${summary.unknownN} more answered "I do not know" (excluded)</span>` : ''}`, evt);
          })
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
      });
    });

    container.querySelector('svg').style.minWidth = '640px';
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.regional = { render, buildRegionColorScale };
})();
