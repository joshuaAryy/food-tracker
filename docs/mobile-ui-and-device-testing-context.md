# Mobile UI And Device Testing Context

This document preserves the current mobile UI and native testing context so
future sessions do not need long conversation history.

## Current Phase

The onboarding visual reset has been merged into `main` as a checkpoint, not as
final visual taste. The next work should move toward
`phase-6-3-ios-device-testing`.

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

Prefer mostly light, off-white, and white UI with thin borders and subtle
structure. Primary CTAs should be black/charcoal. Green/sage may exist as a
secondary or legacy accent, but it should not be the main primary action color.

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
  dashboard preview, receipt-style summary, and "Calculated from your setup" as
  secondary copy.

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

## Recent UI Issues Not To Repeat

- Dark selected cards with black or low-contrast text.
- Green primary CTA returning in onboarding.
- Helper/support text styled as another bordered card near the bottom.
- Goal/activity cards pushed too far down with large empty gaps above.
- Static or uncontrolled birthday wheels where the visible date and age do not
  match.
- Generic rounded cards with no hierarchy, dividers, selected states, or clear
  purpose.
- Treating `docs/design-system.md` or Phase 6.1 primitives as final visual
  authority.

Known current limitation: some bottom text/support content may sit too close
under the main interaction instead of lower on the screen. Revisit this after
native testing rather than continuing desktop web polish.

## Native iPhone Testing Direction

Do not rely on Expo Go for the next phase. Prefer an Expo development build and
local Xcode workflow if practical. Expo itself is not the problem; Expo Go and
web preview are the limitations. Expo development builds are production-capable
for this stage, and the project should not migrate to bare React Native just to
look more "professional."

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

## Next-Phase Priorities

1. Create or use a branch around `phase-6-3-ios-device-testing`.
2. Confirm Node 22 and pnpm 10.34.3.
3. Inspect Xcode, selected developer directory, simulator availability, Expo
   config, `expo-dev-client`, native folder state, and API URL handling.
4. Decide whether to generate native iOS files, asking before committing any
   generated native-file changes.
5. Run the API with a phone-reachable URL.
6. Validate onboarding on simulator or physical iPhone, focusing on safe areas,
   transitions, fixed bottom CTA, Birthday wheel state, selected-card contrast,
   and keyboard/touch behavior.
7. Document any device-only findings before another visual polish pass.
