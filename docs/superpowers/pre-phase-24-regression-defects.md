# Pre-Phase-24 Regression Defect Ledger

This ledger is the execution companion to the acceptance matrix. It remains
empty of defects until a scenario is actually reproduced. Every entry must
contain exact reproduction, evidence, severity, failing layer, falsifiable
root-cause hypothesis, regression coverage, targeted and neighboring results,
Simulator re-run, persistence/downstream verification, and focused commit.

| ID | Scenario | Reproduction/evidence | Severity | Failing layer | Root-cause hypothesis | Regression test | Fix/commit | Re-run evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | No verified defects recorded yet. | — | — | — | — | — | — | — | OPEN |
| AI-RAG-001 | Text AI accepted deterministic retrieval without post-retrieval adequacy judgment | The first request-boundary regression run expected a parse request plus a bounded candidate-evaluation request, but observed only one Gemini request; the route's provider interface exposed parse only and `retrieveParsedFoodItems` output was returned directly. | P1 | API AI text orchestration | Parse and retrieval were separate, but no provider/evaluation boundary existed to classify excellent, review-required, or fallback-eligible candidates. | `ai-food-parse.test.ts` now proves candidate evidence is sent and an ambiguous candidate becomes `needs_review`; neighboring AI/serving tests pass. | Pending focused commit | Full API suite 116 files / 1,400 tests green; Simulator UI re-run blocked by `ENV-SIM-001`. | FIXED-AUTOMATED |

## Execution blockers (not product defects)

| ID | Checkpoint | Evidence | Impact | Next action |
| --- | --- | --- | --- | --- |
| ENV-SIM-001 | iOS Simulator UI harness | Xcode 27 beta successfully built `FoodTracker.app` for iOS 27, but both the QA iPhone 17 and a second iPhone 17 Pro Max hang during `simctl install`; the QA device also reported `Data Migration Failed`, and XcodeBuildMCP `snapshot_ui` timed out creating the remote automation session. | Simulator UI rows cannot be marked PASS from this checkout; no product conclusion is inferred. | Re-run after simulator runtime/service recovery or use the same verified bundle on a healthy supported simulator; preserve API/test evidence independently. |
| ENV-STAGE-001 | Railway staging provenance | Read-only Railway deployment metadata verifies the sleeping `food-tracker-staging-api` currently serves `3f155b6f133aabe9ec216204523b4efd1b79cbf9` from the older `phase-20-22-product-hardening-intelligence` branch, not this debugging branch. The health endpoint returned 200 only after waking the service and is not treated as product evidence. | Cold-start/staging rows cannot be marked PASS against the current candidate; no deployment was performed. | After the candidate is verified and committed, deploy that exact debugging-branch SHA under the authorized staging-only policy and re-verify Railway provenance before UAT. |
| ENV-AUTH-001 | Dedicated QA identities | Repository inspection found no approved QA A/B/C credentials or identities. No everyday account was used, reset, reseeded, switched, or deleted. | Authenticated, isolation, deletion, and dependent Simulator rows remain blocked rather than substituted or bypassed. | Supply/use the explicitly designated Firebase-linked QA A/B accounts and disposable C account during the authorized execution checkpoint. |

## Inspection findings awaiting behavioral proof

| ID | Area | Finding | Required proof before remediation |
| --- | --- | --- | --- |
| AI-ARCH-HYPOTHESIS-001 | AI text logging | The current `/ai/food-parse` route calls the parse provider, then performs deterministic trusted retrieval/ranking; the text provider interface has no retrieval-evidence adjudication operation. This is an inspection finding, not yet a complete product-defect disposition. | Add request-boundary coverage and representative end-to-end evidence showing whether Gemini evaluates bounded retrieval candidates and whether trusted/review/fallback outcomes satisfy the canonical contract. If not, follow the root-cause loop and make the smallest architecture-preserving correction. |

## Deferred visual-only findings

Record spacing, typography, color, hierarchy, card, animation, and chart
aesthetic findings here or in linked Phase 24 issues. Do not mix them with
functional defects. The rule is: ugly is Phase 24; unusable is debugging.
