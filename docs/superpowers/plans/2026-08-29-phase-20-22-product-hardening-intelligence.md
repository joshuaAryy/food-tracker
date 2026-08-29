# Phase 20–22 — Product Hardening + Intelligence Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to execute this plan task-by-task with TDD and checkpoint commits. Do not stop after a successful task.

**Goal:** Deliver the internally verifiable Phase 20–22 product-hardening and intelligence macro phase on `phase-20-22-product-hardening-intelligence`.

**Architecture:** Backend-owned age-aware personalization, DRI/reference compatibility, effective-target resolution, analytics facts, deterministic recommendations, and a bounded Expo push worker. Mobile renders these contracts and owns only UI/local state.

**Tech Stack:** Node 22.x, pnpm 10.34.3, TypeScript, Express, Prisma 6/PostgreSQL, Vitest, Expo SDK 56, Expo Router, React Native, Zustand, Firebase Authentication.

**Spec:** `docs/superpowers/specs/2026-08-29-phase-20-22-product-hardening-intelligence-design.md`

## Global constraints

- Do not create or switch branches; do not create PRs; do not merge; do not push `main); do not force-push or delete branches.
- Preserve protected `.agents/`, `.aidesigner/`, `.codex/`, `.superpowers/`, `backups/`, current design-reference images, generated native directories, and local PostgreSQL safety state.
- Never use `git add .` or `git add -A`.
- Use Node 22.x and pnpm 10.34.3 for every install, generate, test, build, and validation command.
- Use only a dedicated database ending in `_test` for destructive test migration work.
- Do not reset development or benchmark databases.
- Calories and protein remain required FoodLog columns and cannot be Unknown in this phase.
- Age never blocks product access; automatic rate planning is age 19+ only.
- Health Canada/NASEM 2023 EER is the canonical energy model for all supported ages.
- DRI targets require semantic/provider compatibility, not unit matching alone.
- Target authority is effective resolver output; deprecated UserGoal columns are retained but never read as authority.
- Recommendation facts and ranking are deterministic and AI-free.
- Push cap is one claimed opportunity per user/local day, not one submitted event.
- Production rejects fixed-clock overrides.
- Phase 24 redesign and Phase 23 supplements remain out of scope.

---

## Task 1: Baseline, durable artifacts, and migration safety

**Files:**
- Modify: existing docs only as required by the approved artifacts
- Create: migration test fixtures and focused baseline helpers where needed
- Read: `AGENTS.md`, roadmap, architecture/API/data-model/Prisma docs, Phase 17/17.5 and Phase 18/19 closeout docs

**Steps:**
- [ ] Reconfirm branch, HEAD, working tree, Node, pnpm, PostgreSQL, and protected state.
- [ ] Confirm `TEST_DATABASE_URL`/fallback ends in `_test` and differs from development.
- [ ] Capture current test baseline.
- [ ] Review the design artifact for placeholder, contradiction, and scope errors.
- [ ] Add migration-preservation test scaffolding before changing schema.
- [ ] Commit durable spec/plan artifacts as one documentation checkpoint.

**Complete when:** The two artifacts exist, are internally consistent, and the implementation target/database safety checks are recorded.

## Task 2: Account transition isolation

**Files:**
- Modify: `apps/mobile/src/components/auth/auth-bootstrap.tsx`, `apps/mobile/src/store/app-store.ts`, analytics cache and photo-session services
- Modify: account-deletion and ownership routes/tests
- Create: account-transition coordinator if existing reset code cannot own all layers

**Tests first:**
- [ ] A→sign-out→B clears Zustand, photo files, drafts, analytics cache/preferences, pending provider state, and all user-scoped local state.
- [ ] B cannot fetch/update/delete A resources for foods, logs, recipes, weights, water, goals, recommendations, analytics, or preferences.
- [ ] Account deletion disables all later notification associations.
- [ ] Offline sign-out leaves only a non-user-specific pending detach marker.

**Implementation:**
- [ ] Centralize local user-state reset.
- [ ] Delete only app-owned temporary photo artifacts.
- [ ] Preserve ownership middleware and add missing ownership predicates only where tests prove a gap.
- [ ] Leave installation ID intact while removing user/token association.

**Validation:** Focused API ownership, account deletion, AuthBootstrap, auth-store, app-store, and cache tests.

**Checkpoint:** account/user-state isolation hardening.

## Task 3: Age-aware EER and numeric goal rate

**Files:**
- Create: `apps/api/src/modules/personalization/{age,energy-requirement,current-weight,goal-planning,resolver}.ts`
- Modify: `apps/api/src/lib/personalization.ts`, setup/goals/profile routes, shared contracts, onboarding data contracts
- Modify: Prisma schema and first migration

**Tests first:**
- [ ] Conflicting stored age is ignored; future birth dates reject.
- [ ] Ages below 18 onboard and save goals.
- [ ] Published child/adolescent vectors include growth energy.
- [ ] Age 18 uses adolescent equations; age 19 uses adult equations.
- [ ] Adult vectors use EER, not Mifflin.
- [ ] Activity mapping and athlete cap.
- [ ] Latest valid WeightLog and starting-weight fallback.
- [ ] Adult loss/gain/maintenance, 0.25 increments, adaptive bounds, floor constraint.
- [ ] Under-19 goals have baseline EER but no rate adjustment/date.
- [ ] Current-weight/profile changes update recommendations.
- [ ] Deterministic rounding and legacy GoalPace mapping.

**Implementation:**
- [ ] Add injected Clock/SystemClock/FixedClock.
- [ ] Encode exact Health Canada/NASEM 2023 coefficient tables and model version.
- [ ] Implement fractional age/band selection.
- [ ] Implement current-weight resolution.
- [ ] Implement adult rate bounds and floor.
- [ ] Implement younger-user unavailable rate status without access denial.
- [ ] Use age/sex DRI protein RDA for younger users and preserve adult training protein with current-weight lower bound.
- [ ] Add `targetRateLbPerWeek`; map legacy GoalPace while preserving current effective values through later overrides.

**Validation:** Focused personalization/setup/profile tests, Prisma validation, migration deploy to `food_tracker_test).

