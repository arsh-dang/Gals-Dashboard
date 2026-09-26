// View 4: Regional comparison. Same dot-plot mechanics as the outcomes
// average view, but the column of dots is regions instead of activity
// types. Suppression applies per region x item cell - this is exactly the
// small-cell scenario the brief calls out (five of six regions have thin
// samples once you narrow by item/activity).
(function () {
  'use strict';

  const U = window.SIT.utils;

  const WIDE_MIN_WIDTH = 640;
  const SCALE_TICKS = [1, 2, 3, 4];

  function buildRegionColorScale(regions) {
    // No yellow (--series-5): it fails contrast for thin marks on white.
    const vars = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-8', '--series-6'];
    const map = new Map(regions.map((r, i) => [r, U.cssVar(vars[i % vars.length])]));
    return (r) => map.get(r) || U.cssVar('--text-muted');
  }

  function displayTickLabel(displayValue) {
    return window.SIT_DATA.meta.scale.labels[displayValue];
  }

  function truncate(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  function render(container, ratings, meta, regionColorScale) {
    container.innerHTML = '';
    const regions = meta.regions.map((r) => r.key);
    const markerFor = U.buildMarkerScale(regions);
    const items = meta.outcomeItems;
    const compact = U.isCompact(container, WIDE_MIN_WIDTH);
    const width = compact ? container.clientWidth : Math.max(container.clientWidth || 640, WIDE_MIN_WIDTH);
    const gutter = compact ? 0 : U.labelGutter(items.map((i) => i.item), 12, { min: 200, max: 300 });
    const margin = compact
      ? {
        top: 28, right: 68, bottom: 30, left: 18,
      }
      : {
        top: 28, right: 96, bottom: 16, left: gutter,
      };
    // Compact: each region's dot on its own line under the label, same as
    // the outcomes dot plot.
    const geo = U.rowGeometry({
      compact,
      keys: items.map((i) => i.item),
      width,
      margin,
      wideRowHeight: 38,
      widePadding: 0.1,
      plotHeight: regions.length * 6 + 6,
    });
    const { height, band } = geo;
    const bw = items.length ? band(items[0].item).height : 0;
    const inset = compact ? 4 : 8;
    const sub = d3.scalePoint().domain(regions).range([-bw / 2 + inset, bw / 2 - inset]);
    const dotR = compact ? 5 : 6.5;

    const svg = d3.select(container).append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Dot plot of average scores for each statement, by region. Some regions have results hidden for privacy');

    const x = d3.scaleLinear().domain([1, 4]).range([margin.left, width - margin.right]);

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
      items.forEach((item, i) => {
        const b = band(item.item);
        U.drawWideLabel(svg, {
          x: margin.left, yMid: b.top + b.height / 2, text: item.item, gutter, fontPx: 12, badge: item.pairId !== null, tip: labelTip,
        });

        svg.append('rect')
          .attr('x', margin.left).attr('width', width - margin.left - margin.right)
          .attr('y', b.top).attr('height', b.height)
          .attr('fill', i % 2 ? U.cssVar('--surface-sunken') : 'transparent')
          .attr('opacity', 0.5);
      });
    }

    const tip = U.tooltip();

    items.forEach((item) => {
      const b = band(item.item);
      const hiddenHere = regions.filter((region) => { const n = ratings.filter((r) => r.item === item.item && r.region === region).length; return n > 0 && U.isSuppressed(n); });
      if (hiddenHere.length) {
        U.drawHiddenChip(svg, {
          x: width - margin.right + 10, yMid: b.top + b.height / 2, count: hiddenHere.length, total: regions.length, names: hiddenHere, context: item.item, tip,
        });
      }
      regions.forEach((region) => {
        const rows = ratings.filter((r) => r.item === item.item && r.region === region);
        const summary = U.summarizeScores(rows);
        const cy = b.top + b.height / 2 + sub(region);
        const suppressed = U.isSuppressed(rows.length);

        if (suppressed) return;

        const display = U.toDisplayScore(summary.mean);
        const ci = U.ciDisplayBounds(summary);
        const tooltipHtml = `<strong>${region}</strong>${item.item}<br>
              Average (1=No … 4=Yes a lot): ${U.formatScore(summary.mean)}<br>
              Likely range: ${ci ? `${U.formatScore(ci.low)}–${U.formatScore(ci.high)}` : 'too few people to estimate a range'}<br>
              ${summary.n} people${summary.unknownN ? `<br><span class="tt-muted">${summary.unknownN} more answered "I do not know" (left out of the average)</span>` : ''}`;

        if (ci) {
          svg.append('line')
            .attr('class', 'ci-whisker series-mark')
            .attr('data-key', region)
            .attr('x1', x(ci.low)).attr('x2', x(ci.high))
            .attr('y1', cy).attr('y2', cy)
            .attr('stroke', regionColorScale(region))
            .attr('stroke-width', 1.25)
            .attr('stroke-opacity', 0.3);
        }

        svg.append('path')
          .attr('transform', `translate(${x(display)},${cy})`)
          .attr('d', U.markerPath(markerFor(region), dotR))
          .attr('class', 'series-mark')
          .attr('data-key', region)
          .attr('fill', regionColorScale(region))
          .attr('stroke', U.markOutline(regionColorScale(region)))
          .attr('stroke-width', 1)
          .attr('tabindex', 0)
          .attr('role', 'img')
          .attr('aria-label', `${region}, ${item.item}: average ${summary.mean.toFixed(2)} of 4, higher is more positive, ${summary.n} people${ci ? `, likely range ${U.formatScore(ci.low)} to ${U.formatScore(ci.high)}` : ''}`)
          .on('mouseenter focus', (evt) => tip.show(tooltipHtml, evt))
          .on('mousemove', (evt) => tip.move(evt))
          .on('mouseleave blur', () => tip.hide());
      });
    });

    if (!compact) container.querySelector('svg').style.minWidth = `${WIDE_MIN_WIDTH}px`;
  }

  window.SIT.charts = window.SIT.charts || {};
  window.SIT.charts.regional = { render, buildRegionColorScale };
})();
