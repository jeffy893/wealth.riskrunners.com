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

    /* ========================================================================
       §5.3 ROLLING METRICS — locked 12-point weekly series (design §5.3).
       Representative figures defined by the design (NOT a pipeline output).
       W12 is the golf-cart week; spend[11]=12514 breaches bandUpper[11]=11288.
       ===================================================================== */
    var rolling = {
        labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12'],
        // weekly discretionary money spend ($), a representative stochastic series;
        // normal weeks vary ~$180-$510, W12 is the $12,500 golf-cart spike (Obs row 11)
        spend: [285, 420, 190, 510, 340, 265, 455, 180, 390, 230, 300, 12514],
        // 4-week (~30-day) trailing rolling average of `spend`, rounded to $1
        rollingAvg: [285, 352, 298, 351, 365, 326, 392, 310, 322, 314, 275, 3358],
        // trailing mean +/- 1.5 sigma band (sigma of the 4-week window), rounded to $1;
        // normal weeks stay inside the band, only W12 breaches bandUpper
        bandUpper: [285, 454, 440, 535, 541, 504, 536, 462, 483, 483, 393, 11288],
        bandLower: [285, 251, 157, 167, 189, 148, 249, 158, 162, 145, 157, 0],
        breachIndex: 11  // zero-based -> W12, first i where spend[i] > bandUpper[i]
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
                // Illustrative total-balance curve to $90,000 at cycle 60.
                balance: [9000, 10135.94, 20000, 32000, 46000, 62000, 90000]
            },
            down20: {
                lump: 18000,             // LOW 7200 / MED 6300 / HIGH 4500
                lumpTiers: { low: 7200, med: 6300, high: 4500 },
                perCycle: 906.17,        // LOW 402.96 / MED 316.62 / HIGH 186.59
                perCycleTiers: { low: 402.96, med: 316.62, high: 186.59 },
                balance: [18000, 19009.73, 29000, 41000, 55000, 71000, 90000]
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
    var FUNDING_CANVAS_ID = 'funding-chart';
    var FALLBACK_NOTE_ID = 'charts-fallback-note';

    /* ────────────────────────────────────────────────────────────────────
       §10.2 fallback: if Chart.js failed to load, reveal the role=status note
       (which sits beside the always-present paired tables) and do NOT throw.
       ──────────────────────────────────────────────────────────────────── */
    function showFallbackNote() {
        var note = document.getElementById(FALLBACK_NOTE_ID);
        if (note) {
            note.hidden = false;
        }
    }

    /* Shared dark-theme axis/legend options for both charts. */
    function baseOptions(titleText) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: titleText, color: '#ffffff' },
                legend: { labels: { color: '#d0d0d0' } }
            },
            scales: {
                x: { ticks: { color: '#888888' }, grid: { color: 'rgba(255,255,255,0.06)' } },
                y: { ticks: { color: '#888888' }, grid: { color: 'rgba(255,255,255,0.06)' } }
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
            options: baseOptions('Rolling money-spend vs \u00B11.5\u03C3 deviation band (W1\u2013W12)')
        });
    }

    /* §5.5 funding chart — total-balance growth to the goal, 10%- vs 20%-down,
       with the three tier colors represented in the per-cycle legend copy. */
    function buildFundingChart(ctx) {
        var j = funding.jefferson;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: j.cyclePoints,
                datasets: [
                    {
                        label: '10% down (lump $9,000)',
                        data: j.down10.balance,
                        borderColor: TIER_HIGH,
                        backgroundColor: 'rgba(220,38,38,0.12)',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: '20% down (lump $18,000)',
                        data: j.down20.balance,
                        borderColor: TIER_LOW,
                        backgroundColor: 'rgba(37,99,235,0.12)',
                        borderWidth: 2,
                        pointRadius: 3,
                        fill: false
                    },
                    {
                        label: 'Goal $90,000',
                        data: j.cyclePoints.map(function () { return j.goal; }),
                        borderColor: TIER_MED,
                        backgroundColor: TIER_MED,
                        borderWidth: 1,
                        borderDash: [4, 4],
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: baseOptions('Immunized goal funding to $90,000 \u2014 10%-down vs 20%-down (Jefferson, 60 cycles)')
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
