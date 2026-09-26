// Plain-language summary layer, above the charts on both the teacher and
// provider pages. Forum feedback: a teacher (or funder) shouldn't have to
// read twelve outcome statements across seven activities and work out the
// answer themselves - a few sentences should say it, with the charts kept
// underneath for anyone who wants to check the working.
//
// Every sentence here is a plain comparison of two averages already
// computed elsewhere (U.summarizeScores) - nothing is phrased by a
// language model. Two rules make that comparison honest:
//   1. A gap is only ever reported when the two 95% confidence intervals
//      do not overlap (U.ciOverlap). If they do, the data cannot
//      distinguish the groups, and the sentence says that plainly instead
//      of picking a "winner" the sample size doesn't support.
//   2. A cohort under the small-cell threshold gets exactly one sentence
//      (why nothing is shown) and nothing else - same suppression rule as
//      every chart on this dashboard.
(function () {
  'use strict';

  const U = window.SIT.utils;

  // One row per outcome item: both groups' summaries, the raw difference,
  // and whether the confidence intervals actually separate. `distinguishable`
  // folds in per-item suppression too (isSuppressed on either side's n) -
  // a cell too small to plot is too small to found a sentence on either.
  function compareItems(cohortRows, baselineRows, items) {
    return items.map((item) => {
      const cohort = U.summarizeScores(cohortRows.filter((r) => r.item === item));
      const baseline = U.summarizeScores(baselineRows.filter((r) => r.item === item));
      const diff = cohort.mean !== null && baseline.mean !== null ? cohort.mean - baseline.mean : null;
      const distinguishable = diff !== null
        && !U.isSuppressed(cohort.n)
        && !U.isSuppressed(baseline.n)
        && !U.ciOverlap(cohort, baseline);
      return {
        item, cohort, baseline, diff, distinguishable,
      };
    });
  }

  function biggestGap(comparisons) {
    const candidates = comparisons.filter((c) => c.distinguishable);
    if (!candidates.length) return null;
    return candidates.reduce((a, b) => (Math.abs(b.diff) > Math.abs(a.diff) ? b : a));
  }

  function directionWord(diff) {
    return diff >= 0 ? 'higher' : 'lower';
  }

  // --- Teacher view: one school's cohort vs a baseline --------------------
  // Baseline picks the most specific group that still clears the
  // suppression threshold: same region and same year level first, widening
  // a step at a time to same-region-any-year, then the whole sample. This
  // is the "regional or overall baseline" the brief asks for - which one
  // gets used depends only on whether there's enough data, not on the
  // result, and the sentence always says which it was.
  function pickBaseline(allRows, school, schoolLevel, region) {
    const notThisSchool = (r) => r.school !== school;
    const sameRegion = (r) => r.region === region;
    const sameLevel = (r) => !schoolLevel || r.schoolLevel === schoolLevel;

    const tiers = [
      { rows: allRows.filter((r) => notThisSchool(r) && sameRegion(r) && sameLevel(r)), label: 'average for your region' },
      { rows: allRows.filter((r) => notThisSchool(r) && sameRegion(r)), label: 'average for your region' },
      { rows: allRows.filter((r) => notThisSchool(r) && sameLevel(r)), label: 'average for all schools' },
      { rows: allRows.filter(notThisSchool), label: 'average for all schools' },
    ];
    return tiers.find((t) => !U.isSuppressed(U.countDistinctIds(t.rows))) || tiers[tiers.length - 1];
  }

  // Returns { suppressed, n, sentences }. `sentences` is 1 (suppressed),
  // 2 (no distinguishable gap), or 3 (a gap to report) plain strings, each
  // under ~25 words, meant to render as-is with no further wrapping.
  function buildTeacherSummary({
    allRatings, meta, school, schoolLevel,
  }) {
    const schoolRows = allRatings.filter((r) => r.school === school && (!schoolLevel || r.schoolLevel === schoolLevel));
    const n = U.countDistinctIds(schoolRows);

    if (U.isSuppressed(n)) {
      return {
        suppressed: true,
        n,
        sentences: [`Fewer than ${U.SMALL_CELL_THRESHOLD} of your students in this year level answered, so no summary is shown. The same privacy rule applies to every result on this dashboard.`],
      };
    }

    const region = (meta.schools.find((s) => s.key === school) || {}).region;
    const baseline = pickBaseline(allRatings, school, schoolLevel, region);
    const comparisons = compareItems(schoolRows, baseline.rows, meta.outcomeItems.map((i) => i.item));
    const distinguishable = comparisons.filter((c) => c.distinguishable);
    const label = schoolLevel ? `Your ${schoolLevel} students` : 'Your students';
    const sentences = [];

    if (!distinguishable.length) {
      sentences.push(`${label.endsWith('s') ? `${label}'` : `${label}'s`} answers are similar to the ${baseline.label}. Any differences are too small to tell apart from chance with this many students.`);
    } else {
      const higher = distinguishable.filter((c) => c.diff > 0).length;
      const lower = distinguishable.length - higher;
      sentences.push(higher === lower
        ? `${label} scored higher on some statements and lower on others, compared with the ${baseline.label}.`
        : `${label} gave ${directionWord(higher > lower ? 1 : -1)} scores overall than the ${baseline.label}.`);
      const top = biggestGap(comparisons);
      sentences.push(`The biggest difference is on "${top.item}": ${Math.abs(top.diff).toFixed(2)} points ${directionWord(top.diff)} (out of 4) than the ${baseline.label}.`);
    }
    sentences.push(`${n} of your students answered these questions.`);

    return { suppressed: false, n, baselineLabel: baseline.label, sentences };
  }

  // --- Provider view: whole-programme headline, one activity vs the rest -
  // Shorter by design (the brief says so): a single sentence naming the one
  // distinguishable result with the largest gap across every activity and
  // outcome, or saying plainly that there isn't one. Total n is folded into
  // that same sentence rather than a separate one, to keep it to one line.
  function buildProviderSummary({ ratings, meta }) {
    const activities = meta.activityTypes
      .filter((a) => !meta.excludedActivityTypes.includes(a.key))
      .map((a) => a.key);
    const items = meta.outcomeItems.map((i) => i.item);
    const n = U.countDistinctIds(ratings);

    let best = null;
    activities.forEach((activity) => {
      const activityRows = ratings.filter((r) => r.activityType === activity);
      const restRows = ratings.filter((r) => r.activityType !== activity);
      const top = biggestGap(compareItems(activityRows, restRows, items));
      if (top && (!best || Math.abs(top.diff) > Math.abs(best.diff))) {
        best = { ...top, activity };
      }
    });

    const sentence = best
      ? `Across ${n} people who answered, ${best.activity} scored ${directionWord(best.diff)} than the other activities on "${best.item}" (${Math.abs(best.diff).toFixed(2)} points ${directionWord(best.diff)}, out of 4).`
      : `Across ${n} people who answered, no activity stood out from the others. Any differences are too small to tell apart from chance with this many people.`;

    return { n, sentences: [sentence] };
  }

  window.SIT = window.SIT || {};
  window.SIT.summary = {
    compareItems, biggestGap, pickBaseline, buildTeacherSummary, buildProviderSummary,
  };
})();
