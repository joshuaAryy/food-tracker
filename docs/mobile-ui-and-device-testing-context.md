# Mobile UI And Device Testing Context

This document preserves the current mobile UI and native testing context so
future sessions do not need long conversation history.

## Current Phase

Phase 7 is complete enough to move into Phase 8. Phase 6 established the
current mobile visual-system blueprint across
onboarding, Progress, History, logging, Insights, Recommendations,
Profile/Settings, bottom navigation, floating add behavior, logo rendering,
inputs, Simple/Detailed mode identity, and native iPhone testing. The durable
lessons from those iterations are captured in `docs/mobile-visual-lessons.md`;
read it before starting future mobile visual work.

Do not keep spending time on desktop web polish before native testing. Web
preview remains useful for fast layout iteration, but it is not enough to judge
spacing, touch targets, safe areas, keyboard behavior, transitions, tab bar
rhythm, fixed footers, logo clipping, input vertical alignment, or the overall
feel of a screen on a real phone.

## Engineering Boundaries

- Runtime is Node.js `22.x` only. Node 24 validation is invalid.
- Use the existing pnpm workspace.
- Backend is Express, Prisma, and PostgreSQL.
- Mobile is React Native, Expo, Expo Router, TypeScript, and NativeWind.
- Tests use Vitest/Supertest with a dedicated PostgreSQL test database.
- Do not change backend behavior, API contracts, Prisma schema, shared Zod
  schemas, setup preview/save behavior, or routing unless explicitly approved.

Standard validation before merge remains:

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

For documentation-only work, the requester may explicitly narrow validation,
but do not claim broader validation than was run.

## Product And Visual Direction

Product identity: "Simple tracking, serious insight."

The app should feel like clean nutrition software mixed with personal
analytics/lifestyle wellness. It should feel simple, soft, serious,
professional, and real enough to go to market.

`docs/design-system.md` is the current implementation baseline. Current tokens
and primitives are implementation tools, but future work should extend the
Phase 6 standard instead of redesigning from scratch.

Phase 6 uses Stoic as the strongest mood/style reference: whitespace,
confident black typography, calm pacing, restrained icons, focused daily state,
minimal chrome, and quiet metadata. Cal AI is useful for nutrition accents and
density, not exact visual style. Apple Health/Fitness is useful for glanceable
status patterns, not card spam. Lifesum/Cronometer-style visuals should not be
copied.

Prefer a white-forward, charcoal-led UI with subtle structure. Use open
layouts, native-feeling controls, rows, quiet dividers, pills, rails, strong
typography, crisp icons, and restrained accent colors. Borders should be rare
and purposeful. Primary CTAs should be black/charcoal. Green/sage may exist as
a secondary or legacy accent, but it should not be the main primary action
color.

Avoid:

- Apple Health-style stacked card spam
- beige/yellow wellness templates
- generic dashboard modules
- default `AppCard` stacks
- fake View-built graphics
- giant SVG/ring experiments that dominate or overlap content
- repeating generic tab-name headers when the tab bar already gives context
- green-heavy or childish UI
- generic student-project styling
- random cards thrown onto a screen
- profile forms masquerading as onboarding
- preserving old primitives just because they exist

## Onboarding Decisions To Preserve

- Do not add a separate onboarding welcome screen.
- Startup should show splash/loading only while setup status is checked.
- Incomplete setup routes directly to the first real onboarding question.
- Completed setup routes to Progress.
- Onboarding is a quiz flow, not a profile form.
- Each step should feel like one focused decision.
- Progress should be slim and soft, using a compact label instead of
  intimidating `Step X of 13` emphasis.
- Bottom CTA should be fixed and black/charcoal.
- Use a top back arrow where needed; do not add a secondary bottom Back button.
- The review screen should feel like "Here is your starting plan" with a mini
  dashboard preview, weight-direction context, quiet plan inputs, and
  reassurance that targets can be adjusted later.

## Birthday Wheel Requirements

The Birthday step must use a wheel/picker-style selector, not typed
Month/Day/Year boxes.

The wheel must be controlled by real onboarding state. These three values must
always come from the same selected month/day/year:

- visible selected date
- calculated age
- submitted `birthDate`

