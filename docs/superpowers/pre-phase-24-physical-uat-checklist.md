# Pre-Phase-24 Targeted Physical-iPhone UAT Checklist

This is the user-owned device checkpoint after the Codex Simulator critical
journeys, automated validation, committed candidate, and verified staging
deployment are green. It is intentionally short; it must not repeat the full
Simulator matrix.

## Preconditions supplied by Codex

- Branch and candidate SHA: `pre-phase-24-product-regression-debugging` at
  `fbfe2cd75e083e040eaa32a0835b7a5974663ccd` (pushed; no PR or merge).
- Staging deployment ID and served provenance: prior verified staging
  deployment `f522fae3-825e-425c-810d-344fc850db6d`, built from the exact
  archived API candidate `14c0472c1aeb59abe75e4f0cf8507dd70e74a98a`; a fresh
  exact-HEAD upload of committed candidate `42b4d5b` using `--path-as-root`
  was accepted through indexing/upload but rejected by the Railway SFO
  free-tier peak-hours gate (8 AM–8 PM America/Los_Angeles); no new deployment
  was created. Retry outside that window before current-candidate staging
  acceptance.
- Simulator critical-journey result: authenticated QA A/B switching,
  mutation-heavy logging/history/library/analytics journeys, AI review and
  recovery, and staging cold-launch are evidenced on iOS 27. The native
  candidate builds and installs successfully with the approved Xcode beta.
- Automated validation counts: API 116 files / 1,401 tests; mobile Jest 70
  suites / 211 tests; mobile Vitest 67 files / 444 tests; workspace lint,
  typecheck, build, Prisma generate/validate, and test-database migration
  checks pass.
- QA account state and fixture anchor: dedicated QA A and B are available and
  verified; QA C was verified and permanently deleted through the authorized
  deletion journey. QA A's canonical `QA Archive Probe` fixture was restored;
  no everyday account was used or mutated.
- Device model / iOS version / build configuration: iOS 27 Simulator on
  `Food Tracker Fresh QA iPhone 17`, Debug `FoodTracker` workspace build;
  physical iPhone model/iOS and user-operated acceptance remain pending.

Do not run this checklist against production. Do not use an everyday account
for destructive testing. Account deletion remains restricted to explicitly
disposable QA C and is not performed on the physical device unless the
execution record explicitly identifies C.

## Codex stop-point and account coverage

The current Codex checkpoint has green automated contract evidence and broad
authenticated Simulator coverage. Automated PASS does not replace observed
UI evidence; the matrix records those evidence types separately. Account
coverage is complete for the planned non-destructive A/B journeys:

- QA A: authenticated relaunch, the complete AI review corpus including the
  `1 apple` recovery journey, and Simple/Complex continuity.
- QA B: the recognizable second account for sign-out/account-switch isolation
  and delayed-response checks.
- Disposable QA C: confirmation, completion, post-delete routing, and owned-data
  cleanup were completed; C must not be recreated or reused.

Do not substitute an everyday account or bypass Firebase authentication. Do not
reinterpret API-only evidence as Simulator UI evidence. No further destructive
account action is authorized.

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
