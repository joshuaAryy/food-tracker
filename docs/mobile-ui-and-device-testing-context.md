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
- serving multiplier, save/unsave, meal type, notes, and save using the
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

1. Continue on the Phase 8 branch for food database foundation work.
2. Confirm Node 22 and pnpm 10.34.3.
3. Keep generated native folders ignored unless explicitly approved later.

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
Changing the selected candidate or serving multiplier must update visible
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
- search manually for `banana`, `eggs`, `salmon`, or `plantain` and verify USDA
  candidates appear after local matches
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
6. Preserve backend/API/schema approval gates before Phase 8 data-model or
   migration work.
