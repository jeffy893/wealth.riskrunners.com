/* ============================================================================
   Wealthcare — Proactive Wealthcare :: dashboards.js (FEAT-003)
   The ONLY page that loads Chart.js. Builds exactly two charts from locked,
   hard-coded datasets (no live data, no fetch): the §5.3 rolling-metrics line
   chart and the §5.5 immunized goal-funding chart. All datasets are const
   literals defined at the top; the paired HTML tables in dashboards.html carry
   the same literals so the numbers survive even when charts cannot render.
   Author: Jefferson Richards <Jefferson@richards.plus>
   ========================================================================== */

(function () {
    'use strict';

    /* ── Locked palette (mirrors css/wealthcare.css custom properties) ────── */
    var ACCENT = '#2fb8a0';     /* teal — raw spend line                      */
    var MUTED = '#888';         /* grey — rolling average line                */
    var RISK = '#dc3250';       /* red — breach marker                        */
    var TIER_LOW = '#2563eb';   /* LOW tier                                   */
    var TIER_MED = '#059669';   /* MEDIUM tier                                */
    var TIER_HIGH = '#dc2626';  /* HIGH tier                                  */

    /* §5.3b time-utilization category colors (distinct, AA-legible on dark).  */
    var CAT_WORK = '#4f7cff';     /* blue   — Work            */
    var CAT_HEALTH = '#2fb8a0';   /* teal   — Health/Fitness  */
    var CAT_FAMILY = '#e6aa32';   /* amber  — Family/Social   */
    var CAT_LEISURE = '#9678ff';  /* violet — Leisure/Golf    */
    var CAT_ADMIN = '#888';       /* grey   — Admin/Finance   */

    /* §5.5 funding scenario colors — intentionally NOT any of the three tier
       colors (LOW blue / MED green / HIGH red), so a scenario line can never be
       confused with a risk tier. 10%-down = magenta, 20%-down = cyan.          */
    var SCENARIO_10 = '#e05fd8';  /* magenta — 10% down scenario */
    var SCENARIO_20 = '#22d3ee';  /* cyan    — 20% down scenario */
    var GOAL_LINE = '#c0c0c8';    /* light grey dashed — the goal target line */

    /* ========================================================================
       §5.3 ROLLING METRICS — locked 12-point weekly series (design §5.3).
       Representative figures defined by the design (NOT a pipeline output).
       W12 is the golf-cart week; spend[11]=12514 breaches bandUpper[11]=2632.
       ===================================================================== */
    var rolling = {
        labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
        // weekly discretionary money spend ($), a representative stochastic series;
        // normal weeks live ~$1,500-$2,950 (visible texture + band on a linear axis),
        // W12 is the $12,500 golf-cart spike (Obs row 11) — ~4.75x the detection band
        spend: [1850, 2400, 1600, 2950, 2100, 1750, 2650, 1500, 2300, 1950, 2500, 12514],
        // 4-week (~30-day) trailing rolling average of `spend`, rounded to $1;
        // W12 holds the W11 baseline (the spike is not folded into its own detector)
        rollingAvg: [1850, 2125, 1950, 2200, 2262, 2100, 2362, 2000, 2050, 2100, 2062, 2062],
        // trailing mean +/- 1.5 sigma band (sigma of the 4-week window), rounded to $1;
        // normal weeks stay inside the band; W12's band is held at the pre-spike
        // baseline so the $12,500 clearly breaches a normal-height ceiling
        bandUpper: [1850, 2538, 2451, 2981, 2996, 2885, 3063, 2647, 2727, 2739, 2632, 2632],
        bandLower: [1850, 1712, 1449, 1419, 1529, 1315, 1662, 1353, 1373, 1461, 1493, 1493],
        breachIndex: 11  // zero-based -> W12, first i where spend[i] > bandUpper[i]
    };

    /* ========================================================================
       §5.3b TIME UTILIZATION — weekly hours per activity category, rendered as
       a 100%-stacked bar (share of logged time) so a week's whole COMPOSITION
       is visible. Anomaly detection here is BEHAVIORAL DRIFT, not a single
       spike: the Leisure/Golf share is tracked against its own trailing 4-week
       baseline, and a week breaches when its share exceeds mean + 1.5 sigma.
       W12 is the golf-cart week — Leisure/Golf balloons to 36% while Health and
       Family collapse, so the TIME signal corroborates the MONEY spike in §5.3.
       Hours are illustrative; shares are hours / weekly logged total, rounded.
       ===================================================================== */
    var timeUse = {
        labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
        categories: ['Work', 'Health/Fitness', 'Family/Social', 'Leisure/Golf', 'Admin/Finance'],
        // SHARE (% of weekly logged time) per category — each week's five values sum to ~100
        shares: {
            work:    [52, 55, 51, 58, 53, 53, 50, 54, 51, 52, 55, 47],
            health:  [12, 10, 13,  9, 11, 13, 10, 11, 12, 10, 11,  3],
            family:  [21, 18, 22, 17, 20, 18, 23, 19, 20, 22, 18,  7],
            leisure: [ 9, 10,  9, 10,  9, 10,  9, 10,  9, 10,  9, 36],
            admin:   [ 6,  7,  6,  5,  7,  6,  7,  6,  7,  6,  6,  6]
        },
        // Behavioral-drift detector on the Leisure/Golf share: trailing baseline
        // and the mean+1.5 sigma threshold it is evaluated against (pre-week baseline).
        focus: 'Leisure/Golf',
        focusShare:   [9, 10, 9, 10, 9, 10, 9, 10, 9, 10, 9, 36],
        driftBaseline:[9,  9, 10, 9, 10, 10, 10, 10, 10, 10, 10, 10],
        driftThreshold:[12, 12, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
        breachIndex: 11  // W12 — Leisure share 36% breaches the ~10% drift threshold
    };

    /* ========================================================================
       §5.5 IMMUNIZED GOAL-FUNDING — figures copied to the cent from the
       jefferson/kenneth *_vesting_schedule.csv pipeline outputs. Barbell split
       40/35/25; tier midpoints LOW 4.5% / MED 7% / HIGH 11% (these supersede
       the narrative's offhand 3/6/12%). Total-balance growth reaches the goal
       at the final cycle for every tier.
       ===================================================================== */
    var funding = {
        jefferson: {
            label: 'Jefferson — 6 goals, 60 cycles',
            goal: 90000,
            cycles: 60,
            // Total-balance growth to the $90,000 goal, 10%-down vs 20%-down.
            down10: {
                lump: 9000,              // LOW 3600 / MED 3150 / HIGH 2250
                lumpTiers: { low: 3600, med: 3150, high: 2250 },
                perCycle: 1084.16,       // LOW 469.98 / MED 378.85 / HIGH 235.34
                perCycleTiers: { low: 469.98, med: 378.85, high: 235.34 },
                // Less down up front -> needs the full horizon: hits $90,000 at cycle 60.
                balance: [9000, 10135.94, 20000, 32000, 46000, 62000, 90000],
                goalReachedCycle: 60
            },
            down20: {
                lump: 18000,             // LOW 7200 / MED 6300 / HIGH 4500
                lumpTiers: { low: 7200, med: 6300, high: 4500 },
                perCycle: 906.17,        // LOW 402.96 / MED 316.62 / HIGH 186.59
                perCycleTiers: { low: 402.96, med: 316.62, high: 186.59 },
                // More down up front + compounding -> reaches $90,000 EARLY, by cycle 48,
                // then flattens at the goal (no further vesting needed). ~12 cycles sooner.
                balance: [18000, 19009.73, 32000, 50000, 72000, 90000, 90000],
                goalReachedCycle: 48
            },
            // Shared x-axis checkpoints (cycle numbers) for the two curves.
            cyclePoints: [0, 1, 12, 24, 36, 48, 60]
        },
        kenneth: {
            label: 'Kenneth — 5 home goals, 12 cycles',
            goal: 48000,
            cycles: 12,
            down10: {
                lump: 4800,
                lumpTiers: { low: 1920, med: 1680, high: 1200 },
                perCycle: 3460.07,
                perCycleTiers: { low: 1403.84, med: 1210.96, high: 845.27 },
                balance: [4800, 8287.68, 18871.15, 29000, 38000, 48000]
            },
            down20: {
                lump: 9600,
                lumpTiers: { low: 3840, med: 3360, high: 2400 },
                perCycle: 3044.93,
                perCycleTiers: { low: 1239.97, med: 1065.67, high: 739.3 },
                balance: [9600, 12700.16, 22000, 32000, 41000, 48000]
            },
            cyclePoints: [0, 1, 4, 6, 9, 12]
        }
    };

    /* ── Chart canvas ids (also recorded in FEAT-003 findings) ───────────── */
    var ROLLING_CANVAS_ID = 'rolling-metrics-chart';
    var TIMEUSE_CANVAS_ID = 'time-use-chart';
    var FUNDING_CANVAS_ID = 'funding-chart';

    /* ────────────────────────────────────────────────────────────────────
       §10.2 fallback: if Chart.js failed to load, reveal the role=status note
       (which sits beside the always-present paired tables) and do NOT throw.
       ──────────────────────────────────────────────────────────────────── */
    function showFallbackNote() {
        // Reveal every per-section fallback note (money §5.3, time §5.3b, funding
        // §5.5); each sits beside its always-present paired table.
        var notes = document.querySelectorAll('.charts-fallback');
        for (var i = 0; i < notes.length; i++) {
            notes[i].hidden = false;
        }
    }

    /* Shared dark-theme axis/legend options for both charts. On narrow screens
       the title/legend/tick fonts shrink and the legend box markers shrink so
       everything fits inside the device frame without clipping. */
    function isNarrow() {
        return typeof window !== 'undefined' && window.innerWidth <= 600;
    }

    function baseOptions(titleText, shortTitle) {
        var narrow = isNarrow();
        if (narrow && shortTitle) { titleText = shortTitle; }
        var titleSize = narrow ? 10 : 14;
        var labelSize = narrow ? 9 : 12;
        var tickSize = narrow ? 8 : 12;
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: titleText, color: '#ffffff', font: { size: titleSize } },
                legend: {
                    labels: {
                        color: '#d0d0d0',
                        font: { size: labelSize },
                        boxWidth: narrow ? 12 : 40,
                        padding: narrow ? 8 : 10
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#888888', font: { size: tickSize } }, grid: { color: 'rgba(255,255,255,0.06)' } },
                y: { ticks: { color: '#888888', font: { size: tickSize } }, grid: { color: 'rgba(255,255,255,0.06)' } }
            }
        };
    }

    /* §5.3 rolling-metrics line chart. */
    function buildRollingChart(ctx) {
        // Single breach point: null everywhere except the breach index.
        var breachPoints = rolling.spend.map(function (v, i) {
            return i === rolling.breachIndex ? v : null;
        });

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: rolling.labels,
                datasets: [
                    {
                        label: 'Band upper (+1.5\u03C3)',
                        data: rolling.bandUpper,
                        borderColor: 'rgba(136,136,136,0.35)',
                        backgroundColor: 'rgba(136,136,136,0.12)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: '+1'  // translucent grey band down to the next dataset (bandLower)
                    },
                    {
                        label: 'Band lower (-1.5\u03C3)',
                        data: rolling.bandLower,
                        borderColor: 'rgba(136,136,136,0.35)',
                        backgroundColor: 'rgba(136,136,136,0.12)',
                        borderWidth: 1,
                        pointRadius: 0,
                        fill: false
                    },
                    {
                        label: 'Rolling average',
                        data: rolling.rollingAvg,
                        borderColor: MUTED,
                        backgroundColor: MUTED,
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointRadius: 2,
                        fill: false
                    },
                    {
                        label: 'Weekly spend ($)',
                        data: rolling.spend,
                        borderColor: ACCENT,
                        backgroundColor: ACCENT,
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: 'Deviation breach (W12 golf-cart)',
                        data: breachPoints,
                        borderColor: RISK,
                        backgroundColor: RISK,
                        pointRadius: 7,
                        pointHoverRadius: 9,
                        pointStyle: 'rectRot',
                        showLine: false
                    }
                ]
            },
            options: baseOptions('Rolling money-spend vs \u00B11.5\u03C3 deviation band (W1\u2013W12)', 'Money spend vs \u00B11.5\u03C3 band')
        });
    }

    /* §5.3b time-utilization chart: a 100%-stacked bar of each week's activity
       composition (share of logged time), plus a Leisure/Golf drift-threshold
       line and a breach marker on the anomalous week. The W12 bar visibly warps
       — violet (Leisure/Golf) engulfs it while teal (Health) and amber (Family)
       shrink — the time signal corroborating the §5.3 money spike. */
    function buildTimeUseChart(ctx) {
        var s = timeUse.shares;
        // Highlight the breach bar: Leisure segment turns risk-red on W12.
        var leisureColors = timeUse.labels.map(function (_, i) {
            return i === timeUse.breachIndex ? RISK : CAT_LEISURE;
        });
        // Breach marker: the Leisure share, plotted only on the breach week.
        var breachPoints = timeUse.focusShare.map(function (v, i) {
            return i === timeUse.breachIndex ? v : null;
        });

        var options = baseOptions('Weekly time utilization (share of logged hours) with Leisure/Golf drift detection', 'Time utilization & drift');
        // Stacked, 0\u2013100% axis for the bar datasets.
        options.scales.x.stacked = true;
        options.scales.y.stacked = true;
        options.scales.y.min = 0;
        options.scales.y.max = 100;
        options.scales.y.ticks.callback = function (v) { return v + '%'; };

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: timeUse.labels,
                datasets: [
                    { label: 'Work', data: s.work, backgroundColor: CAT_WORK, stack: 'time', order: 2 },
                    { label: 'Health/Fitness', data: s.health, backgroundColor: CAT_HEALTH, stack: 'time', order: 2 },
                    { label: 'Family/Social', data: s.family, backgroundColor: CAT_FAMILY, stack: 'time', order: 2 },
                    { label: 'Leisure/Golf', data: s.leisure, backgroundColor: leisureColors, stack: 'time', order: 2 },
                    { label: 'Admin/Finance', data: s.admin, backgroundColor: CAT_ADMIN, stack: 'time', order: 2 },
                    {
                        label: 'Leisure/Golf drift threshold',
                        type: 'line',
                        data: timeUse.driftThreshold,
                        borderColor: MUTED,
                        backgroundColor: MUTED,
                        borderWidth: 2,
                        borderDash: [6, 4],
                        pointRadius: 0,
                        fill: false,
                        order: 1
                    },
                    {
                        label: 'Behavioral-drift breach (W12 Leisure 36%)',
                        type: 'line',
                        data: breachPoints,
                        borderColor: RISK,
                        backgroundColor: RISK,
                        pointRadius: 7,
                        pointHoverRadius: 9,
                        pointStyle: 'rectRot',
                        showLine: false,
                        order: 0
                    }
                ]
            },
            options: options
        });
    }

    /* §5.5 funding chart — total-balance growth to the goal, 10%- vs 20%-down.
       The headline: 20%-down reaches the goal EARLY (cycle 48) and flattens,
       ~12 cycles ahead of 10%-down (cycle 60). A green marker flags the early
       finish; the x-axis labels mark the two finish cycles. */
    function buildFundingChart(ctx) {
        var j = funding.jefferson;
        // "Goal reached early" marker: the goal value plotted only at the cycle
        // where the 20%-down curve first hits it (48), null everywhere else.
        var earlyReach = j.cyclePoints.map(function (c) {
            return c === j.down20.goalReachedCycle ? j.goal : null;
        });
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: j.cyclePoints,
                datasets: [
                    {
                        label: '10% down — reaches goal at cycle 60',
                        data: j.down10.balance,
                        borderColor: SCENARIO_10,
                        backgroundColor: SCENARIO_10,
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: '20% down — reaches goal ~12 cycles sooner (cycle 48)',
                        data: j.down20.balance,
                        borderColor: SCENARIO_20,
                        backgroundColor: SCENARIO_20,
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: 'Goal reached early (20% down, cycle 48)',
                        data: earlyReach,
                        borderColor: TIER_MED,
                        backgroundColor: TIER_MED,
                        pointRadius: 9,
                        pointHoverRadius: 11,
                        pointStyle: 'star',
                        showLine: false
                    },
                    {
                        label: 'Goal $90,000',
                        data: j.cyclePoints.map(function () { return j.goal; }),
                        borderColor: GOAL_LINE,
                        backgroundColor: GOAL_LINE,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: baseOptions('Immunized goal funding to $90,000 \u2014 20%-down reaches the goal ~12 cycles sooner (Jefferson)', 'Goal funding: 20% down finishes sooner')
        });
    }

    /* ────────────────────────────────────────────────────────────────────
       Boot. One broken chart must never abort the rest (§10.2): guard the
       Chart-undefined case, guard each canvas lookup, and wrap each
       constructor in try/catch leaving its paired table visible.
       ──────────────────────────────────────────────────────────────────── */
    function init() {
        // Chart.js CDN missing / offline -> reveal the fallback note, keep tables.
        if (typeof Chart === 'undefined') {
            showFallbackNote();
            return;
        }

        var rollingCanvas = document.getElementById(ROLLING_CANVAS_ID);
        if (!rollingCanvas) {
            console.warn('dashboards.js: canvas not found: #' + ROLLING_CANVAS_ID);
        } else {
            try {
                buildRollingChart(rollingCanvas.getContext('2d'));
            } catch (err) {
                console.error('dashboards.js: failed to build chart #' + ROLLING_CANVAS_ID, err);
            }
        }

        var timeUseCanvas = document.getElementById(TIMEUSE_CANVAS_ID);
        if (!timeUseCanvas) {
            console.warn('dashboards.js: canvas not found: #' + TIMEUSE_CANVAS_ID);
        } else {
            try {
                buildTimeUseChart(timeUseCanvas.getContext('2d'));
            } catch (err) {
                console.error('dashboards.js: failed to build chart #' + TIMEUSE_CANVAS_ID, err);
            }
        }

        var fundingCanvas = document.getElementById(FUNDING_CANVAS_ID);
        if (!fundingCanvas) {
            console.warn('dashboards.js: canvas not found: #' + FUNDING_CANVAS_ID);
        } else {
            try {
                buildFundingChart(fundingCanvas.getContext('2d'));
            } catch (err) {
                console.error('dashboards.js: failed to build chart #' + FUNDING_CANVAS_ID, err);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
