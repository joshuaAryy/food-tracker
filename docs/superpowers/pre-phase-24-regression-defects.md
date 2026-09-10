# Pre-Phase-24 Regression Defect Ledger

This ledger is the execution companion to the acceptance matrix. It remains
empty of defects until a scenario is actually reproduced. Every entry must
contain exact reproduction, evidence, severity, failing layer, falsifiable
root-cause hypothesis, regression coverage, targeted and neighboring results,
Simulator re-run, persistence/downstream verification, and focused commit.

| ID | Scenario | Reproduction/evidence | Severity | Failing layer | Root-cause hypothesis | Regression test | Fix/commit | Re-run evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | No additional verified defects recorded beyond the entries below. | — | — | — | — | — | — | — | OPEN |
| AI-RAG-001 | Text AI accepted deterministic retrieval without post-retrieval adequacy judgment | The first request-boundary regression run expected a parse request plus a bounded candidate-evaluation request, but observed only one Gemini request; the route's provider interface exposed parse only and `retrieveParsedFoodItems` output was returned directly. | P1 | API AI text orchestration | Parse and retrieval were separate, but no provider/evaluation boundary existed to classify excellent, review-required, or fallback-eligible candidates. | `ai-food-parse.test.ts` now proves candidate evidence is sent, an ambiguous candidate becomes `needs_review`, and invalid/incomplete evaluation cannot preserve a trusted result; neighboring AI/serving tests pass. | `c73d018`, `697236a`, `cb51c62` | Full API suite 116 files / 1,401 tests green; Simulator UI re-run blocked by `ENV-SIM-001`. | FIXED-AUTOMATED |

## Execution blockers (not product defects)

| ID | Checkpoint | Evidence | Impact | Next action |
| --- | --- | --- | --- | --- |
| ENV-SIM-001 | iOS Simulator UI harness | The host-disk blocker was cleared without repository or protected-state changes. On fresh iOS 27 simulator `A716FD01-3A7D-4D5C-90D7-71C139F9EAD1`, the approved Xcode beta workspace build completed with `** BUILD SUCCEEDED **`, produced a valid `FoodTracker.app`/`Info.plist`, installed, and launched. XcodeBuildMCP `snapshot_ui` now captures the accessibility hierarchy. The development client is visibly running and the approved Metro server is visible, but the iOS system “Open in Food Tracker?” confirmation triggered by the Metro deep link does not respond to XcodeBuildMCP tap/touch/key actions; no product-flow PASS is inferred from the dev-client screen. | Native install/launch/accessibility setup is evidenced; signed-out and authenticated product rows remain unvalidated until the Metro confirmation can be completed or a verified standalone bundle is available. | Use the existing approved Metro/development-client workflow or a verified standalone bundle; do not erase the QA simulators or infer product UAT from the system-dialog screen. |
| ENV-STAGE-001 | Railway staging provenance | Read-only Railway deployment metadata verifies the sleeping `food-tracker-staging-api` currently serves `3f155b6f133aabe9ec216204523b4efd1b79cbf9` from the older `phase-20-22-product-hardening-intelligence` branch, not this debugging branch. The exact archived candidate upload was attempted and Railway first returned 502, then rejected the SFO free-tier deploy during the 8 AM–8 PM America/Los_Angeles peak window. The health endpoint returned 200 only after waking the old service and is not treated as product evidence. | Cold-start/staging rows cannot be marked PASS against the current candidate; no deployment was performed. | After the provider window permits deployment, deploy the exact debugging-branch SHA under the authorized staging-only policy and re-verify Railway provenance before UAT. |
| ENV-AUTH-001 | Dedicated QA identities | Repository inspection found no approved QA A/B/C credentials or identities. No everyday account was used, reset, reseeded, switched, or deleted. | Authenticated, isolation, deletion, and dependent Simulator rows remain blocked rather than substituted or bypassed. | Supply/use the explicitly designated Firebase-linked QA A/B accounts and disposable C account during the authorized execution checkpoint. |

## Inspection findings and dispositions

| ID | Area | Finding | Required proof before remediation |
| --- | --- | --- | --- |
| AI-ARCH-HYPOTHESIS-001 | AI text logging | Execution proved the planning hypothesis: the first request-boundary regression observed only parsing/retrieval and no candidate-adequacy judgment. The defect is tracked as `AI-RAG-001` and fixed in the existing provider/retrieval boundary. | API request-boundary coverage now proves bounded evidence evaluation, trusted/review decisions, and invalid/incomplete-decision rejection. Real UI confirmation remains blocked by `ENV-SIM-001`; keep `AI-APPLE-MISSING-UNIT` as a separate UI recovery scenario. |

## Deferred visual-only findings

Record spacing, typography, color, hierarchy, card, animation, and chart
aesthetic findings here or in linked Phase 24 issues. Do not mix them with
functional defects. The rule is: ugly is Phase 24; unusable is debugging.
