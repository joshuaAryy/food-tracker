# Phase 17.5 Chart System, QA Data, and Overview Fidelity Design

## Goal

Unify the Phase 17.5 analytics visual language, refresh the deterministic
staging fixture around an explicit current-date anchor, and recompose Complex
Insights Overview so detail previews remain readable without changing approved
analytics semantics or API contracts.

## Authority and constraints

- The final Figma source is `GFLStsF0ADwaizoVKGeLny`, page `338:21`, with
  final handoff `517:73` and index `524:21`.
- Reviewed target nodes are Overview `338:276`, Macros `338:720`, Calories
  `338:469`, and Logging Consistency `338:928`.
- Runtime behavior is evaluated against the supplied physical-iPhone
  screenshots and the real Simulator loop; physical-iPhone acceptance remains
  user-owned and must remain `PENDING USER RE-VALIDATION`.
- Stay on `phase-17-5-custom-analytics`; do not create a PR, merge, deploy
  production, or touch protected untracked directories.
- Do not change Prisma schema/migrations, shared API contracts, backend
  analytics semantics, authentication, or dependencies.
- Preserve axes, adaptive ticks, grids, missing-date domains, trend continuity,
  null/unknown semantics, hydration persistence, logging completeness, paired
  routing, comparison timelines, references, and empty states.
- Required runtime is Node `v22.x` and pnpm `10.34.3`; tests use the dedicated
  `food_tracker_test` database.

## Design

### 1. Centralized chart visual system

Create a mobile-only, pure style resolver keyed by `AnalyticsMetricKey`. It
maps metrics to stable visual families (energy, macro protein/carbohydrate/fat,
carbohydrate/fiber, protein/amino-acid, fats/lipids, vitamins, minerals,
hydration, weight, and consistency) and returns the palette plus raw,
trend, reference, selected, and tooltip treatments. Metric identity colors are
not status colors: a mineral metric can use its mineral palette while its
status remains positive, warning, or unavailable.

The existing `BarTrendChart` remains the daily hybrid composition. Its style
inputs become explicit enough to render outlined or low-opacity raw bars,
stronger smooth derived trends, selected observations, and restrained
references. The chart continues to omit null raw bars and may bridge nulls only
for derived trend values. Calories uses two restrained dashed/dotted reference
bounds; the large gradient/range slab is removed from that composition.

Hydration, weight, logging consistency, and Macro remain specialized
compositions. They consume shared palette tokens where appropriate but do not
become instances of a universal chart component.

### 2. Macro and calorie fidelity

Macro colors are defined once and consumed by the donut, legend, daily mix, and
overview preview. Donut segments use a controlled white separator stroke or
equivalent small angular divider, not large gaps. The center value/label stack
is centered against the actual donut hole geometry and remains readable at the
overview and detail sizes. The daily mix preserves rounded tops, readable
weekday labels, and white segment boundaries.

Calories keeps daily observations, derived trend, truthful missing days, axes,
and selected tooltips. Its reference range is represented by quiet bounds or
another non-dominant treatment rather than a filled gradient band.

### 3. Complex Overview composition

Keep the existing section/data ownership and make the Complex Overview cards
large enough to match the approved Figma composition. Energy and Macro previews
retain meaningful plot height; nutrient highlights retain target/status rows;
hydration and weight retain their specialized previews; Logging Consistency
uses a materially larger heatmap with clear state differentiation. Additional
scroll height is acceptable. Compact/Simple presentation behavior and all
loading/error/empty states remain intact.

### 4. Deterministic staging QA fixture

Extend only the staging fixture generator so `--anchor-date YYYY-MM-DD`
continues to control the latest day without hardcoding a runtime date. Keep at
least 181 historical days and the current 7D/30D/90D/custom aggregation
windows. Add deterministic, representative nutrient snapshots across general,
energy, carbohydrate/fiber, fat/lipid, protein/amino-acid, vitamin, mineral,
and other supported categories, including caffeine and supported special
metrics. Schedule values to preserve recorded/within-target, near-goal,
below-minimum, above-limit, within-limit, range, partial, unknown, sparse, and
no-reference/no-data states. Do not eliminate intentional empty states.

The seed command retains explicit Firebase-linked target selection, staging-only
refusal, reset confirmation, exact-user isolation, idempotency, and no
credential logging. No production account or random user is ever selected.

## Test strategy

- Mobile unit tests cover family mapping, raw/trend hierarchy, reference mode,
  and null preservation.
- Mobile component tests cover Macro center geometry/separators, daily mix
  identity, Calories reference treatment, and Complex Overview minimum geometry
  including the larger Logging Consistency preview.
- API fixture tests cover anchor-date freshness, long-window coverage,
  representative nutrient categories and special metrics, state matrix
  examples, safety, idempotency, and exact-user isolation.
- Do not add brittle screenshot/pixel assertions for every style property.
- After implementation, run the real Simulator visual loop against the final
  Figma surfaces where the environment permits. Report Simulator evidence
  separately from physical-device acceptance.

## Explicit exclusions

No production deployment, physical-iPhone validation claim, architecture
rewrite, schema/migration work, new authentication behavior, dependency change,
generated native commit, random staging account, or broad historical rewrite.