Do not reintroduce stale age bugs or fake visual selection state. Clamp invalid
day values when month/year changes, handle leap years, prevent future DOB, and
keep the submitted `birthDate` valid as `YYYY-MM-DD`.

This is the highest-priority functional onboarding UI requirement. A visually
nicer wheel is not acceptable if native iPhone scroll momentum, snapping, or
the selected date state can desynchronize from age or submitted `birthDate`.

The Height step should also use wheel interaction. It supports ft/in with two
wheel columns and cm with one wheel column, while saving the existing total
`heightInches` value. Current weight and target weight use lb-based wheels and
continue saving existing setup fields. Target weight should make the delta from
current weight obvious.

## Branding And Icon Guardrails

New-user onboarding and setup-loading branding should default to the simple
mode mark. The mark should be subtle inside onboarding, usually 24-32px, and may
be omitted if it crowds the header. Use it to improve identity, not as repeated
decoration.

Use the actual provided PNG mode icons from `apps/mobile/src/assets/brand/` for
in-app brand marks. Do not recreate the logo with React Native view shapes. The
simple icon is the default new-user/onboarding mark, and the complex icon is for
complex-mode identity.

Launcher icons are configured from tracked assets under
`apps/mobile/assets/icons/`. The default launcher icon is the simple mark.
Dynamic launcher-icon switching uses `expo-alternate-app-icons`: Simple mode
resets to the default icon, and Complex/Detailed mode sets the `ComplexMode`
alternate icon. Launcher icon config changes require a rebuilt Expo development
build before they appear on the iPhone home screen.

Do not change native splash configuration without explicit approval. In-app
brand mark usage is allowed. Generated native folders must remain ignored and
uncommitted.

The Progress/Home mode badge may switch between Simple and Complex only through
the existing tracking-preferences client/API. Do not add endpoints, schemas, or
backend behavior for that interaction. Failed updates should rollback or surface
a safe error state.

Phase 6.5 final onboarding polish keeps the reduced-card direction and uses a
small number of standalone informational slides instead of adding visual modules
inside data-entry slides. Weight-direction preview and starting-plan explanation
modules are acceptable when they use existing answers and do not collect extra
data. Do not add a separate mode explainer after the mode choice. Onboarding
copy should speak to a normal user, avoid internal terms such as baseline,
deterministic, payload, setup data, stored value, trend context, and target
calculation, and explain benefits or next actions instead of system mechanics.
The progress-direction slide should stay text-first unless a real designed
asset is available and tested on native iPhone. Do not build complex onboarding
illustrations from fragile React Native view geometry. If a custom graphic looks
broken, use a clean text-first info slide instead. Future real illustrations
should be custom assets or properly designed SVG/image assets, not rushed
view-block graphics.
Numbered pace/activity selectors should use segmented rail geometry between
marker bubbles so the rail does not visually run through the number circles.
Wheel inputs should feel fluid on iPhone while committing state only after a
snapped row settles or the user taps a row.

## Recent UI Issues Not To Repeat

- Dark selected cards with black or low-contrast text.
- Green primary CTA returning in onboarding.
- Beige/off-white drift when the screen should read as white and charcoal.
- Washed-out grey UI or uniformly weak grey icons.
- Over-coloring nutrition screens until they feel like dashboards.
- Giant rings or rushed custom graphics that overlap content on iPhone.
- Making Progress look like enlarged History.
- Repeating generic tab-name headers such as `Progress`, `History`,
  `Insights`, or `Profile`.
- Bulky footer overlays obscuring form content.
- AppLogo square corners escaping circular or pill containers.
- Single-line input text sitting too low on native iPhone.
- Helper/support text styled as another bordered card near the bottom.
- Helper/support text sitting immediately under the main module on short
  screens instead of occupying the lower support zone.
- Goal/activity cards pushed too far down with large empty gaps above.
- Static or uncontrolled birthday wheels where the visible date and age do not
  match.
- Generic rounded cards with no hierarchy, dividers, selected states, or clear
  purpose.
- Preserving old onboarding card styling by default when the component is the
  reason a screen feels generic.
- Treating `docs/design-system.md` or Phase 6.1 primitives as final visual
  authority.

Known current limitation to keep watching in native testing: lower support
placement and keyboard movement need real-device judgment, not desktop web
approval.

