# Wealthcare — Proactive Wealthcare

A **proof-of-concept static website** in the Risk Runners project family (a sibling of
street.riskrunners.com). It pitches a single idea: take the data standard that powers
healthcare interoperability — **HL7 FHIR**, and the open-source **HAPI FHIR** reference
server — and repurpose it as the backbone of a **personal financial-wellness system**.

> **Proof of concept — not investment advice.** Wealthcare is an educational,
> proof-of-concept demonstration using deterministic, hypothetical modeling. It is **not
> investment advice** and recommends **no securities, allocations, or changes to any
> financial plan**. Figures shown are illustrative representative data, not projections of
> real returns. A real deployment that offered personalized financial guidance would
> require an **SEC no-action letter**, or would have to **restrict access to accredited
> investors** — a significant regulatory hurdle that this proof of concept does not clear.
> Risk, health, and financial figures are illustrative and are not medical, actuarial, or
> financial determinations.

---

## The concept, in plain terms

Healthcare already solved a hard problem: how to represent everything about a person's
health as structured, coded, interoperable data. FHIR does this with **resources**
(`Patient`, `Observation`, `RiskAssessment`, …) that reference one another and carry coded,
searchable values. **HAPI FHIR** is the open-source Java server that stores those resources,
exposes a search API over their codes and parameters, and explodes the JSON into relational
tables.

Wealthcare's proposal is to **relabel** that stack for the wealth domain rather than rebuild
it from scratch. The back end keeps the real FHIR resource names; the front end renames them
for finance:

- `Patient` → **Client**
- `Practitioner` → **Specialist relationship** (advisor, attorney, accountant, broker)
- `Encounter` → **Meeting / appointment**
- `Observation` → **Behavior / transaction event**
- `RiskAssessment` → **Risk → consequence**

Nothing here is a running system. The architecture is *described and mocked*, not deployed.

## The thesis: time + money + objective

How you spend your **time** and your **money** is the measurable signal of a life. Those two
feeds — a calendar for time, a bank/transaction feed for money — stream in as FHIR
**Observations**, get normalized, and are summarized with **rolling averages and rolling
deviations** so anomalies stand out.

But raw signal is not enough. The data only becomes meaningful once it is anchored to an
**objective**. *Without an objective, all of this is for naught.* Objectives come from the
existing [account.ninja](https://account.ninja) goal tool, whose exported timeline is run
through the account-ninja report pipeline to produce an **immunized goal-funding baseline**
(three LOW / MEDIUM / HIGH tiers via a fixed barbell split, compared across a 10%-down vs
20%-down lump-sum scenario). Behavior that drifts from the plan surfaces as a
**RiskAssessment** — the behavior-to-financial-consequence resource that anchors this under
the riskrunners.com umbrella.

## Folder & page structure

Four cross-linked static pages, flat in the root, plus one shared stylesheet, two scripts,
and these two docs:

```
wealth.riskrunners.com/
├── index.html            Vision — time + money + objective; hero, thesis, full disclaimer
├── architecture.html     Architecture — FHIR lineage, resource mapping, governance, min set
├── dashboards.html       Dashboards — phone/computer product mockups + Chart.js charts
├── roadmap.html          Roadmap — buy-vs-build on HAPI FHIR, phased plan
├── css/
│   └── wealthcare.css     single shared stylesheet, linked by all four pages
├── js/
│   ├── nav.js             mobile nav toggle + marks the current page active (all pages)
│   └── dashboards.js      Chart.js setup for dashboards.html only
├── README.md             this file
└── CONTEXT.md            the deeper technical companion
```

- **index.html** (Vision) — the landing page: the time + money + objective thesis, a plain
  how-it-works flow, the "what this is / isn't" panel, and the full compliance disclaimer.
- **architecture.html** (Architecture) — the FHIR/HAPI lineage, the front-end↔back-end
  resource mapping, the Observation + rolling-metrics model, the RiskAssessment worked
  example, the terminology/governance resources, and the minimum sufficient resource set.
- **dashboards.html** (Dashboards) — phone and computer mockups of the would-be product:
  Client overview, Observations feed, rolling-metrics chart, RiskAssessment card, the
  immunized goal-funding view, and the syndication / human-in-the-loop flow.
- **roadmap.html** (Roadmap) — the buy-vs-build plan: start on open-source HAPI FHIR, then
  rebuild lean against only the minimum sufficient resource set and migrate off it.

A persistent compliance banner appears on all four pages, and the footer carries a one-line
not-advice note linking to the full disclaimer on index.html.

## How to view

Open `index.html` in any modern browser. **No build, no server.** Opening the file directly
(`file://`) works. The pages cross-link to each other as plain relative links.

Charts on `dashboards.html` fetch Chart.js from a CDN, so that page needs network access to
render them; offline, the charts fall back to their paired data tables and the page stays
fully readable.

## Tech stack

- **Static HTML5 + CSS3 + vanilla JavaScript (ES6+).** No framework, bundler, transpiler,
  package manager, or server.
- **Exactly two CDN-hosted third-party assets:**
  - [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) — the two charts on dashboards.html.
  - [Google Fonts](https://fonts.google.com) — Inter (UI/body) and Courier Prime
    (labels/codes/tags).
- No analytics, no trackers, no other external assets.

---

## Author & attribution

Author: **Jefferson Richards**

A Risk Runners project. © Jefferson Richards. Provided as a proof-of-concept demonstration.

The not-advice framing mirrors the companion
[account-ninja pipeline README](../../04_integralmass-repo/value.integralmass.com/account-ninja/README.md):
hypothetical modeling for education and goal exploration — not financial advice, and no
recommendation of securities or allocations.

---

## License

Licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the
[LICENSE](LICENSE) file for the full text.

The AGPL's network-use clause (section 13) is deliberate: if this proof of concept is ever
developed into a hosted service that users interact with over a network, that service's
complete corresponding source must be offered to its users.
