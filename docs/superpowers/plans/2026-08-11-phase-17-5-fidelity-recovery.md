# Phase 17.5 Fidelity Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute this plan task-by-task. Keep the checkbox tasks as the execution ledger.

**Goal:** Recover the Phase 17.5 mobile reporting product to the approved final Figma contract while preserving the canonical analytics, water, cache, authentication, saved-view, comparison, forecast, and chart-domain work already present at `a326ce2`.

**Architecture:** Keep routes thin. Move presentation into explicit reporting components, introduce a versioned section-aware Insights result contract, retain committed per-section data during refresh failures, and keep report-level failures distinct from section-level failures. The backend remains authoritative for facts and policy; the mobile app consumes canonical facts and owns presentation state only.

**Tech Stack:** TypeScript, React Native, Expo Router, React Native SVG/chart primitives already in `apps/mobile/src/components`, Vitest, Jest, PostgreSQL/Prisma, Zod contracts in `packages/shared`, Firebase-authenticated API requests.

## Scope and guardrails

- [ ] Stay on `phase-17-5-custom-analytics`; do not create or switch branches.
- [ ] Modify only files named by an execution task. Preserve unrelated work and the protected paths `.agents/`, `.aidesigner/`, `.codex/`, `backups/`, and `docs/design-references/current images/`.
- [ ] Do not edit Prisma schema or migrations without separate explicit approval. This recovery plan contains no schema change.
- [ ] Do not replace the approved Phase 17.5 plan. This document supplements `docs/superpowers/plans/2026-08-07-phase-17-5-custom-analytics.md`.
- [ ] Do not redesign Progress. Restore its existing refresh and mode-switch behavior and follow the final Figma deep-link mapping.
- [ ] Do not replace the current chart framework. Reuse and extend `line-trend-chart.tsx`, `bar-trend-chart.tsx`, `cartesian-plot.tsx`, `chart-frame.tsx`, `chart-selection-overlay.tsx`, `comparison-trend-chart.tsx`, `donut-trend-chart.tsx`, `heatmap-trend-chart.tsx`, and `trend-chart-renderer.tsx`.
- [ ] Keep Simple and Complex as capability views over the same canonical backend and persistence.
- [ ] Keep nutrient missingness as `unknown`; never convert unavailable nutrient data to zero or use it to change logging completeness.
- [ ] Keep hydration universal with the server default of `2000 mL/day`; `waterTrackingEnabled` remains compatibility state and cannot hide Hydration.
- [ ] Keep water persistence as amount plus time with editable history. The global launcher, History quick actions, and Water Log route must use the same persistence path.
- [ ] Keep exactly one pinned saved view and Calories as the unpin fallback. Relative saved periods remain rolling.
- [ ] Keep custom-range eligibility and aggregation rules from the approved plan: first eligible authoritative log through today, no future dates, daily for 1–45 days, weekly for 46–180 days, monthly for 181+ days.
- [ ] Keep forecasts deterministic/statistical. Calories and Weight remain independently eligible, and forecast unavailability cannot remove the base trend.
- [ ] Keep the current cache protections: Firebase UID partitioning, schema-versioned entries, atomic/recoverable writes, same-key serialization, replacement safety, purge barriers, signout/account-deletion clearing, stale state, and committed-data retention.
- [ ] Remove temporary user-visible `Diagnostic:` text before shipping. Preserve only safe, gated server diagnostics after an explicit audit.

## Confirmed repository baseline and evidence

The audit was performed on `phase-17-5-custom-analytics` at `a326ce2`, with Node `v22.23.0` and pnpm `10.34.3`. The branch tracks `origin/phase-17-5-custom-analytics`; the protected untracked paths listed above are present and remain untouched.

The final Figma handoff and node index were inspected through Figma tooling. `517:73` is the product contract and `524:21` is the final node index. Major visual anchors inspected with design context and screenshots include `338:98`, `338:276`, `520:21`, `364:21`, `361:39`, `424:21`, `338:469`, and `447:21`. The full index was structurally inspected. Individual screenshot capture was not completed for the state and responsive nodes listed in the final paragraph of the audit matrix; those nodes remain mandatory implementation-time Figma checks and are not classified as faithful.

Existing source confirms that canonical analytics, trend geometry, saved-view lifecycle, comparisons, forecasts, nutrient references, water CRUD, quick add/Undo, cache replacement, cache purge, and Firebase identity partitioning already exist. The primary product defect is that final Figma compositions were replaced by generic mobile renderers. The primary reliability defect is that the Insights route still rejects the whole report when one metric computation throws.

## 1. Current-state audit matrix

Each row records the current route or component, the exact source worth preserving, the missing behavior and treatment, and the task that will recover the node. Classifications use only the approved vocabulary.

### Entrypoints and reporting

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `338:98` | Insights / Simple / 390 | `apps/mobile/src/app/(tabs)/insights.tsx` `CanonicalInsightsContent` | Renders a flat list from `Object.values(insights.sections)` | PLACEHOLDER | No period summary, energy balance, macro balance, nutrient highlights, hydration, weight direction, logging consistency, recommendations, or composed card hierarchy | Canonical Insights fetch, cache, refresh, recommendations, and mode selection | Compose all approved Simple sections and period controls from real response data | Purpose-built cards, hierarchy, quiet explanatory copy, chart/heatmap treatments, spacing, typography, and CTA placement | Fixture-backed screen assertions plus 390pt screenshot review and loading/error/empty checks | R1.1 |
| `338:276` | Insights / Complex / Overview / 390 | Same route; Complex branch of `InsightsScreen` | Uses the same generic content model with a pinned branch | PLACEHOLDER | Missing Explore entry, Overview/Nutrients/Recommendations tabs, month summary, integrated report cards, and Complex hierarchy | Canonical report data, mode routing, saved-view and recommendations requests | Build the Complex Overview shell and section navigation | Final tab treatment, card grouping, pinned analysis placement, and period controls | Complex fixture screen tests and exact-node screenshot review | R1.2 |
| `520:21` | Trends / Explore curated / Simple / 390 | `apps/mobile/src/app/trends/index.tsx` | Simple catalog rows and range chips render | PLACEHOLDER | No preferred trend row, curated groups, explanatory copy, or Complex capability explanation | Catalog loading, Simple metric allow-list, search helpers, and deep links | Curated Simple groups and preferred-trend entry | Group cards, row hierarchy, copy, affordances, and footer treatment | Simple capability tests, deep-link tests, and 390/320 screenshots | R2.1 |
| `364:21` | Trends / Explore all / 390 | `apps/mobile/src/app/trends/index.tsx` | Complex search renders a flat metric list | PLACEHOLDER | No Nutrients entry, Saved Views card, Manage path, grouped categories, or supporting copy | Catalog, search filtering, metric definitions, and route navigation | Complex Explore information architecture and saved-view entry | Grouped cards, pinned preview, Manage affordance, search treatment, and explanatory copy | Search/category/saved deep links and 390/320 screenshots | R2.2 |
| `361:39` | Insights / Complex / Nutrients / 390 | `insights.tsx`; `components/complete-nutrient-report.tsx` | Existing nutrient summary is embedded in the legacy report component; no canonical tab screen | PARTIAL | No dedicated tab composition, highlights-to-library flow, or target-semantics card | Nutrient registry, reference semantics, `CompleteNutrientReport`, and backend nutrient facts | Canonical Nutrients tab and navigation into the library | Highlights card, GOAL/RANGE/LIMIT legend, category report hierarchy, and tab state | Tab navigation, target semantics, unknown/partial data fixtures, and screenshot review | R1.2, R2.3 |
| `361:104` | Insights / Complex / Recommendations / 390 | `insights.tsx` recommendation list | Recommendations render below generic content, not as a tab | MISSING | No Recommendations tab, approved hierarchy, or tab-local empty/loading/error state | Deterministic recommendation facts and wording data already fetched by Insights | Dedicated tab composition and isolated recommendation state | Final recommendation card, priority treatment, copy hierarchy, and navigation state | Recommendation fixtures, retry behavior, and tab screenshot | R1.2 |
| `450:22` | Insights / Complex / Primary pinned view / 390 | `insights.tsx` `PinnedInsightsView` | Generic Calories `LineTrendChart` is shown as a large standalone block | PLACEHOLDER | No compact integrated pinned card, Manage action, saved-view summary, or approved placement | Pinned/default view lookup, trend query, chart scrubbing, and saved-view backend | Pinned analysis card with Manage navigation and resilient preview state | Compact card, metric summary, period label, action placement, and failure treatment | Pinned preview success/failure fixtures and screenshot comparison | R1.2, R10.4 |

### Core trend masters

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `338:469` | Calories / 30D | `apps/mobile/src/app/trends/[metric].tsx` | Generic detail route renders a line chart and summary | PARTIAL | Missing report-specific header, daily-intake context, chart axes/readout, coverage heatmap, contributors card, and visualization note | Canonical trend query, 7D/30D/90D selection, null gaps, references, coverage, contributors, scrubbing, and forecast | Calories-specific composition and card sections | Approved chart frame, labels, readout, summary cards, coverage, and contributors treatment | Calories fixture with missing days, target, scrub, forecast, and screenshot | R3.1 |
| `363:21` | Calories / 7D | Same generic detail route | Range chip changes the canonical query | PARTIAL | Same composition gap as 30D; 7D density and current-period treatment are not final | Relative range query and rolling semantics | 7D-specific summary and chart density | Final 7D chart labels, period summary, and current bucket state | 7D geometry, current-day fixture, and 390/320 screenshot | R3.1 |
| `363:177` | Calories / 90D | Same generic detail route | Range chip changes the canonical query | PARTIAL | No 90D aggregation presentation, summary context, or approved chart frame | Rolling 90D range and aggregation policy | 90D-specific presentation and aggregation explanation | Final long-range axis, coverage, and card treatment | 90D fixture and monthly/weekly boundary tests | R3.1 |
| `338:605` | Weight | Same generic detail route | Weight maps to generic line presentation | PARTIAL | Missing direction summary, target/reference treatment, selected readout, and weight-specific copy | Weight metric, reference semantics, range/coverage, and forecast policy | Weight-specific report composition | Direction card, reference band, axis/readout, and forecast placement | Weight direction/forecast success and unavailable fixtures | R3.2 |
| `338:720` | Macros | Same generic detail route plus `macro-chart.tsx` | Macro chart and generic summary render | PARTIAL | Missing macro balance composition, shared unit treatment, legend hierarchy, and approved summaries | Macro composition data and existing macro chart primitive | Macro-specific report and comparison-compatible presentation | Donut/legend/card hierarchy, shared units, labels, and target context | Macro fixture, shared-unit comparison, and screenshot | R3.3 |
| `338:928` | Logging consistency | Same generic detail route plus `heatmap-chart.tsx` | Heatmap presentation exists | PARTIAL | Missing completeness/phase explanation, day-state legend, current-day treatment, and final card structure | Logging-day classifier, phase semantics, heatmap geometry, and unknown separation | Logging report card with exact day-state language | Heatmap card, legend, current-day indicator, and explanatory copy | Complete/partial/unlogged/in-progress fixtures and accessibility checks | R3.4 |
| `426:159` | Hydration | Same generic detail route; `water-log.tsx` is separate | Trend route can query hydration; water logger is separate | PARTIAL | Missing hydration-specific target summary, quick-add continuity, water trend composition, and shared logger CTA | Water persistence, hydration metric, default goal, trend data, and logger CRUD | Hydration report detail connected to canonical water logging | Hydration card, visual scale, target/reference, and Add Water path | Water create/edit/delete plus hydration trend and cross-entrypoint tests | R3.5, R8.1 |
| `449:177` | Calories forecast | Generic detail route and `forecast-chart.tsx` | Forecast is appended to generic detail | PARTIAL | Missing forecast-specific summary, confidence/eligibility explanation, continuity, and unavailable state | Deterministic forecast policy, eligibility, horizon, and chart primitive | Calories forecast card integrated with base trend | Forecast card, continuity treatment, and unavailable copy | Eligible/ineligible/insufficient-data fixtures and forecast continuity tests | R3.1, R11.2 |
| `338:814` | Fiber / nutrient goal-depth reference | Generic detail route with reference copy | Nutrient reference values can appear in generic summary | PARTIAL | No goal-depth visual, reference type labeling, or nutrient-specific detail composition | Target/minimum/limit/range semantics and reference schemas | Nutrient goal-depth card and reference explanation | Goal-depth bar/range/limit treatment and unknown state | Full/half/no-bound reference fixtures and screenshot | R4.1 |

