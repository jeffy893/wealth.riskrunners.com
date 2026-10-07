# CONTEXT — Wealthcare / Proactive Wealthcare

The deeper technical companion to [`README.md`](README.md). The README explains *what*
Wealthcare is; this file explains *why the FHIR model fits* and *how the pieces map*. It
mirrors the not-advice framing of the account-ninja pipeline throughout — nothing here is
advice, and nothing recommends securities, allocations, or plan changes.

---

## 1. FHIR lineage

Wealthcare does not invent a data model. It inherits one with decades of history behind it:

1. **ISO 13606** — the EHR communication reference-model standard. It frames the idea that
   *every resource needed to fill out a full profile* of a person can be standardized. This
   is the conceptual reference model Wealthcare borrows from.
2. **Larry Weed — Problem-Oriented Medical Record (POMR)** — the practice of organizing a
   person's record around their **problems** rather than around chronology or provider. This
   is the intellectual ancestor of structuring a record around a person's goals and problems,
   which is exactly how an objective-anchored financial record wants to be organized.
3. **HL7 FHIR** — the modern, resource-based interoperability standard: discrete
   **resources** that reference one another, carry **coded** data, and are **searchable** on
   codes and combinations of codes.
4. **HAPI FHIR** — the open-source Java reference server that implements FHIR. It stores
   resources, exposes a search API over their codes and parameters, and explodes JSON
   resources into relational tables. This is the concrete, existing thing Wealthcare
   proposes to **repurpose** rather than rebuild.

The throughline: a mature, open standard already models "everything about a person" as
coded, referenceable, searchable resources. Finance has no equivalent. Repurposing FHIR is
cheaper and faster than starting over.

## 2. Front-end ↔ back-end resource mapping

The back end uses the real FHIR resource names. The front end relabels them for the wealth
domain. The person is consistently called the **Client** in the UI (never "patient"), though
they map to FHIR `Patient`.

| FHIR resource (back end) | Wealthcare term (front end) | Mapping / notes |
|---|---|---|
| `Patient` | **Client** | The individual whose time + money is tracked. The subject of every Observation and RiskAssessment. One consistent UI term: "Client". |
| `Practitioner` | **Specialist relationship** | Financial advisor, lawyer/attorney, accountant, insurance broker. Like medical specialties, but financial. The human-in-the-loop (see §6). |
| `Encounter` | **Meeting / appointment** | A scheduled interaction (e.g., the insurance-broker slots in the syndication flow). References both Client and Practitioner. |
| `Observation` | **Behavior / transaction event** | Each time-or-money event: a tobacco purchase, a silver purchase, online gambling, a golf-cart purchase, 3 hours of golf on the calendar. Carries a `code`, `subject`→Client, `category` (time vs money), `effectiveDateTime`, `valueQuantity`, and `component[]` for rolling summaries. |
| `RiskAssessment` | **Risk → consequence** | **End of the pipeline.** Turns accumulated behavior into a modeled financial/health consequence. Emphasized because this is a riskrunners.com property. |

## 3. Minimum sufficient resource set

Wealthcare does not need all of FHIR. The minimum set, each with its justification:

- **`Patient`** → the Client. Everything references them; without a subject there is no
  record.
- **`Observation`** → the atomic time/money event *and* the rolling-metric summaries. The
  raw signal of the whole system.
- **`RiskAssessment`** → turns accumulated behavior into a modeled financial/health
  consequence. The analytic payoff and the riskrunners.com anchor.
- **`Practitioner`** → the human specialists (advisor, attorney, accountant, broker)
  required for the human-in-the-loop engagement model.
- **`Encounter`** → the scheduled meetings/appointments that connect Client and Practitioner
  (the broker slots).
- **Terminology/governance trio — `CodeSystem`, `ValueSet`, `StructureDefinition`** → make
  the coded data governable and enforce conformance so new apps can be approved safely
  (see §7).

This subset is the basis for the **lean replacement** migration target in the roadmap (§8):
once proven, Wealthcare needs only *these* resources, not the whole of HAPI FHIR.

## 4. The Observation + rolling-metrics model

