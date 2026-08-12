# SDD ledger — plan: docs/superpowers/plans/2026-08-11-phase-17-5-fidelity-recovery.md

Starting branch: phase-17-5-custom-analytics
Starting HEAD: c08e70a
Workspace: /Users/teiko/food_tracker (user-authorized current feature worktree; no new branch/worktree)
Protected state: .agents/, .aidesigner/, .codex/, backups/, docs/design-references/current images/, local DB backups, ignored generated native folders

Execution corrections governing every task:

- Inspect every exact task Figma node with design context before UI production edits and record discrepancies in the tracked fidelity ledger.
- R1 presentation consumes section-aware/view-model props from R0.2; a temporary v1 adapter may feed them until R10.
- Section retry may re-request canonical Insights, but committed healthy siblings must remain mounted and merge without flicker; no per-section API proliferation by default.
- Backend/API task completion requires PostgreSQL test DB validation on a database ending in \_test.
- Progress physical evidence is accepted as the starting repro; automated/source investigation continues without claiming physical completion.
- Each task requires implementer self-review plus independent spec/Figma and code-quality review before completion.

Task 1 R0.1: complete
Task 2 R0.2: complete
Task 3 R1.1: complete — corrected Simple overview consumes v2 overview facts and section-aware state; Complex/Recommendations/Pinned remain Task 4
Task 3A R1.0a: complete — authorized v2 overview contract/resource extension; approved after fix round 3
Task 3B R1.0b: complete — authoritative overview calculators and typed independent outcomes are live behind a backward-compatible flat transport bridge; mobile normalizes the bridge into the approved v2 presentation contract; core-trend route isolation remains intentionally deferred to R10.5; PostgreSQL test DB green
Task 4 R1.2: pending
Task 5 R2.1: pending
Task 6 R2.2: pending
Task 7 R2.3: pending
Task 8 R3.1: pending
Task 9 R3.2: pending
Task 10 R3.3: pending
Task 11 R3.4: pending
Task 12 R3.5: pending
Task 13 R3.6: pending
Task 14 R4.1: pending
Task 15 R4.2: pending
Task 16 R4.3: pending
Task 17 R4.4: pending
Task 18 R4.5: pending
Task 19 R5.1: pending
Task 20 R5.2: pending
Task 21 R6.1: pending
Task 22 R7.1: pending
Task 23 R7.2: pending
Task 24 R8.1: pending
Task 25 R8.2: pending
Task 26 R9.1: pending
Task 27 R9.2: pending
Task 28 R10.1: pending
Task 29 R10.2: pending
Task 30 R10.3: pending
Task 31 R10.4: pending
Task 32 R10.5: pending
Task 33 R11.1: pending
Task 34 R11.2: pending
Task 35 R11.3: pending
Task 36 R12.1: pending
Task 37 R12.2: pending

## Review history

- Task 1: fix round 1/5 — three original findings addressed; one original finding remained and three fixture/harness findings were added (`8823d99..91ce590`).
- Task 1: fix round 2/5 — all four outstanding findings addressed; no new Critical or Important breakage (`91ce590..84dda7b`).
- Task 1: complete — fidelity fixtures, focused regression harness, and capture ledger committed in `8823d99`, `91ce590`, and `84dda7b`.
- Task 2: initial implementation committed in `1469103`; review found one Critical and five Important contract/resource gaps.
- Task 2: fix round 1/5 — four findings addressed; initial all-eight settlement, retry-failure sibling isolation, and refresh hydration ordering remained (`51b0667`, `1660187`).
- Task 2: fix round 2/5 — all carried findings addressed; one duplicate-terminal-failure idempotency defect found (`ece33c8`, `0bacaff`).
- Task 2: fix round 3/5 — duplicate terminal failures made idempotent; zero open or new Critical/Important findings (`b9c400c`, `f036184`).
- Task 2: complete — section-aware v2 contract/resource/cache-key foundation approved for R0.2.
- Task 3: initial implementation committed locally in `73a9e2c`; independent Figma/spec review found five blocking findings.
- Task 3: blocked pending product/contract direction — final node `338:98` requires authoritative period streak/eligibility, today hydration, current Weight direction/goal/forecast, and Fiber/Sodium/Vitamin C overview facts that the approved eight-section `CanonicalInsightsResponseV2` cannot represent. Mobile derivation/substitution is prohibited; R1.1 forbids the shared/backend expansion needed to supply them, and R10 is ordered later.
- Authorization received: pull forward the minimum R10 shared/backend work required by `338:98`; keep Simple trend permissions unchanged and treat Fiber/Sodium/Vitamin C as non-navigable overview-only highlights. Task order is now R1.0a contract/resource, R1.0b backend facts/outcomes, then R1.1 UI rework.
- Task 3A R1.0a: implementation commit `38dff05` plus contract fix round; final review approved after explicit eligible counts, cross-field fact validation, required production overview schema, and keyed mobile overview state. Focused evidence: API contract 12/12 on `food_tracker_test`, mobile overview/resource 30/30, R0.2 analytics/cache 55/55, shared/mobile typecheck, ESLint, scoped Prettier, and `git diff --check`.
- Approved execution-order deviation: R1.0b pulls forward only the backend/shared/API overview fact calculators and typed independent outcomes required by R1.1; R10.1–R10.5 full production fault-isolation/cache/resource work remains later and must not duplicate these interfaces.
- Task 3B implementation: `38dff05`/`4c1ddd5` contract foundation was extended with `apps/api/src/modules/analytics/trends/overview.ts`, route v2 overview outcomes, local-date hydration/weight facts, historical policy-based streak input, and failure seams. API overview/resilience/contract/trend regressions passed on `food_tracker_test`.
- Task 3 R1.1 rework: exact Figma `338:98` was re-inspected before implementation. Simple cards now consume typed overview outcomes for period summary, energy, macros, curated Fiber/Sodium/Vitamin C, Hydration, Weight, and Logging Consistency; embedded charts consume only canonical trend points. Curated nutrient rows are informational and non-navigable. Focused Jest fidelity tests passed.
- Task 3 R1.1 review capture: exact Figma `338:98` screenshot/design context was inspected; visual requirements recorded were period pills/summary, purpose-built report cards, embedded trend surfaces, non-navigable curated highlights, logged-drinks-only hydration, authoritative current weight, heatmap completeness, and Simple capability copy. Automated component/typecheck evidence is green; physical 390pt comparison remains user-operated.
- Authorized execution-order note: the API client now validates the overview-required v2 response and temporarily adapts available v2 core sections to the legacy report resource for Complex work; full v2 cache/resource wiring remains R10.2–R10.5.
- R1.0b correction review: the live `/analytics/insights` response intentionally remains the established flat section envelope until R10.5. It carries required authoritative `overview` outcomes as a strict bridge field; the mobile adapter wraps validated flat trend sections into section-aware v2 state without deriving facts. Overview context failure preserves the healthy flat core report with overview groups failed; individual overview calculators remain independently isolated. Core trend route failures remain report-level until the production v2 merge/cache boundary is wired in R10.5. Nutrient highlights preserve target, minimum, limit, true-range, and none reference variants with status validation; Fiber/Sodium/Vitamin C remain overview-only and excluded from the Simple catalog/detail routes.
- R1.0b correction review: approved after explicit discriminant narrowing, removal of the unsupported temporary diagnostic category, and target/range/none bridge-schema coverage. Focused evidence: shared build, API typecheck, 45 API tests on `food_tracker_test`, mobile typecheck, bridge resource Vitest, and pinned Insights Jest.