### Nutrient system

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `424:21` | Nutrient library | `components/complete-nutrient-report.tsx`; no dedicated route | Summary component exists; library route does not | MISSING | No searchable complete report route, needs-attention section, category counts, or footer | Nutrient catalog, category metadata, search helper, references, and summary component | Dedicated library route and category navigation | Needs-attention card, category cards, search affordance, and explanatory copy | Route, category, empty, unknown, and search tests | R2.3 |
| `424:67` | Nutrient search / “vit” | `lib/analytics/nutrient-search.ts`; no library UI | Pure search helper exists | MISSING | No search field state, result grouping, highlighted match, or route integration | Typo-tolerant/ranked search logic and backend catalog | Library search UI and state transitions | Search icon/input, result rows, match treatment, and clear action | `vit` fixture, keyboard/focus, no-result, and screenshot | R2.3 |
| `424:116` | Nutrient search / “vit c” | Search helper only | Search can rank terms but no screen consumes it | MISSING | No Vitamin C result row, metric navigation, or selected query state | Ranked metric definitions and deep-link query support | Search result rendering and detail navigation | Result row metadata, highlight, and affordance | Exact query/result assertion and deep-link test | R2.3 |
| `424:138` | Vitamins category | Catalog category data exists; no category screen | Category metadata is available | MISSING | No category page, item counts, or category-level empty/unknown treatment | Registry categories and nutrient definitions | Category route/view | Category header, list grouping, counts, and copy | Category list and back-navigation tests | R2.3 |
| `425:21` | Vitamin C true-range trend | Generic `[metric].tsx` | Canonical reference range can render | PARTIAL | No nutrient header, true-range explanation, coverage summary, contributor link, or range-specific chart treatment | Reference semantics requiring both authoritative bounds and canonical trend data | Nutrient-specific detail composition | Range band, labels, reference explanation, and selected state | Both-bounds, one-bound, and no-bound fixtures | R4.1 |
| `425:92` | Sodium with related Potassium | Generic detail; related metrics data may be available | Generic detail can display related metric metadata | PARTIAL | No related-metric card, sodium limit emphasis, or cross-detail navigation | Related metrics metadata, limit semantics, and canonical queries | Related-metric section and navigation | Limit treatment, paired card, and action affordance | Sodium/Potassium fixture and navigation test | R4.2 |
| `426:21` | Iron with related Vitamin C | Generic detail | Generic detail has no approved nutrient pair composition | PARTIAL | No Iron target/minimum view, Vitamin C related card, or nutrient context | Nutrient registry, references, related metrics, and contributors | Nutrient pair detail composition | Pairing explanation, reference state, and related card | Iron/Vitamin C fixture and screenshot | R4.2 |
| `426:89` | Amino-acid profile | Generic metric catalog/detail only | No amino-acid profile component found | MISSING | No amino-acid group, profile visualization, Leucine entry, or group semantics | Amino-acid nutrient definitions and canonical metric engine | Dedicated profile view and detail navigation | Profile chart/list, group labels, and sparse/unknown treatment | Amino-acid fixture, Leucine navigation, and screenshot | R4.3 |
| `429:21` | Vitamin D sparse coverage | Generic detail coverage copy | Sparse coverage is represented as text | PARTIAL | No explicit sparse-state card, coverage visualization, or non-zero unknown distinction | Metric data coverage state and null-value chart gaps | Nutrient sparse-state composition | Sparse card, coverage indicator, and explanatory copy | Recorded/partial/unknown fixture and no-zero assertion | R4.4 |
| `429:83` | Leucine detail | Generic detail route | A nutrient slug can reach generic detail | PARTIAL | No amino-acid-specific header, reference explanation, profile relation, or contributor CTA | Metric routing, references, coverage, and contributors endpoint | Leucine detail composition | Profile context, reference state, and source explanation | Leucine detail fixture and navigation | R4.3 |
| `426:215` | Vitamin C contributors | `apps/mobile/src/app/trends/contributors.tsx` | Contribution list is functional | PARTIAL | Flat contribution rows replace approved sheet/progress/context/source explanation | Contributor API, attribution, food source names, and loading/error handling | Canonical contributors sheet/card presentation | Progress visualization, context summary, source explanation, and sheet behavior | Contributor totals, missing source data, and modal dismissal tests | R4.5 |
| `426:243` | Nutrient data states | Generic detail text/status | No unified state system is rendered | PARTIAL | No explicit recorded/partial/unknown cards, reference availability state, or retry path | `metric-data-coverage.ts`, canonical missingness, and chart null gaps | Shared nutrient state component | State labels, visual treatment, and retry action | All three states, zero-vs-unknown, and screen assertions | R4.4, R10.2 |

### Comparison, configuration, and saved views

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `447:21` | Configure Trend | `apps/mobile/src/app/trends/configure.tsx` | Draft configuration and Apply are functional | PARTIAL | Raw settings page replaces approved sheet, composed rows, Done/Apply hierarchy, and saved-view context | Draft/apply separation, metric/compare/range/aggregation/coverage/reference/forecast fields, reset behavior | Sheet shell and context-aware actions | Handle, scrim, rows, selectors, footer actions, and typography | Draft immutability, apply/reset, mode capabilities, and sheet screenshots | R5.1 |
| `447:66` | Compare picker | `configure.tsx` metric buttons | Picker is embedded in the raw form | PARTIAL | No dedicated picker sheet, search/grouping, disabled incompatibility explanation, or selected state | Comparison compatibility and missing-pair backend validation | Dedicated picker state and route/sheet | Picker rows, selected indicator, and explanatory copy | Compatible/incompatible pairs and cancel/apply tests | R5.2 |
| `447:114` | Protein + Carbs / shared units | `[metric].tsx` comparison mode | Comparison chart backend and renderer exist | PARTIAL | No shared-unit summary, dual metric header, legend hierarchy, or approved card composition | Comparison query, fixed axes, shared-unit validation, and chart geometry | Shared-unit comparison report | Shared header, colors, legend, readout, and card layout | Shared-unit data and selection/scrub tests | R5.2 |
| `447:149` | Protein + Weight / dual axis | Comparison renderer | Dual-axis data path exists | PARTIAL | No dual-axis labels, axis ownership explanation, or report summary | Dual-axis geometry and metric compatibility rules | Dual-axis report composition | Axis colors/labels, legend, and explanatory treatment | Dual-axis geometry and accessibility tests | R5.2 |
| `454:21` | Sodium + Potassium / normalized | Comparison renderer | Normalization policy exists in backend | PARTIAL | No normalized-unit explanation, paired nutrient presentation, or reference context | Normalization and comparison missingness policy | Normalized comparison report | Normalized scale, labels, legend, and copy | Normalized fixture and unknown/partial tests | R5.2 |
| `447:189` | Custom range | `apps/mobile/src/app/trends/custom-range.tsx` | Date inputs, presets, calendar, rail math, and Apply exist | PARTIAL | Button/form shell replaces approved sheet, historical rail, handles, panning, zooming, and haptic gesture behavior | Eligibility, no-future bounds, rail helpers, aggregation preview, and date validation | Gesture-connected sheet and exact interaction model | Handle/rail, calendar, sheet, CTA, and error states | Pure geometry plus responder, date, boundary, and screenshot tests | R6.1 |
| `453:30` | Data coverage selector | `configure.tsx` coverage buttons | Coverage values are selectable | PARTIAL | No selector sheet, descriptions, selected treatment, or saved-view draft context | Coverage policy and server filtering | Reusable coverage selector | Selector rows, descriptions, and state treatment | Each coverage option and cancel/apply tests | R5.1 |
| `454:62` | Aggregation selector | `configure.tsx` aggregation buttons | Aggregation is selectable | PARTIAL | No selector sheet, range-derived allowed values, or explanatory copy | Aggregation policy and range validation | Reusable aggregation selector | Selector rows, disabled values, and copy | 45/46/180/181 boundaries and UI state tests | R5.1 |
| `449:25` | Save new view | `apps/mobile/src/app/trends/save-view.tsx` | Name input and create request work | PARTIAL | Standalone page replaces approved save sheet and has no pin-on-create choice | Create validation, saved-view API, and duplicate-name handling | Save sheet and pinned-analysis choice | Sheet, name field, pin choice, and CTA treatment | Create, validation, pin-on-create, and cancel tests | R7.1 |
| `449:48` | Modified saved view | `save-view.tsx` update branch | Existing view can be updated | PARTIAL | No modified-state summary, change preview, or save/discard sheet actions | Update endpoint and draft query/configuration state | Modified saved-view presentation and discard path | Dirty state, summary rows, and action hierarchy | Update/discard/unsaved-change tests | R7.1 |
| `449:75` | Saved Views manager | `apps/mobile/src/app/trends/saved-views.tsx` | Full lifecycle is exposed as vertical text actions | PARTIAL | No pinned section, cards, reorder affordance, grouped all views, or action menu | Load/open/pin/unpin/reorder/rename/duplicate/delete logic and one-pinned invariant | Manager composition and action menu | Sections, cards, drag/reorder affordance, and empty state | Full lifecycle plus long names and screenshot | R7.2 |
| `453:54` | Saved-view actions | `saved-views.tsx` inline buttons | Actions work inline | PARTIAL | No action sheet/menu, focused row context, or destructive action separation | All lifecycle API calls and optimistic reload behavior | Action sheet with explicit action labels | Menu rows, separators, destructive color, and dismissal | Each action and cancel behavior | R7.2 |
| `517:60` | Delete confirmation | `saved-views.tsx` native `Alert` | Delete confirmation is native alert | PARTIAL | No approved confirmation sheet, view name/context, or loading/error state | Delete API and failure handling | App-styled confirmation flow | Confirmation sheet, destructive CTA, and retry/error | Confirm/cancel/failure and one-pinned fallback tests | R7.2 |

### Simple-mode detail variants

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `523:21` | Simple Calories / 30D | `[metric].tsx` with Simple mode | Generic Calories trend is reachable with range chips | PARTIAL | Complex controls are hidden, but the approved Simple card/report treatment is absent | Simple metric allow-list, canonical trend, range choices, and chart interaction | Simple Calories composition | Simple header, summary, chart, coverage, and CTA treatment | Simple route controls and screenshot | R3.1 |
| `523:158` | Simple Calories / 7D | `[metric].tsx` | 7D query works | PARTIAL | 7D Simple composition and current-period treatment are absent | Rolling 7D semantics and chart | 7D Simple presentation | 7D labels and compact layout | 7D fixture and 320pt screenshot | R3.1 |
| `523:286` | Simple Calories / 90D | `[metric].tsx` | 90D query works | PARTIAL | 90D Simple composition and long-range treatment are absent | Rolling 90D semantics and aggregation | 90D Simple presentation | Long-range chart/readout and coverage layout | 90D fixture and responsive screenshot | R3.1 |
| `523:429` | Simple Macros | `[metric].tsx` and `macro-chart.tsx` | Macro metric is reachable | PARTIAL | No approved Simple macro card, composition, or shared visual hierarchy | Macro facts and existing chart | Simple macro report | Macro balance card and legend | Macro fixture and screenshot | R3.3 |
| `523:526` | Simple Weight | `[metric].tsx` | Weight metric is reachable | PARTIAL | No approved Simple weight direction card or summary | Weight facts and range selection | Simple weight report | Direction, target, and chart treatment | Weight fixture and screenshot | R3.2 |
| `523:610` | Simple Logging consistency | `[metric].tsx` and `heatmap-chart.tsx` | Heatmap metric is reachable | PARTIAL | No approved Simple completeness/phase presentation | Logging semantics and heatmap | Simple logging report | Legend, current-day state, and copy | State fixture and screenshot | R3.4 |
| `523:725` | Simple Hydration | `[metric].tsx`; `water-log.tsx` | Hydration trend and logger both exist | PARTIAL | No approved Simple hydration card or canonical CTA continuity | Water persistence and hydration facts | Simple hydration report and shared CTA | Visual hydration scale, target, and Add Water action | Cross-entrypoint water test and screenshot | R3.5, R8.1 |

