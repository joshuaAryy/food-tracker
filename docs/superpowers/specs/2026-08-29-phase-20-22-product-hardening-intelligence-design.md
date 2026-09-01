# Phase 20–22 — Product Hardening + Intelligence Design

## Status and scope

This design is the authoritative implementation specification for the combined Phase 20–22 macro-goal. It preserves the existing Food Tracker architecture and adds account isolation hardening, age-aware personalization, effective targets, Complex FoodLog correction, deterministic recommendations, and narrow push notifications. Phase 23 supplements and Phase 24's broad visual redesign are out of scope.

## Non-negotiable invariants

- Authentication identifies the current user; server-side authorization owns resource access. Clients never submit `userId` as authority.
- Backend services own nutrition, reference, analytics, and recommendation facts. AI is not involved in those decisions.
- One personalization resolver owns energy, protein, rate, and estimate math.
- One effective-target resolver owns recommended, reference, derived, custom, and missing values.
- Birth date is authoritative and age is derived. Age never blocks product use.
- Health Canada/NASEM 2023 EER equations are canonical for all supported ages. Published child/adolescent equations, including growth energy, apply through age 18; adult equations begin at age 19.
- Goal intent and progress exist at every age. Automatic rate-driven calorie adjustment and rate-date forecasts are available only for age 19+.
- Calories and protein remain required FoodLog database fields. Complex Unknown correction applies to nullable column-backed nutrients and normalized `FoodLogNutrient` rows; row/nullable absence means Unknown and numeric zero is real zero.
- Editing a FoodLog never mutates its trusted FoodItem or reusable custom-food definition.
- Daily target editing is restricted to `TARGETABLE_NUTRIENT_POLICY`; catalog membership alone never grants target semantics.
- DRI targets require canonical meaning, unit, provider semantics, and cross-provider compatibility. Unit equality alone is insufficient.
- Legacy `/goals` reads project effective values at response time. Legacy target writes create explicit overrides. Deprecated raw columns remain retained but are not a second source of truth.
- Recommendations are deterministic, capped at three active with at most one micronutrient, and use stable identity/fingerprint/ranking semantics.
- Push caps apply to a claimed opportunity: one per user/local date, three per rolling 168 hours, and two logging reminders per rolling 168 hours.
- Production uses real time. Domain tests and guarded staging acceptance inject a fixed clock; production rejects clock override flags.

## Age-aware personalization

The resolver accepts birth date, timezone, sex, height, activity, training style, goal type, target weight, selected rate, and the latest valid weight. Current weight is the newest positive finite `WeightLog`, ordered by logged time, creation time, and a stable final key; `startingWeightLb` is the fallback only.

Activity maps deterministically:

```text
sedentary         -> inactive
lightly_active    -> low_active
moderately_active -> active
very_active       -> very_active
athlete           -> very_active
```

The exact published 2023 coefficient tables are stored under an explicit model version. Completed age chooses the band and fractional age within the birthday interval supplies the equation age input. Age 18 remains adolescent; age 19 selects adult.

Adult loss rates use 0.25-lb/week steps and the maximum of 2.0 lb/week, 1% of current weight/week, and the existing calorie-floor guardrail. Adult gain uses 0.25-lb/week steps capped at 1.0 lb/week and approximately 0.5% of current weight/week. The existing 500 kcal/day per lb/week adjustment is an initial estimate, not a physiological promise, and final calories are rounded to the nearest 10 kcal. Existing floors remain 1,200 kcal for female profiles and 1,500 kcal for male profiles.

Under-19 users may choose lose, maintain, or gain, set target weight, track progress, receive age-appropriate EER/protein targets, and create custom targets. They receive no unsupported automatic rate adjustment or forecast; their goal remains valid and its rate-planning status is unavailable.

Protein for younger users uses age/sex DRI RDA per current weight. Adult protein retains the current training/goal multiplier, uses current weight, and cannot fall below the applicable DRI RDA. Carbohydrate, fat, fiber, and sugar retain the deterministic derived architecture and are labeled `derived`. Sodium uses an age-appropriate CDRR limit where published, otherwise it is missing unless customized.

Estimated completion uses:

```text
ceil(abs(currentWeight - targetWeight) / rate * 7) calendar days
```

and is shown as an estimate only. Maintenance, reached targets, missing inputs, and unsupported younger-user rate planning do not produce a promised date.

## Effective targets and DRI compatibility

Resolution precedence is:

```text
user override > personalized/reference > derived > missing
```

`UserNutrientTargetOverride` stores `origin` as either `user` or `legacy_preserved`. Migration-created rows always use `legacy_preserved` because old target provenance cannot be reconstructed. New or legacy API edits use `user`. Both are effective overrides until `Use recommended` deletes the row.

The initial targetable policy includes calories, protein, carbohydrates, fat, fiber, sugar, sodium, and explicitly DRI-compatible vitamins/minerals. The compatible reference set is vitamin D, calcium, potassium, iron, magnesium, phosphorus, zinc, selenium, copper, manganese, iodine, vitamin C, thiamine, riboflavin, pantothenic acid, vitamin B6, and vitamin B12. Vitamin A, folate, niacin, vitamin E, vitamin K, amino acids, oxalate, phytate, and all other unlisted catalog entries remain trackable but receive no automatic target and do not appear in the target editor.

