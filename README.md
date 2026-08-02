# Food Tracker

Food Tracker is a mobile-first nutrition tracking application designed around
fast logging, trusted food data, deterministic backend analytics, and optional
AI convenience.

The product combines a focused Simple mode with a more detailed Complex mode.
Both modes use the same mobile app, API, database, and business logic.

## Current Capabilities

The implemented baseline includes:

- React Native and Expo Router mobile application
- Express, Prisma, and PostgreSQL API
- Persisted profile, goals, and tracking preferences
- Persisted food and weight log CRUD in the backend
- Mobile food and weight creation flows
- Food database powered logging with saved, recent, and reusable foods
- Barcode scanning with backend-owned Open Food Facts packaged food lookup
- AI-assisted text meal parsing with user review before saving
- Authoritative serving amount/unit resolution with trusted options, provisional
  mobile previews, and immutable FoodLog serving snapshots
- Conservative USDA portion normalization with physical-unit fallback when no
  alternate serving exists, plus candidate-aware AI count serving review
- USDA FoodData Central generic food lookup for AI review and normal search
- User-triggered low-trust AI nutrition estimates for unresolved text-logging
  rows
- Photo food logging with in-memory capture/library analysis, independent
  review rows, canonical trusted matching, quantity-aware servings, and mixed
  trusted/estimated confirmation
- Backend-authoritative photo-derived quantity normalization with flexible
  compatible serving selection and History persistence
- Daily calorie and protein dashboard
- Timezone-aware food and weight history
- Deterministic recommendation generation and dismissal
- Advanced calorie, protein, macro, consistency, and weight analytics
- Deterministic streaks, logging consistency, adherence, weight reporting, and
  Sunday–Saturday weekly/monthly reports on the Phase 15 branch
- Mobile Insights presentation
- Dedicated sequential first-run onboarding with deterministic target personalization
- Mode-aware food forms and Insights presentation
- Analytics completeness and confidence messaging
- Shared TypeScript and Zod contracts
- PostgreSQL-backed backend integration tests
- Firebase Authentication with email/password and Google sign-in; Apple sign-in
  implementation is preserved but disabled for free-development builds
- Firebase UID to application-owned UUID mapping with protected routing and
  server-derived ownership
- Sanitized public errors, redacted diagnostics, explicit CORS, security
  headers, and a minimal `/health` liveness route

Nutrition calculations, trends, and recommendation decisions are deterministic
backend code. AI does not perform analytics, decide recommendations, or act as
the nutrition source of truth.

## Development Status

The implemented baseline includes the full manual logging lifecycle, food
database reuse, barcode lookup, AI-assisted text parsing with USDA generic
nutrition fallback, USDA-backed normal food search, AI-estimated nutrition for
unresolved text-logging rows, completed Phase 14 photo food logging, mode-aware
analytics, and real onboarding with deterministic calorie and protein target
calculation. Phase 15 and the Phase 15.5 reporting redesign are represented in
the current Phase 16 branch. Phase 16 adds Firebase Authentication, protected
routing, public/internal error separation, server diagnostic redaction, and a
validated Railway staging deployment. Hosted setup-status, persistence,
ownership, provider, session, and disposable-account deletion checks passed.

## Current Limitations

- Apple sign-in is disabled for free development through the typed
  `EXPO_PUBLIC_APPLE_SIGN_IN_ENABLED` flag; email/password and Google remain
  the active development providers.
- Water and Note actions are visible but not implemented.
- App Store/TestFlight distribution is not a current goal.
- Local PostgreSQL is required for API persistence and backend tests.
- Physical devices require an explicit LAN API URL.
- Railway staging is validated in its dedicated `staging` environment;
  production resources remain intentionally out of scope.
- Water, supplements, and durable legal-consent work remain outside this phase.
- Immediate account deletion is permanent and was validated with a disposable
  Google account. Reusing that identity creates a fresh empty application
  account; deleted data does not return.
- Photo candidate adjudication and the optional API-unavailable check remain
  `Not tested`; unperformed physical checks are not inferred as passing.

### Phase 16 closeout

Phase 16 is complete. The Railway staging API and private PostgreSQL service
were validated from the physical iPhone with Firebase verification and
revocation checks, setup-status routing, onboarding, persistence, ownership
isolation, USDA/Open Food Facts retrieval, Gemini parsing, photo analysis,
nutrition fallback, session restoration, sign-out, and permanent deletion.
Phase 17 is the next phase for standalone internal/TestFlight distribution.
Metro remains required for development-client testing, while hosted staging
does not require the local API or Docker.

## Technology

- Mobile: React Native, Expo, Expo Router, NativeWind, Zustand, React Hook Form
- API: Node.js, Express, TypeScript, Zod, Prisma
- Database: PostgreSQL
- Tests: Vitest, Supertest, dedicated Prisma test database
- Monorepo: pnpm workspaces
- Required runtime: Node.js 22.x
- Package manager: pnpm 10.34.3
- Authentication: Firebase Authentication on mobile; Firebase Admin on the
  API; the application retains its own UUID user identity

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

For hosted staging or production, configure the server-only Firebase Admin
variables, database, explicit browser CORS origins, and rate-limit key secret
through the deployment environment. Never place these values in mobile
`EXPO_PUBLIC_*` configuration.

### 5. Run the API

```bash
corepack pnpm dev:api
```

The default API base URL is `http://localhost:3000/api/v1`.

### 6. Run the mobile app

Web preview:

```bash
corepack pnpm dev:mobile
```

Native iOS development build commands live in the mobile workspace:

```bash
corepack pnpm --filter @food-tracker/mobile ios:dev-build
corepack pnpm --filter @food-tracker/mobile ios:dev-build:device
```

The native commands generate local Expo native project files when no `ios/`
folder exists. Those generated files are ignored in this phase and should not
be committed without an explicit workflow decision. The Phase 6.3 native iPhone
path uses an Expo development build through local Xcode tooling; Expo Go is not
required.

The mobile client reads `EXPO_PUBLIC_API_URL`. Examples:

```text
iOS simulator:    http://localhost:3000/api/v1
Android emulator: http://10.0.2.2:3000/api/v1
Physical phone:   http://<computer-LAN-IP>:3000/api/v1
```

For a physical phone, the computer and phone must be mutually reachable on the
same network. Local firewall settings may also need to permit port `3000`.
Include `/api/v1` in the configured URL and restart Expo after changing it.
Use the Mac LAN IP, not `localhost`, for physical iPhone testing.

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
- [Mobile visual lessons](docs/mobile-visual-lessons.md)
- [Mobile UI and device testing context](docs/mobile-ui-and-device-testing-context.md)

Mandatory workflow belongs in `AGENTS.md`; README remains the high-level entry
point.
