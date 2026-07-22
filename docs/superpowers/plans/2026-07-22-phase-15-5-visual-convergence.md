# Phase 15.5 Visual Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved `Food Tracker — Phase 15.5 Reporting Redesign` Figma decisions into the existing React Native reporting surfaces while preserving every locked reporting, streak, API, and navigation rule.

**Architecture:** Keep the existing Expo Router screens and backend-owned facts. Add one shared visual family for the flame, grace crest, day rings, metallic gold, over-target consumption, perfect-week band, and day-detail presentation. Progress and Insights will use open white sections and ledger rows, with shared copy/formatting helpers in `apps/mobile/src/lib` and no new server or shared-contract fields.

**Tech Stack:** React Native, Expo Router, TypeScript, NativeWind, `react-native-svg`, existing Lucide icons, Vitest through the API test project, and the existing Xcode/iOS development-build workflow.

## Global Constraints

- Use Node.js `22.x` only; validation under Node 24 is invalid.
- Use pnpm `10.34.3` through `corepack pnpm`.
- Preserve FoodLog-based streaks, local-day open semantics, future-date exclusion, one grace day, Sunday–Saturday weeks, seven independently gold days for a perfect week, goal-specific inclusive calorie ranges, historical current-goal application, equivalent elapsed comparisons, recorded-day nutrient percentages, independent Recommendations loading/dismissal, and Simple/Complex modes.
- Do not change Prisma schema, migrations, API routes/contracts, shared Zod schemas, recommendation logic, authentication, persistence, or backend business rules.
- Do not add manual completion controls, reminders, notifications, exports, widgets, new navigation tabs, or Phase 16 time-series charts.
- Use the native Apple system font/SF Pro behavior; add no font dependency and commit no font files.
- Use pure white affected-screen surfaces, charcoal structure/text, generous whitespace, restrained gray, and no gray page canvas or gray card stacking.
- Preserve unrelated local state and never edit, stage, delete, format, or commit `.gitignore`, `.agents/`, `.aidesigner/`, `.codex/`, or the untracked `docs/design-references/current images/` directory.
- Preserve existing regression tests; do not weaken or delete coverage to obtain a green run.
- Add accessibility semantics to actionable parents; SVG/image layers remain decorative.
- Every behavior/helper change follows TDD: write one focused failing test, run it and observe the expected failure, implement the smallest change, run it green, then refactor while green.
- Use focused commits and never push or merge.

## Approved Figma Mapping And File Inventory

The approved final-refinements node is `GFLStsF0ADwaizoVKGeLny`, node `142:912`. Its selected decisions map as follows:

| Figma decision | Existing or new React Native owner |
| --- | --- |
| Option B layered flame at 24/32/48/hero scale | Create `apps/mobile/src/components/streak-flame.tsx`; bundle the five exported Figma layer assets under `apps/mobile/src/assets/reporting/flame/` |
| Production grace crest | Create `apps/mobile/src/components/grace-laurel-icon.tsx`; bundle the exported crest under `apps/mobile/src/assets/reporting/grace-laurel.png` |
| 44×58 day cell, 34×34 visible ring, 3pt stroke | Modify `apps/mobile/src/components/radial-progress-ring.tsx`, `apps/mobile/src/components/day-progress-ring.tsx`, and `apps/mobile/src/components/monthly-streak-calendar.tsx`; add geometry/state helpers to `apps/mobile/src/lib/streak-calendar-ui.ts` |
| Metallic gold day and continuous perfect-week band | Create `apps/mobile/src/components/streak-gold-band.tsx`; use it from day and calendar components |
| Split streak hero, one status card, native day sheet | Modify `apps/mobile/src/app/streaks.tsx`; create `apps/mobile/src/components/streak-day-detail-sheet.tsx` |
| Pure-white/typography-led foundation | Modify `apps/mobile/src/theme/tokens.ts`, `apps/mobile/src/components/app-text.tsx`, `apps/mobile/src/components/app-screen.tsx`, `apps/mobile/src/components/app-card.tsx`, and `docs/design-system.md` only where the affected baseline is documented |
| Compact Progress streak action and calorie-first report | Modify `apps/mobile/src/components/streak-entry-action.tsx`, `apps/mobile/src/app/(tabs)/progress.tsx`, and `apps/mobile/src/components/progress-reporting-summary.tsx` |
| Flat Energy/Macro/Nutrient ledgers | Modify `apps/mobile/src/components/energy-report-summary.tsx`, `apps/mobile/src/components/macro-report-summary.tsx`, `apps/mobile/src/components/highlighted-nutrient-summary.tsx`, `apps/mobile/src/components/complete-nutrient-report.tsx`, and `apps/mobile/src/lib/reporting-ui.ts` |
| Period/comparison/no-data/recommendation hierarchy | Modify `apps/mobile/src/app/(tabs)/insights.tsx`, `apps/mobile/src/components/insights-report-content.tsx`, `apps/mobile/src/components/report-period-selector.tsx`, `apps/mobile/src/components/equivalent-period-comparison.tsx`, `apps/mobile/src/components/full-period-report.tsx`, and `apps/mobile/src/lib/reporting-ui.ts` |
| Deterministic UI regression contract | Extend `apps/api/test/mobile-reporting-ui.test.ts`; add focused tests there for every new pure helper |

