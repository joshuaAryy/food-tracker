# Pre-Phase-24 Targeted Physical-iPhone UAT Checklist

This is the user-owned device checkpoint after the Codex Simulator critical
journeys, automated validation, committed candidate, and verified staging
deployment are green. It is intentionally short; it must not repeat the full
Simulator matrix.

## Preconditions supplied by Codex

- Branch and candidate SHA: `pre-phase-24-product-regression-debugging` at
  `cf68208c8a65b910ff19d9ec299bfdb67aca6ef0` (pushed; no PR or merge).
- Staging deployment ID and served provenance: prior verified staging
  deployment `f522fae3-825e-425c-810d-344fc850db6d`, built from the exact
  archived API candidate `14c0472c1aeb59abe75e4f0cf8507dd70e74a98a`; a fresh
  exact-HEAD upload was rejected before deployment by the Railway SFO
  free-tier peak-hours gate and must be retried before current-HEAD staging
  acceptance.
- Simulator critical-journey result: signed-out and staging cold-launch
  journeys are evidenced; the native candidate builds and installs on iOS 27.
  Authenticated, mutation-heavy, and real AI-review journeys remain pending
  approved QA identities, and are not inferred from automated coverage.
- Automated validation counts: API 116 files / 1,401 tests; mobile Jest 68
  suites / 203 tests; mobile Vitest 64 files / 438 tests; lint, typecheck,
  build, Prisma generate/validate, and test-database migration checks pass.
- QA account state and fixture anchor: dedicated QA A/B and disposable C
  identities are unavailable; no everyday account was used, reset, reseeded,
  switched, or deleted. Identity-dependent matrix rows remain blocked.
- Device model / iOS version / build configuration: iOS 27 Simulator on
  `Food Tracker Fresh QA iPhone 17`, Debug `FoodTracker` workspace build;
  physical iPhone model/iOS and user-operated acceptance remain pending.

Do not run this checklist against production. Do not use an everyday account
for destructive testing. Account deletion remains restricted to explicitly
disposable QA C and is not performed on the physical device unless the
execution record explicitly identifies C.

## Codex stop-point and remaining QA-account work

The current Codex checkpoint has automated contract evidence for the major
backend slices and signed-out/staging Simulator evidence. Automated PASS does
not close the corresponding real UI journey. Before the physical pass, use the
approved identities as follows:

- QA A: authenticated relaunch, the complete AI review corpus including the
  `1 apple` recovery journey, and Simple/Complex continuity.
- QA B: the recognizable second account for sign-out/account-switch isolation
  and delayed-response checks.
- Disposable QA C: confirmation, completion, post-delete routing, and owned-data
  cleanup for the destructive deletion journey.

Do not substitute an everyday account, bypass Firebase authentication, or
reinterpret API-only evidence as Simulator UI evidence. If the identities are
unavailable, leave those matrix rows blocked and continue only with independent
work.

## Device-only checks

Record `PASS`, `FAIL`, or `BLOCKED` plus a short observation for every item.

| ID | Check | Expected result | Result / evidence |
| --- | --- | --- | --- |
| PHYS-01 | Cold launch without Metro | App launches on the installed candidate and reaches the expected signed-out or authenticated route without a loop. | |
| PHYS-02 | Camera permission and real camera | Permission prompt, grant/deny recovery, camera preview, capture, cancel, and retry remain usable. | |
| PHYS-03 | Photo library and HEIC | Library permission, portrait/landscape, HEIC selection, preprocessing, review, and original-library preservation work. | |
| PHYS-04 | Barcode scanner | Real packaged-food scan normalizes, looks up, displays serving data, and reaches a recoverable save/retry state. | |
| PHYS-05 | AI `1 apple` recovery | Text result with incomplete unit state allows amount/unit edit, replacement/removal, cancel/back, continue, save, and History agreement. | |
| PHYS-06 | Touch, keyboard, and reachability | Required fields and Save/Cancel actions remain reachable with the physical keyboard and normal touch/scroll behavior. | |
| PHYS-07 | Complex nutrient states | Numeric value, explicit zero, and Unknown remain distinct after save/reopen where the QA fixture exposes the correction flow. | |
| PHYS-08 | Water and mode switching | Water entry/edit/Undo and Simple ↔ Complex switching preserve one canonical state. | |
| PHYS-09 | Lifecycle | Background/foreground, terminate, and relaunch preserve the expected auth and recoverable screen state. | |

## Reporting

Attach device model/iOS version, candidate SHA, screenshots or screen
recordings only when useful, and exact reproduction for every failure. Report
camera/scanner/permission/filesystem limitations separately from Simulator
results. A physical `BLOCKED` result is not a Simulator PASS and is not silently
substituted by source inspection or an automated test.