### Responsive and state references

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `490:21` | Complex Insights / 320 | Complex `insights.tsx` | Generic layout is width-aware through `useWindowDimensions` | PLACEHOLDER | Generic rows do not establish the final 320pt card hierarchy or truncation rules | Existing width query and shared spacing tokens | Explicit 320pt layout rules | Compact typography, wrapping, card padding, and hit targets | 320pt screenshot and text truncation assertions | R11.1 |
| `490:319` | Calories Trends / 320 | `[metric].tsx` | Chart width is calculated from window width | PARTIAL | Generic chart shell lacks final 320pt labels, controls, and card density | Width calculation, chart geometry, and null-gap handling | Responsive trend composition | 320pt axis/readout, controls, and card padding | 320pt screenshot and overflow test | R11.1 |
| `492:21` | Insights / Large Type stress | `insights.tsx` shared text | No explicit Large Type layout test | PARTIAL | Long text and dynamic card content can collide because rows are generic and cards are not constrained | React Native dynamic text and accessibility labels | Large-Type-specific wrapping and minimum heights | Text hierarchy, wrapping, and action placement | Large-Type simulator/manual checklist and test fixtures | R11.1 |
| `492:319` | Calories / Large Type stress | `[metric].tsx` | Generic labels use shared text components | PARTIAL | Axis/readout and control layout have no approved Large-Type constraints | Chart accessibility selection and shared text | Large-Type chart labels and control wrapping | Axis/readout placement and chip wrapping | Large-Type screenshot and accessibility test | R11.1 |
| `477:21` | Motion skeleton loading | Insights/trends loading branches | Loading state uses existing generic skeleton/loading components | PARTIAL | No screen-specific skeleton composition matching final card geometry | Existing loading status and skeleton primitives | Per-card skeletons with stable layout | Card-shaped skeletons, spacing, and motion treatment | Loading fixture and no-layout-shift screenshot | R11.1 |
| `510:437` | Refresh pending / committed data visible | `analytics-resource.ts`; `insights.tsx` refresh | Resource preserves value while refreshing | PARTIAL | UI does not consistently expose pending state while committed sections remain visible | Reducer commit/refresh behavior and AppScreen refresh control | Explicit pending treatment per report/section | Pending indicator, retained cards, and disabled retry state | Refresh transition test and screenshot | R10.3, R11.1 |
| `510:467` | Refresh failed / stale data preserved | `analytics-resource.ts`; Insights error branches | Resource preserves value on failure | PARTIAL | Error copy is report-level and does not mark the affected section while preserving healthy refreshed siblings | Stale value preservation and cache fallback | Section stale/error state and retry action | Stale marker, inline error, and unaffected sibling layout | Failure injection and state transition tests | R10.3, R11.1 |
| `495:21` | First-use analytics | `insights.tsx` empty branch | Empty state exists for no canonical sections | PARTIAL | No guided first-use explanation, approved action path, or mode-specific composition | Empty detection and navigation to logging surfaces | First-use state with real data boundary | Illustration/quiet copy, CTA, and period context | Empty fixture and CTA deep-link test | R11.1 |
| `492:455` | Current period in progress | Backend logging phase plus generic UI | Phase is computed but not presented in final hierarchy | PARTIAL | No current-day indicator/legend in overview and logging cards | `closed`/`in_progress` semantics and current-bucket calculation | Current-period presentation | Indicator, label, and explanatory copy | Current-day fixture, timezone, and screenshot | R11.1 |
| `492:753` | Section-level error | Insights API route and mobile parser | Route `Promise.all` rejects the entire report; no section error envelope | BROKEN | A Hydration or other metric exception prevents healthy sections and cannot render an inline error | Per-metric diagnostic logging and partial schema shape | End-to-end section failure contract, retry, stale retention, and isolated rendering | Inline section error card and healthy-sibling layout | Eight core metric injections plus nutrient/comparison/forecast/pinned/recommendation failures | R10.1–R10.5 |
| `477:141` | Full analytics unavailable | `insights.tsx` error/empty branches | Generic error state exists | PARTIAL | No report-level unavailable state distinguished from a section failure or cache fallback | Auth/network/error handling and cache reads | Explicit report-level state classification and retry | Full unavailable composition and recovery CTA | Auth/network/parser/database failure fixtures | R10.1, R11.1 |
| `492:1058` | Forecast unavailable | `[metric].tsx` forecast branch | Generic forecast copy can render when forecast is absent | PARTIAL | No forecast-specific unavailable card while base trend remains visible | Forecast policy and base trend continuity | Dedicated forecast unavailable state | Inline explanation, base-trend continuity, and retry/education copy | Ineligible/insufficient-data tests | R11.2 |
| `492:1097` | Active scrub | `chart-selection-overlay.tsx`, chart primitives | Haptic scrub and accessibility selection exist | PARTIAL | Selected value/readout and guide treatment are not composed per final metric reports | Gesture geometry, haptic call, null gaps, and selection state | Metric-specific readout and active guide | Selected marker, tooltip/readout, labels, and haptic affordance | Gesture unit tests, accessibility action tests, and physical iPhone check | R3.6, R11.3 |
| `492:1279` | Offline cached analytics | `analytics-cache.ts`, `analytics-resource.ts`, Insights | Whole-report cache and stale resource exist | PARTIAL | No explicit offline cached report state, per-section freshness, or safe user-facing copy | UID cache isolation, atomic writes, stale fallback, and committed retention | Versioned section-aware offline cache state | Offline banner/label, freshness context, and retry action | Cache migration, offline screen, and failure tests | R10.3, R11.1 |

### Hydration and sheets

| Figma node | Final screen/state name | Current route/component | Current implementation status | Classification | Specific differences | Existing functionality worth preserving | Missing functionality | Missing visual treatment | Testing implications | Planned recovery task |
|---|---|---|---|---|---|---|---|---|---|---|
| `440:28` | Log water / 390 | `apps/mobile/src/app/water-log.tsx` | Water-only amount/time CRUD and history exist | PARTIAL | No canonical quick amounts, visual water state, selected amount, or Add Water CTA composition | Amount/time persistence, unit conversion, edit/delete, validation, and API flow | Canonical logger sheet/screen and quick amount continuity | Water visual, selected amount, CTA, history rows, and spacing | Create/edit/delete, quick amount, Other Amount, and screenshot | R8.1 |
| `490:550` | Responsive Log water / 320 | `water-log.tsx` | Form uses shared width and text components | PARTIAL | No verified 320pt sheet layout, quick amount wrapping, or history truncation | Water behavior and shared form controls | Explicit 320pt logger layout | Compact controls, hit targets, and history density | 320pt screenshot and overflow tests | R8.2 |
| `490:455` | Responsive Custom range / 320 | `custom-range.tsx` | Date controls and rail helpers exist | PARTIAL | Approved rail/sheet controls are not verified at 320pt | Date eligibility and pure rail geometry | Responsive handle/calendar composition | Rail labels, sheet padding, and CTA placement | 320pt gesture/screenshot test | R6.1, R11.1 |
| `490:496` | Responsive Compare picker / 320 | `configure.tsx` embedded metric buttons | No dedicated compare picker exists | PLACEHOLDER | Embedded rows do not provide a 320pt picker surface or compatibility messaging | Backend compatibility validation and draft state | Dedicated responsive picker | Compact rows, selected state, and copy | 320pt picker fixture and interaction test | R5.2 |
| `492:1236` | Responsive Saved Views long-name stress / 320 | `saved-views.tsx` flat rows | Names are limited to two lines in the current list | PARTIAL | No card/reorder/action-menu layout or verified long-name behavior | Saved-view identity and lifecycle operations | Stable long-name layout and action placement | Truncation/wrapping, cards, and hit targets | Long-name fixture at 320pt and Large Type | R7.2, R11.1 |

### Audit counts

- FAITHFUL: `0`
- MINOR DRIFT: `0`
- PARTIAL: `49`
- PLACEHOLDER: `11`
- MISSING: `6`
- BROKEN: `1`

The absence of FAITHFUL and MINOR DRIFT classifications is intentional: every final node either has a material composition/state gap, lacks a dedicated production route, or is blocked by the current all-or-nothing report contract.

## 2. Implementation architecture

### Route and component boundaries

The recovery must not grow `insights.tsx` or `[metric].tsx` into a second monolith. Keep these routes responsible for query parameters, navigation, resource subscription, and composition selection. Create focused components under the existing mobile component convention:

- `apps/mobile/src/components/analytics/insights/insights-period-summary.tsx`: Week/Month controls, period label, and summary facts.
- `apps/mobile/src/components/analytics/insights/energy-balance-card.tsx`: Calories summary, target context, and chart slot.
- `apps/mobile/src/components/analytics/insights/macro-balance-card.tsx`: Macro composition, totals, legend, and chart slot.
- `apps/mobile/src/components/analytics/insights/nutrient-highlights-card.tsx`: Highlighted nutrients and reference-state labels.
- `apps/mobile/src/components/analytics/insights/hydration-insights-card.tsx`: Hydration summary, target, state, and Log Water action.
- `apps/mobile/src/components/analytics/insights/weight-direction-card.tsx`: Weight direction, reference, and forecast entry.
- `apps/mobile/src/components/analytics/insights/logging-consistency-card.tsx`: Completeness heatmap, phase, legend, and copy.
- `apps/mobile/src/components/analytics/insights/recommendations-card.tsx`: Deterministic recommendations with isolated loading/error/empty states.
- `apps/mobile/src/components/analytics/insights/pinned-analysis-card.tsx`: Compact pinned preview, Manage action, and isolated preview error.
- `apps/mobile/src/components/analytics/insights/analytics-section-error.tsx`: User-safe retryable section error with no HTTP class, request ID, cache, parser, reducer, or backend diagnostic details.
- `apps/mobile/src/components/analytics/insights/insights-tabs.tsx`: Complex Overview/Nutrients/Recommendations navigation.
- `apps/mobile/src/components/analytics/trends/trend-report-header.tsx`: Metric identity, range controls, Configure/Save affordances, and mode boundary.
- `apps/mobile/src/components/analytics/trends/trend-summary-card.tsx`: Metric-specific summary facts and reference context.
- `apps/mobile/src/components/analytics/trends/trend-coverage-card.tsx`: Logging completeness separate from metric availability.
- `apps/mobile/src/components/analytics/trends/trend-contributors-card.tsx`: Contributor entry and summary.
- `apps/mobile/src/components/analytics/trends/nutrient-reference-summary.tsx`: Target, minimum, limit, true range, and unknown reference state.
- `apps/mobile/src/components/analytics/trends/nutrient-data-state.tsx`: Recorded, partial, and unknown presentation.
- `apps/mobile/src/components/analytics/trends/metric-specific-report.tsx`: Explicit dispatch to Calories, Macros, Weight, Hydration, Logging consistency, and nutrient report compositions. It must not contain every metric’s full JSX.
- `apps/mobile/src/components/analytics/trends/trend-card.tsx`: Shared card frame only; metric-specific content remains in focused children.

Existing chart primitives remain below these components. New components consume canonical response facts and do not calculate nutrition, analytics, recommendations, forecast eligibility, or reference values.

### Section-aware contract and state

Create `packages/shared/src/analytics-insights.ts` and export it from the shared package. Preserve the existing `CanonicalTrendResponse` data shape. Add a versioned result envelope:

```ts
type AnalyticsSectionKey =
  | 'calories'
  | 'protein'
  | 'carbs'
  | 'fat'
  | 'macroComposition'
  | 'weight'
  | 'hydration'
  | 'loggingConsistency';

type AnalyticsSectionResult =
  | { status: 'available'; data: CanonicalTrendResponse; fetchedAt: string }
  | { status: 'failed'; code: 'section_unavailable'; retryable: true };

interface CanonicalInsightsResponseV2 {
  contractVersion: 2;
  mode: 'simple' | 'complex';
  period: 'week' | 'month';
  sections: Partial<Record<AnalyticsSectionKey, AnalyticsSectionResult>>;
}
```

The public failure code is intentionally generic. Server logs may retain safe operational context behind the existing diagnostics gate, but the mobile contract must not expose internal error categories or identifiers.

