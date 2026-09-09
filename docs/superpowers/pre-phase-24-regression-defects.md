# Pre-Phase-24 Regression Defect Ledger

This ledger is the execution companion to the acceptance matrix. It remains
empty of defects until a scenario is actually reproduced. Every entry must
contain exact reproduction, evidence, severity, failing layer, falsifiable
root-cause hypothesis, regression coverage, targeted and neighboring results,
Simulator re-run, persistence/downstream verification, and focused commit.

| ID | Scenario | Reproduction/evidence | Severity | Failing layer | Root-cause hypothesis | Regression test | Fix/commit | Re-run evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | No verified defects recorded yet. | — | — | — | — | — | — | — | OPEN |

## Execution blockers (not product defects)

| ID | Checkpoint | Evidence | Impact | Next action |
| --- | --- | --- | --- | --- |
| ENV-SIM-001 | iOS Simulator UI harness | Xcode 27 beta successfully built `FoodTracker.app` for iOS 27, but both the QA iPhone 17 and a second iPhone 17 Pro Max hang during `simctl install`; the QA device also reported `Data Migration Failed`, and XcodeBuildMCP `snapshot_ui` timed out creating the remote automation session. | Simulator UI rows cannot be marked PASS from this checkout; no product conclusion is inferred. | Re-run after simulator runtime/service recovery or use the same verified bundle on a healthy supported simulator; preserve API/test evidence independently. |

## Inspection findings awaiting behavioral proof

| ID | Area | Finding | Required proof before remediation |
| --- | --- | --- | --- |
| AI-ARCH-HYPOTHESIS-001 | AI text logging | The current `/ai/food-parse` route calls the parse provider, then performs deterministic trusted retrieval/ranking; the text provider interface has no retrieval-evidence adjudication operation. This is an inspection finding, not yet a complete product-defect disposition. | Add request-boundary coverage and representative end-to-end evidence showing whether Gemini evaluates bounded retrieval candidates and whether trusted/review/fallback outcomes satisfy the canonical contract. If not, follow the root-cause loop and make the smallest architecture-preserving correction. |

## Deferred visual-only findings

Record spacing, typography, color, hierarchy, card, animation, and chart
aesthetic findings here or in linked Phase 24 issues. Do not mix them with
functional defects. The rule is: ugly is Phase 24; unusable is debugging.
