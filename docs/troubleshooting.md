# Troubleshooting

Use the documented verification step before applying a fix. Do not bypass
safety checks to make a command pass.

## Unsupported Node Engine

**Symptom**

```text
Unsupported engine: wanted {"node":"22.x"}
```

**Likely cause**

The shell is using Node 24 or another unsupported runtime.

**Verify**

```bash
node -v
which node
```

**Fix**

```bash
nvm use 22
node -v
```

Rerun the complete validation sequence from the beginning. Results from the
unsupported runtime are invalid.

## Prisma P1001: Cannot Reach Database

**Likely cause**

PostgreSQL is stopped, the host or port is wrong, or Docker is unavailable.

**Verify**

```bash
docker ps -a --filter name=food-tracker-postgres
docker logs food-tracker-postgres
```

Check the selected `DATABASE_URL`, `TEST_DATABASE_URL`, or
`DATABASE_URL_TEST`.

**Fix**

```bash
docker start food-tracker-postgres
```

If the container does not exist, follow `docs/dev-setup.md`.

## PostgreSQL Container Is Stopped

**Symptom**

`docker ps` does not show `food-tracker-postgres`, but `docker ps -a` does.

**Fix**

```bash
docker start food-tracker-postgres
docker ps --filter name=food-tracker-postgres
```

## Port 5432 Is Already In Use

**Symptom**

Docker cannot bind `0.0.0.0:5432`.

**Verify**

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

**Fix**

Use the already-running intended PostgreSQL instance, stop the conflicting
service, or deliberately choose another host port and update both database
URLs. Do not start multiple unclear database instances.

## Development Or Test Database Is Missing

**Symptom**

PostgreSQL is reachable, but Prisma reports that `food_tracker` or
`food_tracker_test` does not exist.

**Verify**

```bash
docker exec food-tracker-postgres \
  psql -U postgres -d postgres -c '\l'
```

**Fix**

```bash
docker exec food-tracker-postgres \
  createdb -U postgres food_tracker

docker exec food-tracker-postgres \
  createdb -U postgres food_tracker_test
```

Creating an already-existing database will fail harmlessly; inspect first when
the state is unclear.

## Test Database Safety Refusal

**Symptom**

```text
Test database names must end in "_test"
```

**Cause**

The test URL points to a database without the required suffix.

**Fix**

Set the test URL to a dedicated database such as:

```text
postgresql://postgres:postgres@localhost:5432/food_tracker_test
```

Do not weaken or remove the suffix check.

## Tests Point At The Development Database

**Risk**

The test suite clears records between tests.

**Verify**

```bash
printf '%s\n' "$TEST_DATABASE_URL"
printf '%s\n' "$DATABASE_URL_TEST"
```

The effective database name must end in `_test` and must not be `food_tracker`.

**Fix**

Unset the incorrect override or replace it with the dedicated test URL. Never
modify test cleanup code to permit the development database.

## Pending Migrations

**Symptom**

The application or tests fail because the database schema is behind committed
migrations.

**Verify and fix**

```bash
corepack pnpm --filter @food-tracker/api exec prisma migrate status
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
```

Run against the intended database URL. Tests deploy committed migrations
automatically.

## Stale Prisma Client

**Symptom**

Generated Prisma types or runtime behavior do not match the committed schema.

**Fix**

```bash
corepack pnpm prisma:generate
corepack pnpm typecheck
```

Do not edit generated Prisma files manually.

## Physical Device Cannot Reach The API

**Likely causes**

- `EXPO_PUBLIC_API_URL` uses `localhost`
- phone and computer cannot reach each other
- API is not running
- firewall blocks port `3000`
- wrong Mac network interface was used

**Verify**

Find the Mac LAN IP:

```bash
ipconfig getifaddr en0
ipconfig getifaddr en1
```

Open this URL from the phone browser:

```text
http://<computer-LAN-IP>:3000/api/v1/setup/status
```

A JSON success response proves network reachability.

**Fix**

Start Expo with:

```bash
EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:3000/api/v1 \
  corepack pnpm dev:mobile
```

The app's connection error is intentionally generic and never displays the API
URL, host, endpoint, or local address it attempted. If the app still appears to
use stale configuration, stop Expo and restart it after changing the ignored
local environment configuration.

