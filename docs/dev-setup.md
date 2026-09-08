# Development Setup

This guide covers the supported local environment for the Food Tracker
monorepo.

## Required Tools

- Node.js `22.x`
- pnpm `10.34.3`
- Docker with a running daemon
- PostgreSQL client access through the project Prisma tooling

## 1. Verify Node And pnpm

Using `nvm`:

```bash
nvm install 22
nvm use 22
node -v
corepack pnpm -v
```

Expected:

```text
node: v22.x
pnpm: 10.34.3
```

Stop if Node is not `22.x`. An `Unsupported engine` warning means the runtime is
wrong and invalidates later validation.

Do not require `corepack enable`. If `corepack pnpm` is unavailable, use the
pinned fallback:

```bash
npx pnpm@10.34.3 <command>
```

## 2. Install Dependencies

From the repository root:

```bash
corepack pnpm install
```

## 3. Start PostgreSQL With Docker

The repository does not currently include a Docker Compose file. Use a named
PostgreSQL container:

```bash
docker run --name food-tracker-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=food_tracker \
  -p 5432:5432 \
  -d postgres:16
```

This creates the development database. Create the dedicated test database once:

```bash
docker exec food-tracker-postgres \
  pg_isready -U postgres

docker exec food-tracker-postgres \
  createdb -U postgres food_tracker_test
```

Wait until `pg_isready` reports that PostgreSQL is accepting connections before
creating the test database or running Prisma commands.

On later development sessions, restart the existing container:

```bash
docker start food-tracker-postgres
```

Confirm it is running:

```bash
docker ps --filter name=food-tracker-postgres
```

Standard URLs:

```text
Development:
postgresql://postgres:postgres@localhost:5432/food_tracker

Tests:
postgresql://postgres:postgres@localhost:5432/food_tracker_test
```

Never configure tests to use `food_tracker`. The test suite migrates and clears
the selected test database.

## 4. Configure The API

Create the ignored local environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

The default contents point to the development database:

```dotenv
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/food_tracker"
```

Tests resolve their database URL in this order:

1. `TEST_DATABASE_URL`
2. `DATABASE_URL_TEST`
3. `postgresql://postgres:postgres@localhost:5432/food_tracker_test`

Any selected test database name must end in `_test`.

## Phase 16 Authentication And Hosted API Configuration

Firebase Authentication is the selected identity provider for the active local
implementation. The API uses Firebase Admin variables named
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
These are server-only and must never use `EXPO_PUBLIC_` names. Use separate
development, staging, and production Firebase projects and inject the matching
credentials through the environment; do not commit a plist or service-account
file.

For local API development, place those server-only values in the ignored
`apps/api/.env` file. The API development command loads that file directly;
the mobile plist is not a Firebase Admin credential source.

Email/password and Google are the active free-development providers. Apple code
remains preserved but the current build disables it with
`EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false`. The flag is parsed centrally by the
typed Expo configuration helper; malformed values fail configuration.

The API also requires explicit hosted CORS origins and a server-owned
`RATE_LIMIT_KEY_SECRET` outside development/test. The API liveness route is
`/health`. Root `railway.json` declares the workspace build, Prisma
`migrate deploy` pre-deploy step, compiled API start command, health check, and
restart policy. Railway staging resources, secrets, and domain are staging-only;
production deployment, backups, billing, and rollback ownership remain outside
this phase.

For a physical authentication check, start the local API and confirm its
unauthenticated health route is reachable before signing in. The API must have
Firebase Admin configuration and a reachable PostgreSQL database with current
migrations before an authenticated setup-status request can succeed. A valid
mobile Firebase token alone is not sufficient.

For Railway staging, supply server-only Firebase Admin variables, database
configuration, explicit trusted browser origins, rate-limit and provider
secrets through Railway's environment controls. The dedicated environment is
named `staging`, contains the API and private PostgreSQL service, and has been
validated with hosted migrations, health checks, two-user ownership isolation,
provider flows, and disposable account deletion. Production resources remain
separate and were not changed.

### Railway Staging Handoff

The repository manifest builds the workspace, generates Prisma artifacts,
applies committed migrations before deployment, starts the compiled API, and
uses the unauthenticated health route for liveness. It does not create a
Railway resource or store any environment value.