## Native iPhone Testing Direction

Do not rely on Expo Go for this phase. The confirmed Phase 6.3 path is a local
Expo development build through Xcode. Expo itself is not the problem; Expo Go
and web preview are the limitations. Expo development builds are
production-capable for this stage, and the project should not migrate to bare
React Native just to look more "professional."

Confirmed native testing state:

- Xcode was switched from Command Line Tools to full Xcode.
- iOS platform support was installed.
- `expo-dev-client` was added.
- CocoaPods installed successfully.
- The native build succeeded.
- The app installs and runs on Josh's iPhone through the Expo development build
  path.
- The iPhone can reach the Mac API through the Mac LAN IP.
- `EXPO_PUBLIC_API_URL` is set locally through `apps/mobile/.env.local`.
- Expo Go is not required for this testing path.
- `apps/mobile/ios/` may exist locally but should remain ignored/uncommitted
  for now.

Native-backed visual dependencies follow the same rebuild rule. Phase 6.6 uses
`react-native-svg` for reliable History calorie rings and `lucide-react-native`
for crisp mobile icons. After adding or changing native dependencies, rebuild
and reinstall the Expo development build before judging the result on iPhone;
Metro alone only validates JS/UI updates.

For JS-only UI changes, Metro refresh is enough to inspect layout on the
installed development build. For native dependency, native config, launcher
icon, splash, or generated native project changes, create a new development
build before judging behavior. `apps/mobile/ios/` and `apps/mobile/android/`
remain generated local folders and should stay uncommitted unless the project
explicitly changes that workflow.

Major UI work should be judged on physical iPhone before merge. Screens to
check include first load, loading/error/empty states, pull-to-refresh, keyboard
behavior, footer overlap, tab spacing, floating add behavior, logo clipping,
input vertical alignment, icon contrast, white/charcoal consistency, and
Simple/Detailed mode presentation.

Phase 7 should add skeleton loading for backend-connected mobile screens where
it improves perceived performance. Skeletons need native iPhone validation
because they can create layout jumps, awkward safe-area spacing, or visual
noise that is not obvious in web preview. They should match the final page
shape, use subtle neutral placeholders, avoid heavy animation, and follow the
Phase 6 white/charcoal standard.

Phase 7 skeleton QA should cover Progress, History, Insights, Profile, and
edit/log-again states for food and weight logs. New blank logging forms should
render normally without a skeleton. During pull-to-refresh, previously loaded
content should remain visible if the refresh fails.

Phase 7 completion checkpoint:

- Shared skeleton primitives exist for blocks, lines, pills, and rails.
- Progress, History, Insights, and Profile use first-load skeletons.
- Food log edit/log-again and weight log edit use record-load skeletons.
- New food and weight create forms render immediately.
- Small action spinners remain for saving, deleting, dismissing, and refreshing
  existing content.
- No backend, API, Prisma schema, package, lockfile, app config, or generated
  native changes were part of Phase 7.

Phase 8 should now focus on the backend/data foundation for app-owned food
records, custom foods, saved or reusable foods, barcode-ready food items, future
Open Food Facts and USDA integration, future RAG-assisted retrieval, and future
Complex mode nutrition expansion. Do not treat this checkpoint as approval to
implement barcode scanning, RAG-assisted AI logging, full nutrition expansion,
or native workflow changes.

Phase 10 adds food database-powered logging inside the existing food log flow.
Native smoke testing should cover manual food create/edit/delete/log-again,
searching reusable foods, selecting and clearing a food item, serving
multiplier input, saved-food save/unsave rows, recent-food reuse, and the
manual “save as reusable food” toggle. The new flow should still render a blank
create form immediately, keep the footer reachable above the keyboard, and
preserve the Phase 6 open row/divider visual standard without changing native
folders, app config, package files, or launcher icons.

Native iPhone testing also confirmed an expected Phase 10 limitation: food
search is wired correctly, but the local `FoodItem` list has no real starter
catalog yet. Search will be sparse until users create reusable foods or future
phases add barcode lookup, Open Food Facts, USDA, or starter catalog data.
Empty food-search and saved-food states should calmly point users back to
manual logging and reusable-food creation. Complex mode may acknowledge richer
nutrient data only when saved foods contain it; richer Complex UI and reporting
come later.

