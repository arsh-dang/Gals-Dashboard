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

  // Ordered so GALS (always present, always dominant) gets a fixed neutral
  // slot rather than the first "most distinguishable" colour - it isn't the
  // comparison of interest, the other programmes are.
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
        const x = evt.clientX;
        const y = evt.clientY;
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

  // Text/table alternative to a chart, behind a <details> disclosure, per
  // the accessibility rule that every chart needs one.
  function renderDataTable(container, { columns, rows }) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Show data table';
    details.appendChild(summary);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.marginTop = 'var(--space-2)';
    table.style.fontSize = 'var(--text-small)';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach((c) => {
      const th = document.createElement('th');
      th.textContent = c.label;
      th.style.textAlign = c.align || 'left';
      th.style.padding = 'var(--space-2)';
      th.style.borderBottom = '1px solid var(--border-strong)';
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
        td.style.textAlign = c.align || 'left';
        td.style.padding = 'var(--space-2)';
        td.style.borderBottom = '1px solid var(--border-subtle)';
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
    renderDataTable,
    renderFooterDate,
    SMALL_CELL_THRESHOLD,
  };
})();
