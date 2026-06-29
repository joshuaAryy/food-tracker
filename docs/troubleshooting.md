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

The app's connection error displays the API URL it attempted and reminds native
device users that `localhost` refers to the device. If it shows an old URL,
stop Expo and restart it after setting `EXPO_PUBLIC_API_URL`.

Do not commit a machine-specific IP address. Use a shell variable or an ignored
local environment file where supported.

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