Phase 11 adds barcode scanning from the food-log flow. It intentionally adds
`expo-camera`, configures camera permission copy in `apps/mobile/app.json`, and
requires a rebuilt Expo development build before physical iPhone validation.
Metro refresh alone is not enough after adding this native dependency or camera
permission config.

Native scanner standards:

- `expo-camera` is a native dependency.
- Adding or changing camera native config requires a rebuilt iOS development
  build; Metro reload is not enough for new native permissions/config.
- Generated `apps/mobile/ios/` and `apps/mobile/android/` folders stay
  uncommitted unless the project explicitly adopts checked-in native folders.
- Camera permission copy must exist in app config and in the generated native
  build, including `NSCameraUsageDescription` on iOS.
- Physical iPhone testing is required for scanner work; simulator validation is
  not enough for barcode scanning.
- Camera permission crashes should be debugged from native config outward:
  app config, Expo prebuild/dev-build state, generated `Info.plist`, installed
  development build, and physical device logs.

Barcode scanner native smoke testing should cover:

- `Scan barcode` appears as a small action near food search, not a large card
- first camera permission request and denied-permission recovery
- scanner cancel/back behavior
- camera unavailable state if the camera cannot mount
- successful packaged-food scan returning to food logging with the scanned
  food selected
- Canadian/US retail barcodes, including UPC-A, UPC-E, EAN-13, and EAN-8
  where supported by Expo Camera
- UPC-A values that iOS reports as EAN-13 with a leading zero, such as
  `069000013762` and `0069000013762`
- close-range usability: hold the barcode inside the frame, move back slightly
  if the preview looks blurry, and use good lighting or the scanner light
- serving amount/unit, save/unsave, meal type, notes, and save using the
  existing selected-food flow
- no-match copy: `No barcode match yet` and
  `You can still save this as a reusable food.`
- network/backend error copy remains user-facing and non-technical
- unknown barcodes guide back to manual reusable food creation
- generated `apps/mobile/ios/` and `apps/mobile/android/` folders remain
  ignored and uncommitted

Before changing native files or generating an iOS project, inspect and report:

```bash
xcodebuild -version
xcode-select -p
xcrun simctl list devices
```

Also inspect:

- whether full Xcode is selected instead of Command Line Tools only
- whether a native `ios/` folder already exists
- Expo app config
- how `EXPO_PUBLIC_API_URL` is supplied

`expo-dev-client` is installed for local development builds. Use the mobile
workspace scripts for native iOS builds after confirming native generation is
acceptable:

```bash
corepack pnpm --filter @food-tracker/mobile ios:dev-build
corepack pnpm --filter @food-tracker/mobile ios:dev-build:device
```

These commands use `expo run:ios` and will generate `apps/mobile/ios/` if it is
missing. Generated native folders are ignored in this phase and should not be
committed without an explicit workflow decision.
Keep both `apps/mobile/ios/` and `apps/mobile/android/` ignored unless the
project explicitly adopts checked-in native folders later.

## Physical iPhone API Access

A physical iPhone cannot use `localhost` to reach the Mac API. Use the Mac LAN
IP and include `/api/v1`.

Find the Mac IP:

```bash
ipconfig getifaddr en0
ipconfig getifaddr en1
```

The API URL should look like:

```text
http://MAC_IP:3000/api/v1
```

Do not commit machine-specific IP addresses. Prefer `.env.local` or a shell
environment variable if supported, and verify the file is ignored by Git. This
repository ignores `.env.*` except example files.

## Native Onboarding Findings

Native iPhone testing confirmed that another onboarding UI polish pass is
needed before treating the visual system as settled.

- Mobile spacing and centering differ from web preview.
- Bottom helper/support text should sit closer to the bottom and move up only
  when the keyboard appears.
- The Birthday picker should return to true scroll/wheel behavior instead of
  tap-only rows.
- Onboarding should move away from old card-heavy styling instead of preserving
  previous visual primitives by default.
- Onboarding and Progress/Home should use the same visual system so setup and
  the first main screen feel like one designed product.

## Next-Phase Priorities

1. Preserve the completed Phase 12.8A–F serving behavior during Phase 12.9
   recipe and mixed-meal work.
