# Phase 12.9 Handoff

## Current State

Phase 12.9A Slices 1–4 are implemented in the uncommitted
`phase-12-9-recipes-mixed-meals` branch state.

- Slice 1: additive Recipe/RecipeIngredient persistence, frozen snapshot
  contracts, and nullable FoodLog recipe provenance.
- Slice 2: current-user recipe CRUD plus trusted frozen ingredient mutations.
- Slice 3: transactional Recipe-to-FoodLog materialization and recipe-origin
  FoodLog immutability.
- Slice 4: Food Log entry point, recipe list/builder/detail/logging screens,
  History restrictions, mobile API client methods, and pure mobile-flow tests.

No recipe screen calculates authoritative nutrition. The backend owns serving
resolution, snapshots, totals, rounding, persistence, ownership, and archive
behavior. Mobile uses frozen recipe responses only for display and sends only
the documented metadata, FoodItem IDs, serving requests, and logging metadata.

## Required Physical iPhone Smoke Test

Use the existing Expo development build with `EXPO_PUBLIC_API_URL` pointed at
the Mac LAN API URL.

1. Open Food Log, verify the compact `Recipes` action, then open an empty list.
2. Create a recipe from persisted trusted FoodItems; verify FoodItemChoiceRow
   selection, unit/amount changes, and serving review blocking.
3. Attempt an unsupported household serving; verify the visible correction
   state and blocked save. Correct it with grams or a listed serving.
4. Verify optional cooked weight: no gram log option without it, then add a
   cooked weight and verify gram logging appears.
5. Check list loading/error/empty/pull-to-refresh and row calories per portion,
   portion count, and gram availability on a small phone.
6. Check detail total/per-portion/per-gram summaries in Simple and Detailed
   modes; confirm only Detailed shows normalized nutrients.
7. Edit only recipe metadata and then only one ingredient; confirm the intended
   change persists and retained ingredient order remains stable. Archive with
   confirmation and verify it disappears from the active list.
8. Log a fractional portion and grams, choose meal/date/time/notes, and confirm
   History, Progress, and Insights refresh after close. Attempt a rapid double
   tap and verify only one entry is created.
9. Open the historical recipe FoodLog from History. Verify only meal/time/notes
   are editable and the correction explanation is visible. Verify a normal
   FoodLog still exposes its ordinary editor.
10. Check keyboard/footer reachability, modal close/back behavior, long names,
    loading/error copy, and no duplicate Food Log header on all recipe routes.

Record the device, iOS version, app build, API reachability, and any layout or
interaction findings before declaring Phase 12.9A complete.

## Next Scope: Phase 12.9B

Phase 12.9B combines one-off mixed meals and manual ingredients. It is
deliberately separate from reusable recipes: do not add manual ingredients,
AI-generated nutrition, sharing, photos, or a new tab to the Slice 4 routes.
