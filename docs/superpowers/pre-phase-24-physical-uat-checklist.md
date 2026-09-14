# Pre-Phase-24 Targeted Physical-iPhone UAT Checklist

This was the user-owned device checkpoint after the Codex Simulator critical
journeys, automated validation, committed candidate, and verified staging
deployment were green. It is intentionally short and did not repeat the full
Simulator matrix. The gate is complete as of 2026-09-14.

## Preconditions supplied by Codex

- Runtime source candidate: mobile correction `75a64ec` on
  `pre-phase-24-product-regression-debugging`; later branch checkpoints are
  documentation-only and do not change this runtime. The fixed physical build
  was installed and exercised on the device (pushed; no PR or merge).
- Staging deployment evidence: current deployment
  `94a303eb-5cce-4a90-9a67-8f4c14828b78` served exact commit
  `251ef3ce36e652172832b9feda906b26a98f080e` from the debugging branch. Both
  API and Postgres were sleeping before the un-prewarmed QA A Simulator launch;
  the first app-triggered request recorded transient wake refusals, then setup,
  profile, dashboard, analytics, and goals recovered with 200 responses. The
  Simulator reached authenticated Complex Progress/Profile without a crash or
  bootstrap loop, so COLD-002 is green.
- Simulator critical-journey result: authenticated QA A/B switching,
  mutation-heavy logging/history/library/analytics journeys, and AI review and
  recovery are evidenced on iOS 27. The native candidate builds and installs
  successfully with the approved Xcode beta; staging cold-launch was not
  claimed from the earlier blocked deployment and was later verified by
  COLD-002 against the served deployment recorded above.
- Automated validation counts: API 116 files / 1,401 tests; mobile Jest 72
  suites / 213 tests; mobile Vitest 68 files / 447 tests; workspace lint,
  typecheck, build, Prisma generate/validate, and test-database migration
  checks pass.
- QA account state and fixture anchor: dedicated QA A and B are available and
  verified; QA C was verified and permanently deleted through the authorized
  deletion journey. QA A's canonical `QA Archive Probe` fixture was restored;
  no everyday account was used or mutated.
- Device model / iOS version / build configuration: Josh's physical iPhone 15
  Pro (`iPhone16,1`), iOS 27.0, OS build `24A5418b`; fixed build containing
  `75a64ec` installed and tested.

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
| PHYS-01 | Cold launch without Metro | App launches on the installed candidate and reaches the expected signed-out or authenticated route without a loop. | PASS — effectively immediate (~1–2 s), usable auth flow, no crash or loop. |
| PHYS-02 | Camera permission and real camera | Permission prompt, grant/deny recovery, camera preview, capture, cancel, and retry remain usable. | PASS — permission, live preview, capture, back-out, and reopen verified. |
| PHYS-03 | Photo library and HEIC | Library permission, portrait/landscape, HEIC selection, preprocessing, review, and original-library preservation work. | PASS — portrait, landscape, and an iPhone-camera-origin photo path reached review; original remained intact. |
| PHYS-04 | Barcode scanner | Real packaged-food scan normalizes, looks up, displays serving data, and reaches a recoverable save/retry state. | PASS AFTER FIX — serving initialized without Reset; first unit, edits, conversions, save, History, cancel, and retry verified. |
| PHYS-05 | AI `1 apple` recovery | Text result with incomplete unit state allows amount/unit edit, replacement/removal, cancel/back, continue, save, and History agreement. | PASS — editable recovery, save, and History agreement verified. |
| PHYS-06 | Touch, keyboard, and reachability | Required fields and Save/Cancel actions remain reachable with the physical keyboard and normal touch/scroll behavior. | PASS — Log Food, History, Water, Goals, and Profile actions remained reachable. |
| PHYS-07 | Complex nutrient states | Numeric value, explicit zero, and Unknown remain distinct after save/reopen where the QA fixture exposes the correction flow. | PASS — `2`, explicit `0`, and Unknown remained distinct after reopen. |
| PHYS-08 | Water and mode switching | Water entry/edit/Undo and Simple ↔ Complex switching preserve one canonical state. | PASS — quick-add, Keep/Undo, and mode transitions preserved one water state. |
| PHYS-09 | Lifecycle | Background/foreground, terminate, and relaunch preserve the expected auth and recoverable screen state. | PASS — repeated background/foreground and full relaunch recovered normally without duplication. |

## Reporting

The completed record identifies Josh's iPhone 15 Pro (`iPhone16,1`), iOS 27.0,
OS build `24A5418b`, and the fixed candidate containing `75a64ec`. All PHYS-01
through PHYS-09 checks passed. Camera, barcode, photo-library/HEIC, touch,
keyboard, persistence, and lifecycle observations were made on the physical
device; they are not substituted by Simulator or automated evidence.