2. Preserve Phase 12.7 trusted-search behavior; do not make AI nutrition
   authoritative.
3. Keep generated native folders ignored unless explicitly approved later.

Phase 12.8 final automated validation passed with Node `v22.23.0`, pnpm
`10.34.3`, 26 test files, and 598 tests. Final physical-device smoke testing
also passed for compatible-unit conversion, quantity-only trusted USDA foods,
candidate switching, physical-unit fallback, hidden internal whole-item
selectors, and authoritative serving saves. Physical devices use the Mac LAN
API URL through `EXPO_PUBLIC_API_URL`; Expo must be restarted after changing
that value.

## Phase 12 AI Text Logging Context

Phase 12 adds a `Describe meal` entry point to the existing food-log flow. The
screen should feel like messy thought to clean food log, not like a chat
assistant. Keep the Phase 6 visual standard: white-forward, charcoal-led, open
rows, thin dividers, compact pills, restrained copy, and no broad redesign.

AI text logging must preserve manual search, manual entry, saved foods, recent
foods, reusable foods, and barcode scanning. The review screen should allow
matched/loggable parsed foods to be selected, removed, and amount-adjusted.
Unmatched foods stay visible as unresolved rows and should direct the user back
to manual search or entry.

Phase 12.5 adds USDA generic food candidates to this same review surface.
USDA rows should read as normal food matches, not as a technical search tool.
Show simple source copy such as `USDA match` and keep the nutrient basis
visible, such as `per 100 g`. Do not imply that messy quantities like `2 eggs`
were perfectly converted unless the backend supplies a safe conversion.

Normal food search also needs USDA/generic candidates after local results.
Search results should still feel like Food Tracker rows, not a USDA browser:
local/saved/custom rows first, then source copy such as `Generic food match`.
Changing the selected candidate or serving amount/unit must update visible
calories/macros before save. Simple mode nutrient editing stays limited to
calories, protein, carbs, fat, fiber, sugar, and sodium. Complex mode can show
the supported normalized nutrient catalog. Any user-edited nutrition is a
FoodLog-level override only.

Phase 12.6 adds AI-estimated nutrition only for unresolved AI text logging
rows. Do not offer estimates in normal food search and do not auto-generate
estimates after parsing. The unresolved row should show a user-triggered
`Use AI estimate` action, low-trust copy, and editable basic nutrition before
saving. Saving an estimate creates only an unlinked FoodLog snapshot; it must
not create a reusable FoodItem or trusted cache entry. Simple mode exposes the
main nutrient editor fields. Complex mode must not show AI-generated detailed
micronutrients, though the user can still use the separate manual edit flow for
supported detailed nutrients later.

## Final Phase 12.7 Search Validation

Phase 12.7 is complete and commit-ready. Physical-phone smoke testing passed
with significantly improved search quality, alongside API terminal smoke,
mixed regression/out-of-sample testing, and compound-identity holdout testing.
The public candidate-search request contract remains unchanged; no public
`searchDepth` or show-more workflow was added.

The mobile caller should treat candidate confidence and review state as backend
facts. `visibleRelevant` means a candidate is related enough to show as a
manual option. `selectionEligible` means it is safe for AI parsing to select
automatically or for trusted-candidate checks to block a low-trust estimate.
Raw, dry, frozen, unprepared, composite, conflicting, or partial compound
forms may remain visible but are not trusted automatically unless explicitly
requested. Medium confidence alone is not selection-safe.

The final phone/search smoke covered the core set (`banana`, `rice`, `eggs`,
`milk`, `chicken breast`, `steak`, `salmon`, `oats`, `potato`, `Greek yogurt`,
and `peanut butter`) plus compound and out-of-sample holdouts: `sweet potato`,
`rice noodles`, `egg sandwich`, `whole milk`, `almond milk`, `chicken
sandwich`, `whole wheat bread`, `brown rice noodles`, `baked sweet potato`,
and `turkey sandwich`. These queries returned no empty results or request
errors, and cold/warm cache behavior remained stable. Explicit forms such as
oat milk, steak sauce, banana pudding, peanut butter cookies, egg white, and
raw salmon remain distinct from their plain/default queries.

