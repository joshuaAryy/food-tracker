# Food Tracker

AI-assisted nutrition tracking application designed to make food logging fast, intuitive, and highly customizable.

## Vision

Most food tracking apps fail because they create too much friction.

This app aims to solve that by combining:
- fast logging
- optional deep tracking
- AI-assisted parsing
- personalized recommendations

---

## Core Features

### Food Logging
Phase 2 proves the core loop with manual structured food entry:

```text
Manual entry
→ validation
→ database
→ analytics
→ dashboard/history
```

Each food log is one food item with a meal type and timestamp. AI-assisted text input, nutrition matching, food database lookup, barcode scanning, and photo recognition are later features.

---

### Weight Tracking
Track:
- body weight
- trends
- goal progress

---

### Recommendations
Provide deterministic coaching based on facts computed by the backend:
- calorie adherence
- protein intake
- weight trends
- goal progress

AI is optional and may later improve recommendation wording. It does not calculate facts or decide recommendations.

---

## Tracking Modes

### Simple Mode
Tracks:
- Calories
- Protein
- Weight
- Water (optional)

Best for casual users.

---

### Complex Mode
Tracks everything in Simple Mode plus:
- Carbs
- Fat
- Fiber
- Sugar
- Sodium
- Vitamins
- Minerals
- Meal timing
- Supplements
- Custom nutrients

Best for advanced users.

---

## Tech Stack

### Frontend
- React Native
- Expo
- TypeScript
- Expo Router
- NativeWind
- Zustand
- React Hook Form

### Backend
- Node.js
- Express
- TypeScript
- Zod
- Prisma

### Database
- PostgreSQL
- Supabase Auth as the intended authentication provider
- Supabase-hosted PostgreSQL (planned)

### Monorepo
- pnpm
- pnpm workspaces
- Turborepo only if needed later
- No Nx

### AI
- Local LLM / Ollama (planned)
- Future AI food parser with user confirmation
- Optional recommendation wording layer

---


## Development Status
Phase 1 — Foundation scaffold

See [docs/technical-decisions.md](docs/technical-decisions.md) for locked technical decisions.

## Local Development Setup

### Node.js

The project expects Node.js `22.x`.

Using `nvm`:

```bash
nvm install 22
nvm use 22
node -v
```

If validation is run with another Node version, package commands may emit an unsupported-engine warning. Switch to Node 22 before treating that warning as a project issue.

### pnpm

Do not require or assume a global pnpm installation.

Preferred command form when Corepack is available:

```bash
corepack pnpm <command>
```

Fallback command form:

```bash
npx pnpm@10.34.3 <command>
```

The first `npx` invocation may require access to the npm registry to download the pinned pnpm version.

`corepack enable` is not required. On restricted systems it may fail while attempting to create a pnpm symlink in `/usr/local/bin`.

### API Environment

Create the local API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` in `apps/api/.env`. The example connection string is acceptable for Prisma schema validation. A real running PostgreSQL database is required before migrations or persistence can work.

### Install And Validate

From the repository root:

```bash
npx pnpm@10.34.3 install
npx pnpm@10.34.3 lint
npx pnpm@10.34.3 typecheck
npx pnpm@10.34.3 format:check
npx pnpm@10.34.3 build
```

Validate and run the API:

```bash
cd apps/api
npx pnpm@10.34.3 prisma validate
npx pnpm@10.34.3 dev
```

Run the mobile app:

```bash
cd apps/mobile
npx pnpm@10.34.3 start
```

### Phase 1 Mock Behavior

The Phase 1 API returns static mock responses only:

- POST, PUT, PATCH, and DELETE routes do not persist changes.
- A successful POST response will not appear in a later GET response.
- Dashboard summaries are static and are not calculated from submitted logs.
- The Prisma schema exists, but runtime routes do not use Prisma or PostgreSQL.

This behavior is expected during Phase 1 and must not be mistaken for working persistence. The mobile app also uses mock data and does not make network requests.