No file under `apps/api/src`, `packages/shared/src`, Prisma, migrations, native iOS, package manifests, or lockfiles is in scope.

## Task 1: Visual Foundation And Typography Tokens

**Files:**

- Modify: `apps/mobile/src/theme/tokens.ts`
- Modify: `apps/mobile/tailwind.config.js`
- Modify: `apps/mobile/src/components/app-text.tsx`
- Modify: `apps/mobile/src/components/app-screen.tsx`
- Modify: `apps/mobile/src/components/app-card.tsx`
- Modify: `docs/design-system.md`
- Test: `apps/api/test/mobile-reporting-ui.test.ts` for exported pure token/geometry constants only when a helper is introduced

**Interfaces:**

- Consumes: existing NativeWind semantic aliases and `AppScreen`, `AppCard`, and `AppText` call sites.
- Produces: `colors.light.canvas === '#FFFFFF'` for affected app surfaces, charcoal/white token aliases, and a type ramp that keeps title bold, heading semibold, hero bold/heavy, values semibold, body regular, secondary context regular, and compact labels medium.

- [ ] **Step 1: Record the foundation acceptance test and inspect the current token consumers**

  Confirm that all reporting screens use `AppScreen` and that changing `colors.light.canvas` does not require a NativeWind config change. Keep onboarding-specific token values intact unless the shared page-canvas role is directly used by the affected screens.

- [ ] **Step 2: Implement the smallest token and typography change**

  Set the affected light page/surface roles and their NativeWind aliases (`canvas`, `surface`) to white, retain charcoal primary structure, expose no new font dependency, and update `AppText` variants so `caption` is medium rather than bold while `label` remains semibold. Keep `tabular-nums` on numeric variants and do not change dark-mode behavior.

- [ ] **Step 3: Remove default card/canvas styling from the shared shell only where reporting screens depend on it**

  Keep `AppCard` available for clear purposeful supporting cards, but make its default surface white and its border/radius treatment compatible with open reporting sections. Keep `AppScreen` capped at `480px`, preserve safe areas, refresh, keyboard behavior, and bottom padding, and make the default affected background pure white.

- [ ] **Step 4: Align the design-system documentation and run focused checks**

  Update only the light token table and affected reporting guidance in `docs/design-system.md`. Run:

  ```bash
  corepack pnpm exec prettier --check apps/mobile/src/theme/tokens.ts apps/mobile/src/components/app-text.tsx apps/mobile/src/components/app-screen.tsx apps/mobile/src/components/app-card.tsx docs/design-system.md
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/mobile/src/theme/tokens.ts apps/mobile/tailwind.config.js apps/mobile/src/components/app-text.tsx apps/mobile/src/components/app-screen.tsx apps/mobile/src/components/app-card.tsx docs/design-system.md
  git commit -m "refactor: align mobile visual foundations"
  ```

## Task 2: Flame, Grace, Ring, And Calendar State Primitives

**Files:**