Implement `apps/mobile/src/lib/analytics/analytics-report-resource.ts` as a report-specific resource rather than stretching the single-value resource into undocumented behavior. It owns:

- report-level `loading`, `ready`, `refreshing`, `stale`, and `error` state;
- committed per-section data;
- per-section pending/error/stale flags;
- atomic replacement of successful sections;
- retention of a previously committed section when its replacement fails;
- section retry that does not blank healthy siblings;
- parser failure as a report-level error;
- offline cache hydration as committed stale data.

### Safe cache migration

Keep the existing cache writer, serialization lock, purge barrier, UID path, and replacement protocol. Add a `contractVersion: 2` discriminator and use `insights-v2-week` and `insights-v2-month` keys. Do not overwrite v1 files in place.

On read, accept a valid v2 payload. A valid v1 whole-report payload may be normalized into `available` section results and written to the v2 key after validation; a malformed, user-mismatched, schema-invalid, or partially ambiguous v1 payload is discarded without touching valid v2 data. On write, write a complete candidate to a temporary file, validate it, atomically replace the v2 key, and keep the previous valid v2 entry if replacement fails. Purge remains coordinated with active writes. Add tests proving v1-to-v2 normalization, invalid-v1 isolation, concurrent writes, failed replacement, signout purge, account-delete purge, and stale retention.

### Backend fault isolation

Refactor `apps/api/src/modules/analytics/trends/routes.ts` and the supporting service so that report context failures remain report-level while section computation failures become `AnalyticsSectionResult.status = 'failed'`. Do not solve this by changing one `Promise.all` call to `Promise.allSettled`.

- Load authentication, identity, mode, period, and required global configuration first. Failure here returns the existing report-level error path.
- Keep independent data-source outcomes for food logs, water logs, weight logs, and nutrient/reference inputs. A water-source failure must not reject calories or logging sections.
- Wrap each section calculator in an explicit typed outcome function with an injectable calculator map in tests. Each of the eight core sections must have an independent failure-injection test.
- Keep optional forecast, comparison, pinned-preview, nutrient-detail, contributor, and recommendation work out of the base report transaction. Their failure affects only their owning UI section or route.
- Preserve existing canonical metric availability and logging-day semantics. The response may omit a failed section or return the explicit failed result, but the parser and reducer must treat it as a section failure, never as zero data.

## 3. Execution plan

Each task below is a future implementation commit boundary. The current PLAN MODE session will commit only this document. Every RED command is expected to fail before the task implementation and pass after the task is complete.

### Recovery Slice 0 — guardrails and fidelity harness

#### R0.1 — Establish fixtures, Figma capture ledger, and screen regression harness

- [ ] Files to create: `apps/mobile/src/test-fixtures/analytics-fixtures.ts`, `apps/mobile/src/test-fixtures/analytics-state-fixtures.ts`, `apps/api/test/fixtures/analytics-section-fixtures.ts`, `docs/superpowers/phase-17-5-fidelity-capture-ledger.md`.
- [ ] Files to modify: existing mobile analytics screen test files discovered by `rg --files apps/mobile/src | rg 'test|spec'`, existing API analytics fixture imports, and no production route.
- [ ] Interfaces consumed: `CanonicalInsightsResponse`, `CanonicalTrendResponse`, `AnalyticsMetricKey`, nutrient reference types, logging-day states, saved-view query types, and water log types.
- [ ] Interfaces produced: deterministic Simple/Complex overview fixtures, 390pt/320pt/Large-Type fixture data, section-failure fixtures, Figma node-to-test mapping, and a screenshot acceptance checklist.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/test-fixtures/analytics-fixtures.test.ts`; expected failure: the fixture module and required state assertions do not exist.
- [ ] Implementation: encode real-shaped fixtures only; include complete/partial/unlogged/in-progress logging days, recorded/partial/unknown metric coverage, true range/one-bound/no-bound references, sparse Vitamin D, saved names longer than two lines, forecast unavailable, stale cached data, and each final state node. Do not add screenshot-only fake facts to production code.
- [ ] GREEN test: the fixture tests assert exact canonical values, unknown is not zero, missing nutrient data does not alter logging state, and Simple excludes Complex-only capabilities.
- [ ] Regression validation: run the existing analytics contract, range, coverage, reference, saved-view, forecast, water, and chart tests without changing their expectations.
- [ ] Commit boundary: `test: add Phase 17.5 fidelity fixtures and capture ledger`.

#### R0.2 — Define the section-aware shared contract without changing presentation

- [ ] Files to create: `packages/shared/src/analytics-insights.ts`, `apps/mobile/src/lib/analytics/analytics-report-resource.ts`, `apps/mobile/src/lib/analytics/analytics-report-resource.test.ts`, `apps/api/test/analytics-insights-contract-v2.test.ts`.
- [ ] Files to modify: `packages/shared/src/index.ts`, `packages/shared/src/analytics-trends.ts` only where the existing response type must be re-exported or versioned, `apps/mobile/src/lib/analytics/analytics-cache-runtime.ts`, and the package export map if required by current conventions.
- [ ] Interfaces consumed: existing canonical trend schemas, cache entry validation, `AnalyticsResourceState`, and API response parsing.
- [ ] Interfaces produced: `CanonicalInsightsResponseV2`, `AnalyticsSectionResult`, `AnalyticsReportResourceState`, section reducer actions, v2 cache keys, and user-safe section error mapping.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-report-resource.test.ts && corepack pnpm --filter @food-tracker/api test -- analytics-insights-contract-v2.test.ts`; expected failure: no v2 schema, reducer, or section-state behavior exists.
- [ ] Implementation: add strict Zod validation, report-level versus section-level discriminators, section retry actions, committed-value retention, and v1-to-v2 cache normalization rules described above. Keep the current whole-report resource and cache behavior unchanged until Slice 10 wires the new route.
- [ ] GREEN test: parse available, failed, malformed, and mixed responses; prove a failed replacement retains committed data; prove parser failure is report-level; prove the v2 key does not overwrite v1.
- [ ] Regression validation: run `analytics-resource.test.ts`, `analytics-cache.test.ts`, cache filesystem tests, auth bootstrap purge tests, and all shared typecheck tests.
- [ ] Commit boundary: `feat: define versioned section-aware analytics contract`.

### Recovery Slice 1 — Insights Simple and Complex

#### R1.1 — Recover the Simple Insights overview composition

- [ ] Files to create: `apps/mobile/src/components/analytics/insights/insights-period-summary.tsx`, `energy-balance-card.tsx`, `macro-balance-card.tsx`, `nutrient-highlights-card.tsx`, `hydration-insights-card.tsx`, `weight-direction-card.tsx`, `logging-consistency-card.tsx`, `analytics-section-error.tsx`, and `apps/mobile/src/components/analytics/insights/__tests__/simple-insights-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/(tabs)/insights.tsx`, `apps/mobile/src/components/analytics/insights/insights-report-content.tsx` only if a legacy primitive can be adapted to canonical facts, and existing shared card/token files where a documented token is missing.
- [ ] Interfaces consumed: canonical Simple report sections, period controls, resource state, `CanonicalTrendResponse`, nutrient reference/data-state facts, logging-day phase, hydration facts, and navigation callbacks.
- [ ] Interfaces produced: explicit `SimpleInsightsOverview` component props and stable card-level loading/error/empty boundaries.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/insights/__tests__/simple-insights-fidelity.test.tsx`; expected failure: the current flat `CanonicalInsightsContent` lacks the required cards and test IDs/accessibility labels.
- [ ] Implementation: replace the conflicting flat production renderer with explicit card composition. Preserve real canonical values and existing chart primitives. Add period summary, energy balance, macro balance, nutrient highlights, hydration, weight direction, logging consistency, recommendations entry, and Explore trends entry. Keep Simple capability boundaries exact.
- [ ] GREEN test: render the complete fixture and assert card order, real values, Simple-only controls, all loading/error/empty states, and Log Water/Explore navigation. Snapshot or screenshot-review against `338:98` at 390pt.
- [ ] Regression validation: existing Insights, canonical schema, recommendation, cache, and chart tests; `typecheck`; manual 390pt scroll and VoiceOver-label check.
- [ ] Commit boundary: `feat: recover Simple Insights reporting composition`.

#### R1.2 — Recover Complex Overview, Nutrients, Recommendations, and pinned analysis

- [ ] Files to create: `apps/mobile/src/components/analytics/insights/insights-tabs.tsx`, `recommendations-card.tsx`, `pinned-analysis-card.tsx`, `complex-insights-overview.tsx`, `complex-insights-nutrients.tsx`, `complex-insights-recommendations.tsx`, and `apps/mobile/src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/(tabs)/insights.tsx`, existing `complete-nutrient-report.tsx` only when it is adapted to canonical section facts, and the current pinned-view test.
- [ ] Interfaces consumed: Complex report sections, saved-view summary/pinned query, recommendations resource, nutrient summary, navigation, and section error/retry props.
- [ ] Interfaces produced: Overview/Nutrients/Recommendations tab state, compact `PinnedAnalysisCard` props with Manage callback, and isolated recommendation/pinned error boundaries.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx`; expected failure: no approved tab composition, pinned compact card, or tab-local states exist.
- [ ] Implementation: build `338:276`, `361:39`, `361:104`, and `450:22` from real data. Keep the pinned card compact and integrated, expose Manage, and do not render a giant generic standalone chart. Use the final Nutrients tab as the entry into the library, and keep Recommendations deterministic.
- [ ] GREEN test: assert tab navigation, card order, pinned Manage path, recommendation state isolation, no Complex controls in Simple, and no fake values. Review exact Figma screenshots at 390pt.
- [ ] Regression validation: pinned Insights, recommendations, saved-view deep-link, nutrient summary, cache stale state, and accessibility tests.
- [ ] Commit boundary: `feat: recover Complex Insights tabs and pinned analysis`.

### Recovery Slice 2 — Explore surfaces and nutrient library

#### R2.1 — Recover Simple curated Explore

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/explore-curated.tsx` and `apps/mobile/src/components/analytics/trends/__tests__/explore-curated-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/index.tsx`.
- [ ] Interfaces consumed: Simple metric allow-list, metric registry labels/descriptions, preferred metric preference, 7D/30D/90D range navigation, and search state only if the final Simple surface exposes it.
- [ ] Interfaces produced: curated grouped rows and preferred-trend navigation props.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/explore-curated-fidelity.test.tsx`; expected failure: current route renders flat rows and lacks `Energy & macros` and `Body & habits` card hierarchy.
- [ ] Implementation: match `520:21`, including back navigation, explanatory copy, preferred trend, curated groups, and the approved Simple capability footer. Do not expose custom range, comparisons, saved-view manager, nutrient library, or Configure.
- [ ] GREEN test: assert exact Simple metric set, group order, preferred route, 7D/30D/90D availability, and absent Complex actions.
- [ ] Regression validation: current catalog/search/deep-link tests and 390/320 manual review.
- [ ] Commit boundary: `feat: recover curated Simple trend Explore`.

#### R2.2 — Recover Complex Explore and Saved Views entry

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/explore-all.tsx` and `apps/mobile/src/components/analytics/trends/__tests__/explore-all-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/index.tsx`.
- [ ] Interfaces consumed: full metric catalog, search helper, pinned saved-view summary, saved-view Manage route, category metadata, and Complex capability flags.
- [ ] Interfaces produced: grouped Explore cards, saved-view preview, Manage navigation, and search/category state.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/explore-all-fidelity.test.tsx`; expected failure: no Saved Views card, Nutrients entry, or grouped Complex catalog exists.
- [ ] Implementation: match `364:21`, including search, Saved Views card, pinned preview, Manage path, Energy & macros, Nutrients, Body & habits, and supporting copy.
- [ ] GREEN test: assert search result navigation, pinned preview state, Manage route, Complete nutrient report route, and all grouped metric entries.
- [ ] Regression validation: saved-view routing, nutrient search helper, metric catalog, and Complex mode tests.
- [ ] Commit boundary: `feat: recover Complex trend Explore`.

#### R2.3 — Recover the dedicated nutrient library and search/category states

