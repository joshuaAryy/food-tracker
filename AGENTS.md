# Food Tracker Engineering Operating Manual

## 1. Authority And Document Ownership

This file is the mandatory source of truth for engineering workflow and
architecture guardrails.

- `AGENTS.md`: required development, validation, Git, database, and Codex rules
- `README.md`: project overview, current capabilities, limitations, and quick start
- `docs/dev-setup.md`: detailed local environment and runtime setup
- `docs/mobile-ui-and-device-testing-context.md`: current mobile visual
  direction, onboarding decisions, known UI pitfalls, and native iPhone testing
  context
- `docs/troubleshooting.md`: recovery procedures for known development failures
- `docs/roadmap.md`: completed state and planned sequencing
- `docs/architecture.md`, `docs/api-contracts.md`,
  `docs/data-model-decisions.md`, and `docs/prisma-schema-decisions.md`: locked
  architecture, API, data, and schema decisions

If duplicated guidance conflicts, follow this file. Update documentation in the
same branch when behavior, setup, commands, or workflow requirements change.

## 2. Product And Architecture Invariants

Food Tracker is a mobile-first nutrition application focused on low-friction
manual tracking. Simple and Complex modes are views of the same application,
backend, database, and business logic.

The following rules are mandatory:

- The backend owns validation, persistence, nutrition calculations, analytics,
  and recommendation decisions.
- The mobile app renders backend facts and owns UI and local state. It MUST NOT
  calculate nutrition analytics or recommendation facts.
- Analytics and recommendation decisions MUST be deterministic and fully
  testable without AI.
- AI MAY later propose structured entries from user text or rewrite wording for
  already-computed recommendations.
- AI MUST NOT calculate calories or nutrients, analyze trends, detect deficits,
  decide recommendation facts, or query the database.
- Shared API and domain contracts belong in `packages/shared`.
- Preserve the pnpm workspace monorepo. Do not add Nx. Add Turborepo only after
  a demonstrated need.
- Preserve module ownership: food logs own food-log CRUD, analytics owns facts,
  and recommendations convert facts into recommendation objects.
- Do not introduce microservices, event buses, custom authentication, stored
  daily-summary sources of truth, or unnecessary abstractions.
- Firebase Authentication is the active identity boundary for current local and
  staging flows. Remaining account-lifecycle work is tracked in Phase 20, and
  clients MUST NOT send `userId`.
- Phase 17.5 is complete after completed Phase 17. Its source of truth is the
  approved Phase 17.5 plan and the aligned closeout documents listed in that
  plan. Hydration is complete in this phase; supplements remain deferred.
  Phase 18 — Additional Food Providers — is next.
- Phase 17.5 analytics keeps logging-day completeness separate from selected
  metric coverage. `complete`, `partial`, and `unlogged` describe FoodLog
  behavior; `in_progress` identifies the current local day; `recorded`,
  `partial`, and `unknown` describe authoritative metric availability.
  Unknown values are never zero, and missing nutrient data never changes a
  logging-day state.
- Authentication establishes who the user is; authorization determines which
  resources that user may access. Preserve both boundaries independently.
- Prisma schema or migration changes require explicit approval before editing.
- Existing regression coverage MUST NOT be removed, weakened, or bypassed to
  obtain a green validation result.

Mobile UI MUST use `docs/design-system.md` as the current implementation
baseline, support small phones, and include loading, error, and relevant empty
states for backend-connected screens. The mobile visual identity is still
exploratory: existing Phase 6.1 primitives, colors, cards, and tokens are
implementation tools, not the final visual direction. For onboarding, explicit
design references and user feedback override old visual assumptions, and the
existing onboarding look must not be preserved just because it exists. Preserve
the current mobile/onboarding/native testing context in
`docs/mobile-ui-and-device-testing-context.md`.

## 3. Required Environment

Required versions and services:

```text
Node.js: 22.x only
pnpm: 10.34.3
PostgreSQL: required for API persistence and backend tests
```

Before package installation, generation, build, tests, or implementation, run:

```bash
node -v
corepack pnpm -v
git status --short --branch
```

Rules:

- If `node -v` does not report `v22.x`, STOP and switch runtimes.
- Validation under Node 24 or any unsupported runtime is invalid.
- Any pnpm `Unsupported engine` warning invalidates the entire validation run.
- After switching to Node 22, rerun the complete validation sequence from the
  beginning.
- Do not report a task complete when Node 22 is unavailable.
- Prefer `corepack pnpm <command>`.
- If Corepack cannot provide pnpm, use `npx pnpm@10.34.3 <command>`.
- Do not require `corepack enable`; it may attempt a restricted global symlink.

Detailed environment setup is in `docs/dev-setup.md`.

## 4. Task-Start Procedure

Before editing files for a non-trivial task:

1. Inspect the current branch, working tree, relevant implementation, scripts,
   and locked decision documents.
2. Summarize the requested outcome, affected modules, constraints, and expected
   output.
3. State the files expected to change before implementation.
4. State whether API, database, shared contracts, mobile behavior, tests, or
   documentation will change.
5. Separate confirmed facts from assumptions.
6. Ask before making architecture changes, schema changes, dependency changes,
   folder restructuring, or broad cross-module rewrites.
7. Preserve unrelated user changes in a dirty worktree.

Prefer small, reversible, PR-sized changes using existing patterns. Do not
silently redesign architecture during feature work.

## 5. Branch Workflow

One branch represents one scoped task or phase.

### Start

1. Begin from a clean, current `main`.
2. Synchronize with `git pull --ff-only`.
3. Create a clearly named branch, for example:

```text
phase-5-2-core-log-management
chore/docs-workflow-hardening
fix/test-database-setup
```

4. Do not implement directly on `main`.
5. Do not mix unrelated fixes into the branch.

### Git State Vocabulary

- **Committed**: changes exist in the local branch history.
- **Pushed**: local commits were uploaded to a remote branch.
- **Merged**: branch commits are incorporated into `main`.

Pushed work is not merged work. Never report a branch as merged based only on a
successful push.

### Handoff And Merge Readiness

After final changes and validation, report:

```bash
git status --short --branch
git branch -vv
git log --oneline main..HEAD
git diff --check
```

The working tree must contain only intentional changes. Validation must be
complete before the branch is declared ready.

### Cleanup

- Verify the feature branch tip is reachable from updated `main` before deleting
  any branch.
- Delete local and remote branches only after merge is verified.
- If histories diverge, stop and inspect the commit graph.
- Do not force-push, rewrite shared history, delete unmerged work, or perform a
  manual repair merge without explicit approval.

## 6. Database Operating Rules

Standard local database names:

```text
Development: food_tracker
Tests:       food_tracker_test
```

Safety rules:

- Backend integration tests MUST use a dedicated database whose name ends in
  `_test`.
- Development and test URLs MUST NOT reference the same database.
- The test suite migrates and clears the selected test database.
- Tests MUST never read from, write to, migrate, or clean the development
  database.
- PostgreSQL being unavailable is an environment blocker, not permission to
  skip tests.
- Prisma `P1001` usually means PostgreSQL is stopped, unreachable, or configured
  with the wrong host/port.

Test database URL precedence:

1. `TEST_DATABASE_URL`
2. `DATABASE_URL_TEST`
3. `postgresql://postgres:postgres@localhost:5432/food_tracker_test`

Common commands:

```bash
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
corepack pnpm test
```

The test command automatically applies committed migrations to the test
database. Docker/PostgreSQL setup and recovery procedures are documented in
`docs/dev-setup.md` and `docs/troubleshooting.md`.

## 7. Required Validation Before Merge

Run the following sequence after all final edits:

```bash
node -v
corepack pnpm -v
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
git diff --check
git status --short --branch
```

Requirements:

- `node -v` MUST report `v22.x`.
- Every command must pass under the same Node 22 environment.
- An unsupported-engine warning makes the run invalid.
- Do not skip tests because PostgreSQL is unavailable.
- Report exact errors instead of vague summaries.
- Documentation-only branches normally use the complete baseline sequence, but
  an explicitly scoped docs-only closeout may narrow validation to changed-file
  formatting, local-link/command checks, `git diff --check`, and repository
  state. Report the unrun source checks rather than implying they passed.
- Root `build` currently verifies the shared package and API TypeScript build;
  it is not a complete native mobile bundle validation.
- Manual checks supplement automated tests; they do not replace them.

Additional validation by change type:

- Backend behavior: automated success, validation, persistence, ownership, and
  relevant lifecycle regression tests
- Database/schema: Prisma validation, committed migration review, migration
  deployment against a dedicated test database, and full tests
- Mobile behavior: lint/typecheck plus reported simulator or physical-device
  smoke testing until automated mobile tests exist
- API contract: shared types/schemas, API tests, and documentation updated
- Documentation: internal links, command accuracy, formatting, and changed-file
  scope verified

### Phase 17 free-Xcode standalone checkpoint

The guarded command is `corepack pnpm ios:staging-release`. It must run on the
Phase 17 branch or post-merge `main`, under Node 22 and pnpm 10.34.3, and must
reject unsafe API targets, missing staging selectors, public/server variable
confusion, missing Firebase public configuration, unsafe generated native
state, missing Xcode/CocoaPods/device prerequisites, and insufficient disk
space before prebuild. Set `EXPO_NO_DOTENV=1` and ensure
`EXPO_NO_CLIENT_ENV_VARS` is absent. Never print URLs, plist values, secrets,
Apple identifiers, device identifiers, signing material, or hosted values.

`apps/mobile/ios/` is generated Expo native state and remains ignored,
untracked, non-symlinked, and disposable. Clean prebuild and CocoaPods may
create it locally; the guarded cleanup may remove only that exact directory
after evidence capture. Preserve unrelated dirty and untracked files. Xcode
Personal Team selection, automatic signing, Release installation, and physical
iPhone validation are user-only checkpoints. EAS, TestFlight, App Store
Connect, production Railway, Apple Sign In, Android standalone distribution,
and paid external distribution are not Phase 17 work.

## 8. Code Quality And Architecture Rules

- TypeScript strict mode remains enabled.
- Avoid `any`; use strong domain and API types.
- Prefer composition, focused modules, and existing reusable components.
- Do not add abstractions without a current use case.
- Do not move backend business logic into the frontend.
- Do not place recommendation fact calculations inside the recommendation
  wording layer.
- Do not add random colors or one-off mobile styles when documented tokens or
  shared components apply.
- Do not introduce payments, social features, Kubernetes, event buses,
  microservices, complex custom auth, or broad AI integration.
- Optimize for simplicity, maintainability, and development speed before
  speculative scale.

## 9. Codex Operating Rules

Codex MUST:

- Summarize understanding before meaningful changes.
- State planned files and affected systems before editing.
- Inspect actual repository state rather than relying on roadmap claims.
- Preserve existing architecture and unrelated user work.
- Ask for approval before schema, architecture, dependency, or folder-structure
  changes.
- Explain meaningful implementation tradeoffs.
- Never silently redesign architecture.
- Never skip, shorten, or misrepresent required validation.
- Never treat Node 24 validation as acceptable.
- Report exact commands, Node and pnpm versions, test counts, validation
  failures, manual checks, and unvalidated areas.
- Distinguish committed, pushed, merged, and deleted-branch states.
- Never force-push, delete branches, or perform destructive Git operations
  without the required verification and authorization.
- Finish with what changed, why, risks, and the next practical step.