Phase 12.8 serving intelligence is implemented. Public
expanded search/show-more, typo semantics, embeddings/vector search, recipes,
and additional providers remain future backlog, not mobile requirements for
Phase 12.7.

Final Phase 12.6 phone smoke passed on the local development build:

- `2 eggs, toast, banana` resolves through trusted review candidates instead of
  requiring AI estimates
- homemade/custom unresolved food can show the `Use AI estimate` action
- the estimate is visibly low-trust and editable before saving
- saving the estimate creates an unlinked FoodLog snapshot, not a reusable
  FoodItem
- Simple mode stays limited to main nutrient editing
- Complex mode does not show AI-generated micronutrients

Manual smoke test for implementation:

- open `Describe meal`
- submit a messy description
- see `Reading your meal...`
- review parsed rows
- remove one row
- adjust a matched row amount
- switch between multiple candidates for a parsed food such as eggs
- search manually for `banana`, `eggs`, `rice`, `cooked rice`, `chicken breast`,
  `milk`, `Greek yogurt`, and `peanut butter`; verify the most obvious trusted
  candidate ranks first even when weaker local/cached/branded rows exist
- verify preparation-only false matches are absent: `boiled egg` and `cooked
  rice` must not show kale; plain `milk` must not show milk chocolate; plain
  `banana` must rank raw banana above banana chips
- verify plain/default ordering: cooked/plain rice above rice snacks or flour,
  plain Greek yogurt above flavored branded yogurt, whole egg above processed
  egg white, and cooked/plain chicken breast above raw, deli, or honey-glazed
  products; raw/dry alternatives may remain visible but must not be selected
  automatically for AI parse
- search `banana chips`, `rice cakes`, `milk chocolate`, `breaded chicken`,
  `egg white`, and `peanut butter cookies`; verify explicit requested forms
  rank above edible defaults for their own queries
- search `steak`, `beef steak`, `salmon`, `oats`, `oatmeal`, and `potato`;
  verify usable cooked/default candidates appear when USDA metadata supports
  them, with no more than one bounded fallback lookup per search
- search `sweet potato`, `rice noodles`, `egg sandwich`, and `whole milk`;
  verify complete compound identities outrank ordinary potato, plain rice,
  plain egg, yogurt, buttermilk, and evaporated milk
- search `oat milk`, `steak sauce`, `banana pudding`, `almond milk`, `chicken
  sandwich`, `whole wheat bread`, `brown rice noodles`, `baked sweet potato`,
  and `turkey sandwich`; verify each remains distinct from its plain/default
  identity
- for plain `rice`, `milk`, `steak`, and `oats`, verify noodles/rice-with-milk,
  malted milk, steak sauce, and oat bran/oat milk do not outrank an available
  cooked/default candidate
- live smoke scripts should read candidate names from `externalFood.name` for
  USDA candidates and `foodItem.name` for local candidates, and should print
  elapsed time; normal searches should return usable candidates quickly, with
  repeat searches faster because of process-local USDA caches
- change a serving amount and verify displayed nutrition updates immediately
- verify Simple mode only exposes main nutrient editing and Complex mode
  exposes detailed nutrients
- verify USDA-backed rows show explicit basis copy when present
- leave an unmatched row unresolved, then tap `Use AI estimate`
- verify the estimate is labeled low-trust and can be edited before saving
- verify no AI estimate appears for matched or USDA-backed rows
- log selected rows
- verify AI unavailable, rate-limit, and network error copy
- verify existing manual/search/barcode flows still work
4. Use `apps/mobile/.env.local` with the Mac LAN IP for physical iPhone API
   access.
5. Keep Phase 7 skeleton standards intact while adding richer food-data flows.

## Phase 12.8E Mobile Serving Intelligence

The standard Food Log screen now treats trusted servings as an amount plus a
safe unit or trusted listed serving, rather than a raw multiplier. Search,
saved/reusable FoodItems, barcode-resolved FoodItems, and trusted external
candidates share the same control. The preview is deliberately provisional:
it uses the shared deterministic resolver and scaler, while the API response is
the persisted source of truth after saving.

- Show the stored nutrition basis plainly (for example, `per 100 g`), not as a
  recommendation.