An `Observation` captures a single time or money event:

- `code` — a coded behavior (see §7 on coding systems).
- `subject` — a reference to the Client (`Patient`).
- `category` — the top-level axis: **time** vs **money** (extensible to sub-categories like
  "discretionary" or "health-adjacent").
- `effectiveDateTime` — when it happened (ties money events to the transaction feed and time
  events to the calendar feed).
- `valueQuantity` — the magnitude: dollars for money, minutes/hours for time.
- `component[]` — used for **rolling summaries**.

The narrative stresses two derived metrics: a **rolling average** and the **rolling
deviation from that average**. These are modeled as **derived Observations** — a summary
Observation whose components carry the rolling-average and rolling-standard-deviation over a
trailing window (e.g. 30- or 90-day), computed over the stream of raw Observations. This is
what powers the "we noticed a large expenditure" trigger: when a raw event breaches the ±1σ
band around the trailing baseline, it fires.

**Worked RiskAssessment example (illustrative).** Coded tobacco-purchase Observations
accumulate for the Client. A `RiskAssessment` references them as its `basis` and expresses a
`prediction` with a modeled probability band of **0.25%–0.4%** modeled likelihood, which
flows to a modeled financial consequence (treatment cost / insurance-premium impact). *This
is illustrative modeling — not a medical or actuarial determination.*

## 5. account.ninja objective-setting + the immunized-baseline pipeline

