# Phase 17.5 Progress physical regression record

## Scope

This record covers the two regressions reported from the physical iPhone
Insights/Progress validation build:

- Pull-to-refresh on Progress did not respond reliably.
- The Progress Simple/Complex mode switch did not change mode reliably, while
  the same preference changed through Settings.

Physical confirmation remains user-operated. This document records the source
inspection, deterministic automated seams, and the required release retest; it
does not claim that Codex operated or validated the iPhone.

## Source investigation and automated boundary

The Progress surface already uses `AppScreen` with React Native
`RefreshControl`, so the recovery did not introduce a replacement Progress
design. The automated regression harness now verifies:

1. the `RefreshControl` is attached to the actual Progress scroll view;
2. invoking its `onRefresh` callback requests a fresh summary while committed
   Progress content remains mounted;
3. a newer load generation cannot be overwritten by an older response;
4. the mode preference is persisted before launcher-icon synchronization is
   awaited; and
5. launcher-icon synchronization is fire-and-forget and cannot prevent the
   persisted tracking mode from becoming visible.

The corresponding test is
`apps/mobile/src/app/(tabs)/__tests__/progress-regressions.test.tsx`, with
stable fixtures in
`apps/mobile/src/lib/progress/progress-transition-fixtures.ts`.

## User-operated release retest

On a standalone Release build, the user should verify the following sequence
with the API and Metro disconnected where the release checklist requires it:

1. Open Progress, pull from the real scrollable content surface, and confirm a
   refresh spinner appears and the refreshed summary replaces the committed
   summary.
2. Switch Simple to Complex and back repeatedly from the Progress mode badge.
3. Repeat the switch during a focus reload and while a refresh is pending.
4. Confirm Settings, Progress, the backend preference, and the launcher icon
   converge after each switch.
5. If icon synchronization fails or logs a UIKit/main-thread warning, confirm
   the tracking mode is still persisted and visible in Progress and Settings.

Record the device/build, exact observed behavior, and whether the result was
performed by the user. Do not mark this physical retest complete from Jest,
source inspection, or simulator output.

## R12.2 physical handoff status — 2026-08-12

The automated recovery gate is complete under Node `v22.23.0` and pnpm
`10.34.3`, including the PostgreSQL-backed API suite against
`food_tracker_test`, mobile Vitest and Jest suites, typechecks, lints, builds,
owned formatting, source diagnostics scan, and `git diff --check`.

Physical standalone iPhone acceptance remains **PENDING USER VALIDATION**.
The next device evidence must use a newly prepared staging Release because the
mobile implementation changed substantially. The user, not Codex, must select
Personal Team signing in Xcode, build/install Release, run the artifact
verifier, and execute the ordered Phase 17.5 physical checklist. Do not run
the generated-iOS cleanup until that user validation is finished.

Phase merge is **NOT AUTHORIZED** pending that user-operated acceptance.
