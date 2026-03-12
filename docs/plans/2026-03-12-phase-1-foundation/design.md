# Phase 1 — Foundation Design

**Sprint:** Week 1 (March 17–21, 2026)
**Goal:** Scaffold the full-stack project, define the initial DB schema, wire up Clerk auth, and establish the CI/CD pipeline.

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth roles | Clerk metadata + PostgreSQL users table | Fast middleware checks (no DB hit) + full relational data for business logic |
| Phase 1 schema | `users` table only | YAGNI — unblocks auth sync without premature schema design |
| CI/CD | lint + tsc + vitest + build | Fast, meaningful feedback without deploy complexity in Week 1 |

---

## 1. Project Scaffold

**Init command:**
```bash
pnpm create next-app@latest wassalha \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --no-turbopack
```

**Additional dependencies:**
```bash
# UI
pnpm dlx shadcn@latest init   # New York style, CSS variables on

# Database
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# Auth
pnpm add @clerk/nextjs svix

# Validation + Forms
pnpm add zod react-hook-form @hookform/resolvers

# Testing + Tooling
pnpm add -D vitest @vitejs/plugin-react prettier
```

**Key config files:**

| File | Purpose |
|------|---------|
| `drizzle.config.ts` | Schema at `src/lib/db/schema/`, migrations output to `src/lib/db/migrations/` |
| `next.config.ts` | Clerk-ready, env validation |
| `.env.example` | Template with all required keys |
| `src/middleware.ts` | Clerk `clerkMiddleware()` — protects `/dashboard/*`, role-checks `/admin/*` |
| `vitest.config.ts` | Vitest with `@vitejs/plugin-react` |
| `.prettierrc` | Consistent formatting |

**Route groups (empty shells for now):**

```
src/app/
├── (auth)/
│   ├── sign-in/page.tsx       # Clerk hosted UI
│   └── sign-up/page.tsx       # Clerk hosted UI
├── (dashboard)/
│   └── page.tsx               # Protected shell (redirects to /compare later)
├── api/
│   └── webhooks/
│       └── clerk/route.ts     # User sync endpoint
├── layout.tsx                 # Root layout with ClerkProvider
└── page.tsx                   # Landing page (placeholder)
```

---

## 2. DB Schema

**File:** `src/lib/db/schema/users.ts`

```ts
import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["retailer", "admin"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),           // Clerk user ID (e.g. user_2abc...)
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("retailer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**DB client** at `src/lib/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

**Drizzle config** at `drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

### Clerk Webhook Sync

**File:** `src/app/api/webhooks/clerk/route.ts`

- `user.created` → insert row into `users`
- `user.updated` → update `email` + `name`
- `user.deleted` → delete row
- All payloads validated with `svix` (Clerk webhook signature verification)

### Middleware Role Check

**File:** `src/middleware.ts`

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isDashboard = createRouteMatcher(["/dashboard(.*)"]);
const isAdmin = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isDashboard(req)) await auth.protect();
  if (isAdmin(req)) {
    const { sessionClaims } = await auth();
    if (sessionClaims?.metadata?.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

> Roles are read from `sessionClaims.metadata.role` (set in Clerk `publicMetadata`) — no DB round-trip needed in middleware.

---

## 3. CI/CD Pipeline

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm tsc --noEmit
      - run: pnpm test --run
      - run: pnpm build
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
```

**Branch strategy:**

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready, protected (require CI green + 1 review) |
| `dev` | Integration branch — all PRs target here |
| `feat/phase-1-scaffold` | Week 1 work branch |

**GitHub Secrets to configure:**
- `DATABASE_URL` — Neon or Supabase connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

---

## Deliverables Checklist (Week 1)

- [ ] `pnpm dev` runs without errors
- [ ] Clerk sign-up/sign-in working (hosted UI)
- [ ] New user creation triggers webhook → row inserted in `users` table
- [ ] `/dashboard` redirects unauthenticated users to sign-in
- [ ] `/admin` redirects non-admin users to `/dashboard`
- [ ] `pnpm db:migrate` runs the initial migration cleanly
- [ ] GitHub Actions CI passes on `feat/phase-1-scaffold` PR
- [ ] `.env.example` documents all required keys