The validated staging service uses these server-side categories by name:
`APP_ENV`, `DATABASE_URL`, `CORS_ORIGINS`, `FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `RATE_LIMIT_KEY_SECRET`,
`USDA_FDC_API_KEY`, `AI_PROVIDER`, `GEMINI_API_KEY`,
`GEMINI_FOOD_PARSE_MODEL`, and the photo-AI feature controls and proof secret.
Mobile staging uses only `EXPO_PUBLIC_API_URL`; it must be supplied to the
Expo process with static public-variable access. `EXPO_NO_CLIENT_ENV_VARS`
must be unset, and server secrets must never enter `EXPO_PUBLIC_*` values.

Use only backward-compatible database migrations during the first staging
deploy. Rollback means redeploying the last known-good application build; do
not automatically reverse a migration. Confirm managed-database backup and
restore ownership before storing user data, apply a small environment-appropriate
spend limit or alert, and remove idle services before ending staging work.

### Deterministic Phase 17.5 staging QA data

The API includes a staging-only reset-and-reseed command for visual QA. Run it
inside the existing Railway `staging` environment, where `DATABASE_URL` is
already injected; do not copy secrets into a shell history or documentation:

```bash
railway run --service food-tracker-staging-api --environment staging -- \
  env APP_ENV=staging corepack pnpm --filter @food-tracker/api seed:staging-analytics-qa -- \
  --firebase-uid <existing-staging-firebase-uid> \
  --anchor-date 2026-08-12 \
  --reset
```

`--email <existing-staging-email>` may be supplied instead of the UID, or
alongside it as a cross-check. The command refuses production and non-staging
environments, requires an explicit target and `--reset`, and changes only that
Firebase-linked user's analytics fixture state. It preserves the user and
Firebase ownership identity. The fixture contains 210 prior days plus the
anchor day, mixed complete/partial/unlogged logging behavior, weight and water
observations, sparse micronutrients, four saved views with exactly one pinned,
and production-shaped recommendations.

The account must be created and signed into staging once by the user before
this command can run. Never substitute another staging account and never place
credentials, tokens, or service-account material in this repository.

### Phase 17.5 staging Simulator workflow

After the generated `apps/mobile/ios/FoodTracker.xcworkspace` exists, start a
staging-configured LAN Metro server for the installed Debug development client
with:

```bash
corepack pnpm ios:staging-simulator
```

The command validates the Railway staging API target, staging Firebase public
configuration, and dotenv guardrails before starting Metro. It removes only
inherited Debug/Release flags that would suppress bundling or client variables;
it does not change the standalone Release workflow or print secret values.
Build/install the workspace with the iOS Simulator workflow, then connect the
development client to the LAN URL shown by Expo. Authenticate only through the
normal staging Firebase flow using the dedicated QA account.

## 5. Prepare Prisma

From the repository root:

```bash
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
```

`prisma migrate deploy` applies committed migrations to the database selected by
`apps/api/.env`.

The test suite runs `prisma migrate deploy` automatically against its dedicated
test database before tests execute.

## 6. Run The API

```bash
corepack pnpm dev:api
```

Default API:

```text
http://localhost:3000/api/v1
```

## 7. Run The Mobile App

Web preview:

```bash
corepack pnpm dev:mobile
```

The mobile client uses `EXPO_PUBLIC_API_URL`. Set it in the shell before
starting Expo when the default is not reachable:

The local and LAN examples in this section apply only to the Metro-backed
development client. The Phase 17 Release workflow rejects them and embeds the
existing Railway staging target instead.

```bash
EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1 \
  corepack pnpm dev:mobile
```

The value must be the complete API base URL, including `/api/v1`. Expo embeds
public environment variables when the development server starts, so stop and
restart Expo after changing the value.

Runtime examples:

```text
iOS simulator:
http://localhost:3000/api/v1

Android emulator:
http://10.0.2.2:3000/api/v1

