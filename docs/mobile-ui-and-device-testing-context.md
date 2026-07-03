# Mobile UI And Device Testing Context

This document preserves the current mobile UI and native testing context so
future sessions do not need long conversation history.

## Current Phase

The Phase 6.5 visual system reset begins aligning onboarding and Progress/Home
around the imported reference set in `docs/design-references/phase-6-5/`.
The durable lessons from the Phase 6 visual iterations are captured in
`docs/mobile-visual-lessons.md`; read it before starting future mobile visual
work.

Do not keep spending time on desktop web onboarding polish before native
testing. Web preview remains useful for fast layout iteration, but it is not
enough to judge spacing, touch targets, safe areas, keyboard behavior,
transitions, or the fixed bottom CTA on a real phone.

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

The mobile visual identity is still exploratory. `docs/design-system.md` is the
current implementation baseline, not final brand authority. Current tokens,
cards, and Phase 6.1 primitives are implementation tools; they may be rewritten
or replaced when explicit design feedback shows they are too generic, too
form-like, or visually weak.

Phase 6.5 uses Stoic as the strongest mood/style reference: calm grey canvas,
confident black typography, soft white modules, restrained icons, purposeful
hero panels, minimal chrome, and quiet metadata. Cal AI is useful for
nutrition/onboarding flow structure and result payoff, not exact visual style.
Lifesum/Cronometer-style visuals and Apple Health card spam should not be
copied. Green health references are picker/functionality references, not green
CTA direction.

Prefer mostly light, off-white, and white UI with subtle structure. Onboarding
should move away from bordered-card stacks and rely more on open layouts,
native-feeling wheel zones, soft selected bands, typography, spacing, and
subtle fills. Borders should be rare and purposeful. Primary CTAs should be
black/charcoal. Green/sage may exist as a secondary or legacy accent, but it
should not be the main primary action color.

Avoid:

- Apple Health-style stacked card spam
- beige/yellow wellness templates
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

1. Create or use a branch around `phase-6-3-ios-device-testing`.
2. Confirm Node 22 and pnpm 10.34.3.
3. Keep generated native folders ignored unless explicitly approved later.
4. Use `apps/mobile/.env.local` with the Mac LAN IP for physical iPhone API
   access.
5. Use native iPhone findings to judge the Phase 6.5 onboarding and
   Progress/Home reset.
6. Keep the birthday wheel scroll/snap/state behavior intact while iterating on
   visuals.