- Create: `apps/mobile/src/assets/reporting/flame/outer-flame-body.png`
- Create: `apps/mobile/src/assets/reporting/flame/crimson-depth.png`
- Create: `apps/mobile/src/assets/reporting/flame/orange-inner-heat.png`
- Create: `apps/mobile/src/assets/reporting/flame/yellow-heat-accent.png`
- Create: `apps/mobile/src/assets/reporting/flame/compact-inner-flame.png`
- Create: `apps/mobile/src/assets/reporting/grace-laurel.png`
- Create: `apps/mobile/src/components/streak-flame.tsx`
- Create: `apps/mobile/src/components/grace-laurel-icon.tsx`
- Create: `apps/mobile/src/components/streak-gold-band.tsx`
- Modify: `apps/mobile/src/components/radial-progress-ring.tsx`
- Modify: `apps/mobile/src/components/day-progress-ring.tsx`
- Modify: `apps/mobile/src/components/monthly-streak-calendar.tsx`
- Modify: `apps/mobile/src/components/streak-entry-action.tsx`
- Modify: `apps/mobile/src/lib/streak-calendar-ui.ts`
- Test: `apps/api/test/mobile-reporting-ui.test.ts`

**Interfaces:**

- Consumes: Figma-exported flame/crest assets, `StreakCalendarDay`, accepted upper ratio, and existing `RadialProgressRing` children.
- Produces: `StreakFlame`, `GraceLaurelIcon`, `StreakGoldBand`, `DAY_CELL_SIZE`, `DAY_RING_SIZE`, `DAY_RING_STROKE`, `calendarDayAppearance(day, preTracking)`, `isPreTrackingCalendar(calendar)`, `dayDetailFacts(day, activeCalorieTarget, acceptedCalorieRange, goldWeek)`, and `consumingCharcoalFraction` behavior compatible with existing callers.

- [ ] **Step 1: Add failing helper tests**

  Extend `mobile-reporting-ui.test.ts` with deterministic assertions for:

  ```ts
  expect(DAY_CELL_SIZE).toBe(44);
  expect(DAY_RING_SIZE).toBe(34);
  expect(DAY_RING_STROKE).toBe(3);
  expect(calendarDayAppearance(preTrackingDay).visual).toBe('plain');
  expect(calendarDayAppearance(openDay).visual).toBe('dotted');
  expect(calendarDayAppearance(futureDay).visual).toBe('dotted');
  expect(calendarDayAppearance(missedDay).visual).toBe('dotted');
  expect(calendarDayAppearance(loggedPartialDay).visual).toBe('green-progress');
  expect(calendarDayAppearance(loggedNoTargetDay).visual).toBe('green-complete');
  expect(calendarDayAppearance(goldDay).visual).toBe('gold');
  expect(calendarDayAppearance(overTargetDay).visual).toBe('over-target');
  expect(calendarDayAppearance(graceDay).visual).toBe('grace');
  expect(isPreTrackingCalendar({ ...calendar, currentStreak: { ...calendar.currentStreak, longestLoggedDays: 0 } })).toBe(true);
  expect(isPreTrackingCalendar({ ...calendar, currentStreak: { ...calendar.currentStreak, longestLoggedDays: 1 } })).toBe(false);
  ```

  The test fixture must use real `StreakCalendarDay` fields and must assert that semantic labels still distinguish open, future, missed, grace, gold, no-target, partial, and over-target states even when their visual family is shared.

