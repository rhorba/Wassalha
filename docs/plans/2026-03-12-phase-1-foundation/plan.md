# Phase 1 — Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Scaffold the Wassalha monorepo with Next.js 15, wire up Clerk authentication with PostgreSQL user sync, define the initial Drizzle schema, and establish a GitHub Actions CI pipeline.

**Architecture:** Next.js 15 App Router serves both frontend and API routes. Clerk handles identity and session management at the edge (middleware reads `publicMetadata.role` — no DB hit). A PostgreSQL `users` table (Drizzle ORM) is kept in sync via Clerk webhooks verified with `svix`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W1 — Phase 1 Foundation (March 17–21, 2026)

---

## Tasks Overview

| # | Task | Files |
|---|------|-------|
| 1 | Scaffold Next.js project + install deps | `package.json`, `tsconfig.json`, configs |
| 2 | Configure shadcn/ui + Tailwind 4 | `components.json`, `src/app/globals.css` |
| 3 | Configure Prettier + ESLint | `.prettierrc`, `.eslintrc.json` |
| 4 | Configure Vitest | `vitest.config.ts` |
| 5 | Set up environment variables | `.env.example`, `.env.local` |
| 6 | Set up Drizzle ORM + DB client | `drizzle.config.ts`, `src/lib/db/index.ts` |
| 7 | Define `users` schema + migration | `src/lib/db/schema/users.ts`, migration |
| 8 | Configure Clerk + root layout | `src/middleware.ts`, `src/app/layout.tsx` |
| 9 | Create auth route shells | `(auth)/sign-in`, `(auth)/sign-up` |
| 10 | Create dashboard shell | `(dashboard)/page.tsx`, `(dashboard)/layout.tsx` |
| 11 | Create landing page placeholder | `src/app/page.tsx` |
| 12 | Implement Clerk webhook handler | `src/app/api/webhooks/clerk/route.ts` |
| 13 | Set up GitHub Actions CI | `.github/workflows/ci.yml` |
| 14 | Final verification | typecheck + lint + build + smoke test |

---

## Task 1: Scaffold Next.js Project + Install Dependencies

**Files:**
- Create: project root (run from parent directory)
- Modify: `package.json` (add scripts)

**Step 1: Create Next.js app**
```bash
pnpm create next-app@latest wassalha \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd wassalha
```

**Step 2: Install production dependencies**
```bash
pnpm add drizzle-orm pg @clerk/nextjs svix zod react-hook-form @hookform/resolvers @tanstack/react-query
```

**Step 3: Install dev dependencies**
```bash
pnpm add -D drizzle-kit @types/pg vitest @vitejs/plugin-react prettier @types/node
```

**Step 4: Add scripts to `package.json`**

Merge these into the `"scripts"` block:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Step 5: Verify install**
```bash
pnpm dev
```
Expected: Next.js dev server starts on `http://localhost:3000` with no errors.

---

## Task 2: Configure shadcn/ui + Tailwind 4

**Files:**
- Create: `components.json`
- Modify: `src/app/globals.css`

**Step 1: Initialize shadcn/ui**
```bash
pnpm dlx shadcn@latest init
```

When prompted, select:
- Style: **New York**
- Base color: **Zinc**
- CSS variables: **Yes**

This creates `components.json` and updates `src/app/globals.css` with CSS variable tokens.

**Step 2: Add initial shadcn components needed for auth pages**
```bash
pnpm dlx shadcn@latest add button card input label
```

**Step 3: Verify `components.json`**

Should look like:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

---

## Task 3: Configure Prettier + ESLint

**Files:**
- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `eslint.config.mjs` (or `.eslintrc.json`)

**Step 1: Create `.prettierrc`**
```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": []
}
```

**Step 2: Create `.prettierignore`**
```
.next/
node_modules/
src/lib/db/migrations/
pnpm-lock.yaml
```

**Step 3: Verify ESLint config includes TypeScript rules**

The default Next.js `eslint.config.mjs` should already include `@next/eslint-plugin-next`. Confirm `no-explicit-any` is enforced by adding to the config:
```js
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
```

**Step 4: Verify**
```bash
pnpm lint
```
Expected: No errors on the scaffolded files.

---

## Task 4: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/__tests__/example.test.ts` (smoke test)

**Step 1: Create `vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

**Step 2: Create smoke test `src/lib/__tests__/example.test.ts`**
```ts
describe("smoke test", () => {
  it("passes", () => {
    expect(true).toBe(true);
  });
});
```

**Step 3: Verify**
```bash
pnpm test:run
```
Expected: 1 test passes.

---

## Task 5: Set Up Environment Variables

**Files:**
- Create: `.env.example`
- Create: `.env.local` (gitignored — fill in real values)

**Step 1: Create `.env.example`**
```bash
# ─── Database ─────────────────────────────────────────────────────────────────
# PostgreSQL connection string (Neon: https://neon.tech, or Supabase)
DATABASE_URL=postgresql://user:password@host:5432/wassalha

# ─── Clerk Auth ───────────────────────────────────────────────────────────────
# Get from: https://dashboard.clerk.com → your app → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk redirect URLs (keep as-is for local dev)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