Vitamin A retinol/RAE, folate/DFE, and niacin/NE mismatches are explicit negative compatibility fixtures. Vitamin D, calcium, and potassium must pass current provider-semantic tests because they are the Recommendation Engine's initial micronutrient pool.

Legacy `GET /goals` reads the effective resolver at response time. Legacy `PUT /goals` writes override rows transactionally. Deprecated `UserGoal` target columns are retained, migration-preserved, frozen, and never read as authority; there is no dual-write.

## FoodLog correction

Calories and protein remain required and are never set Unknown in this phase. Nullable carbs/fat/fiber/sugar/sodium columns and normalized nutrient rows use a per-key patch contract:

```text
{ nutrientKey, state: "known", amount }  // zero allowed
{ nutrientKey, state: "unknown" }        // clear only this key
```

The entire patch applies transactionally. Invalid patches roll back. Existing whole-map requests remain compatible; clients cannot send both forms. The effective historical snapshot is returned after saving.

## Recommendation Engine 2.0

Shared types are:

```text
protein_low
calories_under_target
calories_over_target
missing_recent_weight_logs
inconsistent_food_logging
goal_progress_behind_rate
goal_progress_opposite_direction
maintenance_weight_drift
hydration_below_target
micronutrient_below_target
```

Stable identity is the type, or `micronutrient_below_target:<nutrientKey>` for a micronutrient. Fingerprints include identity, severity, condition band, goal type, goal-relevance band, effective source, and reference version, excluding volatile exact values and timestamps.

Ranking is deterministic: severity, evidence confidence, exact goal relevance, stable rule priority, then lexical identity. Goal relevance is 3 for goal-progress/maintenance drift or corroborated calorie direction, 2 for goal-relevant calories without trend and loss/gain protein or missing weight, 1 for maintenance protein/logging/hydration, and 0 for micronutrients.

Micronutrient candidates require at least four logged days in the last seven, nutrient recorded on at least four days, and at least 70% recorded coverage using existing reporting semantics. Missing composition is never low intake.

Dismissal suppresses an unchanged condition for three local calendar days; higher severity may reactivate early and resolved conditions archive. A partial unique active index protects identity uniqueness.

## Push subsystem

The subsystem contains preferences, installations, claimed events, delivery attempts, and a worker checkpoint. Installation registration is authenticated, idempotent, token-hash protected, and rebindable after sign-out. Account deletion disables and clears the association.

The Railway worker runs every 30 minutes in UTC, takes pages of 100 users with five-way bounded concurrency, resumes a persisted UUID keyset cursor, and exits by eight minutes. Each claim transaction takes a per-user PostgreSQL transaction advisory lock and relies on the unique `(userId, localDate)` constraint, so concurrent cron invocations cannot claim the same user's daily opportunity; no process-wide lock is required. Receipt processing precedes new sends: tickets are checked after 15 minutes, transient/not-ready receipts remain pending, `DeviceNotRegistered` retires only the matching token hash, and attempts expire from receipt polling after 24 hours.

Remote payloads contain only generic copy and an opaque route/recommendation identifier. Taps always re-fetch through authenticated API authorization.

For non-production acceptance, run the worker against exactly one staging user
with an explicit fixed clock:

```bash
APP_ENV=staging NOTIFICATION_ACCEPTANCE_TIME_OVERRIDE_ENABLED=true \
  NOTIFICATION_ACCEPTANCE_APPROVED_FIREBASE_UID="$STAGING_FIREBASE_UID" \
  corepack pnpm --filter @food-tracker/api notifications:worker -- \
  --at '2026-08-29T22:00:00.000Z' \
  --acceptance-user-firebase-uid "$STAGING_FIREBASE_UID"
```

Add `--send` only for an intentional staging delivery check, and only with
`NOTIFICATION_ACCEPTANCE_SEND_ENABLED=true` as a second explicit authorization
gate. Production uses
`notifications:worker -- --send` from a Railway Cron Job scheduled as
`*/30 * * * *` UTC; production rejects `--at` and the override environment flag.

Physical Expo-to-APNs delivery is intentionally deferred when the available
Apple Personal Team cannot provision the `aps-environment` entitlement. Railway
staging deployment/schema/health remains a separate verified gate.

## Mobile and acceptance

Onboarding adds a presentable numeric adult rate control and younger-user plan summary. Profile exposes Goal Plan and Nutrition Targets screens with recommended/effective/custom state and `Use recommended`. Complex FoodLog adds per-nutrient Unknown controls. Insights renders the canonical maximum-three recommendations. Notification permission is user-driven, and cold/warm/foreground routing is validated.

Automated tests, Simulator checks, staging checks, and physical-device checks are separate evidence classes. Real APNs/FCM delivery, Railway execution, and lock-screen behavior remain user-owned physical/staging acceptance gates.

## Out of scope

No supplements, grocery recommendations, wearables, offline sync, saved-meal expansion, broad CI/CD, marketing/broadcast notifications, pediatric diagnosis, pregnancy/lactation planning, medical advice, full physiological simulation, LLM recommendation reasoning, unrelated food-search/Pinecone/national-dataset work, or Phase 24's comprehensive frontend redesign.
