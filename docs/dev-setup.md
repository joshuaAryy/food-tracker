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

Do not rely on Expo Go for the next native testing phase. Use an Expo
development build/local Xcode workflow. Expo itself remains the intended stack;
do not migrate to bare React Native merely to make the app feel more
production-ready.

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

If `xcrun simctl list devices` shows no simulator devices, check runtimes:

```bash
xcrun simctl list runtimes
```

When no iOS simulator runtimes or devices are installed, prioritize physical
iPhone testing and install a simulator runtime later from Xcode Settings >
Platforms.

## 9. Run Backend Tests

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

## 10. Full Validation

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

The root build does not currently create a native mobile bundle, and the
repository does not yet have automated mobile tests. Mobile changes therefore
also require reported simulator or physical-device smoke testing.