- [ ] **Step 2: Run the focused test and verify the expected RED failure**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  ```

  Expected result: failure because the new exported constants/helpers do not yet exist.

- [ ] **Step 3: Download and bundle the exact approved Figma artwork**

  Use the Figma asset-export capability for the selected Option B layer nodes `139:2`, `139:4`, `139:6`, `139:8`, `139:10`, and crest node `103:916`. Save the returned source bytes at the exact asset paths in this task. Do not use expiring remote URLs, authored placeholder SVGs, or recreated path geometry.

- [ ] **Step 4: Implement the shared visual family**

  `StreakFlame` must layer the five bundled images in one square container, with a compact `size <= 24` rendering that preserves the white opening and does not expose decorative accessibility nodes. `GraceLaurelIcon` must render the bundled full-weight charcoal crest centered in a 44px square. `StreakGoldBand` must provide a restrained warm-gold gradient/highlight/specular treatment for both a 34px day state and a 7-date continuous week band.

- [ ] **Step 5: Implement ring/state geometry**

  Update `RadialProgressRing` to use the shared center/path geometry, white centers, 3pt default stroke for day rings, clockwise progress, and a charcoal fraction that consumes the emerald arc after the accepted upper ratio. Add a gold gradient path without a hard brown semicircle or inflated shadow. Keep `RadialProgressRing` generic for existing non-calendar callers by retaining overridable size/stroke/colors.

- [ ] **Step 6: Implement day appearance selection**

  `calendarDayAppearance` must return only these visual families: `plain`, `dotted`, `green-progress`, `green-complete`, `gold`, `over-target`, `grace`. Pre-tracking is determined by the response-level no-history fact; open/future/missed/untouched tracked days all return `dotted`; no-target logged days return `green-complete`; partial progress returns `green-progress`; gold returns `gold`; over-target returns `over-target`; grace returns `grace`. No `X`, `G`, arrow, checkmark, future dot, opacity taxonomy, or state legend is rendered.

- [ ] **Step 7: Update the calendar layout**

  Render each day as a 44×58 cell with a 34×34 ring/artwork centered at `x=5`, `y=5`, and the date centered inside the visual state. Render a `goldWeek` row as one continuous rounded metallic band with seven dates directly inside and no individual ring outlines. Render non-gold weeks with the shared individual day components. Preserve Sunday–Saturday ordering, touch hit slop, month relation semantics, and accessible labels.

- [ ] **Step 8: Update the compact Progress entry action**

  Use `StreakFlame` at 24px and a compact uncontained flame-and-number row. Keep the existing route and parent accessibility label; do not use a full-width bordered pill.

- [ ] **Step 9: Run focused tests and commit**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  corepack pnpm exec prettier --check apps/mobile/src/assets/reporting apps/mobile/src/components/streak-flame.tsx apps/mobile/src/components/grace-laurel-icon.tsx apps/mobile/src/components/streak-gold-band.tsx apps/mobile/src/components/radial-progress-ring.tsx apps/mobile/src/components/day-progress-ring.tsx apps/mobile/src/components/monthly-streak-calendar.tsx apps/mobile/src/components/streak-entry-action.tsx apps/mobile/src/lib/streak-calendar-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git diff --check
  git add apps/mobile/src/assets/reporting apps/mobile/src/components/streak-flame.tsx apps/mobile/src/components/grace-laurel-icon.tsx apps/mobile/src/components/streak-gold-band.tsx apps/mobile/src/components/radial-progress-ring.tsx apps/mobile/src/components/day-progress-ring.tsx apps/mobile/src/components/monthly-streak-calendar.tsx apps/mobile/src/components/streak-entry-action.tsx apps/mobile/src/lib/streak-calendar-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git commit -m "feat: implement production streak visuals"
  ```

## Task 3: Streak Screen And Day-Detail Sheet

**Files:**

- Create: `apps/mobile/src/components/streak-day-detail-sheet.tsx`
- Modify: `apps/mobile/src/app/streaks.tsx`
- Modify: `apps/mobile/src/lib/streak-calendar-ui.ts`
- Test: `apps/api/test/mobile-reporting-ui.test.ts`

**Interfaces:**

- Consumes: `StreakCalendarResponse`, `StreakCalendarDay`, `MonthlyStreakCalendar`, `StreakFlame`, `GraceLaurelIcon`, and `StreakGoldBand`.
- Produces: split hero composition, one useful supporting status, month navigation, selected-day modal state, and deterministic day-detail copy without a contract addition.

- [ ] **Step 1: Add failing day-detail helper tests**

  Add assertions for `dayDetailFacts(day, activeCalorieTarget, acceptedCalorieRange, goldWeek)` covering full date, calories logged, target/range, `within_range`, `below_range`, `over_range`, `no_target`, open/future/missed, grace span meaning, and whether the selected gold day contributes to a perfect week. Assert that unavailable values use `—` and that a previous-period/no-data phrase is not used for calendar details.

