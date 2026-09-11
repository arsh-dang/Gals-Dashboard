// Shared helpers: token colour lookup, scale math, filtering, tooltip.
// No colour is ever written as a literal hex here - everything reads the
// custom property so a palette swap in tokens.css is the only place that
// needs to change.
(function () {
  'use strict';

  const root = document.documentElement;
  const styleCache = new Map();

  function cssVar(name) {
    if (!styleCache.has(name)) {
      const value = getComputedStyle(root).getPropertyValue(name).trim();
      styleCache.set(name, value);
    }
    return styleCache.get(name);
  }

  const SERIES_VARS = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8'];

  function seriesColor(index) {
    return cssVar(SERIES_VARS[index % SERIES_VARS.length]);
  }

  // GALS always gets --series-7, the same colour it uses in the GALS-split
  // charts elsewhere on the page, rather than whatever the sort order would
  // otherwise assign it. Callers must pass only activity types that will
  // actually be shown (i.e. already filtered against
  // meta.excludedActivityTypes) - an unfiltered list still consumes a
  // colour slot for an activity nothing ever renders, which can push a
  // real activity into the same series-7 slot GALS is hardcoded to.
  function buildActivityColorScale(activityKeys) {
    const ordered = [...activityKeys].sort((a, b) => {
      if (a === 'Girls as Leaders in STEM program') return 1;
      if (b === 'Girls as Leaders in STEM program') return -1;
      return a.localeCompare(b);
    });
    const map = new Map();
    ordered.forEach((key, i) => {
      map.set(key, key === 'Girls as Leaders in STEM program' ? cssVar('--series-7') : seriesColor(i));
    });
    return (key) => map.get(key) || cssVar('--text-muted');
  }

  // Deliberate display-only overrides of raw survey wording, requested by
  // the team for clarity (e.g. forum attendees misreading an option as
  // being about the subjects themselves rather than knowing which are
  // required). The join/sort/lookup key everywhere else in the pipeline
  // stays the raw survey text - only what's shown to a reader changes here.
  // Add future label overrides to this map, not at the point of display.
  // Each override belongs in the Data notes list in index.html too.
  const LABEL_OVERRIDES = {
    'Subjects I need for a future job': 'Knowing which subjects I need for a future job',
  };

  function displayLabel(text) {
    return LABEL_OVERRIDES[text] || text;
  }

  const SMALL_CELL_THRESHOLD = window.SIT_DATA.meta.smallCellThreshold;

  function isSuppressed(n) {
    return n < SMALL_CELL_THRESHOLD;
  }

  // Mean score excluding "I do not know" (code 5) and any null score.
  // Returns {mean, n, unknownN, unknownRate, sd, ciMargin} - never a bare
  // number, because every consumer needs n and the unknown rate alongside
  // it. ciMargin is the 95% CI half-width on the raw 1-4 scale (normal
  // approximation, sample SD) - null when n<2, since the activity-type
  // averages sit close enough together that an unqualified average
  // overstates how different they are.
  function summarizeScores(rows) {
    const known = rows.filter((r) => r.score !== null && r.score !== undefined);
    const unknownN = rows.length - known.length;
    const n = known.length;
    const mean = n ? known.reduce((s, r) => s + r.score, 0) / n : null;
    let sd = null;
    let ciMargin = null;
    if (n >= 2) {
      const variance = known.reduce((s, r) => s + (r.score - mean) ** 2, 0) / (n - 1);
      sd = Math.sqrt(variance);
      ciMargin = 1.96 * (sd / Math.sqrt(n));
    }
    return {
      mean,
      n,
      unknownN,
      unknownRate: rows.length ? unknownN / rows.length : 0,
      sd,
      ciMargin,
    };
  }

  // `score` already runs 1=No..4=Yes a lot, higher is better - no inversion
  // needed. Kept as a named pass-through (rather than inlining `.mean`
  // everywhere) so every chart's display value still reads through one
  // function, in case that ever changes again.
  function toDisplayScore(rawMean) {
    return rawMean;
  }

  // 95% CI bounds on the display scale, clamped to the 1-4 axis. Null if
  // the summary has no computable margin (n<2) - callers should skip
  // drawing a whisker in that case, not draw a zero-width one.
  function ciDisplayBounds(summary) {
    if (summary.ciMargin === null || summary.mean === null) return null;
    return {
      low: Math.max(1, summary.mean - summary.ciMargin),
      high: Math.min(4, summary.mean + summary.ciMargin),
    };
  }

  function distributionCounts(rows) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, dontKnow: 0 };
    rows.forEach((r) => {
      if (r.isDontKnow) counts.dontKnow += 1;
      else if (r.score >= 1 && r.score <= 4) counts[r.score] += 1;
    });
    return counts;
  }

  // Generic: filters is {fieldName: value}; any falsy value is "no constraint".
  // Works for {region, schoolLevel} on the provider page and
  // {region, school, schoolLevel} on the teacher page against the same
  // row shape, since both are joined onto respondent fields at build time.
  function applyFilters(rows, filters) {
    const keys = Object.keys(filters).filter((k) => filters[k]);
    return rows.filter((r) => keys.every((k) => r[k] === filters[k]));
  }

  function uniqueBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    arr.forEach((item) => {
      const k = keyFn(item);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(item);
      }
    });
    return out;
  }

  function countDistinctIds(rows) {
    return new Set(rows.map((r) => r.id)).size;
  }

  function formatPct(x, digits) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    return `${(x * 100).toFixed(digits === undefined ? 0 : digits)}%`;
  }

  function formatScore(x, digits) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    return x.toFixed(digits === undefined ? 2 : digits);
  }

  // --- Tooltip singleton -----------------------------------------------
  let tooltipEl = null;
  function tooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'viz-tooltip';
      tooltipEl.setAttribute('role', 'status');
      document.body.appendChild(tooltipEl);
    }
    return {
      show(html, evt) {
        tooltipEl.innerHTML = html;
        tooltipEl.classList.add('is-visible');
        this.move(evt);
      },
      move(evt) {
        // Focus events (keyboard, and a tap on a touch screen) carry no
        // pointer position - anchor to the element itself instead.
        let x = evt.clientX;
        let y = evt.clientY;
        if (typeof x !== 'number' && evt.target && evt.target.getBoundingClientRect) {
          const r = evt.target.getBoundingClientRect();
          x = r.left + r.width / 2;
          y = r.top + r.height / 2;
        }
        const w = tooltipEl.offsetWidth;
        const h = tooltipEl.offsetHeight;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        tooltipEl.style.left = `${Math.min(x + 14, vw - w - 8)}px`;
        tooltipEl.style.top = `${Math.min(y + 14, vh - h - 8)}px`;
      },
      hide() {
        tooltipEl.classList.remove('is-visible');
      },
    };
  }

  function onResize(el, cb) {
    const ro = new ResizeObserver(() => cb());
    ro.observe(el);
    return ro;
  }

  // --- Narrow-screen chart layout -----------------------------------------
  // Row charts put each label in a left gutter on a wide card. On a phone
  // that gutter alone is most of the screen, so below a chart's designed
  // minimum width the label moves onto its own line(s) above the row and
  // the plot gets the full width. The chart grows taller, which a phone
  // scrolls well, instead of scrolling sideways inside a card with its
  // labels out of view.
  function isCompact(container, wideMinWidth) {
    const w = container.clientWidth;
    return w > 0 && w < wideMinWidth;
  }

  // Content-box width of a padded container (a facet cell). An SVG drawn at
  // exactly this width renders 1:1, so its text stays at the size it was set
  // to rather than being scaled down to fit.
  function contentWidth(el, fallback) {
    const cs = getComputedStyle(el);
    const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return w > 0 ? Math.floor(w) : fallback;
  }

  // Rough character budget for a pixel width (Open Sans averages a little
  // over half an em per character).
  function charsFor(px, fontPx) {
    return Math.max(4, Math.floor(px / (fontPx * 0.56)));
  }

  function truncateText(text, max) {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  }

  // Greedy word wrap into at most maxLines lines; the last line gets an
  // ellipsis if words are left over.
  function wrapLines(text, maxChars, maxLines) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    let i = 0;
    while (i < words.length && lines.length < maxLines) {
      const next = line ? `${line} ${words[i]}` : words[i];
      if (next.length <= maxChars) {
        line = next;
        i += 1;
      } else if (line) {
        lines.push(line);
        line = '';
      } else {
        lines.push(truncateText(words[i], maxChars));
        i += 1;
      }
    }
    if (line) lines.push(line);
    const last = lines[lines.length - 1];
    if (i < words.length && last && !last.endsWith('…')) {
      lines[lines.length - 1] = last.length < maxChars ? `${last}…` : `${last.slice(0, maxChars - 1)}…`;
    }
    return lines;
  }

  // Stacked layout: each row is its label line(s), an optional smaller note
  // line (the "≈ wording variant" tag), then a plot band of plotHeight.
  function stackedRows(keys, labelFor, {
    top, width, plotHeight, gap = 10, fontPx = 12, noteFor = null,
  }) {
    const lineH = Math.round(fontPx * 1.3);
    const maxChars = charsFor(width, fontPx);
    const rows = new Map();
    let y = top;
    keys.forEach((key) => {
      const lines = wrapLines(labelFor(key), maxChars, 2);
      const note = noteFor ? noteFor(key) : null;
      const labelHeight = (lines.length + (note ? 1 : 0)) * lineH;
      const plotTop = y + labelHeight + 2;
      rows.set(key, {
        lines, note, rowTop: y, plotTop, plotHeight, rowBottom: plotTop + plotHeight,
      });
      y = plotTop + plotHeight + gap;
    });
    return {
      rows, bottom: y - gap, lineH, fontPx,
    };
  }

  // Row geometry for either layout. `band(key)` is the plot band - where the
  // marks go - so a chart draws its marks the same way in both; only the
  // labels and gridlines differ. Wide mode reproduces the charts' original
  // scaleBand rows exactly.
  function rowGeometry({
    compact, keys, labelFor = (key) => key, width, margin, wideRowHeight,
    widePadding = 0, wideOuterPadding = 0, plotHeight, gap = 10, noteFor = null,
  }) {
    if (compact) {
      const layout = stackedRows(keys, labelFor, {
        top: margin.top, width, plotHeight, gap, noteFor,
      });
      return {
        layout,
        height: layout.bottom + margin.bottom,
        band: (key) => {
          const row = layout.rows.get(key);
          return { top: row.plotTop, height: row.plotHeight };
        },
      };
    }
    const height = margin.top + margin.bottom + keys.length * wideRowHeight;
    const y = d3.scaleBand().domain(keys).range([margin.top, height - margin.bottom])
      .paddingInner(widePadding)
      .paddingOuter(wideOuterPadding);
    return { layout: null, height, band: (key) => ({ top: y(key), height: y.bandwidth() }) };
  }

  function drawStackedLabel(svg, row, layout, { x = 0, title = null } = {}) {
    const text = svg.append('text')
      .attr('class', 'item-row-label')
      .style('font-size', `${layout.fontPx}px`)
      .attr('x', x)
      .attr('y', row.rowTop);
    row.lines.forEach((line, i) => {
      text.append('tspan')
        .attr('x', x)
        .attr('dy', i === 0 ? layout.fontPx : layout.lineH)
        .text(line);
    });
    if (title) text.append('title').text(title);
    if (row.note) {
      svg.append('text')
        .attr('class', 'pair-tag')
        .attr('x', x)
        .attr('y', row.rowTop + layout.fontPx + row.lines.length * layout.lineH - 1)
        .text(row.note);
    }
  }

  // Gridlines inside each row's plot band only - full-height ones would run
  // through every label line in the stacked layout.
  function drawRowGridlines(svg, layout, xScale, ticks) {
    layout.rows.forEach((row) => {
      ticks.forEach((t) => {
        svg.append('line')
          .attr('class', 'gridline')
          .attr('x1', xScale(t)).attr('x2', xScale(t))
          .attr('y1', row.plotTop).attr('y2', row.rowBottom);
      });
    });
  }

  // Alternate-row tint spanning label and plot together, so a label reads as
  // belonging to the marks under it rather than the row above.
  function drawRowShading(svg, layout, width) {
    let i = 0;
    layout.rows.forEach((row) => {
      if (i % 2 === 1) {
        svg.append('rect')
          .attr('x', 0).attr('width', width)
          .attr('y', row.rowTop - 4).attr('height', row.rowBottom - row.rowTop + 8)
          .attr('fill', cssVar('--surface-sunken'))
          .attr('opacity', 0.5);
      }
      i += 1;
    });
  }

  // Compact frame for a 1-4 scale row chart: the axis repeated at the bottom
  // (a 12-row stacked chart is too tall to keep the top one in view), row
  // tint, per-row gridlines, stacked labels.
  function drawCompactScaleFrame(svg, geo, x, {
    width, height, margin, ticks, tickFormat,
  }) {
    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${height - margin.bottom + 6})`)
      .call(d3.axisBottom(x).tickValues(ticks).tickFormat(tickFormat));
    drawRowShading(svg, geo.layout, width);
    drawRowGridlines(svg, geo.layout, x, ticks);
    geo.layout.rows.forEach((row, key) => drawStackedLabel(svg, row, geo.layout, { title: key }));
  }

  // Text/table alternative to a chart, behind a <details> disclosure, per
  // the accessibility rule that every chart needs one. Styled by .data-table
  // in styles.css rather than inline, so a phone can restack each row as a
  // labelled card (data-label feeds each cell's label there).
  function renderDataTable(container, { columns, rows }) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Show data table';
    details.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach((c) => {
      const th = document.createElement('th');
      th.textContent = c.label;
      th.scope = 'col';
      if (c.align) th.dataset.align = c.align;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((c) => {
        const td = document.createElement('td');
        td.textContent = c.value(row);
        td.dataset.label = c.label;
        if (c.align) td.dataset.align = c.align;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    details.appendChild(table);
    container.appendChild(details);
  }

  // Guide: footer should carry "the date the data snapshot" was taken.
  // meta.generatedAt is a build-time ISO timestamp; a plain date slice is
  // enough here, no timezone-aware formatting needed for a coarse label.
  function renderFooterDate(elementId) {
    const el = document.getElementById(elementId);
    if (!el || !window.SIT_DATA.meta.generatedAt) return;
    el.textContent = `Data snapshot: ${window.SIT_DATA.meta.generatedAt.slice(0, 10)}`;
  }

  window.SIT = window.SIT || {};
  window.SIT.utils = {
    cssVar,
    buildActivityColorScale,
    displayLabel,
    isSuppressed,
    summarizeScores,
    toDisplayScore,
    ciDisplayBounds,
    distributionCounts,
    applyFilters,
    uniqueBy,
    countDistinctIds,
    formatPct,
    formatScore,
    tooltip,
    onResize,
    isCompact,
    contentWidth,
    charsFor,
    wrapLines,
    rowGeometry,
    drawStackedLabel,
    drawRowGridlines,
    drawRowShading,
    drawCompactScaleFrame,
    renderDataTable,
    renderFooterDate,
    SMALL_CELL_THRESHOLD,
  };
})();
