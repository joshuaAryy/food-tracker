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
| ENV-SIM-001 | iOS Simulator UI harness | The host-disk blocker was cleared without repository or protected-state changes. On fresh iOS 27 simulator `A716FD01-3A7D-4D5C-90D7-71C139F9EAD1`, the approved Xcode beta workspace build completed with `** BUILD SUCCEEDED **`, produced a valid `FoodTracker.app`/`Info.plist`, installed, and launched. XcodeBuildMCP `snapshot_ui` now captures the accessibility hierarchy. The development client’s custom-scheme confirmation does not respond to XcodeBuildMCP tap/touch/key actions. A separate already-booted non-QA iPhone 17 Pro Max accepted the existing bundle and the supported Expo `--initialUrl` launch argument; after clearing only its Expo dev-menu onboarding preference, real host-window interaction plus XcodeBuildMCP snapshots reached the signed-out screen, password-reset screen, sign-in return path, and create-account empty-form validation. A cold relaunch reached signed-out controls again. | Native install/launch/accessibility setup and these signed-out navigation journeys are evidenced on the non-QA Simulator. XcodeBuildMCP element actions still report success without reliably changing some React Native targets on iOS 27, so host-window interaction is the evidence path for reachable signed-out controls; authenticated and mutation journeys still require the approved QA accounts and a reliable target interaction path. | Continue with the supported `--initialUrl` path on the non-QA Simulator for reachable journeys; do not erase/reset either Food Tracker QA simulator or infer authenticated UAT without QA identities. |
| ENV-STAGE-001 | Railway staging provenance | Read-only metadata still identifies the prior sleeping deployment as `3f155b6f133aabe9ec216204523b4efd1b79cbf9` from the older `phase-20-22-product-hardening-intelligence` branch. During the off-peak window, an exact `git archive` of `14c0472c1aeb59abe75e4f0cf8507dd70e74a98a` was submitted to the existing `food-tracker-staging-api` staging service. Railway created deployment `b0d04d9b-c9d2-414f-94d3-647007339f59`, but the CLI then failed with TLS `BadRecordMac`; the deployment remains `INITIALIZING` without candidate commit metadata or health evidence. Deployment logs are empty and Railway reports that the deployment has no associated build. | Cold-start/staging rows remain BLOCKED; neither the old health response nor the initializing deployment is product evidence. No production service or data was touched. | Monitor the authorized staging deployment; if it fails, retry only with the exact committed candidate when Railway accepts uploads, then verify deployed SHA/provenance before UAT. |
| ENV-AUTH-001 | Dedicated QA identities | Repository inspection found no approved QA A/B/C credentials or identities. No everyday account was used, reset, reseeded, switched, or deleted. | Authenticated, isolation, deletion, and dependent Simulator rows remain blocked rather than substituted or bypassed. | Supply/use the explicitly designated Firebase-linked QA A/B accounts and disposable C account during the authorized execution checkpoint. |

## Inspection findings and dispositions

| ID | Area | Finding | Required proof before remediation |
| --- | --- | --- | --- |
| AI-ARCH-HYPOTHESIS-001 | AI text logging | Execution proved the planning hypothesis: the first request-boundary regression observed only parsing/retrieval and no candidate-adequacy judgment. The defect is tracked as `AI-RAG-001` and fixed in the existing provider/retrieval boundary. | API request-boundary coverage now proves bounded evidence evaluation, trusted/review decisions, and invalid/incomplete-decision rejection. Real UI confirmation remains blocked by `ENV-SIM-001`; keep `AI-APPLE-MISSING-UNIT` as a separate UI recovery scenario. |

## Deferred visual-only findings

Record spacing, typography, color, hierarchy, card, animation, and chart
aesthetic findings here or in linked Phase 24 issues. Do not mix them with
functional defects. The rule is: ugly is Phase 24; unusable is debugging.