- [ ] **Step 2: Run the test and observe the expected RED failure**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  ```

- [ ] **Step 3: Implement `dayDetailFacts` and the native sheet**

  Derive only presentation copy from returned facts. The sheet props are:

  ```ts
  type StreakDayDetailSheetProps = {
    day: StreakCalendarDay | null;
    visible: boolean;
    activeCalorieTarget: number | null;
    acceptedCalorieRange: StreakCalendarResponse['acceptedCalorieRange'];
    goldWeek: boolean;
    onClose: () => void;
  };
  ```

  Use React Native `Modal` with a white bottom-anchored panel, charcoal handle/title/close action, concise rows, and `accessibilityViewIsModal`. Include full date, calories, active target, accepted range, status, remaining/exceeded amount, counted-as-logged meaning, gold meaning, perfect-week contribution, and grace explanation where applicable. Do not persist selection or add a new endpoint.

- [ ] **Step 4: Replace the old Streak screen composition**

  Remove the two giant streak cards, numeric boundary copy, Sunday–Saturday explanation, symbol legend, enclosing calendar card, calorie-completion card, and redundant empty-state blocks. Build Layout C: back navigation, title, large streak number, `day logging streak`, 48–104px flame, longest/grace stats, one useful status card, month title/arrows, clean calendar, and day-detail sheet. Choose exactly one supporting status at a time: grace availability when available, otherwise today-open context, otherwise distance from longest streak.

- [ ] **Step 5: Add responsive and accessibility safeguards**

  Keep the hero in a wrapping row that is usable at 320px, constrain the flame with explicit dimensions, use 44pt controls, allow large text to push content vertically rather than clip, keep each date pressable, and preserve semantic state labels at the parent pressable. Under reduced motion, use the native sheet without custom animation choreography.

- [ ] **Step 6: Run focused checks and commit**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts streak-calendar-domain.test.ts
  corepack pnpm exec prettier --check apps/mobile/src/app/streaks.tsx apps/mobile/src/components/streak-day-detail-sheet.tsx apps/mobile/src/lib/streak-calendar-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git diff --check
  git add apps/mobile/src/app/streaks.tsx apps/mobile/src/components/streak-day-detail-sheet.tsx apps/mobile/src/lib/streak-calendar-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git commit -m "feat: add streak hero and day details"
  ```

## Task 4: Progress Reporting Convergence

**Files:**

- Modify: `apps/mobile/src/app/(tabs)/progress.tsx`
- Modify: `apps/mobile/src/components/progress-reporting-summary.tsx`
- Modify: `apps/mobile/src/components/energy-report-summary.tsx`
- Modify: `apps/mobile/src/components/macro-report-summary.tsx`
- Modify: `apps/mobile/src/components/highlighted-nutrient-summary.tsx`
- Modify: `apps/mobile/src/components/streak-entry-action.tsx`
- Modify: `apps/mobile/src/lib/reporting-ui.ts`
- Test: `apps/api/test/mobile-reporting-ui.test.ts`

**Interfaces:**

- Consumes: existing `DashboardSummary`, `ProgressResponse`, `ReportsResponse`, daily nutrient totals, shared streak action, and independent error states.
- Produces: `streakEntryLabel(currentStreak)`, calorie-first Progress hierarchy, compact streak action, target-range rail, protein-priority macro rows, fiber/sugar/sodium rows, and final-day weekly momentum without placeholder disks.

- [ ] **Step 1: Add failing tests for Progress copy and state helpers**

  Test that `streakEntryLabel` is compact, calorie context includes amount/range/remaining-or-exceeded, no-target copy is a single em dash where a target is unavailable, and weekly momentum uses returned final day facts without inventing gray placeholder state. Keep API failure separation represented by existing props and error branches.