- [ ] Files to create: `apps/mobile/src/app/trends/nutrients/index.tsx`, `apps/mobile/src/app/trends/nutrients/search.tsx` only if the existing router convention requires a separate search route, `apps/mobile/src/components/analytics/nutrients/nutrient-library.tsx`, `nutrient-search-field.tsx`, `nutrient-category-section.tsx`, and `apps/mobile/src/components/analytics/nutrients/__tests__/nutrient-library-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/index.tsx`, `apps/mobile/src/components/complete-nutrient-report.tsx` when sharing category/needs-attention primitives, and router link definitions.
- [ ] Interfaces consumed: nutrient catalog, categories, counts, `nutrient-search.ts`, reference/data-state facts, and metric deep links.
- [ ] Interfaces produced: Complete nutrient report route, query state for `vit` and `vit c`, Vitamins category state, and detail navigation.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/nutrient-library-fidelity.test.tsx`; expected failure: the route, search field, category sections, and needs-attention card do not exist.
- [ ] Implementation: match `424:21`, `424:67`, `424:116`, and `424:138`. Use real catalog data and canonical states. Do not duplicate metric definitions in the UI.
- [ ] GREEN test: assert needs-attention ordering, category counts, `vit`/`vit c` results, Vitamins category navigation, empty/unknown states, and back navigation.
- [ ] Regression validation: nutrient search, registry uniqueness, reference semantics, and Complex-only route gating.
- [ ] Commit boundary: `feat: add canonical nutrient library surfaces`.

### Recovery Slice 3 — Core trend detail system

#### R3.1 — Recover Calories masters, Simple variants, and forecast composition

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/calories-report.tsx`, `calories-summary-card.tsx`, `calories-forecast-card.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/calories-report-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/[metric].tsx`, `trend-chart-renderer.tsx` only for explicit props needed by the approved composition, and existing forecast chart tests.
- [ ] Interfaces consumed: canonical Calories trend, range/aggregation facts, coverage, references, contributors summary, forecast result, chart geometry, and Simple/Complex mode.
- [ ] Interfaces produced: Calories report props for 7D/30D/90D/Custom and forecast unavailable state.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/calories-report-fidelity.test.tsx`; expected failure: generic detail lacks approved summary, axes/readout, coverage card, contributor entry, and forecast composition.
- [ ] Implementation: match `338:469`, `363:21`, `363:177`, `449:177`, `523:21`, `523:158`, and `523:286`. Keep range semantics and chart primitives. Add selected readout and 7D/30D/90D/Custom controls only where allowed.
- [ ] GREEN test: assert metric-specific card order, real average/reference/coverage values, forecast continuity, unavailable forecast preserving the base trend, and Simple absence of Configure/Save/Custom/arbitrary comparison.
- [ ] Regression validation: trend range, forecast policy, chart geometry, scrub, custom-range navigation, and no-future tests.
- [ ] Commit boundary: `feat: recover Calories trend reports`.

#### R3.2 — Recover Weight report and direction/forecast treatment

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/weight-report.tsx`, `weight-direction-card.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/weight-report-fidelity.test.tsx`.
- [ ] Files to modify: `[metric].tsx` dispatch and forecast chart props only.
- [ ] Interfaces consumed: Weight trend, references, coverage, forecast policy/result, and selected chart state.
- [ ] Interfaces produced: Weight-specific report composition for Simple and Complex.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/weight-report-fidelity.test.tsx`; expected failure: Weight uses the generic line report and lacks direction/reference/forecast cards.
- [ ] Implementation: match `338:605` and `523:526`; keep Weight forecast independent from Calories and keep unavailable forecast local.
- [ ] GREEN test: assert direction summary, target/reference state, chart selection, forecast continuity, and Simple controls.
- [ ] Regression validation: Weight backend, reference, coverage, range, forecast, and chart tests.
- [ ] Commit boundary: `feat: recover Weight trend reports`.

#### R3.3 — Recover Macro reports and shared-unit presentation

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/macros-report.tsx`, `macro-balance-summary.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/macros-report-fidelity.test.tsx`.
- [ ] Files to modify: `[metric].tsx`, `macro-chart.tsx` only for presentation props, and comparison chart tests.
- [ ] Interfaces consumed: macro composition response, Protein/Carbs/Fat trends, shared-unit comparison data, references, and chart selection.
- [ ] Interfaces produced: Simple Macro report and Complex shared-unit comparison composition.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/macros-report-fidelity.test.tsx`; expected failure: generic macro chart lacks the final balance card, legend, shared-unit summary, and metric-specific layout.
- [ ] Implementation: match `338:720` and `523:429`; preserve canonical macro facts and do not recalculate ratios in mobile.
- [ ] GREEN test: assert macro card/legend order, shared units, comparison labels, and Simple capability boundary.
- [ ] Regression validation: macro chart, comparison compatibility, fixed-axis, and canonical macro tests.
- [ ] Commit boundary: `feat: recover Macro trend reports`.

#### R3.4 — Recover Logging consistency reports

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/logging-consistency-report.tsx`, `logging-day-state-legend.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/logging-consistency-report-fidelity.test.tsx`.
- [ ] Files to modify: `[metric].tsx`, `heatmap-chart.tsx` only for explicit labels/selection props.
- [ ] Interfaces consumed: logging-day classifier, `closed`/`in_progress` phase, complete/partial/unlogged states, heatmap geometry, and coverage copy.
- [ ] Interfaces produced: Simple/Complex logging report with current-day treatment and legend.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/logging-consistency-report-fidelity.test.tsx`; expected failure: generic heatmap has no final legend, phase label, or explanatory card.
- [ ] Implementation: match `338:928` and `523:610`; keep logging completeness independent from nutrient metric availability.
- [ ] GREEN test: assert all three logging states, current in-progress phase, no nutrient-driven state changes, and selected-day behavior.
- [ ] Regression validation: logging classifier/policy, current-day, timezone, heatmap geometry, and accessibility tests.
- [ ] Commit boundary: `feat: recover Logging consistency reports`.

#### R3.5 — Recover Hydration trend composition and shared water CTA

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/hydration-report.tsx`, `hydration-target-card.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/hydration-report-fidelity.test.tsx`.
- [ ] Files to modify: `[metric].tsx`, `insights` hydration card imports, and the water navigation helper if a single route callback is needed.
- [ ] Interfaces consumed: canonical Hydration trend, water totals, `2000 mL/day` default, water log route, and section state.
- [ ] Interfaces produced: Hydration report composition for `426:159` and `523:725`, with a shared Log Water action.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/hydration-report-fidelity.test.tsx`; expected failure: hydration and water are separate generic surfaces with no approved trend/card composition.
- [ ] Implementation: build the visual target summary and trend from canonical data; keep `waterTrackingEnabled` from hiding the section; use one navigation/persistence path.
- [ ] GREEN test: assert default goal, current totals, missingness, CTA route, and Simple/Complex visibility.
- [ ] Regression validation: hydration analytics, water API, cache, and existing water-log tests.
- [ ] Commit boundary: `feat: recover Hydration trend reports`.

#### R3.6 — Compose shared trend headers, cards, coverage, and active scrub

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/trend-report-header.tsx`, `trend-summary-card.tsx`, `trend-coverage-card.tsx`, `trend-contributors-card.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/trend-report-shell.test.tsx`.
- [ ] Files to modify: `[metric].tsx`, `chart-selection-overlay.tsx`, `line-trend-chart.tsx`, `bar-trend-chart.tsx` only for tested readout/guide props.
- [ ] Interfaces consumed: metric-specific report props, chart selection state, coverage/metric availability distinction, and navigation actions.
- [ ] Interfaces produced: stable report shell used by Calories, Macros, Weight, Hydration, Logging consistency, and nutrients.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/trend-report-shell.test.tsx`; expected failure: no shared shell exposes the final header, card, coverage, contributor, and active scrub contracts.
- [ ] Implementation: centralize only the shell responsibilities. Add selected date/value presentation and accessibility actions without moving metric calculations into the client.
- [ ] GREEN test: assert shell slots, Simple/Complex controls, section order, null gaps, haptics callback, accessibility selection, and no duplicate business calculations.
- [ ] Regression validation: all chart component tests, geometry tests, and physical scrub checklist.
- [ ] Commit boundary: `feat: compose final trend report shell and selection state`.

### Recovery Slice 4 — nutrient depth

#### R4.1 — Recover nutrient references, goal depth, and true-range details

- [ ] Files to create: `apps/mobile/src/components/analytics/nutrients/nutrient-reference-summary.tsx`, `nutrient-goal-depth-card.tsx`, `apps/mobile/src/components/analytics/nutrients/__tests__/nutrient-reference-fidelity.test.tsx`.
- [ ] Files to modify: `[metric].tsx`, `metric-specific-report.tsx`, `complete-nutrient-report.tsx` where canonical facts can replace legacy data adapters.
- [ ] Interfaces consumed: target/minimum/limit/lower/upper references, nutrient trend, coverage, and metric data state.
- [ ] Interfaces produced: explicit reference-type presentation and true-range state.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/nutrient-reference-fidelity.test.tsx`; expected failure: generic reference copy does not distinguish all required states.
- [ ] Implementation: render a true range only when both authoritative bounds exist; render target, minimum, limit, one-bound, and unknown states explicitly; never infer a bound.
- [ ] GREEN test: assert all reference permutations, no fabricated half-range, no nutrient zero-fill, and approved `425:21`/`338:814` treatment.
- [ ] Regression validation: backend/shared reference tests and canonical missingness tests.
- [ ] Commit boundary: `feat: recover nutrient reference and goal-depth states`.

#### R4.2 — Recover related metrics and nutrient pair details

- [ ] Files to create: `apps/mobile/src/components/analytics/nutrients/related-metric-card.tsx`, `nutrient-pair-report.tsx`, `apps/mobile/src/components/analytics/nutrients/__tests__/related-nutrient-fidelity.test.tsx`.
- [ ] Files to modify: `metric-specific-report.tsx`, `[metric].tsx`, and related-metric route helpers.
- [ ] Interfaces consumed: related metric metadata, nutrient references, canonical detail data, and deep-link navigation.
- [ ] Interfaces produced: Sodium/Potassium and Iron/Vitamin C pair sections.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/related-nutrient-fidelity.test.tsx`; expected failure: generic details have no approved related-metric composition.
- [ ] Implementation: match `425:92` and `426:21`, including Sodium limit emphasis, Iron reference context, and related navigation.
- [ ] GREEN test: assert pair labels, limit/range semantics, navigation, and failure isolation when the related metric is unavailable.
- [ ] Regression validation: related metric catalog, comparison compatibility, and nutrient routing tests.
- [ ] Commit boundary: `feat: recover related nutrient detail reports`.

#### R4.3 — Recover amino-acid profile and Leucine detail

- [ ] Files to create: `apps/mobile/src/components/analytics/nutrients/amino-acid-profile.tsx`, `leucine-detail.tsx`, `apps/mobile/src/components/analytics/nutrients/__tests__/amino-acid-fidelity.test.tsx`.
- [ ] Files to modify: nutrient library category navigation and `metric-specific-report.tsx`.
- [ ] Interfaces consumed: amino-acid metric definitions, Leucine canonical trend, references, coverage, and contributors route.
- [ ] Interfaces produced: profile list/visualization and Leucine-specific detail.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/amino-acid-fidelity.test.tsx`; expected failure: no profile component or Leucine-specific composition exists.
- [ ] Implementation: match `426:89` and `429:83`; use registry data and the same reference/data-state components as other nutrients.
- [ ] GREEN test: assert amino-acid category, Leucine route, sparse/unknown handling, and contributor navigation.
- [ ] Regression validation: nutrient registry, search, references, and canonical trend tests.
- [ ] Commit boundary: `feat: recover amino-acid nutrient reports`.

#### R4.4 — Recover sparse coverage and nutrient data-state presentation

