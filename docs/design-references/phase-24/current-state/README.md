# Phase 24 current-state visual baseline

This directory is the pre-redesign visual baseline for Phase 24. It records
the current mobile UI without product, API, schema, or design-system changes.
The screenshots are reference material for the redesign and are not approval
of the existing visual treatment.

## Capture metadata

| Field | Value |
| --- | --- |
| Branch | `phase-24-frontend-redesign` |
| Baseline commit | `4674e78b2ddcd705be323f9bfafb23b95b7848ea` |
| Simulator | `Food Tracker QA iPhone 17` |
| Simulator UUID | `53D0A189-7A75-49B1-97E6-A4C5DC4CB12F` |
| Runtime | iOS 27.0, portrait |
| Output | 368 x 800 PNG captures from the simulator capture tool |
| Account | Existing QA A account; displayed profile name: Joshua |
| App state | Existing local Phase 24 app with local API and Metro runtime |
| Data policy | Existing QA data only; no food logs, recipes, saved views, photos, or barcode data were created |

`Canonical` identifies the primary reference for a screen or state. It does
not mean the screen is visually approved. `Supplemental` identifies a useful
diagnostic, empty, intermediate, or duplicate state that should remain
available during redesign review but should not be treated as the primary
reference.

## Screenshot manifest

All rows use the simulator and QA account listed above. Mode is the tracking
mode visible at capture time.

| Filename | Route / screen | Mode | State | Use |
| --- | --- | --- | --- | --- |
| `01-core/food-log-simple-clean.png` | Progress > Log food | Simple | Clean empty logging sheet | Canonical |
| `01-core/history-empty-current.png` | History | Complex | Current empty history; 0 entries | Canonical |
| `01-core/history-unavailable-offline.png` | History | Complex | Offline/unavailable diagnostic state | Supplemental |
| `01-core/insights-unavailable-offline.png` | Insights | Complex | Offline/unavailable diagnostic state | Supplemental |
| `01-core/insights-week-current.png` | Insights | Complex | Current week report shell; 0 logged days | Canonical |
| `01-core/profile-complex-populated.png` | Profile | Complex | Existing QA profile and plan summary | Canonical |
| `01-core/profile-simple-populated.png` | Profile | Simple | Existing QA profile and plan summary | Canonical |
| `01-core/profile-unavailable-offline.png` | Profile | Complex | Offline/unavailable diagnostic state | Supplemental |
| `01-core/progress-complex-current.png` | Progress | Complex | Current empty progress; 0 food entries | Canonical |
| `01-core/progress-complex-offline-empty.png` | Progress | Complex | Offline/unavailable empty state | Supplemental |
| `01-core/progress-simple-current.png` | Progress | Simple | Current empty progress; 0 food entries | Canonical |
| `02-food-logging/ai-meal-describe-entry.png` | Progress > Log food > Describe meal | Complex | AI meal description entry screen | Supplemental |
| `02-food-logging/ai-meal-review.png` | Progress > Log food > Describe meal review | Complex | Example meal reviewed; not saved | Canonical |
| `02-food-logging/barcode-scanner-ready.png` | Progress > Log food > Scan barcode | Complex | Scanner ready; no barcode submitted | Canonical |
| `02-food-logging/food-library-empty.png` | Progress > Log food > Food Library | Complex | Empty saved-food library | Canonical |
| `02-food-logging/food-log-complex-clean.png` | Progress > Log food | Complex | Clean empty logging sheet | Canonical |
| `02-food-logging/food-log-complex-search-entry.png` | Progress > Log food | Complex | Search-entry intermediate state | Supplemental |
| `02-food-logging/food-log-entry-sheet-complex.png` | Progress > Log food | Complex | Food-entry sheet with search fields | Supplemental |
| `02-food-logging/food-serving-preview-banana.png` | Progress > Log food > food serving | Complex | Banana serving preview; not logged | Canonical |
| `02-food-logging/mixed-meal-builder.png` | Progress > Log food > Mixed meal | Complex | Empty mixed-meal builder | Canonical |
| `02-food-logging/photo-logging-entry.png` | Progress > Log food > Photo logging | Complex | Photo logging entry; no photo selected | Canonical |
| `02-food-logging/search-banana-results.png` | Progress > Log food > Search foods | Complex | Banana search results | Canonical |
| `03-analytics/custom-date-range.png` | Insights > Trends > Custom date range | Complex | Date-range configuration | Canonical |
| `03-analytics/insights-month-current.png` | Insights | Complex | Current month report shell | Supplemental |
| `03-analytics/metric-picker-primary.png` | Insights > Trends > Metric picker | Complex | Primary metric selection | Canonical |
| `03-analytics/saved-views-empty.png` | Insights > Saved Views | Complex | No saved views | Supplemental |
| `03-analytics/trend-configuration.png` | Insights > Trends > Configure | Complex | Trend configuration screen | Canonical |
| `03-analytics/trend-detail-calories-unknown.png` | Insights > Trends > Calories | Complex | No recorded values; unknown/gap state | Canonical |
| `03-analytics/trends-overview.png` | Insights > Trends | Complex | Trends overview | Canonical |
| `04-recipes/recipe-create-editor.png` | Recipes > Create recipe | Complex | Empty recipe editor; not saved | Canonical |
| `04-recipes/recipes-list-empty.png` | Recipes | Complex | Empty recipe list | Canonical |
| `06-secondary/goal-plan.png` | Profile > Review goal plan | Complex | Existing plan summary and recommendation | Canonical |
| `06-secondary/logging-menu.png` | Progress > Logging menu | Complex | Logging action menu | Canonical |
| `06-secondary/nutrition-targets.png` | Profile > Nutrition targets | Complex | Existing targets; not edited | Canonical |
| `06-secondary/streaks-unavailable-offline.png` | Progress > Streaks | Complex | Offline/unavailable diagnostic state | Supplemental |
| `06-secondary/water-log-date-time.png` | Progress > Log water > Date and time | Complex | Date/time editor | Supplemental |
| `06-secondary/water-log-form.png` | Progress > Log water | Complex | Empty water-log form; not saved | Canonical |
| `06-secondary/weight-log-form.png` | Progress > Log weight | Complex | Empty weight-log form; not saved | Canonical |

## Deferred or intentionally omitted captures

The following states were not manufactured for the baseline. They are
documented here so their absence is explicit.

| Area | Deferred state | Reason |
| --- | --- | --- |
| Core logging and analytics | Populated food log, populated history, populated charts, and populated streaks | QA A had 0 food entries and 0 logged days; creating junk data would reduce baseline fidelity |
| Food logging | Manual Foods list/form and Default Serving editor | QA A had no reusable or manual food records; no records were created |
| Food logging | Photo review and actual barcode detection | No test photo or physical barcode was supplied; entry/scanner states were captured without forcing data |
| Recipes | Recipe detail, ingredients, and log-recipe flow | QA A had no recipes; no recipe was created |
| Analytics | Saved View editor, contributors, and comparison populated states | No saved view or populated trend data was available |
| Auth/onboarding | Sign in, create account, forgot password, and onboarding | Signing out or resetting the existing QA account would disrupt the authenticated baseline |

## Scope and preservation notes

- Only this new `current-state/` directory was created for the baseline.
- The protected `docs/design-references/current images/` directory was not
  touched, reorganized, renamed, deleted, or staged.
- No source, shared contract, API, database, migration, dependency, generated
  native, or product behavior changes were made.
- No save, log, recipe, saved-view, photo-library, barcode, sign-out, or
  account-reset action was completed during capture.