Physical phone:
http://<computer-LAN-IP>:3000/api/v1
```

For physical devices:

- The phone and development computer must be on a mutually reachable network.
- The API must remain running on the computer.
- The local firewall must permit inbound connections to port `3000`.
- Do not use `localhost`; on the phone it refers to the phone itself.
- Find the Mac LAN IP with `ipconfig getifaddr en0`; if that returns nothing,
  try `ipconfig getifaddr en1`.
- Do not commit machine-specific IP addresses. Use a shell environment variable
  or an ignored local environment file when supported.

Verify reachability from the phone browser before opening the app:

```text
http://<computer-LAN-IP>:3000/api/v1/setup/status
```

A JSON success response confirms that the phone can reach the API.

## 8. Native iPhone Development Build Preparation

Web preview is not final mobile UI validation. Use it for fast iteration, but
judge safe areas, touch behavior, keyboard behavior, transitions, spacing, and
fixed bottom CTAs on an iOS simulator or physical iPhone.

Expo Go is not required for the current native testing path. The confirmed
Phase 6.3 workflow is an Expo development build through local Xcode tooling:
full Xcode selected, iOS platform support installed, `expo-dev-client`
installed, CocoaPods installed successfully, native build succeeded, and the
app installed/runs on Josh's iPhone.

Before generating native files, inspect:

```bash
xcodebuild -version
xcode-select -p
xcrun simctl list devices
```

Also inspect whether full Xcode is selected instead of Command Line Tools only,
whether an `ios/` folder already exists, the Expo config, and how
`EXPO_PUBLIC_API_URL` is provided.

`expo-dev-client` is installed for development builds. The mobile workspace
exposes local iOS build commands:

```bash
corepack pnpm --filter @food-tracker/mobile ios:dev-build
corepack pnpm --filter @food-tracker/mobile ios:dev-build:device
```

These commands run `expo run:ios` and will generate local `apps/mobile/ios/`
files if the folder does not exist. Generated native folders are ignored in
this phase and should not be committed without an explicit workflow decision.
`apps/mobile/ios/` may exist locally after a native build; keep it uncommitted
for now. `apps/mobile/android/` is also ignored unless the project explicitly
adopts checked-in native folders later.

For physical iPhone testing, prefer an ignored local environment file:

```dotenv
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:3000/api/v1
```

The iPhone must use the Mac LAN IP. `localhost` points to the phone, not the
Mac. Verify the API from the iPhone browser before testing the app:

```text
http://<computer-LAN-IP>:3000/api/v1/setup/status
```

If `xcrun simctl list devices` shows no simulator devices, check runtimes:

```bash
xcrun simctl list runtimes
```

When no iOS simulator runtimes or devices are installed, prioritize physical
iPhone testing and install a simulator runtime later from Xcode Settings >
Platforms.

## 9. Phase 17 Free Xcode Standalone Release — Complete

### Personal Team local UAT mode

When a free Apple Personal Team is used for hands-on iPhone testing, use the
dedicated local command:

```bash
corepack pnpm --filter @food-tracker/mobile ios:personal-team
```

This synchronizes the existing ignored iOS project without a clean prebuild,
sets `IOS_REMOTE_PUSH_ENABLED=false`, and runs the app on a connected device.
The generated app retains the notification source and dependency for ordinary
app behavior, but omits the APNs `aps-environment` entitlement, does not
register a remote-push installation, and explains in Notification settings
that delivery is unavailable in this local build. It is intended for manual
UAT with a Personal Team and is not physical APNs acceptance.

The real staging Release workflow is separate and remains push-capable. Its
validated ignored environment must set `IOS_REMOTE_PUSH_ENABLED=true` and
provide the canonical `EXPO_PUBLIC_EAS_PROJECT_ID`; the workflow rejects a
push-disabled staging Release before prebuild. An eligible paid Apple
Developer Team is required for that native capability and for eventual remote
push acceptance.

Phase 17 delivered and physically validated a local Xcode Release installation
for Josh's iPhone. It does not use EAS,
EAS Submit, TestFlight, App Store Connect, a production Railway environment, or
the local API at runtime. The existing Railway staging API and private staging
PostgreSQL remain the hosted backend, and Firebase remains the authentication
provider.

Prerequisites:

- the current branch is `phase-17-free-xcode-standalone` or post-merge `main`;
- Node `22.x` and pnpm `10.34.3`;
- the canonical iOS deployment target is `16.4` for the app and generated Pods;
- full Xcode with the iPhoneOS SDK, accepted license, and CocoaPods;
- at least 10 GiB free Mac disk space;
- Josh's trusted iPhone connected by USB or approved wireless debugging, with
  Developer Mode enabled;
- an Apple Account whose free Personal Team is visible in Xcode;
- a locally available external Firebase `GoogleService-Info.plist` for the
  existing iOS bundle, with no plist or credential copied into Git.

Create the ignored `apps/mobile/.env.staging-release.local` file locally. It
contains only these categories:

- `APP_ENV=staging` and `EXPO_PUBLIC_APP_ENV=staging`;
- `RAILWAY_STAGING_API_HOST` set to the same Railway staging service host as
  the public HTTPS API base;
- the public Railway staging HTTPS API base ending in `/api/v1`;
- `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED=false`;
- `IOS_REMOTE_PUSH_ENABLED=true` for this push-capable Release workflow;
- the public Google web client ID;
- the Google reversed-client URL scheme and an absolute local path to the
  external Firebase plist;
- `EXPO_NO_DOTENV=1`.

Do not include database URLs, Firebase Admin material, provider keys,
rate-limit/proof secrets, credentials, or any unapproved `EXPO_PUBLIC_*` name.
The preparation command rejects localhost, loopback, private/LAN/link-local
and `.local` API hosts, malformed paths, query/fragment/credential-bearing
URLs, missing staging selectors, exposed server variables, and a present
`EXPO_NO_CLIENT_ENV_VARS` variable. It prints categories only, never values.

Run the guarded preparation from the repository root:

```bash
node -v
corepack pnpm -v
corepack pnpm ios:staging-release
```

The command snapshots the existing dirty Git state, verifies that
`apps/mobile/ios/` is ignored, untracked, and not a symlink, runs clean Expo
prebuild and CocoaPods preparation, validates Release metadata, Firebase,
Google, camera/photo permissions, static frameworks, and the bundled
JavaScript entry point, then opens `FoodTracker.xcworkspace`. It does not select
credentials or sign on the user's behalf. The completed Phase 17 run passed
these automated boundaries, and the user completed Personal Team signing,
physical installation, standalone launch, artifact verification, and guarded
cleanup.

After clean prebuild and CocoaPods, the workflow writes an ignored,
workflow-owned `apps/mobile/ios/.xcode.env.local` handoff containing only the
validated staging public/native variables. It sets `EXPO_NO_DOTENV=1` and
clears `EXPO_NO_CLIENT_ENV_VARS`, so Xcode's later Expo Constants and
`export:embed` processes cannot fall back to `.env.local`. Normal development
prebuilds regenerate this file for local Debug behavior; never copy staging
values into `.env.local` or commit the generated handoff.

The generated iOS project also adopts the UIScene lifecycle required by the
iOS 27 SDK. The tracked CNG plugin creates one default application scene,
moves React Native window ownership and startup into `SceneDelegate.swift`,
and keeps AppDelegate Firebase, Google callback, and linking integration. Do
not patch the generated Swift files directly; rerun the guarded prebuild after
changing native configuration.

After the user builds Release in Xcode, verify the actual artifact before
another physical reinstall:

```bash
corepack pnpm ios:staging-release -- --verify-release-artifact
```

This guarded check finds the newest `Release-iphoneos/FoodTracker.app`,
requires a non-empty `main.jsbundle`, validates canonical metadata, and checks
that the embedded API target is the validated staging target without printing
the URL or bundle contents. It rejects local, private, malformed, or missing
targets.

After Xcode evidence is recorded, the guarded cleanup removes only the exact
generated `apps/mobile/ios/` directory:

```bash
corepack pnpm ios:staging-release -- --cleanup-after-validation
```

Cleanup refuses tracked, non-ignored, non-directory, symlinked, or unexpected
native state and preserves unrelated dirty or untracked files. The seven-day
Personal Team limit is expected: when the profile expires, rerun preparation,
select the Personal Team again if prompted, build Release, and reinstall.

If the beta Xcode application is installed outside `/Applications`, substitute
its installed `.app` path when opening the workspace. The generic `open -a
Xcode` handoff can fail when macOS has no application registered under that
name; manually opening the installed beta application and then
`FoodTracker.xcworkspace` is the supported fallback.

### Xcode and iPhone checkpoint

In Xcode, open the generated workspace, select Josh's iPhone, select the
existing bundle identifier, enable automatic signing with the free Personal
Team, and choose the Release configuration for Run. Trust the Mac on the
iPhone, enable Developer Mode, build and install, and allow the Release app to
replace the development client. Stop Metro, Docker, and the local API before
disconnecting the phone. Validate on cellular data or independent Wi-Fi, then
run the consolidated physical checklist in
`docs/mobile-ui-and-device-testing-context.md`. The final Phase 17 record
confirms that the user completed this checklist successfully; it remains the
repeatable procedure for the next free-signing reinstall.

## 10. Run Backend Tests

Ensure PostgreSQL is running and `food_tracker_test` exists:

```bash
corepack pnpm test
```

The test configuration:

- refuses databases whose names do not end in `_test`
- applies committed migrations
- clears test-owned tables between tests
- runs files serially against the dedicated test database

PostgreSQL being unavailable is a setup failure, not a reason to omit tests.

## 11. Full Validation

Run after final changes and before merge:

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

All package commands must run under Node `22.x` without an unsupported-engine
warning.

Command coverage:

- `format:check`: repository formatting
- `lint`: shared, API, and mobile linting
- `typecheck`: shared, API source/tests, and mobile TypeScript
- `build`: shared and API TypeScript build
- `test`: backend Vitest/Supertest integration suite

The root build does not currently create a native mobile bundle. Mobile pure
logic uses Vitest and rendered mobile behavior uses Jest/RNTL; physical-device
smoke testing remains required for native provider, motion, keyboard, and
accessibility behavior.

Account deletion validation must use a disposable verified account. It requires
recent provider reauthentication, permanently removes the Firebase account and
application-owned data, and must run only after the local account-deletion
migration is applied. Never use a primary account or print deletion credentials.