Do not commit a machine-specific IP address. Use a shell variable or an ignored
local environment file where supported.

## Setup Status Recovery After Successful Sign In

**Meaning**

A setup-status recovery screen means Firebase has already supplied a valid
mobile session, but the API could not load account setup data. It is not a cue
to create another account or repeat provider sign-in automatically.

**Verify in order**

- the mobile API configuration is present and uses a physical-device-reachable
  host category;
- the API process is running and its unauthenticated health route responds;
- Firebase Admin server configuration is complete;
- PostgreSQL is reachable and migrations are current;
- the recovery screen remains single and stable, then use Retry exactly once.

**Recovery behavior**

Retry makes one new setup-status request only when tapped. Sign Out is the only
action that clears the Firebase/API session. Do not add a timeout, automatic
retry loop, duplicate route replacement, or a second loading screen to conceal
an unavailable API.

## Expo Go Or Web Preview Does Not Match iPhone UI

**Likely cause**

The next mobile UI phase needs native validation. Web preview cannot reliably
judge safe areas, touch behavior, keyboard behavior, transitions, or fixed
bottom CTA placement. Expo Go is also not the target for development-build
validation.

**Verify**

```bash
xcodebuild -version
xcode-select -p
xcrun simctl list devices
```

Confirm full Xcode is selected, then inspect whether an `ios/` folder and Expo
config are already present before generating native files.

**Fix**

Use the native testing plan in
`docs/mobile-ui-and-device-testing-context.md` and `docs/dev-setup.md`.
`expo-dev-client` is installed, but running the native iOS build command will
generate local native files when `apps/mobile/ios/` is absent.

The confirmed Phase 6.3 path is local Xcode plus Expo development build. Expo
Go is not required. If `apps/mobile/ios/` exists after a successful native
build, keep it ignored and uncommitted unless the project explicitly decides to
adopt checked-in native folders.

## Physical iPhone Shows API Connection Errors After Native Install

**Likely cause**

The app was built or bundled with a `localhost` API URL, or the iPhone cannot
reach the Mac on the local network.

**Verify**

Check the ignored local mobile environment file:

```bash
cat apps/mobile/.env.local
```

It should use the Mac LAN IP:

```dotenv
EXPO_PUBLIC_API_URL=http://<computer-LAN-IP>:3000/api/v1
```

Then open this URL from the iPhone browser:

```text
http://<computer-LAN-IP>:3000/api/v1/setup/status
```

**Fix**

Restart Expo or rebuild the development client after correcting
`EXPO_PUBLIC_API_URL`. Do not commit the LAN IP.

## Xcode Shows No Simulator Devices

**Likely cause**

Full Xcode is selected, but no iOS simulator runtime or simulator device is
installed.

**Verify**

```bash
xcrun simctl list runtimes
xcrun simctl list devices
xcodebuild -showsdks
```

If runtimes and devices are empty but `xcodebuild -showsdks` lists iOS SDKs,
the local Xcode install can build for devices but still lacks simulator
runtimes/devices.

**Fix**

Use physical iPhone testing first. To repair simulator testing later, open
Xcode Settings > Platforms, install an iOS Simulator runtime, then rerun the
verification commands.

## Android Emulator Cannot Reach localhost

Android's standard emulator uses `10.0.2.2` to access the host machine:

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1 \
  corepack pnpm dev:mobile