- Offer only g/kg/oz/lb for mass bases, mL/L for volume bases, the exact count
  identity for count bases, and trusted provider/manual labels. Never expose
  internal regional unit codes or raw option IDs.
- A bare cup, bowl, plate, handful, or another untrusted household amount must
  show review guidance with no fabricated nutrition preview. Keep the entered
  amount so the user can choose a safe alternative.
- Snapshot-backed edits can recalculate from the saved basis. A frozen option
  remains usable when its FoodItem is deleted or changed; a different option
  requires the current FoodItem option. Legacy logs with no snapshot keep the
  existing manual editing behavior and must not claim recalculation support.
- If a snapshot has a nutrition adjustment, changing its serving must explicitly
  remove or replace that adjustment. Do not silently multiply or preserve it.
- The current screen and `AppScreen` layout continue to use the existing
  keyboard-safe scroll/footer pattern; validate long labels, small phones, and
  open keyboards on a device before declaring the flow smoke-tested.

An Expo web server smoke successfully started and served the app on a temporary
alternate port; no interactive browser, device, or simulator smoke was
performed as part of this handoff. Phase 12.8F AI quantity interpretation
is documented separately below; no device smoke has been completed for it.

## Phase 12.8F AI Quantity And Serving Review

The Describe meal review now preserves AI quantity and serving text while using
the shared deterministic parser and provisional serving engine. Each parsed row
owns its amount, unit, selected trusted option, preview, and error state.

- Parsed servings initialize from the parser; missing servings initialize from
  the selected candidate basis with explicit basis-default copy.
- Bare cup, bowl, plate, handful, and size text never receive a universal
  conversion. They remain review-required unless the candidate's validated
  serving options resolve them.
- Candidate changes preserve amount/unit where possible, clear unavailable
  options, and re-run the preview without changing another row.
- Trusted saves send `serving` per row to the authoritative candidate API. The
  low-trust AI-estimate fallback remains separate and unchanged.

No interactive device or simulator smoke has been performed for this flow.
6. Preserve backend/API/schema approval gates before Phase 8 data-model or
   migration work.

## Phase 12.9A Slice 4 — Mobile Recipe Experience

The reusable recipe experience lives inside the existing Food Log flow rather
than in a new tab. `Recipes` opens a compact modal-stack sequence for the list,
builder/editor, detail, and logging surfaces. It reuses `FoodItemChoiceRow`,
`ServingAmountControl`, `AppScreen`, the shared Food Log refresh signal, and
the white/charcoal open-row visual language.

- Recipe search accepts persisted `food_item` candidates only. External
  candidates stay visible as explanatory non-selectable rows; manual foods and
  client nutrition totals are never sent to recipe endpoints.
- Ingredient serving previews are provisional Phase 12.8 feedback. Invalid or
  needs-review servings remain visible but prevent saving. The backend recipe
  response remains the nutrition authority.
- Builder metadata updates call only the recipe update endpoint. Existing
  ingredients are compared with their frozen requests so only added, changed,
  or removed ingredients use mutation endpoints. A missing source FoodItem
  remains an unchanged frozen ingredient until the user intentionally replaces
  it.
- Recipe detail displays backend total, per-portion, and—only when available—
  per-gram summaries. Simple mode hides normalized nutrients; Detailed mode
  shows the returned normalized nutrient map without recomputing it.
- Recipe logging has portion and optional gram modes, uses the existing
  meal/date/time/notes conventions, disables duplicate submissions, and bumps
  the shared data version after the authoritative FoodLog response. History,
  Progress/Dashboard, Insights, and the next Food Log load then refresh.
- Editing a recipe-origin History entry exposes only meal, timestamp, and
  notes. It clearly directs nutrition or quantity corrections to delete and
  re-log from Recipes. Ordinary FoodLogs retain their existing screen.

The Phase 12.9A recipe smoke test passed on the physical iPhone. Use the
installed Expo development build and the LAN API URL for future regression
checks; no native rebuild is needed because these slices change only
JavaScript/TypeScript.

## Phase 12.9B Slice 3 — Mixed Meals And Manual Foods