**Checkpoint:** age-aware rate-based personalization.

## Task 4: Effective target and DRI/reference system

**Files:**
- Create: `apps/api/src/modules/nutritionTargets/{targetable-policy,dri-data,dri-compatibility,reference-resolver,effective-resolver,routes,service}.ts`
- Create: `UserNutrientTargetOverride` migration/model
- Modify: shared reporting types/schemas, reporting and analytics consumers, goals/setup routes

**Tests first:**
- [ ] Every catalog key is classified targetable or track-only.
- [ ] Direction is policy-defined and cannot be inferred.
- [ ] RDA/AI/CDRR age/sex values resolve, including 18/19 boundary.
- [ ] UL never becomes a target.
- [ ] Vitamin A/folate/niacin semantic mismatch returns unavailable.
- [ ] Vitamin D/calcium/potassium and the approved compatible set pass provider matrix.
- [ ] Legacy migration creates `legacy_preserved` overrides from every non-null historical target.
- [ ] Explicit new or legacy edits use `user` origin.
- [ ] Profile/weight changes do not overwrite either override origin.
- [ ] Delete/Use Recommended restores automatic resolution.
- [ ] Legacy GET projects effective values; legacy PUT creates overrides; raw columns are never read or dual-written.

**Implementation:**
- [ ] Replace universal extended defaults with the exact targetable policy.
- [ ] Encode semantic/provider compatibility and negative fixtures.
- [ ] Add normalized override model with unique `(userId,nutrientKey)`, value/unit validation, and `origin: user | legacy_preserved`.
- [ ] Migrate old targets before enabling resolver reads.
- [ ] Implement effective target response shape.
- [ ] Add daily target routes and legacy response-time projection.
- [ ] Route analytics/reporting through effective targets.