## 9.1 Execution Style And Delegation

The repository supports ordinary single-threaded work, agent-assisted work,
and bounded parallel delegation. Agents are optional accelerators, not a
required architecture or a measure of task quality.

Choose the execution mode from the work:

- Stay single-threaded for small changes, tightly coupled work, documentation
  passes, sequential debugging, shared-state edits, and any task whose next
  step depends immediately on the current result.
- Delegate only a bounded, reviewable task that materially reduces wall-clock
  time. Good examples are independent test coverage, a disjoint documentation
  audit, or one self-contained visual comparison.
- Do not delegate tiny edits, duplicate investigations, architecture decisions,
  physical-device acceptance, signing, credentials, or external-state actions.
- Reuse an existing worker when the context is valuable. Do not create an agent
  for every file or metric family.

When delegation is useful, use bounded resources:

- Default to approximately 2–3 active subagents, with a soft maximum of 4.
- Queue work rather than spawning another worker when an existing result will
  arrive soon or the tasks share state.
- Start with the lowest reasonably capable reasoning intensity. Escalate only
  for a concrete unresolved blocker after lower-cost investigation; Terra or
  Terra Max is an exception requiring a narrow question and written reason,
  never a default implementation tier.
- The coordinator owns scope, duplicate avoidance, integration, and the final
  evidence review. Delegated output is not self-validating.

### Visual-fidelity execution gates

Visual work is complete only when its applicable gates are separately recorded:

1. Implementation gate: the intended source change is present and approved
   semantics, contracts, and tokens are preserved.
2. Automated validation gate: focused and required regression checks pass under
   the supported runtime.
3. Runtime capture gate: the real app runs with the declared state, account,
   backend target, and viewport; screenshots are captured from that runtime.
4. Independent review gate: a reviewer compares the runtime evidence with the
   exact authoritative Figma node or acceptance reference and lists findings.
5. Physical acceptance gate: the user performs any required signing,
   installation, and physical-device validation. Codex must report this as
   user-owned and separate from Simulator evidence.

Do not claim a gate from a nearby viewport, an old screenshot, a source-only
inspection, a test fixture, or a runtime whose boot, install, authentication,
backend target, or seeded state was not proven. If an external prerequisite is
missing, record the specific checkpoint as blocked or pending user validation,
stop claiming downstream progress, and do not mark the phase complete. A
blocked checkpoint is not permission to substitute invalid evidence or invent
certainty; continue only with independent in-scope work.

## 10. Phase Closeout Standard

Every phase closeout must record the following in the appropriate existing
documents:

- completion status and intended scope versus delivered scope;
- important architecture decisions and decisions now locked;
- UX review findings and regression-sensitive behaviour;
- automated validation with runtime, commands, and test counts;
- simulator or physical-device validation where relevant, including who
  performed it;
- documentation alignment, known limitations, and remaining risks;
- mistakes, root causes, implemented corrections, and prevention rules;
- intentionally deferred or excluded work;
- the next-phase recommendation.

The roadmap must contain a concise phase-level completion summary. Detailed
lessons belong in the existing architecture, technical-decision, AI/data,
mobile-testing, or workflow documents that own them. Future roadmap entries
must remain phase-level; implementation slices are planned only when that
phase begins.

Before declaring a phase closed, search for stale phase, branch, checkpoint,
provider, and pending-work wording. Confirm that no unintended product code,
schema, migration, dependency, lockfile, generated-native, or unrelated
changes are included. Documentation-only closeouts still run the complete
validation sequence in Section 7.

## 11. Completion Report

Every implementation handoff must include:

```text
Changed:
Why:
Validation environment:
Commands run:
Automated results:
Manual validation:
Git state:
Known limitations or risks:
Suggested next step:
```

Do not claim persistence works unless create-then-read behavior has been
verified. Do not claim a mobile flow works unless its relevant automated or
manual validation is reported.