```

Do not use this address for a physical Android phone.

## Expo Cache Appears Stale

**Symptom**

Environment variables or source changes are not reflected after restart.

**Fix**

Stop Expo, confirm the intended environment variable, then run:

```bash
corepack pnpm --filter @food-tracker/mobile exec expo start --clear
```

Do not delete unrelated project files as a first response.

## Railway staging works only when the local API is running

First prove the client target category from the active Metro bundle. Set
`EXPO_PUBLIC_API_URL` directly in the Expo process, set the staging selector,
and leave `EXPO_NO_CLIENT_ENV_VARS` unset; do not rely on `APP_ENV=staging`
alone and do not let `apps/mobile/.env.local` silently win. Clear the Expo
cache and explicitly reconnect the development client to the current Metro
server. Then verify one authenticated setup-status request and one create/read
database operation in Railway. Firebase sign-in by itself does not prove the
hosted API path.

If hosted food search is empty while manual logging works, inspect the
provider/cache boundary and Railway variables. A missing USDA or AI provider
variable can be converted into an empty result; enabled optional providers
must instead report a safe unavailable category. Never copy local `.env` files
or server secrets into `EXPO_PUBLIC_*` variables.

## Committed, Pushed, And Merged Are Confused

**Verify local commits**

```bash
git status --short --branch
git log --oneline main..HEAD
```

**Verify remote tracking**

```bash
git branch -vv
```

**Verify merge after updating main**

```bash
git switch main
git pull --ff-only
git branch --merged main
```

A push only uploads a branch. It does not merge it.

## Safely Clean Up A Merged Branch

1. Update `main`.
2. Confirm the branch appears in `git branch --merged main`.
3. Confirm no unique commits remain:

```bash
git log --oneline main..<branch-name>
```

4. Delete only after verification:

```bash
git branch -d <branch-name>
git push origin --delete <branch-name>
```

Do not use `git branch -D` or force deletion to bypass an unmerged-work warning.

## Phase 17 staging Release preparation fails

Run the guarded command from the repository root only after checking Node and
pnpm:

```bash
node -v
corepack pnpm -v
corepack pnpm ios:staging-release
```

The first reported boundary is authoritative. A wrong branch, staged file,
unsupported toolchain, missing CocoaPods/Xcode SDK, insufficient disk space,
undiscoverable device, missing ignored staging environment file, unsafe API
target, missing Firebase plist, mismatched Google scheme, exposed server
variable, or unsafe generated directory must be corrected at that boundary.
The workflow never prints the failing URL, plist contents, credentials, Apple
identifiers, device identifiers, or hosted values.

- For an unsafe API target, use only the Railway staging HTTPS host and exact
  `/api/v1` path. Do not use localhost, loopback, a LAN/private/link-local
  address, a `.local` host, credentials, a query, or a fragment.
- For Firebase/Google errors, verify the external plist is a regular local XML
  file for the existing iOS bundle and that its reversed-client value matches
  the supplied scheme. Do not copy it into a tracked path.
- For prebuild or Pod errors, preserve the first error, leave the unrelated
  dirty worktree untouched, and inspect the generated ignored directory. Do not
  upgrade Expo/React Native or repair Docker without an approved causal
  failure.
- If an iOS 27 device build returns to the Home Screen before React Native
  starts, inspect the first crash frame for UIKit's no-scene-lifecycle
  termination. The guarded generated-state check requires the application
  scene manifest, AppDelegate scene configuration, SceneDelegate target
  membership, and one scene-owned React Native startup. Regenerate from the
  tracked CNG configuration; do not edit `apps/mobile/ios` by hand.
- For signing or provisioning errors, stop at Xcode. Confirm the Apple Account,
  free Personal Team, automatic signing, existing bundle identifier, trusted
  iPhone, Developer Mode, and Release scheme in the Xcode UI.
- If a Release launch asks for Metro, the wrong scheme/configuration was run or
  the bundle phase failed. Re-run the guarded preparation after correcting the
  generated state; do not treat a development-client launch as standalone
  evidence.
- If runtime requests reach the wrong API, stop the app, correct the ignored
  staging environment file, regenerate, and rebuild Release. The Xcode build
  receives staging values through the generated ignored `.xcode.env.local`; do
  not point the Release app at the local API or Railway production. Before a
  physical reinstall, run:

  ```bash
  corepack pnpm ios:staging-release -- --verify-release-artifact
  ```

  The verifier must confirm a non-empty bundle, canonical metadata, and the
  validated staging API target. A failed verifier is not standalone evidence.

Only after standalone evidence is recorded may the cleanup command remove the
exact generated directory:

```bash
corepack pnpm ios:staging-release -- --cleanup-after-validation
```

Cleanup refuses tracked, non-ignored, symlinked, or unexpected native state and
does not touch Android, DerivedData, Pods outside the generated directory,
archives, credentials, or unrelated files.