Mixed meals open as a compact modal from Food Log and do not add a bottom tab.
The builder stores meal metadata, ordered duplicate-capable ingredients, serving
navigation state, and save-as-recipe metadata in a focused Zustand session.
Trusted persisted foods, USDA candidates persisted through the existing backend
flow, and manual foods all return through the shared ingredient serving-details
screen. Preview totals are backend-returned; the mobile client sends only FoodItem
IDs and requested serving fields.

Manual foods use dedicated create/edit/archive modals. They are user-owned and
searchable but are not automatically saved. Validate all required nutrition and
basis fields, explicit zero values, unsupported-unit errors, archive behavior,
keyboard-safe navigation, retryable preview failures, and duplicate-submit
protection on a small physical device as part of the Phase 12.9B smoke suite.

### Phase 12.9B Physical-Device Validation — Complete

All 18 Slice 3/4 physical-device checks passed on the iPhone, including trusted
FoodItem selection, USDA persistence, manual-food creation/edit/archive,
serving-details cancellation and edits, mixed-meal preview, Simple/Detailed
nutrition display, save-as-recipe, error recovery, refresh propagation, and
rapid repeated taps creating exactly one FoodLog. Phase 12.9B is complete.

### Deferred Logging-Selector Redesign

The current Food Log screen may continue listing available logging methods in
one place. A later frontend redesign may replace that temporary layout with a
multi-screen interactive logging selector, potentially integrated into the
existing curved or semi-circular bottom control, so users move between logging
methods instead of seeing every method on one page. This redesign is outside
Phase 12.9B; future logging methods may continue using the temporary entry
layout until that redesign begins.
# Phase 13 Food Library

Food Log has a compact Food Library action, presented in the existing modal
stack. It exposes Saved, My Foods, Recent, and Archived sections without a new
tab or a cache-wide USDA browser. Default servings are editable prefills using
the existing ServingAmountControl; every use still goes through serving
validation. The multi-method Food Log selector redesign remains deferred.

# Phase 14 Slice 2 Photo Logging

Photo Logging is available from the current temporary Food Log method list;
the deferred selector redesign remains deferred. The flow uses `/photo-log`
for source choice and privacy disclosure, `/photo-log/camera` for still capture
and permission recovery, `/photo-log/review` for analysis and independent
rows, `/photo-log/search` for trusted replacement or manually added foods, and
`/photo-log/confirm` for explicit final saving.

Camera and photo-library permissions are configured through Expo. A library
asset is user-owned and is never deleted. Camera captures and normalized files
are app-owned temporary files. Both sources use the same native re-encoding
pipeline: EXIF orientation is applied while decoding, aspect ratio is
preserved, the longest edge is capped at 2048 px without upscaling, and the
result is JPEG at quality 0.75. The processed file must be at most 5 MiB; the
original is never silently uploaded as a fallback. HEIC/library input is
converted to JPEG before upload. Cleanup is best-effort, idempotent, and never
blocks navigation or replaces the primary error. No photo is retained after
completion, failure, cancellation, or reset.

The mobile client sends the normalized file as a raw `image/jpeg` request to
the Slice 1 endpoint with an abort signal and a 17-second client budget. It
does not send multipart, base64 JSON, provider payloads, photo URIs, or
nutrition data. The Expo development client must be rebuilt after adding the
approved image packages and permission/config changes.

One photo may produce up to eight independent review rows. Each row starts
pending and must be confirmed with a trusted candidate and valid serving, or
explicitly excluded. Rows can be replaced, removed/excluded, or supplemented
with a trusted search result; user-added rows remain distinct from
provider-recognized rows. Unsupported servings, unresolved candidates,
unreviewed low-confidence matches, and pending rows block continuation. Simple
mode shows concise trusted calories/protein; Detailed/Complex mode also shows
trusted available macros and normalized nutrients. Unknown values remain
unknown, and provider nutrition is never displayed or used.

Final confirmation calls `/food-logs/from-candidates` with only trusted
candidate references, reviewed servings, meal metadata, and permitted notes.
Rapid repeated taps are single-flight. A successful save clears the transient
session, cleans app-owned files, marks the existing shared refresh signal, and
dismisses the photo modal stack. Physical-device testing is still pending and
must verify camera/library permissions, HEIC and orientation cases,
cancellation, upload timeout/offline recovery, review-row editing, and final
save on a rebuilt development client.