# Clerk webhook secret — get from Clerk dashboard → Webhooks → your endpoint
CLERK_WEBHOOK_SECRET=whsec_...

# ─── Google Maps ──────────────────────────────────────────────────────────────
# Needed in Phase 2 — add now to avoid missing key errors later
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# ─── Supabase Realtime (Phase 5) ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ─── Mapbox (Phase 5) ─────────────────────────────────────────────────────────
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...

# ─── Stripe (Phase 4) ─────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ─── Resend Email (Phase 4) ───────────────────────────────────────────────────
RESEND_API_KEY=re_...

# ─── WhatsApp Business API (Phase 7) ──────────────────────────────────────────
WHATSAPP_API_TOKEN=...
WHATSAPP_PHONE_ID=...

# ─── Monitoring ───────────────────────────────────────────────────────────────
NEXT_PUBLIC_POSTHOG_KEY=phc_...
SENTRY_DSN=https://...@sentry.io/...
```

**Step 2: Copy to `.env.local` and fill in real values**
```bash
cp .env.example .env.local
```

Fill in at minimum:
- `DATABASE_URL` — your Neon or Supabase connection string
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — from Clerk dashboard
- `CLERK_WEBHOOK_SECRET` — create a webhook in Clerk dashboard pointing to `https://your-domain/api/webhooks/clerk` (use ngrok for local dev)

**Step 3: Verify `.gitignore` includes `.env.local`**

The default Next.js `.gitignore` already includes this. Confirm:
```bash
grep ".env.local" .gitignore
```
Expected: `.env.local` appears in the output.

---

## Task 6: Set Up Drizzle ORM + DB Client

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/schema/index.ts`

**Step 1: Create `drizzle.config.ts`** (project root)
```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

**Step 2: Create `src/lib/db/index.ts`**
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
```

**Step 3: Create `src/lib/db/schema/index.ts`** (barrel export — add tables here as schema grows)
```ts
export * from "./users";
```

---

## Task 7: Define `users` Schema + Generate Migration

**Files:**
- Create: `src/lib/db/schema/users.ts`
- Create: `src/lib/db/migrations/` (auto-generated by drizzle-kit)

**Step 1: Create `src/lib/db/schema/users.ts`**
```ts
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["retailer", "admin"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user ID e.g. user_2abc123
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("retailer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

**Step 2: Generate migration**
```bash
pnpm db:generate
```
Expected: Creates `src/lib/db/migrations/0000_initial_users.sql` with `CREATE TYPE "role"` and `CREATE TABLE "users"`.

**Step 3: Apply migration**
```bash
pnpm db:migrate
```
Expected: Migration applied to your PostgreSQL database. Verify in Drizzle Studio:
```bash
pnpm db:studio
```

---

## Task 8: Configure Clerk + Root Layout

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/middleware.ts`

**Step 1: Wrap root layout with `ClerkProvider`**

`src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wassalha — COD Delivery Aggregator",
  description: "Compare, book, and track COD deliveries across Morocco.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="fr">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

**Step 2: Create `src/middleware.ts`**
```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isDashboard = createRouteMatcher(["/dashboard(.*)"]);
const isAdmin = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Protect all dashboard routes — redirects to sign-in if unauthenticated
  if (isDashboard(req)) {
    await auth.protect();
  }

  // Protect admin routes — redirect non-admins to /dashboard
  if (isAdmin(req)) {
    const { sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

> **Note:** `sessionClaims.metadata.role` is populated from Clerk `publicMetadata`. After a user signs up, set their role via the Clerk webhook handler (Task 12) or manually in the Clerk dashboard during development.

---

## Task 9: Create Auth Route Shells

**Files:**
- Create: `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
- Create: `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Create `src/app/(auth)/layout.tsx`**
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      {children}
    </div>
  );
}
```

**Step 2: Create `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`**
```tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <SignIn />;
}
```

**Step 3: Create `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`**
```tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return <SignUp />;
}
```

> **Why `[[...sign-in]]`?** Clerk's hosted UI uses catch-all routes to handle multi-step flows (verify email, OAuth callbacks, etc.) within the same page.

**Step 4: Verify**
Navigate to `http://localhost:3000/sign-in` — Clerk sign-in UI should render.

---

## Task 10: Create Dashboard Shell

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/page.tsx`

**Step 1: Create `src/app/(dashboard)/layout.tsx`**
```tsx
import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-900">Wassalha</span>
        <UserButton />
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
```

**Step 2: Create `src/app/(dashboard)/page.tsx`**
```tsx
import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
      <p className="mt-2 text-zinc-500">Welcome. User ID: {userId}</p>
      <p className="mt-4 text-zinc-400 text-sm">
        Phase 2 will add carrier comparison here.
      </p>
    </div>
  );
}
```

**Step 3: Verify**
- Navigate to `http://localhost:3000/dashboard` while signed out → should redirect to `/sign-in`
- Sign in → should render the dashboard page with your Clerk user ID

---

## Task 11: Create Landing Page Placeholder

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace default Next.js page with a placeholder**