- [ ] **Step 2: Run the focused test and verify RED**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  ```

- [ ] **Step 3: Implement the Progress surface**

  Keep the existing data-loading and mode-switch behavior, but reorder presentation so the calorie amount is the hero, accepted range and remaining/exceeded context are visible, protein has priority, carbohydrates/fat follow, fiber/sugar/sodium remain available, and the Insights route is a restrained row. Remove gray page backgrounds, full-width streak pills, stacked summary cards, and placeholder weekly disks. If weekly final-day visuals need more state than the existing report returns, use the existing streak-calendar endpoint facts read-only; do not calculate analytics from raw logs and do not add a contract field.

- [ ] **Step 4: Keep independent loading/error/refresh semantics**

  Preserve the current `Promise.allSettled` branches: report failure must not erase dashboard content, weekly report failure must not erase daily nutrients, daily nutrient failure must not erase the calorie hero, and refresh must retain existing content until replacement data resolves.

- [ ] **Step 5: Run focused tests and commit**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts reporting-api.test.ts
  corepack pnpm exec prettier --check 'apps/mobile/src/app/(tabs)/progress.tsx' apps/mobile/src/components/progress-reporting-summary.tsx apps/mobile/src/components/energy-report-summary.tsx apps/mobile/src/components/macro-report-summary.tsx apps/mobile/src/components/highlighted-nutrient-summary.tsx apps/mobile/src/components/streak-entry-action.tsx apps/mobile/src/lib/reporting-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git diff --check
  git add 'apps/mobile/src/app/(tabs)/progress.tsx' apps/mobile/src/components/progress-reporting-summary.tsx apps/mobile/src/components/energy-report-summary.tsx apps/mobile/src/components/macro-report-summary.tsx apps/mobile/src/components/highlighted-nutrient-summary.tsx apps/mobile/src/components/streak-entry-action.tsx apps/mobile/src/lib/reporting-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git commit -m "feat: align Progress reporting with approved design"
  ```

## Task 5: Insights Ledgers, Complex Groups, And Recommendations

**Files:**

- Modify: `apps/mobile/src/app/(tabs)/insights.tsx`
- Modify: `apps/mobile/src/components/insights-report-content.tsx`
- Modify: `apps/mobile/src/components/report-period-selector.tsx`
- Modify: `apps/mobile/src/components/energy-report-summary.tsx`
- Modify: `apps/mobile/src/components/macro-report-summary.tsx`
- Modify: `apps/mobile/src/components/highlighted-nutrient-summary.tsx`
- Modify: `apps/mobile/src/components/equivalent-period-comparison.tsx`
- Modify: `apps/mobile/src/components/full-period-report.tsx`
- Modify: `apps/mobile/src/components/complete-nutrient-report.tsx`
- Modify: `apps/mobile/src/lib/reporting-ui.ts`
- Test: `apps/api/test/mobile-reporting-ui.test.ts`

**Interfaces:**

- Consumes: `ReportsResponse`, current/previous/equivalent boundaries, nutrient details, existing recommendation lifecycle, and report mode.
- Produces: `nutrientPercentageLabel(input)`, `nutrientRowCopy(input)`, `previousPeriodNoDataLabel(boundary)`, `initialExpandedGroups(groups)`, flat white Insights hierarchy, energy rail instead of donut, ledger rows with independently aligned percentages, expanded-all Complex groups with independent collapse, compact prior-period no-data copy, and unchanged recommendation behavior.