**Validation:** DRI, target-policy, legacy-goals, migration-preservation, analytics-reference, API contract, Prisma migration tests.

**Checkpoint:** authoritative nutrition target/reference resolution.

## Task 5: Complex FoodLog correction

**Files:**
- Modify: `apps/api/prisma/schema.prisma` only for nullable optional fields if required; keep calories/protein non-null
- Modify: FoodLog routes/serializers, shared schemas/types, mobile FoodLog editor
- Create: focused correction service if route logic is currently monolithic

**Tests first:**
- [ ] Numeric correction and numeric zero.
- [ ] One nullable/normalized nutrient to Unknown removes only that nutrient.
- [ ] Unrelated values survive.
- [ ] Calories and protein remain required and reject Unknown.
- [ ] FoodItem and reusable custom-food definition never change.
- [ ] Legacy whole-map update remains compatible.
- [ ] Invalid mixed patch rolls back atomically.

**Implementation:**
- [ ] Add per-key `known`/`unknown` patch contract.
- [ ] Represent Unknown with nullable column absence or normalized row absence.
- [ ] Keep calories/protein required at database and normal-create validation layers.
- [ ] Apply patches transactionally and return resolved snapshot.
- [ ] Update analytics missing/coverage semantics.
- [ ] Add Complex-only Unknown controls.

**Validation:** FoodLog, nutrient totals, provider/custom-food, analytics coverage, mobile editor tests.

**Checkpoint:** Complex FoodLog nutrient correction completion.

## Task 6: Recommendation Engine 2.0

**Files:**
- Modify: `apps/api/src/modules/analytics/recommendation-facts.ts`, recommendation engine/service/routes, Prisma Recommendation model
- Modify: shared enums/types/schemas and Insights components
- Create: lifecycle/fingerprint/ranking helpers as focused modules
- Create: migration with reviewed partial active-identity index

**Tests first:**
- [ ] Exact additive vocabulary and stable identity keys.
- [ ] Simple/Complex scope.
- [ ] Maximum three and maximum one micronutrient.
- [ ] Four logged days, four nutrient-recorded days, 70% coverage.
- [ ] Missing composition never implies low intake.
- [ ] Goal/weight-trend corroboration and on-pace suppression.
- [ ] Exact relevance scores and tuple ordering.
- [ ] Stable order under shuffled candidates and unchanged creation times.
- [ ] Three-local-day dismissal, higher-severity reactivation, resolved archive.
- [ ] Concurrent generation has one active row per identity.
- [ ] Wording never diagnoses deficiency.

**Implementation:**
- [ ] Reuse existing reporting day/coverage semantics.
- [ ] Add hydration, goal progress, maintenance drift, and compatible micronutrient facts.
- [ ] Add identity/fingerprint fields and lifecycle.
- [ ] Apply deterministic ranking/selection.
- [ ] Add partial unique active index through reviewed SQL.
- [ ] Update Insights without broad redesign.

**Validation:** Focused recommendation/fact/lifecycle/API/mobile tests.

**Checkpoint:** deterministic Recommendation Engine 2.0.

## Task 7: Push registration and bounded delivery

**Files:**
- Create: notification schema/models/migration
- Create: `apps/api/src/modules/notifications/{routes,policy,claims,expo-client,receipts,worker}.ts`
- Create: `apps/api/src/lib/clock.ts` if not created in Task 3
- Modify: API router, account deletion, package scripts, Railway deployment configuration
- Modify: `apps/mobile/package.json`, `apps/mobile/app.config.ts`, AuthBootstrap, API client
- Create: guarded staging fixture/worker script

**Tests first:**
- [ ] Registration ownership, idempotence, duplicate token, rotation, detach, deletion, and A/B rebind.
- [ ] One claimed opportunity per user/local date under concurrency.
- [ ] Three/168-hour and two-reminder/168-hour caps.
- [ ] Seven-day inactivity suppression.
- [ ] Local evening and DST behavior.
- [ ] Recommendation priority over reminder.
- [ ] Failed send consumes claim.
- [ ] Receipt delay, transient/not-ready, 24-hour expiry, DeviceNotRegistered, token-hash protection.
- [ ] Cursor pagination, page size 100, concurrency five, per-user transaction advisory lock plus unique daily claim, deadline, resume, clean exit.
- [ ] Generic privacy-safe payload and validated route data.

