# Phase 24 populated current-state supplement

This directory supplements the original Phase 24 baseline at
[`../current-state/`](../current-state/). The original directory remains the
initial empty, unavailable, and failure-state reference set. This directory is
the healthy staging supplement and should generally be used when judging the
normal populated layout of data-driven screens during Phase 24 design work.

The screenshots are reference material, not approval of the current visual
treatment. The supplement intentionally does not replace or delete the
original empty/offline captures.

## Capture provenance

| Field | Value |
| --- | --- |
| Branch | `phase-24-frontend-redesign` |
| Capture starting commit | `97116eb` (`docs: capture Phase 24 current UI baseline`) |
| Simulator | `Food Tracker QA iPhone 17` (`53D0A189-7A75-49B1-97E6-A4C5DC4CB12F`) |
| Runtime | iOS 27.0, portrait |
| Installed app | `ca.joshuaaryeetey.foodtracker`, existing installed development client |
| Application environment | Existing Railway staging API target, staging Metro on port 8084 |
| QA account | Existing QA-A account; account label only; no credentials recorded |
| Tracking mode | Complex for the captured populated screens |
| Capture output | Settled simulator screenshots, 368 x 800 PNGs from the capture tool |
| Data provenance | Existing QA-A fixture data; no account reset, reseed, new account, or screenshot-only log creation |

The QA-A fixture already contained historical food, nutrient, water, weight,
saved-view, and recommendation data. The latest existing activity was anchored
around September 2026, while this capture ran on October 7, 2026. Therefore the
September History, September Streak calendar, and September 8–October 7 Month
reports are genuinely populated, while current-day Progress and the current
Week report are genuinely empty/in-progress. Those current-day states are not
included here as populated references.

The guarded staging simulator launcher could not run because the local ignored
staging file does not contain the required EAS project selector. I used the
same existing staging variables to start the normal development Metro runtime
without editing that file. The staging API health endpoint returned HTTP 200.
The host also reached an `ENOSPC` condition; only the exact regenerable
FoodTracker Xcode DerivedData and ModuleCache directories were removed to
restore runtime space. No simulator data, repository files, QA records, or
protected directories were removed.

## Populated screenshot manifest

| Filename | Route / screen | State represented | Why it is trustworthy |
| --- | --- | --- | --- |
| `01-core/history-populated-sep10.png` | History | Thursday, September 10; 1,158 kcal and two logged entries | Online History showed Breakfast and Lunch entries, water, and weight for the selected historical day |
| `01-core/history-populated-sep10-details.png` | History | Lower detail area for the same day | Online detail view showed multiple meal sections, two entries, water, and weight |
| `01-core/profile-complex-online-populated.png` | Profile | Healthy online Complex profile and plan summary | Profile loaded from the authenticated staging account with existing targets and preferences |
| `03-analytics/insights-month-populated-sep08-oct07.png` | Insights > Month | September 8–October 7; 5 logged days and 17% consistency | Report displayed real energy balance, coverage, nutrient, hydration, and trend content |
| `03-analytics/insights-month-populated-details.png` | Insights > Month | Macro balance and report coverage detail | Report displayed Protein 52 g / 21%, Carbohydrates 141 g / 56%, Fat 26 g / 23%, and 1 complete / 4 partial / 25 unlogged days |
| `03-analytics/trends-overview-populated.png` | Insights > Explore all trends | Populated trend library with saved views | Existing Calories, Protein + Weight, and Sodium + Potassium saved views plus the full metric library were visible |
| `03-analytics/trend-detail-calories-populated.png` | Insights > Trends > Calories | 30-day Calories detail for September 8–October 7 | Report displayed a 1,013 kcal recorded average across 5 recorded days, contributor data, and explicit historical gaps |
| `03-analytics/trend-detail-macro-composition-populated.png` | Insights > Trends > Macro Composition | 30-day macro composition | Report displayed Protein 21%, Carbohydrates 56%, Fat 23%, plus a daily macro mix and recorded values |
| `06-secondary/streaks-populated-september.png` | Progress > Streak calendar | September 2026 historical calendar | Online calendar showed real gold, partial, missed, and grace-day classifications with calorie values |

## Coverage boundaries

- History, Insights Month, Trends, Calories detail, Macro Composition, and the
  historical Streak calendar all loaded normally under the healthy staging
  runtime. The former offline/unavailable screenshots remain useful
  supplemental failure-state references, not primary normal-use references.
- Profile also loaded normally online. The existing profile captures in the
  original baseline remain valid for comparison; this copy records the same
  healthy online context alongside the populated supplement.
- Progress loaded normally online but was current-day empty because the
  existing fixture had no October 7 food entries. Complex and Simple populated
  Progress captures were not manufactured, and the existing QA data was not
  mutated merely to fill the current day.
- The current Week report had no logged days because the current week was
  outside the fixture's activity dates. Month is the representative report
  period for this supplement.
- No genuine product bug was reproduced. The empty current-day surfaces are a
  data-freshness/fixture-date limitation, not evidence that the online routes
  were unavailable.
- Captures are simulator-tool output at 368 x 800 pixels (approximately a
  402-point viewport), so they are consistent with the existing Phase 24
  baseline but are not exact 390/393-point device evidence. No physical-device
  acceptance was performed.

## Preservation and scope

- No Phase 24 product redesign was implemented.
- No source, shared contract, API, database, migration, dependency, generated
  native, or product behavior changes were made.
- No credentials, tokens, private identifiers, or personal user data are
  recorded here.
- No save, food log, water log, weight log, recipe, saved-view, photo-library,
  barcode, sign-out, account-reset, or fixture-reset action was completed.
- The protected `docs/design-references/current images/` directory and all
  unrelated local worktree changes were left untouched.
