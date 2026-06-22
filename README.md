# Food Tracker

Food Tracker is a mobile-first nutrition tracking application designed around
fast manual logging, deterministic backend analytics, and optional future AI
convenience.

The product combines a focused Simple mode with a more detailed Complex mode.
Both modes use the same mobile app, API, database, and business logic.

## Current Capabilities

The implemented baseline includes:

- React Native and Expo Router mobile application
- Express, Prisma, and PostgreSQL API
- Persisted profile, goals, and tracking preferences
- Persisted food and weight log CRUD in the backend
- Mobile food and weight creation flows
- Daily calorie and protein dashboard
- Timezone-aware food and weight history
- Deterministic recommendation generation and dismissal
- Advanced calorie, protein, macro, consistency, and weight analytics
- Mobile Insights presentation
- Shared TypeScript and Zod contracts
- PostgreSQL-backed backend integration tests

Nutrition calculations, trends, and recommendation decisions are deterministic
backend code. AI does not perform analytics or decide recommendations.

## Development Status

The implemented baseline is complete through advanced analytics and mobile
Insights integration. The current maintenance phase hardens documentation,
environment setup, branch workflow, and merge validation before the next
feature phase.

## Current Limitations

- Development still uses a fixed mock-user authentication boundary.
- Food entry is manual and structured; there is no food database lookup.
- Mobile edit and delete flows for food and weight logs are not implemented.
- Complex mode does not yet provide a complete differentiated experience.
- Water and Note actions are visible but not implemented.
- Mobile automated tests are not yet configured.
- Local PostgreSQL is required for API persistence and backend tests.
- Physical devices require an explicit LAN API URL.
- AI parsing, barcode scanning, photo recognition, and supplements are future
  work.

## Technology

- Mobile: React Native, Expo, Expo Router, NativeWind, Zustand, React Hook Form
- API: Node.js, Express, TypeScript, Zod, Prisma
- Database: PostgreSQL
- Tests: Vitest, Supertest, dedicated Prisma test database
- Monorepo: pnpm workspaces
- Required runtime: Node.js 22.x
- Package manager: pnpm 10.34.3

## Quick Start

### 1. Select Node 22

```bash
nvm install 22
nvm use 22
node -v
```

`node -v` must report `v22.x`. Validation under Node 24 or another unsupported
runtime is invalid.

### 2. Install dependencies

```bash
corepack pnpm -v
corepack pnpm install
```

The expected pnpm version is `10.34.3`. If Corepack is unavailable, use
`npx pnpm@10.34.3`.

### 3. Start PostgreSQL

Follow [docs/dev-setup.md](docs/dev-setup.md) to start the local PostgreSQL
container and create both:

```text
food_tracker
food_tracker_test
```

### 4. Configure and migrate the API

```bash
cp apps/api/.env.example apps/api/.env
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm --filter @food-tracker/api exec prisma migrate deploy
```

### 5. Run the API

```bash
corepack pnpm dev:api
```

The default API base URL is `http://localhost:3000/api/v1`.

### 6. Run the mobile app

```bash
corepack pnpm dev:mobile
```

The mobile client reads `EXPO_PUBLIC_API_URL`. Examples:

```text
iOS simulator:    http://localhost:3000/api/v1
Android emulator: http://10.0.2.2:3000/api/v1
Physical phone:   http://<computer-LAN-IP>:3000/api/v1
```

For a physical phone, the computer and phone must be mutually reachable on the
same network. Local firewall settings may also need to permit port `3000`.

## Common Commands

Run from the repository root:

```bash
corepack pnpm dev:api
corepack pnpm dev:mobile
corepack pnpm prisma:generate
corepack pnpm prisma:validate
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
corepack pnpm test
corepack pnpm test:coverage
```

`build` currently compiles the shared package and API. It does not produce a
complete native mobile bundle.

## Required Validation

Before merge, run the complete sequence under Node 22.x:

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

Backend tests require a running PostgreSQL instance and use a dedicated database
whose name must end in `_test`.

## Documentation

- [Engineering operating manual](AGENTS.md)
- [Detailed development setup](docs/dev-setup.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Roadmap](docs/roadmap.md)
- [Architecture](docs/architecture.md)
- [API contracts](docs/api-contracts.md)
- [Data-model decisions](docs/data-model-decisions.md)
- [Prisma schema decisions](docs/prisma-schema-decisions.md)
- [Mobile design system](docs/design-system.md)

Mandatory workflow belongs in `AGENTS.md`; README remains the high-level entry
point.