- [ ] **Step 1: Add failing tests for the approved ledger contract**

  Add deterministic tests for:

  ```ts
  expect(nutrientPercentageLabel({ key: 'protein', average: 118, report: proteinReport })).toBe('90%');
  expect(nutrientPercentageLabel({ key: 'omega3', average: 1.6, report: noTargetReport })).toBe('—');
  expect(
    nutrientRowCopy({
      key: 'omega3',
      detail: noTargetNutrient,
      report: noTargetReport,
    }),
  ).not.toContain('target');
  expect(previousPeriodNoDataLabel({ startDate: '2026-06-01', endDate: '2026-06-30' })).toBe('No logged data for Jun 1–Jun 30');
  expect(initialExpandedGroups(['general', 'vitamins'])).toEqual(['general', 'vitamins']);
  ```

  Also assert that an em dash is accompanied by an accessible explanation, that no row uses `0%` for a missing target, and that `recommendationMeta`/dismissal wording remains unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts
  ```

- [ ] **Step 3: Implement shared reporting helpers**

  Add pure helpers for nutrient percentage/row copy, previous-period no-data copy, and `initialExpandedGroups`. Use only target facts already returned by the API: protein may use `proteinTargetGrams`; nutrients without a returned target use `—` and an accessibility label such as `No target available for this nutrient`.

- [ ] **Step 4: Replace unapproved reporting graphs**

  Remove production use of `RadialProgressRing` from Energy, macro progress bars, comparison arrows/glyphs, pie/donut/sparkline/target-arc/decorative graphs, and the old day-strip graph-like treatment. Keep only the approved calorie target-range rail and streak visuals. Render Energy as average calories, status, accepted range, remaining/exceeded context, and optional rail.

- [ ] **Step 5: Implement the macro and nutrient ledgers**

  Each row places the name at left, total amount/unit beneath it, and the percentage independently aligned at right. Do not repeat the word `target` in dense row copy. Omit unavailable nutrients instead of showing fake zeroes. Keep recorded-day count as quiet context where it helps interpretation.

- [ ] **Step 6: Implement Complex expansion state**

  Start all visible categories expanded. Store expanded groups as a `Set<ReportingNutrientGroup>`, toggle one group without changing the others, and provide understated `Expand all` and `Collapse all` controls. Keep categories absent when no recorded nutrients exist.

- [ ] **Step 7: Implement previous-period no-data and preserve Recommendations**

  Replace three giant zero metrics with one compact boundary-aware message when the completed period has no logs. Keep Recommendations as flat rows with priority/category, title, explanation, dismiss, refresh, independent loading, independent errors, and existing dismissal behavior.

- [ ] **Step 8: Validate the Insights task and commit**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts reporting-api.test.ts
  corepack pnpm exec prettier --check 'apps/mobile/src/app/(tabs)/insights.tsx' apps/mobile/src/components/insights-report-content.tsx apps/mobile/src/components/report-period-selector.tsx apps/mobile/src/components/energy-report-summary.tsx apps/mobile/src/components/macro-report-summary.tsx apps/mobile/src/components/highlighted-nutrient-summary.tsx apps/mobile/src/components/equivalent-period-comparison.tsx apps/mobile/src/components/full-period-report.tsx apps/mobile/src/components/complete-nutrient-report.tsx apps/mobile/src/lib/reporting-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git diff --check
  git add 'apps/mobile/src/app/(tabs)/insights.tsx' apps/mobile/src/components/insights-report-content.tsx apps/mobile/src/components/report-period-selector.tsx apps/mobile/src/components/energy-report-summary.tsx apps/mobile/src/components/macro-report-summary.tsx apps/mobile/src/components/highlighted-nutrient-summary.tsx apps/mobile/src/components/equivalent-period-comparison.tsx apps/mobile/src/components/full-period-report.tsx apps/mobile/src/components/complete-nutrient-report.tsx apps/mobile/src/lib/reporting-ui.ts apps/api/test/mobile-reporting-ui.test.ts
  git commit -m "feat: align Insights with approved reporting design"
  ```

## Task 6: Accessibility, Responsive Acceptance, And Regression QA

**Files:**

- Modify: `apps/api/test/mobile-reporting-ui.test.ts`
- Modify: any Task 2–5 mobile files only when a concrete QA defect is found
- Create outside the repository: native screenshots under `/tmp/food-tracker-phase-15-5/`

**Interfaces:**

- Consumes: all implemented reporting primitives/screens and the locked test fixtures.
- Produces: complete helper/UI-contract coverage, a responsive/accessibility checklist, and an implementation-review handoff that distinguishes automated results from native/physical results.

- [ ] **Step 1: Extend the focused test matrix**

  Cover pre-tracking plain dates; shared dotted open/future/missed visual state; disappearance of dots after logging; no-target full emerald ring; no gold in over-target state; black fraction consumption; one perfect-week band; nutrient row em-dash and no repeated `target`; all Complex groups initially expanded; independent group collapse; compact previous-period no-data; semantic labels for every state; day-detail sheet formatting; and unchanged Recommendations helper/lifecycle expectations.

- [ ] **Step 2: Run focused tests and inspect the rendered source for forbidden graphs/markers**

  ```bash
  corepack pnpm --filter @food-tracker/api test -- mobile-reporting-ui.test.ts reporting-domain.test.ts streak-calendar-domain.test.ts reporting-api.test.ts
  rg -n "RadialProgressRing|Pie|Sparkline|Donut|target arc|✓|×|G|↑|◐|future dot|placeholder" apps/mobile/src/app/streaks.tsx apps/mobile/src/app/'(tabs)' apps/mobile/src/components apps/mobile/src/lib
  ```

  Any remaining match must be reviewed against the approved exceptions before proceeding; remove production uses that are not the target-range rail, approved macro treatment, streak rings, or perfect-week band.