- [ ] Files to create: `apps/mobile/src/components/analytics/nutrients/nutrient-data-state.tsx`, `nutrient-sparse-state.tsx`, `apps/mobile/src/components/analytics/nutrients/__tests__/nutrient-state-fidelity.test.tsx`.
- [ ] Files to modify: nutrient detail and library components.
- [ ] Interfaces consumed: `recorded`/`partial`/`unknown`, null trend points, reference availability, and section retry state.
- [ ] Interfaces produced: shared state component for `429:21` and `426:243`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/nutrient-state-fidelity.test.tsx`; expected failure: current UI reduces these states to generic copy.
- [ ] Implementation: give Vitamin D sparse data a dedicated state while keeping available points; keep unknown distinct from zero; expose retry only when the owning section can retry.
- [ ] GREEN test: assert recorded/partial/unknown, sparse points, no zero substitution, and local error rendering.
- [ ] Regression validation: metric coverage, chart null-gap, schema, and cache tests.
- [ ] Commit boundary: `feat: recover nutrient coverage and sparse states`.

#### R4.5 — Recover contributors sheet and source explanation

- [ ] Files to create: `apps/mobile/src/components/analytics/nutrients/contributors-sheet.tsx`, `contributors-progress.tsx`, `apps/mobile/src/components/analytics/nutrients/__tests__/contributors-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/contributors.tsx`.
- [ ] Interfaces consumed: contributor API response, nutrient/metric context, totals, source names, and modal navigation.
- [ ] Interfaces produced: canonical contributor sheet matching `426:215`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/nutrients/__tests__/contributors-fidelity.test.tsx`; expected failure: current page is a flat action/list view.
- [ ] Implementation: add approved sheet behavior, progress visualization, context, source explanation, loading, empty, and error states.
- [ ] GREEN test: assert contributions sum/display correctly from API facts, source rows, dismiss behavior, and local failure state.
- [ ] Regression validation: contributor backend tests, navigation, and accessibility.
- [ ] Commit boundary: `feat: recover nutrient contributor sheet`.

### Recovery Slice 5 — comparisons and configuration

#### R5.1 — Recover Configure Trend sheet and selectors

- [ ] Files to create: `apps/mobile/src/components/analytics/configure/configure-trend-sheet.tsx`, `selector-row.tsx`, `coverage-selector.tsx`, `aggregation-selector.tsx`, `apps/mobile/src/components/analytics/configure/__tests__/configure-trend-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/configure.tsx`.
- [ ] Interfaces consumed: `TrendDraft`, metric registry, compare candidates, range/aggregation policy, coverage options, reference/forecast flags, saved-view context, and Apply/Reset callbacks.
- [ ] Interfaces produced: sheet-local draft state and typed selector rows; no mutation of applied query until Apply/Save.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/configure/__tests__/configure-trend-fidelity.test.tsx`; expected failure: current form is not a sheet and lacks composed selector contracts.
- [ ] Implementation: match `447:21`, `453:30`, and `454:62`; keep draft state immutable until explicit Apply/Save; restrict Simple controls.
- [ ] GREEN test: assert every selector, allowed aggregation boundary, reset, cancel, Apply, and saved-view context.
- [ ] Regression validation: existing configure tests, range aggregation, comparison compatibility, and mode capability tests.
- [ ] Commit boundary: `feat: recover Configure Trend sheet`.

#### R5.2 — Recover compare picker and comparison reports

- [ ] Files to create: `apps/mobile/src/components/analytics/configure/compare-picker-sheet.tsx`, `apps/mobile/src/components/analytics/trends/comparison-report.tsx`, `apps/mobile/src/components/analytics/configure/__tests__/comparison-fidelity.test.tsx`.
- [ ] Files to modify: `configure.tsx`, `[metric].tsx`, `comparison-trend-chart.tsx`, and existing comparison presentation tests.
- [ ] Interfaces consumed: compatibility matrix, comparison query, shared-unit/dual-axis/normalized policy, missing-pair semantics, and chart geometry.
- [ ] Interfaces produced: picker state and report variants for `447:114`, `447:149`, and `454:21`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/configure/__tests__/comparison-fidelity.test.tsx`; expected failure: comparison is generic and the picker is embedded in Configure.
- [ ] Implementation: build separate shared-unit, dual-axis, and normalized compositions; preserve backend validation and fixed axes; show unavailable pairs without blanking the primary metric.
- [ ] GREEN test: assert picker compatibility, axis ownership, normalized explanation, selected state, and missing-pair error handling.
- [ ] Regression validation: API comparison, shared-unit, dual-axis, normalized, and chart geometry tests.
- [ ] Commit boundary: `feat: recover comparison picker and report variants`.

### Recovery Slice 6 — Custom Range

#### R6.1 — Recover Custom Range sheet, rail gestures, and responsive state

- [ ] Files to create: `apps/mobile/src/components/analytics/configure/custom-range-sheet.tsx`, `custom-range-rail.tsx`, `apps/mobile/src/components/analytics/configure/__tests__/custom-range-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/custom-range.tsx`, `custom-range-geometry.ts`, and existing rail tests where actual responder callbacks need coverage.
- [ ] Interfaces consumed: first eligible date, today bound, aggregation preview, `PanResponder`, rail helpers, calendar selection, haptic callbacks, and Apply navigation.
- [ ] Interfaces produced: sheet-local range draft with handle, pan, zoom, calendar, Earlier/Zoom/forward rail controls, and Apply actions.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/configure/__tests__/custom-range-fidelity.test.tsx`; expected failure: current buttons/forms do not prove the approved sheet gesture contract.
- [ ] Implementation: match `447:189` and `490:455`; connect handles/panning/zooming to the existing pure geometry helpers, enforce no future and first-eligible bounds, and preserve draft-until-Apply semantics.
- [ ] GREEN test: assert date boundaries, aggregation preview, rail movement, haptic callback, calendar, Apply/cancel, and 320pt layout.
- [ ] Regression validation: range eligibility, DST/timezone, aggregation boundaries, no-future, and current custom-range tests.
- [ ] Commit boundary: `feat: recover Custom Range sheet interactions`.

### Recovery Slice 7 — Saved Views

#### R7.1 — Recover Save View sheet and modified-view flow

- [ ] Files to create: `apps/mobile/src/components/analytics/saved-views/save-view-sheet.tsx`, `saved-view-draft-summary.tsx`, `apps/mobile/src/components/analytics/saved-views/__tests__/save-view-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/save-view.tsx`.
- [ ] Interfaces consumed: saved-view create/update payloads, draft trend configuration, one-pinned policy, name validation, and route params.
- [ ] Interfaces produced: new/modified sheet state with pin-on-create choice, save/discard actions, and validation errors.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/saved-views/__tests__/save-view-fidelity.test.tsx`; expected failure: current standalone page has no approved sheet or pin-on-create option.
- [ ] Implementation: match `449:25` and `449:48`; show the draft summary, preserve relative rolling ranges, allow one pinned analysis, and never write until Save.
- [ ] GREEN test: assert create/update, duplicate-name failure, pin-on-create, discard, and no mutation before Save.
- [ ] Regression validation: saved-view API/service full lifecycle and existing route tests.
- [ ] Commit boundary: `feat: recover Save View sheet flow`.

#### R7.2 — Recover Saved Views manager, actions, delete confirmation, and long names

- [ ] Files to create: `apps/mobile/src/components/analytics/saved-views/saved-views-manager.tsx`, `saved-view-card.tsx`, `saved-view-actions-sheet.tsx`, `delete-saved-view-sheet.tsx`, `apps/mobile/src/components/analytics/saved-views/__tests__/saved-views-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/trends/saved-views.tsx`.
- [ ] Interfaces consumed: full saved-view lifecycle, pinned state, reorder API, optimistic reload, delete errors, and name identity.
- [ ] Interfaces produced: pinned section, all-views section, card/action-sheet/delete-sheet composition.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/saved-views/__tests__/saved-views-fidelity.test.tsx`; expected failure: current inline action list has none of the approved manager surfaces.
- [ ] Implementation: match `449:75`, `453:54`, `517:60`, and `492:1236`; preserve exactly one pinned view, Calories fallback on unpin, reorder behavior, optimistic failure recovery, and long-name wrapping/truncation.
- [ ] GREEN test: assert open, pin, unpin, fallback, move, rename, duplicate, delete confirm/cancel/failure, empty state, 320pt, and long names.
- [ ] Regression validation: saved-view service, cache, navigation, and accessibility tests.
- [ ] Commit boundary: `feat: recover Saved Views manager and actions`.

### Recovery Slice 8 — hydration and Log Water fidelity

#### R8.1 — Recover canonical Log Water experience and entrypoint parity

- [ ] Files to create: `apps/mobile/src/components/water/log-water-sheet.tsx`, `water-amount-quick-actions.tsx`, `water-history-list.tsx`, `apps/mobile/src/components/water/__tests__/log-water-fidelity.test.tsx`.
- [ ] Files to modify: `apps/mobile/src/app/water-log.tsx`, `apps/mobile/src/components/floating-action-wheel.tsx`, `apps/mobile/src/app/(tabs)/history.tsx`, and `apps/mobile/src/lib/water-actions.ts` only to centralize existing persistence calls.
- [ ] Interfaces consumed: water amount/time API, unit conversion, history edit/delete, `quickAddWater`, `undoQuickAddWater`, global launcher route, and existing success/error states.
- [ ] Interfaces produced: one canonical Log Water composition and shared amount/action callbacks.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/water/__tests__/log-water-fidelity.test.tsx`; expected failure: current logger lacks final quick amount/visual/selected amount/Add Water composition and entrypoint parity assertions.
- [ ] Implementation: match `440:28`; preserve amount plus time only, quick amounts, Other Amount, Add Water, edit/delete history, +250 mL, Undo, and all persistence behavior. Ensure the launcher opens this canonical experience.
- [ ] GREEN test: create through launcher, +250 mL, Undo, Other Amount, edit, delete, history refresh, and hydration total consistency all use the same API path.
- [ ] Regression validation: water API/integration tests, history tests, hydration analytics, cache, and auth ownership tests.
- [ ] Commit boundary: `feat: recover canonical Log Water experience`.

#### R8.2 — Verify Log Water responsive treatment

- [ ] Files to create: `apps/mobile/src/components/water/__tests__/log-water-responsive.test.tsx`.
- [ ] Files to modify: water components only when the test identifies a concrete 320pt overflow or hit-target defect.
- [ ] Interfaces consumed: canonical water component props and layout tokens.
- [ ] Interfaces produced: tested 320pt layout constraints for `490:550`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/water/__tests__/log-water-responsive.test.tsx`; expected failure: no 320pt layout assertions exist.
- [ ] Implementation: constrain quick amounts, selected amount, CTA, and history rows to 320pt with accessible hit targets and no clipped text.
- [ ] GREEN test: render at 320pt and assert no horizontal overflow, visible CTA, wrapped/truncated history names, and accessible actions.
- [ ] Regression validation: 390pt screenshot and physical iPhone logger check.
- [ ] Commit boundary: `test: lock Log Water responsive behavior`.

### Recovery Slice 9 — Progress regressions

#### R9.1 — Reproduce Progress refresh and mode-switch regressions before changing production logic

- [ ] Files to create: `apps/mobile/src/app/(tabs)/__tests__/progress-regressions.test.tsx`, `apps/mobile/src/lib/progress/progress-transition-fixtures.ts`, `docs/superpowers/phase-17-5-progress-physical-repro.md`.
- [ ] Files to modify: no production source in the RED phase; add only test seams if a pure seam is required and it does not change behavior.
- [ ] Interfaces consumed: `ProgressScreen`, `AppScreen`, React Native `RefreshControl`, `ModeBadge`, tracking-preference API, `app-store` data version, `syncLauncherIconToMode`, and Settings mode flow.
- [ ] Interfaces produced: deterministic repro harness for refresh gesture state, concurrent load generations, mode persistence, Settings synchronization, focus reload, and launcher-icon failure.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/app/(tabs)/__tests__/progress-regressions.test.tsx`; expected failure: no regression tests exist, so physical failures are not represented in automation.
- [ ] Implementation: document physical reproduction on the user-operated iPhone build: pull from the actual scrollable Progress surface; switch Simple/Complex from ModeBadge repeatedly during refresh/focus reload; compare Settings change; record request ordering, visible state, API persistence, store data version, and launcher icon result. Inspect `AppScreen` scroll/RefreshControl attachment, content height/insets, nested pressables, and alternate-icon UIKit/main-thread warnings. Do not label a suspected cause as root cause until a failing test or log sequence identifies it.
- [ ] GREEN test: after the harness is implemented, reproduce each current failure deterministically in Jest or a pure state test and record the physical evidence in the repro document.
- [ ] Regression validation: run existing Progress summary/routing tests and verify no Figma redesign is introduced.
- [ ] Commit boundary: `test: capture Progress physical regression harness`.