Raw signal is meaningless without an **objective**. Objectives come from the
[account.ninja](https://account.ninja) goal tool: a user distributes a fixed per-cycle
budget across their goal accounts, with no growth assumed, and exports a **timeline CSV**.
The account-ninja report pipeline runs that timeline into an **immunized goal-funding
baseline**.

A goal has **no inherent risk profile**. Instead, risk is an **allocation choice** applied
to the *total* funding goal, split across three interest-earning tiers via a fixed
**barbell split**:

| Tier | Allocation | Modeled midpoint return |
|---|---|---|
| LOW | 40% | 4.5% |
| MEDIUM | 35% | 7% |
| HIGH | 25% | 11% |

> **Note on the narrative's "3% / 6% / 12%".** The driving narrative casually refers to "the
> 3%, the 6%, the 12% accounts." Those offhand figures are **superseded** by the pipeline's
> modeled tier midpoints **LOW 4.5% / MEDIUM 7% / HIGH 11%** and its 40/35/25 barbell. The
> deterministic CSV outputs are authoritative; 4.5/7/11% is used everywhere.

The pipeline immunizes each tier with a **lump-sum down payment** now plus per-cycle vesting
that compounds at the tier midpoint to reach the allocated target. Two scenarios are
compared: **10% down** vs **20% down** today. The payoff: because the three accounts earn
returns, you do not have to keep feeding the full per-cycle budget into your goals.

The worked numbers below are copied directly from the pipeline's `*_vesting_schedule.csv`
outputs; they are **deterministic educational modeling**, not projections.

### Jefferson example (default) — 6 goal accounts, 60 cycles × 30 days (~5 years), $1,500/cycle budget, **$90,000** no-growth goal

| Scenario | Lump sum | LOW / MED / HIGH lump | Per-cycle vesting | LOW / MED / HIGH per-cycle |
|---|---|---|---|---|
| 10% down | **$9,000** | $3,600 / $3,150 / $2,250 | **$1,084.16** | $469.98 / $378.85 / $235.34 |
| 20% down | **$18,000** | $7,200 / $6,300 / $4,500 | **$906.17** | $402.96 / $316.62 / $186.59 |

All tiers reach $90,000 at cycle 60. Headline relief: 20%-down requires only ~$906/cycle vs
the $1,500 budget — compound growth covers the rest.

### Kenneth example (secondary) — 5 home-project goals, 12 cycles × 30 days (~1 year), $4,000/cycle budget, **$48,000** goal

| Scenario | Lump sum | Per-cycle vesting |
|---|---|---|
| 10% down | $4,800 | **$3,460.07** |
| 20% down | $9,600 | **$3,044.93** |

## 6. Syndication & human-engagement model

A detected signal is not left to run silently. Observations + rolling metrics detect a
breach → a RiskAssessment or threshold fires → Wealthcare **syndicates** the relevant slice
of data to a partner pipeline (e.g., an insurer) over APIs → the partner returns an offer
(pre-approval, premium) → Wealthcare surfaces it to the Client alongside a **human
Practitioner** (a broker) and bookable `Encounter` slots that drop onto the Client's
calendar.

The insistence that "it can't just all be behind the scenes — you have to have human
engagement" is a **first-class design requirement**, not a footnote. The Client always
approves the action, and a human specialist is always in the loop.

## 7. Terminology, governance resources, and the governance-team workflow

The terminology trio is not just data plumbing — it is **how a governance team controls what
may be written into the pipeline**:

- **`CodeSystem`** — defines the coded behaviors. On the open question of whether financial
  coding standards already exist: **yes for money** — **MCC (Merchant Category Codes, ISO
  18245)** classify merchants on card transactions and bank feeds often carry them, so MCC
  is a reasonable seed vocabulary for *money* Observations. There is **no** universal
  standard for *time*/behavior coding, so Wealthcare defines a **custom CodeSystem** for
  coded behaviors (and for finer financial intent than MCC captures).
- **`ValueSet`** — the approved subset of codes usable in a given Observation `category`
  (e.g., the money-behavior ValueSet drawn from MCC + custom codes).
- **`StructureDefinition` (profiles)** — constrains what a valid Wealthcare Observation or
  RiskAssessment must contain. This is the contract a new partner app must conform to.

**Governance-team workflow** for approving a new mapping or a new partner app that wants to
write to the pipeline:

1. Propose codes.
2. Governance reviews them against the existing CodeSystem / ValueSet.
3. Define or extend the StructureDefinition profile.
4. Validate conformance in a staging HAPI FHIR instance.
5. Approve and publish the ValueSet / profile.
6. Grant the app write scope.

## 8. Buy-vs-build roadmap

Build **on top of open-source HAPI FHIR** first to minimize time-to-market, then — once it
is clear only the minimum sufficient resource subset (§3) is actually used — build a **lean
replacement** limited to that subset and **migrate off HAPI FHIR** onto it.

- **Phase 0 — Repurpose & prove.** Stand up HAPI FHIR; relabel Patient→Client,
  Observation→behavior/transaction, etc.; load representative Observations; build the
  dashboards. (This PoC site is the artifact of Phase 0's thinking.)
- **Phase 1 — Ingest.** Wire the two data sources: **Google Calendar** (time) and
  **bank/transactions via a Stripe-style partner** (money). **AI/LLM agents** do the NLP to
  extract structured Observations from free-text calendar entries and transaction
  descriptions, mapping them to codes (MCC + custom CodeSystem). Real deployment needs
  explicit consent and secure handling of this sensitive calendar + financial data.
- **Phase 2 — Objective & baseline.** Integrate account.ninja objective-setting and the
  immunized-baseline report pipeline; attach goals to the Client; render the funding view.
- **Phase 3 — Risk & syndication.** Add RiskAssessment analytics and the insurer/broker
  syndication + human-in-the-loop engagement.
- **Phase 4 — Lean rebuild & migrate.** Replace HAPI FHIR with a purpose-built store
  covering only the minimum sufficient resource set; migrate data; decommission the HAPI
  dependency. Faster, cheaper, owned.

---

> **Proof of concept — not investment advice.** Wealthcare is an educational,
> proof-of-concept demonstration using deterministic, hypothetical modeling. It is **not
> investment advice** and recommends **no securities, allocations, or changes to any
> financial plan**. Figures shown are illustrative representative data, not projections of
> real returns. There is a fine line when securities are involved: in a real deployment
> the platform would surface information and modeling, but any **personalized investment
> advice could only be delivered by accredited, duly registered financial advisors** — the
> platform informs, licensed humans advise. Standing that up would likely also require an
> **SEC no-action letter** clarifying the platform's role. Risk, health, and financial
> figures are illustrative and are not medical, actuarial, or financial determinations.

*Author: Jefferson Richards — a Risk Runners project.*