- [ ] **Step 3: Run modified-file formatting and the full automated baseline**

  ```bash
  node -v
  corepack pnpm -v
  corepack pnpm exec prettier --check apps/mobile/src/theme/tokens.ts apps/mobile/src/components/app-text.tsx apps/mobile/src/components/app-screen.tsx apps/mobile/src/components/app-card.tsx apps/mobile/src/components/streak-flame.tsx apps/mobile/src/components/grace-laurel-icon.tsx apps/mobile/src/components/streak-gold-band.tsx apps/mobile/src/components/radial-progress-ring.tsx apps/mobile/src/components/day-progress-ring.tsx apps/mobile/src/components/monthly-streak-calendar.tsx apps/mobile/src/components/streak-entry-action.tsx apps/mobile/src/components/streak-day-detail-sheet.tsx apps/mobile/src/components/progress-reporting-summary.tsx apps/mobile/src/components/energy-report-summary.tsx apps/mobile/src/components/macro-report-summary.tsx apps/mobile/src/components/highlighted-nutrient-summary.tsx apps/mobile/src/components/insights-report-content.tsx apps/mobile/src/components/report-period-selector.tsx apps/mobile/src/components/equivalent-period-comparison.tsx apps/mobile/src/components/full-period-report.tsx apps/mobile/src/components/complete-nutrient-report.tsx apps/mobile/src/lib/streak-calendar-ui.ts apps/mobile/src/lib/reporting-ui.ts 'apps/mobile/src/app/(tabs)/progress.tsx' 'apps/mobile/src/app/(tabs)/insights.tsx' apps/mobile/src/app/streaks.tsx apps/api/test/mobile-reporting-ui.test.ts docs/design-system.md
  corepack pnpm prisma:validate
  corepack pnpm format:check
  corepack pnpm lint
  corepack pnpm typecheck
  corepack pnpm build
  corepack pnpm test
  git diff --check
  ```

  Do not edit `.agents/skills/aidesigner-frontend/SKILL.md` to make formatting pass. Report any unrelated pre-existing formatter issue exactly.

- [ ] **Step 4: Perform native validation**

  Use the existing Expo development build/iOS workflow without modifying native files. Validate on the standard 390pt phone, narrow 320pt layout where possible, large Dynamic Type, VoiceOver, and reduced motion. Inspect and capture screenshots outside the repository for: populated/empty Progress, Insights Week/Month, expanded Complex nutrients, previous-period no-data, Recommendations, normal Streak month, perfect week, over-target, grace, day-detail sheet, History after shared-ring changes, and the flame at 24px. Reuse the known iPhone 17 Pro target after verifying the 10GB free-space gate; do not retry after storage/transport failure without fixing the cause.

- [ ] **Step 5: Run the implementation-review checklist**

  Confirm complete diff scope, no API/schema/migration/native/dependency changes, protected tooling files untouched, all four focused commit groups present, automated counts recorded, native/physical results recorded honestly, screenshot paths recorded, and unresolved defects explicitly listed. Do not declare Phase 15.5 complete until physical-device validation passes.

- [ ] **Step 6: Commit the test/QA group**

  ```bash
  git add apps/api/test/mobile-reporting-ui.test.ts
  git commit -m "test: validate phase 15.5 visual convergence"
  ```

## Self-Review Before Execution

- Figma requirements covered: Option B flame, crest, shared ring geometry, metallic gold, over-target black consumption, perfect-week band, Layout C hero, flat ledger, expanded Complex groups, compact previous-period no-data, and day-detail sheet.
- Locked state rules covered: FoodLog streaks, open today, future exclusion, grace span/count distinction, inclusive goal ranges, Sunday–Saturday, seven gold days, current-goal historical reporting, equivalent elapsed comparison, recorded-day nutrient percentages, independent Recommendations, and Simple/Complex modes.
- Accidental Phase 16 scope excluded: no time-series charts, sparklines, pie/donut charts, exports, widgets, notifications, or new tabs.
- Unsafe global redesign excluded: only shared affected visual tokens/shell behavior and listed reporting screens/components are changed; unrelated workflows and protected local tooling remain untouched.
- Test coverage includes helper behavior, semantic state differences, accessibility wording, row copy, group state, no-data state, and recommendation preservation.
- Native requirements are explicitly gated and the plan does not claim simulator/physical success before evidence exists.