**Implementation:**
- [ ] Add preference, installation, event, attempt, and worker-checkpoint models.
- [ ] Install Expo-supported notification dependencies and config plugin.
- [ ] Add user-driven permission and token registration.
- [ ] Implement claimed-event transaction with unique daily constraint.
- [ ] Process receipts older than 15 minutes before new sends; stop polling after 24 hours.
- [ ] Implement keyset cursor, bounded concurrency, seven/eight-minute deadlines, and per-user transaction advisory lock.
- [ ] Add production-rejecting fixed-clock guards and exact-user staging invocation.
- [ ] Configure Railway `*/30 * * * *` UTC schedule without introducing a queue.

**Validation:** Notification unit/integration/concurrency tests, config tests, worker dry-run against scoped staging fixture, Prisma migration deploy to `food_tracker_test`.

**Checkpoint:** account-safe bounded push delivery.

## Task 8: Mobile integration and runtime QA

**Files:**
- Modify: onboarding/profile/Insights/FoodLog/root layout/AuthBootstrap
- Create: `apps/mobile/src/app/{goal-plan,nutrition-targets}.tsx`
- Create: target/rate/notification components and notification service
- Create: mobile tests

**Tests first:**
- [ ] Younger and adult onboarding flows.
- [ ] Adult rate/date live updates.
- [ ] Younger unavailable-rate explanation.
- [ ] Recommended/custom/Use Recommended flow.
- [ ] Target editor policy filtering.
- [ ] Complex Unknown/zero flow.
- [ ] Simple/Complex recommendation rendering.
- [ ] Permission, foreground, warm, cold, signed-out, stale, and wrong-account navigation.

**Implementation:**
- [ ] Use current tokens, typography, controls, and accessible small-phone layouts.
- [ ] Keep onboarding server-driven and avoid duplicated math.
- [ ] Add loading, error, empty, and unavailable states.
- [ ] Add authenticated notification route lookup; payload never bypasses API authorization.
- [ ] Keep Phase 24 navigation/design redesign out of scope.

**Validation:** Mobile Jest, lint, typecheck, real iOS Simulator scenarios at required viewports.

**Checkpoint:** presentable Phase 20–22 mobile integration.

## Task 9: Integrated acceptance, docs, and handoff

**Files:**
- Modify: roadmap, architecture, API/data-model/Prisma docs, mobile testing context, closeout documentation
- Modify: only explicitly reviewed implementation/test files as needed

**Steps:**
- [ ] Run Prisma generate/validate and migrations against disposable `_test`.
- [ ] Run complete API, shared, and mobile tests.
- [ ] Run format check, lint, typecheck, build, and `git diff --check`.
- [ ] Execute every Simulator scenario from the design.
- [ ] Run guarded staging fixed-clock acceptance for caps, dismissal, inactivity, and local evening.
- [ ] Perform requirement-by-requirement self-review.
- [ ] Confirm protected state and generated native directories were not staged.
- [ ] Update docs with exact evidence, limitations, physical-device gates, and deferred scope.
- [ ] Create final coherent validation/docs checkpoint.

**Complete when:** Automated and Simulator evidence is fresh, the branch contains only intentional changes, the implementation candidate is ready, and physical/staging acceptance is clearly separated.

---

## Required final validation

Run under Node 22.x/pnpm 10.34.3:

```bash
node -v
corepack pnpm -v
git status --short --branch
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm --filter @food-tracker/mobile test:jest
git diff --check
git status --short --branch
git branch -vv
git log --oneline main..HEAD
```

Do not claim physical push delivery, APNs/FCM behavior, Railway hosted execution, or final product acceptance from automated or Simulator evidence alone.