#### R9.2 — Fix Progress refresh and mode synchronization at the first failing boundary

- [ ] Files to create: `apps/mobile/src/lib/progress/progress-controller.ts` only if the tested request-generation/state machine cannot remain readable in `progress.tsx`, plus focused unit tests.
- [ ] Files to modify: `apps/mobile/src/app/(tabs)/progress.tsx`, `apps/mobile/src/components/app-screen.tsx` only if the RefreshControl attachment is proven defective, `apps/mobile/src/lib/app-icon.ts` only if the warning/failure boundary is proven relevant, `apps/mobile/src/store/app-store.ts` only if request generation needs an existing store signal.
- [ ] Interfaces consumed: current API response contracts, focus lifecycle, data-version invalidation, launcher icon promise, and RefreshControl props.
- [ ] Interfaces produced: request-generation guard, refresh state that cannot be overwritten by an older load, mode persistence state that remains committed when icon sync fails, and reliable refresh gesture wiring.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/app/(tabs)/__tests__/progress-regressions.test.tsx`; expected failure: stale concurrent loads or missing RefreshControl/mode event behavior reproduces the captured regression.
- [ ] Implementation: fix only the proven boundary. Ensure tracking preference update commits independently of launcher icon sync; ensure Settings, Progress, backend, store, and launcher icon converge after focus/reload; ensure refresh starts from the real scroll surface and preserves the existing summary/report resource semantics. Keep alternate-icon warnings safe and non-blocking unless evidence shows they block the user action.
- [ ] GREEN test: assert pull-to-refresh invokes `loadSummary(true)`, newer request wins, mode update remains persisted when icon sync rejects, Settings and Progress converge, and launcher failure does not block tracking-mode persistence.
- [ ] Regression validation: run Progress, Settings/profile mode, app icon, auth, and dashboard tests; perform the user-operated physical iPhone retest and record who performed it. Do not claim physical completion from automation.
- [ ] Commit boundary: `fix: restore Progress refresh and mode synchronization`.

### Recovery Slice 10 — reporting fault isolation

#### R10.1 — Isolate backend report-level context from section calculations

- [ ] Files to create: `apps/api/src/modules/analytics/trends/section-outcome.ts`, `apps/api/test/analytics-insights-section-failures.test.ts`.
- [ ] Files to modify: `apps/api/src/modules/analytics/trends/routes.ts`, `apps/api/src/modules/analytics/trends/service.ts`, `apps/api/src/modules/analytics/trends/insights-diagnostics.ts` only for safe diagnostic context, and shared route test helpers.
- [ ] Interfaces consumed: canonical metric calculators, report context, food/water/weight data loaders, existing diagnostics gate, and `CanonicalInsightsResponseV2`.
- [ ] Interfaces produced: typed section outcome wrapper, independent data-source outcomes, report-level failure mapper, and v2 Insights response.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/api test -- analytics-insights-section-failures.test.ts`; expected failure: an injected section exception currently rejects the entire Insights request.
- [ ] Implementation: establish global context failure handling; load independent source outcomes; wrap each core section calculator with a typed generic failure result; preserve server-side safe diagnostics; do not return internal error strings or request identifiers to clients.
- [ ] GREEN test: inject failure into each of Calories, Protein, Carbs, Fat, Macro Composition, Weight, Hydration, and Logging Consistency; assert healthy siblings are returned and report-level auth/database/parser failures use the full-unavailable path.
- [ ] Regression validation: all existing Insights contract, hydration, range, coverage, logging, reference, and diagnostics tests.
- [ ] Commit boundary: `feat: isolate Insights section failures on the API`.

#### R10.2 — Parse and render section outcomes without zero-fill

- [ ] Files to create: `apps/mobile/src/lib/analytics/analytics-section-view-model.ts`, `apps/mobile/src/lib/analytics/analytics-section-view-model.test.ts`.
- [ ] Files to modify: `apps/mobile/src/lib/api-client.ts` response parsing, `analytics-report-resource.ts`, shared schema imports, and Insights components.
- [ ] Interfaces consumed: v2 section outcomes, canonical missingness, metric coverage, and section retry callback.
- [ ] Interfaces produced: user-safe section view models with `available`, `stale`, `failed`, and `unknown` data states.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-section-view-model.test.ts`; expected failure: parser/resource has no section outcome mapping.
- [ ] Implementation: map failed sections to generic retryable UI state; map available data without altering values; preserve `unknown`; reject malformed envelopes as report-level parse errors.
- [ ] GREEN test: assert all eight core failures preserve sibling data, nutrient unknown is not zero, and malformed response cannot become an empty successful report.
- [ ] Regression validation: API client parsing, canonical Insights, resource, nutrient data-state, and empty-state tests.
- [ ] Commit boundary: `feat: render isolated analytics section outcomes`.

#### R10.3 — Merge section refresh results and cache committed data safely

- [ ] Files to create: `apps/mobile/src/lib/analytics/analytics-report-cache.ts`, `apps/mobile/src/lib/analytics/analytics-report-cache.test.ts`.
- [ ] Files to modify: `analytics-cache.ts` only for a tested v2 payload predicate/helper, `analytics-cache-runtime.ts`, `analytics-report-resource.ts`, and auth bootstrap purge tests.
- [ ] Interfaces consumed: v2 response, current committed section map, cache writer serialization, purge barrier, and refresh result.
- [ ] Interfaces produced: section merge function, stale/offline state, v2 cache payload, and retry behavior.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run src/lib/analytics/analytics-report-cache.test.ts`; expected failure: current cache stores one whole report and has no section merge semantics.
- [ ] Implementation: successful sections replace their committed values; failed sections retain prior valid values and receive stale/error state; a failed replacement cannot destroy a valid entry; whole-report network/parser failure falls back to valid cache; preserve UID isolation and coordinated purge.
- [ ] GREEN test: prove mixed refresh, failed hydration with successful calories/weight, offline v2 read, invalid v1 read, concurrent same-key writes, failed atomic replacement, signout purge, and account-delete purge.
- [ ] Regression validation: all existing cache/resource/auth tests and the recent four cache-fix commit scenarios.
- [ ] Commit boundary: `feat: retain committed analytics sections through refresh failure`.

#### R10.4 — Isolate optional nutrient, comparison, forecast, pinned, contributor, and recommendation failures

- [ ] Files to create: `apps/api/test/analytics-insights-optional-failures.test.ts`, `apps/mobile/src/lib/analytics/analytics-optional-resource.test.ts`.
- [ ] Files to modify: optional route/service modules only where their current error escapes the owning resource, `insights.tsx`, `[metric].tsx`, comparison and contributor routes, and pinned/recommendation loaders.
- [ ] Interfaces consumed: optional endpoints, section retry callbacks, canonical base trend, and saved-view/pinned query.
- [ ] Interfaces produced: local error/resource boundaries for nutrient detail, comparison, forecast, pinned preview, contributors, and recommendations.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/api test -- analytics-insights-optional-failures.test.ts && corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/lib/analytics/analytics-optional-resource.test.ts`; expected failure: optional failures currently appear as generic route failures or remove adjacent content.
- [ ] Implementation: keep base trend visible when forecast/comparison/pinned/recommendation work fails; show section-local retry/error treatment; preserve deterministic policy and saved-view behavior.
- [ ] GREEN test: inject each optional failure and assert unrelated content remains usable.
- [ ] Regression validation: comparison, forecast, contributor, recommendation, saved-view, pinned, and navigation tests.
- [ ] Commit boundary: `feat: isolate optional analytics resource failures`.

#### R10.5 — Wire v2 report resource into Insights and refresh behavior

- [ ] Files to modify: `apps/mobile/src/app/(tabs)/insights.tsx`, `analytics-cache-runtime.ts`, API client route typing, and the new Insights components from R1.
- [ ] Interfaces consumed: v2 API response, report resource, section view models, cache merge, retry, and AppScreen refresh.
- [ ] Interfaces produced: production section-aware Insights refresh path.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/insights/__tests__/complex-insights-fidelity.test.tsx src/components/analytics/insights/__tests__/simple-insights-fidelity.test.tsx`; expected failure: components are still fed through the old whole-report resource.
- [ ] Implementation: replace the old Insights fetch path only after R10.1–R10.4 pass; preserve committed content on refresh; display pending/stale/failed section state; keep report-level unavailable state distinct.
- [ ] GREEN test: render mixed v2 response, refresh with one failed section, retry only that section, and offline cached response at both modes.
- [ ] Regression validation: all Insights, cache, parser, API contract, and mode tests.
- [ ] Commit boundary: `feat: wire section-aware Insights refresh path`.

### Recovery Slice 11 — responsive and state fidelity

#### R11.1 — Implement exact responsive, loading, empty, stale, offline, and failure compositions

- [ ] Files to create: `apps/mobile/src/components/analytics/states/analytics-skeleton.tsx`, `analytics-first-use.tsx`, `analytics-report-unavailable.tsx`, `analytics-offline-banner.tsx`, `apps/mobile/src/components/analytics/states/__tests__/analytics-state-fidelity.test.tsx`.
- [ ] Files to modify: Insights, Explore, trend report, Configure, Custom Range, Saved Views, nutrient, water, and shared analytics card components only where exact state slots are consumed.
- [ ] Interfaces consumed: report/section resource states, retry callbacks, width, font scale, committed timestamp, and Figma state mapping.
- [ ] Interfaces produced: consistent state components for `477:21`, `510:437`, `510:467`, `495:21`, `477:141`, `492:455`, `492:753`, and `492:1279`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/states/__tests__/analytics-state-fidelity.test.tsx`; expected failure: no exact state composition or state-to-visual mapping exists.
- [ ] Implementation: add per-card skeletons, first-use CTA, current-period marker, full report unavailable screen, stale/offline labels, section retry, and committed-data pending treatment. Keep user-facing messages free of diagnostics.
- [ ] GREEN test: assert state transitions and exact safe copy for loading, empty, in-progress, section failure, full failure, stale refresh, and offline cache.
- [ ] Regression validation: all screen tests, 390/320 render tests, Large-Type test fixtures, accessibility labels, and manual Figma screenshot review.
- [ ] Commit boundary: `feat: recover analytics loading and failure state compositions`.

#### R11.2 — Recover forecast unavailable states and continuity

- [ ] Files to create: `apps/mobile/src/components/analytics/trends/forecast-unavailable-card.tsx`, `apps/mobile/src/components/analytics/trends/__tests__/forecast-state-fidelity.test.tsx`.
- [ ] Files to modify: Calories and Weight report components.
- [ ] Interfaces consumed: forecast policy/result, base trend, data coverage, and section retry state.
- [ ] Interfaces produced: local unavailable state matching `492:1058`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/trends/__tests__/forecast-state-fidelity.test.tsx`; expected failure: generic text does not establish the approved unavailable card.
- [ ] Implementation: keep base trend and summaries visible, explain unavailable eligibility/coverage in user-safe language, and do not invoke an LLM.
- [ ] GREEN test: assert Calories and Weight independently show unavailable forecast while the base trend remains rendered.
- [ ] Regression validation: forecast backend/policy tests and trend screenshot review.
- [ ] Commit boundary: `feat: recover forecast unavailable states`.

#### R11.3 — Lock active scrub, 320pt, Large Type, and long-name behavior