`src/app/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Wassalha</h1>
        <p className="mt-4 text-lg text-zinc-500">
          Comparez, réservez et suivez vos livraisons COD au Maroc.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button asChild>
            <Link href="/sign-up">Commencer</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sign-in">Se connecter</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
```

---

## Task 12: Implement Clerk Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/clerk/route.ts`

**Context:** Clerk fires webhook events when users are created, updated, or deleted. This handler syncs those events to the PostgreSQL `users` table. The `svix` library verifies the webhook signature to prevent spoofed requests.

**Step 1: Create `src/app/api/webhooks/clerk/route.ts`**
```ts
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type ClerkUserEventData = {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
};

type ClerkWebhookEvent = {
  type: "user.created" | "user.updated" | "user.deleted";
  data: ClerkUserEventData;
};

function getPrimaryEmail(data: ClerkUserEventData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? "";
}

function getFullName(data: ClerkUserEventData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return new Response("CLERK_WEBHOOK_SECRET not set", { status: 500 });
  }

  // Verify signature using svix
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created") {
    await db.insert(users).values({
      id: data.id,
      email: getPrimaryEmail(data),
      name: getFullName(data),
      role: "retailer", // Default role — admin must be set manually in Clerk dashboard
    });
  }

  if (type === "user.updated") {
    await db
      .update(users)
      .set({
        email: getPrimaryEmail(data),
        name: getFullName(data),
        updatedAt: new Date(),
      })
      .where(eq(users.id, data.id));
  }

  if (type === "user.deleted") {
    await db.delete(users).where(eq(users.id, data.id));
  }

  return new Response("OK", { status: 200 });
}
```

**Step 2: Register webhook in Clerk dashboard**
1. Go to [Clerk Dashboard](https://dashboard.clerk.com) → your app → **Webhooks**
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
   - For local dev: use [ngrok](https://ngrok.com): `ngrok http 3000`, then use the ngrok URL
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the **Signing Secret** → paste as `CLERK_WEBHOOK_SECRET` in `.env.local`

**Step 3: Verify**
Sign up a new user via `http://localhost:3000/sign-up`. Then check:
```bash
pnpm db:studio
```
A row should appear in the `users` table with the Clerk user ID and email.

---

## Task 13: Set Up GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create directory**
```bash
mkdir -p .github/workflows
```

**Step 2: Create `.github/workflows/ci.yml`**
```yaml
name: CI

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  ci:
    name: Lint, Typecheck, Test, Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test:run

      - name: Build
        run: pnpm build

    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY }}
      CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}
      CLERK_WEBHOOK_SECRET: ${{ secrets.CLERK_WEBHOOK_SECRET }}
```

**Step 3: Configure GitHub repository secrets**

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`

**Step 4: Set up branch protection on `main`**

Go to GitHub repo → **Settings** → **Branches** → **Add rule**:
- Branch name pattern: `main`
- ✅ Require status checks to pass before merging → select `Lint, Typecheck, Test, Build`
- ✅ Require a pull request before merging

**Step 5: Initialize git and push**
```bash
git init
git config core.autocrlf input
git checkout -b main
git add .
git commit -m "feat: initial project scaffold (phase 1)"
git remote add origin <your-github-repo-url>
git push -u origin main

# Create dev branch
git checkout -b dev
git push -u origin dev
```

---

## Task 14: Final Verification

**Run all checks:**
```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm build
```

**Manual smoke test checklist:**

- [ ] `pnpm dev` starts with no errors on `http://localhost:3000`
- [ ] Landing page renders with "Commencer" and "Se connecter" buttons
- [ ] `/sign-up` renders Clerk hosted sign-up UI
- [ ] `/sign-in` renders Clerk hosted sign-in UI
- [ ] Sign up a new user → redirected to `/dashboard`
- [ ] Check `pnpm db:studio` → new row in `users` table with correct email + role `retailer`
- [ ] Sign out → navigate to `/dashboard` → redirected to `/sign-in`
- [ ] `pnpm db:migrate` runs cleanly on a fresh DB
- [ ] GitHub Actions CI passes on a PR to `dev`

**Expected file tree after Phase 1:**
```
wassalha/
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   └── webhooks/
│   │   │       └── clerk/
│   │   │           └── route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── ui/
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       └── label.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   │   └── 0000_initial_users.sql
│   │   │   ├── schema/
│   │   │   │   ├── index.ts
│   │   │   │   └── users.ts
│   │   │   └── index.ts
│   │   ├── utils.ts          (shadcn cn utility)
│   │   └── __tests__/
│   │       └── example.test.ts
│   └── middleware.ts
├── .env.example
├── .env.local               (gitignored)
├── .prettierrc
├── .prettierignore
├── components.json
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
└── vitest.config.ts
```

---

## Phase 2 Handoff Notes

Once Phase 1 is green, Phase 2 (Week 2) will:
1. Add `carriers` + `addresses` tables to the Drizzle schema
2. Seed 5+ Moroccan carrier records
3. Wire up Google Maps address autocomplete
4. Build admin CRUD for carriers

The `users` table established here will be foreign-keyed by `shipments`, `bookings`, and `commissions` in later phases.