- [ ] Files to create: `apps/mobile/src/components/analytics/__tests__/responsive-and-scrub-fidelity.test.tsx`.
- [ ] Files to modify: chart/report/saved-view/water/configure components only for concrete layout or interaction failures.
- [ ] Interfaces consumed: chart selection callbacks, accessibility actions, width/font-scale props, saved-view names, and final node ledger.
- [ ] Interfaces produced: automated responsive/scrub coverage for `490:21`, `490:319`, `492:21`, `492:319`, `492:1097`, `490:550`, `490:455`, `490:496`, and `492:1236`.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/components/analytics/__tests__/responsive-and-scrub-fidelity.test.tsx`; expected failure: current screens lack the exact width/font-scale and active selection assertions.
- [ ] Implementation: encode minimum hit targets, no horizontal overflow, wrapping/truncation rules, selected readouts, accessibility actions, and haptic callback boundaries.
- [ ] GREEN test: render exact fixture states at 320pt, 390pt, and Large Type; invoke accessibility selection; assert no overflow and stable action placement.
- [ ] Regression validation: chart geometry, chart accessibility, water/configure/custom/saved tests, and physical iPhone scrub check.
- [ ] Commit boundary: `test: lock Phase 17.5 responsive and scrub fidelity`.

### Recovery Slice 12 — diagnostics cleanup and final hardening

#### R12.1 — Remove temporary user-visible diagnostics and audit server diagnostics

- [ ] Files to modify: `apps/mobile/src/app/(tabs)/insights.tsx`, `apps/mobile/src/lib/analytics/staging-insights-diagnostics.ts` if it has no remaining safe consumer, and tests that currently assert visible `Diagnostic:` text.
- [ ] Files to create: `apps/mobile/src/app/(tabs)/__tests__/insights-diagnostics-visibility.test.tsx`, `docs/superpowers/phase-17-5-diagnostics-audit.md`.
- [ ] Interfaces consumed: normal Insights resource state, existing server `insights-diagnostics.ts` gate, and sanitized error presentation.
- [ ] Interfaces produced: no user-visible diagnostic formatter/import; documented keep/remove decision for server diagnostics.
- [ ] RED test command: `corepack pnpm --filter @food-tracker/mobile exec jest --runInBand src/app/(tabs)/__tests__/insights-diagnostics-visibility.test.tsx`; expected failure: current physical build renders `Diagnostic: api_insights_resolved · report_commit_dispatched` or the failure category.
- [ ] Implementation: remove the client diagnostic import, formatter, state, and render path. Audit server diagnostics for staging-only gating, safe values, low noise, and operational usefulness; retain only entries meeting those conditions.
- [ ] GREEN test: render successful, stale, section-failed, and report-failed Insights and assert none contains `Diagnostic:`, HTTP classes, request IDs, cache state, parser stages, reducer stages, or backend diagnostic categories.
- [ ] Regression validation: API diagnostics tests, sanitized error tests, full mobile tests, and a Release bundle source scan.
- [ ] Commit boundary: `fix: remove user-visible Insights diagnostics`.

#### R12.2 — Run final automated validation and prepare physical iPhone handoff

- [ ] Files to modify: `docs/superpowers/phase-17-5-fidelity-capture-ledger.md`, `docs/superpowers/phase-17-5-progress-physical-repro.md`, and the owning current documentation files only when delivered behavior or validation commands changed.
- [ ] Interfaces consumed: all final routes/components, test suites, cache contract, and physical checklist.
- [ ] Interfaces produced: completed automated evidence, explicit physical-device checklist, known validation gaps, and phase-closeout documentation inputs.
- [ ] RED test command: `node -v && corepack pnpm -v && corepack pnpm format:check && corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build && corepack pnpm test`; expected failure: the final sequence must remain red until all implementation tasks and documentation updates are complete.
- [ ] Implementation: run the complete repository sequence under Node 22. Include the original plan’s database/shared/mobile suites when the implementation changes those surfaces: `corepack pnpm prisma:generate`, `corepack pnpm prisma:validate`, `corepack pnpm --filter @food-tracker/api exec prisma migrate deploy`, `corepack pnpm --filter @food-tracker/api test`, `corepack pnpm --filter @food-tracker/mobile exec vitest --config vitest.config.ts run`, and `corepack pnpm --filter @food-tracker/mobile test:jest`. Use a database whose name ends in `_test`.
- [ ] GREEN test: every command passes under Node `22.x` and pnpm `10.34.3`; record exact test counts, no unsupported-engine warnings, `git diff --check`, and final status. Run a source scan proving no temporary client diagnostic remains.
- [ ] Regression validation: user performs the standalone staging Release physical iPhone workflow. Verify Progress refresh and mode switch, Insights cards, all chart classes, scrub/haptics, Custom Range gestures, comparison variants, nutrient states, saved lifecycle, canonical Water, 320pt, Large Type, stale/section/offline/report failures, and standalone operation without Metro, Docker, local API, or Mac connectivity. Attribute physical evidence to the user; do not claim it from automation.
- [ ] Commit boundary: `docs: close Phase 17.5 fidelity recovery validation`.

## 4. Product and architecture acceptance criteria

- [ ] Every node in the final index `524:21` has a corresponding audit row and implementation task. No hidden draft or historical screenshot is used as a visual authority.
- [ ] Simple Insights is a composed report with period summary, energy, macros, nutrient highlights, hydration, weight, logging consistency, recommendations, and Explore entry. It has no Complex Configure, Save, Custom Range, arbitrary comparison, full nutrient library, or saved-view manager controls.
- [ ] Complex Insights has Overview/Nutrients/Recommendations tabs, Explore all, pinned analysis with Manage, full nutrient entry, and the approved card hierarchy.
- [ ] Explore Simple is curated and Explore Complex is grouped/searchable with Nutrients and Saved Views entrypoints.
- [ ] Calories, Macros, Weight, Hydration, Logging consistency, and nutrient details use explicit report compositions while consuming canonical facts.
- [ ] True ranges require both authoritative bounds. Target, minimum, limit, one-bound, and unknown references are distinct.
- [ ] Nutrient recorded/partial/unknown states remain distinct from logging complete/partial/unlogged and current-day in-progress.
- [ ] Comparisons cover shared units, dual axes, normalized units, incompatible pairs, selection, and missingness without client-side fact calculation.
- [ ] Custom Range enforces first eligible date through today, no future dates, aggregation boundaries, draft-until-Apply, rail handles, pan, zoom, calendar, and haptic behavior.
- [ ] Saved Views cover create, update, rename, duplicate, pin, unpin, reorder, delete, action menu, delete confirmation, one-pinned invariant, Calories fallback, rolling periods, and long names.
- [ ] Log Water uses amount/time persistence across launcher, Water Log, History quick actions, Other Amount, +250 mL, Undo, edit, and delete. Hydration remains visible in both modes.
- [ ] Progress refresh is physically responsive and the ModeBadge persists/synchronizes mode with Settings, backend, store, and launcher icon. Launcher-icon failure cannot undo tracking-mode persistence.
- [ ] Core metric failures are isolated for Calories, Protein, Carbs, Fat, Macro Composition, Weight, Hydration, and Logging Consistency. Optional nutrient detail, comparison, forecast, pinned preview, contributor, and recommendation failures are local.
- [ ] Report-level auth, network, database/global context, or unreadable-response failures show the full unavailable state. Section failures leave healthy committed or refreshed siblings visible.
- [ ] A refresh success replaces only successful sections; a failed replacement keeps the previous valid section as stale/error. Whole-report cache failure never destroys a valid cache.
- [ ] v1 cache entries are never treated as v2 without validation. v2 is written under versioned keys and remains UID-partitioned, atomic, serialized, purge-safe, and recoverable.
- [ ] Loading, refresh pending, stale refresh failure, first use, current period, section failure, full unavailable, forecast unavailable, active scrub, offline cache, 320pt, Large Type, and long names match their exact final Figma references.
- [ ] No normal user can see `Diagnostic:` or internal HTTP/error/request/cache/parser/reducer/backend diagnostics.

## 5. Cross-check against the approved Phase 17.5 plan

| Original plan requirement | Recovery coverage |
|---|---|
| Frozen Simple/Complex capability boundary | R1.1, R2.1, R2.2, R3.1–R3.5, acceptance criteria |
| Canonical metric registry and response semantics | R0.1, R0.2, R10.1, R10.2; existing shared/API contracts preserved |
| Logging-day classification and current-day phase | R0.1, R3.4, R11.1; existing classifier/policy tests retained |
| Independent metric coverage and unknown handling | R0.1, R4.4, R10.2; no zero-fill acceptance criterion |
| Water ownership/CRUD/quick add/Undo/default hydration | R3.5, R8.1, R8.2; existing water API and persistence retained |
| Custom range eligibility, gestures, aggregation, no future | R6.1 and R11.3 |
| Comparison compatibility, fixed axes, shared/dual/normalized units | R5.2, R3.3, R10.4 |
| Saved-view full lifecycle, rolling periods, one pinned, Calories fallback | R7.1, R7.2, R10.3 |
| Deterministic Calories and Weight forecasts | R3.1, R3.2, R11.2 |
| Nutrient catalog/search/categories/references/related/contributors | R2.3, R4.1–R4.5 |
| Existing chart geometry and interaction primitives | R3.6, R11.3; no new chart framework |
| Atomic cache writes, stale/offline, UID isolation, purge | R0.2, R10.3, R12.2 |
| Auth and authorization boundaries | R10.1, R10.3, existing auth/API tests retained |
| API/shared/mobile/type/test validation sequence | R12.2 |
| 320pt, Large Type, accessibility, haptics, physical iPhone | R0.1, R9.1, R9.2, R11.1–R11.3, R12.2 |
| Progress existing surface and deep-link mapping | R9.1, R9.2; no replacement Progress design |
| Documentation closeout and stale wording audit | R0.1, R12.1, R12.2 |

No approved Phase 17.5 requirement is intentionally omitted. The recovery adds presentation and reliability work while preserving the original domain and persistence contracts.

## 6. Review gates and execution dependencies

- [ ] R0.1 must pass before any visual recovery task so all screens use the same real-shaped fixtures and final-node ledger.
- [ ] R0.2 must pass before R1.1, R1.2, and R10 so all new presentation components can consume a stable section-state interface.
- [ ] R1.1 and R1.2 must pass before R2 because Insights navigation owns the Explore and Nutrients entrypoints.
- [ ] R2.3 must pass before R4 because nutrient detail routes depend on the library/category contract.
- [ ] R3.6 must pass before R4 and R5 because nutrient and comparison reports consume the shared trend shell.
- [ ] R5.1 must pass before R5.2 and R6 because comparison and custom-range sheets consume the Configure draft contract.
- [ ] R7.1 must pass before R7.2 because the manager opens the same saved-view draft/action model.
- [ ] R8.1 must pass before R3.5 final wiring and R11 responsive review because all hydration entrypoints must share persistence and navigation.
- [ ] R9.1 must pass before R9.2; physical evidence must identify the first failing Progress boundary before production changes.
- [ ] R10.1–R10.4 must pass before R10.5; R10.5 must pass before final stale/offline UI acceptance.
- [ ] R11 must follow the stable report/resource contracts; it must not become a second redesign pass.
- [ ] R12.1 follows revalidation of the cache/report path so temporary instrumentation is removed only after the evidence is captured.
- [ ] R12.2 is the only completion gate. Physical validation remains user-owned and is reported separately from automated evidence.

## 7. Self-review record for this plan

- [ ] Figma coverage: all 67 nodes listed in the final index are present in the matrix. Major anchor nodes were visually inspected. The following nodes require an individual implementation-time screenshot check because the audit batch did not capture them separately: `361:104`, `450:22`, `363:21`, `363:177`, `338:605`, `338:720`, `338:928`, `426:159`, `449:177`, `338:814`, `424:67`, `424:116`, `424:138`, `425:21`, `425:92`, `426:21`, `426:89`, `429:21`, `429:83`, `426:215`, `426:243`, `447:66`, `447:114`, `447:149`, `454:21`, `447:189`, `453:30`, `454:62`, `449:25`, `449:48`, `449:75`, `453:54`, `517:60`, all `523:*` nodes, all `490:*`/`492:*`/`477:*`/`510:*`/`495:21` state nodes, and `440:28`/`490:550`. They are not classified faithful.
- [ ] Product-plan cross-check: the original plan’s registry, semantics, water, ranges, comparisons, saved views, forecasts, chart, cache, auth, validation, physical, and documentation requirements all map to explicit tasks above.
- [ ] Physical regressions: Progress refresh, Progress mode switch, temporary diagnostics, cache non-regression, Insights drift, and section-level isolation each have dedicated tasks and acceptance tests.
- [ ] Placeholder-language review: every task names files, interfaces, RED command, expected failure, implementation action, GREEN evidence, regression validation, and future commit boundary. No task relies on an unspecified implementation.
- [ ] Scope/order review: section contract and fixtures precede UI work; optional and fault-isolation wiring follows stable presentation boundaries; responsive review follows stable state contracts; diagnostic removal follows cache/report revalidation.
- [ ] Commit review: the current session stages and commits only `docs/superpowers/plans/2026-08-11-phase-17-5-fidelity-recovery.md`.
