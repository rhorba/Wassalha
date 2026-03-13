# Phase 1 — Test Plan

> **Status gate:** All sections must pass before starting Phase 2 design.
> When all checks are green, run `/brainstorming` for Phase 2.

---

## 1. Automated Tests (run locally + in CI)

### 1.1 Unit Tests — Vitest

Run: `pnpm test:run`

#### T1.1.1 — Smoke test passes
- **File:** `src/lib/__tests__/example.test.ts`
- **Assert:** `expect(true).toBe(true)` — 1 test, 0 failures
- **Pass criteria:** Exit code 0

#### T1.1.2 — Webhook helper: `getPrimaryEmail`
- **File:** `src/lib/__tests__/webhook.test.ts` *(create)*
- **Input:** `{ email_addresses: [{ email_address: "a@b.com", id: "e_1" }], primary_email_address_id: "e_1" }`
- **Assert:** returns `"a@b.com"`
- **Edge case:** `primary_email_address_id` doesn't match → falls back to `email_addresses[0]`
- **Edge case:** empty `email_addresses` → returns `""`

#### T1.1.3 — Webhook helper: `getFullName`
- **Input:** `{ first_name: "Youssef", last_name: "Amrani" }` → `"Youssef Amrani"`
- **Input:** `{ first_name: "Youssef", last_name: null }` → `"Youssef"`
- **Input:** `{ first_name: null, last_name: null }` → `null`

#### T1.1.4 — Drizzle schema types compile correctly
- **File:** `src/lib/__tests__/schema.test.ts` *(create)*
- **Assert:** `User` and `NewUser` types satisfy TypeScript — `tsc --noEmit` passes with these types in scope
- **Runtime check:** `roleEnum.enumValues` includes `"retailer"` and `"admin"`

```ts
// src/lib/__tests__/schema.test.ts
import { roleEnum } from "@/lib/db/schema/users";

describe("users schema", () => {
  it("roleEnum contains retailer and admin", () => {
    expect(roleEnum.enumValues).toContain("retailer");
    expect(roleEnum.enumValues).toContain("admin");
  });
});
```

---

### 1.2 Typecheck

Run: `pnpm typecheck`

| Check | Expected |
|-------|----------|
| No `any` types in `src/` | ✅ 0 errors (`@typescript-eslint/no-explicit-any: error`) |
| `middleware.ts` — `sessionClaims.metadata` cast is explicit | ✅ typed as `{ role?: string }` |
| Webhook route types — `ClerkWebhookEvent` and `ClerkUserEventData` | ✅ fully typed, no implicit any |
| Drizzle `db` export type matches `Database` alias | ✅ |

**Pass criteria:** `tsc --noEmit` exits 0.

---

### 1.3 Lint

Run: `pnpm lint`

| Rule | Expected |
|------|----------|
| `@typescript-eslint/no-explicit-any` | 0 violations |
| `@typescript-eslint/no-unused-vars` | 0 violations (unused prefixed with `_`) |
| `next/core-web-vitals` | 0 violations |
| Import paths use `@/*` alias (not relative `../../`) | ✅ enforced by convention |

**Pass criteria:** ESLint exits 0.

---

### 1.4 Build

Run: `pnpm build`

| Check | Expected |
|-------|----------|
| Next.js compiles all 5 routes | ✅ `/`, `/sign-in`, `/sign-up`, `/dashboard`, `/_not-found` |
| No type errors during build | ✅ |
| No missing env var crashes | ✅ (Clerk keys set in `.env.local`) |
| Static prerender of `/_not-found` succeeds | ✅ (requires valid Clerk key) |
| Output: `.next/` generated | ✅ |

**Pass criteria:** `next build` exits 0 and reports all pages generated.

---

## 2. Infrastructure Tests

### 2.1 Database Migration

Run: `pnpm db:migrate`

| Check | Expected |
|-------|----------|
| Migration file exists | `src/lib/db/migrations/0000_keen_aqueduct.sql` |
| Migration creates `role` enum | `CREATE TYPE "public"."role" AS ENUM('retailer', 'admin')` |
| Migration creates `users` table | `CREATE TABLE "users" (id text PK, email text UNIQUE NOT NULL, name text, role role NOT NULL DEFAULT 'retailer', created_at timestamp, updated_at timestamp)` |
| Re-running migrate is idempotent | exits 0 with "No pending migrations" |

Verify via Drizzle Studio:
```bash
pnpm db:studio
```
- [ ] `users` table visible with 6 columns
- [ ] `role` enum visible with 2 values

### 2.2 Environment Variables

| Variable | Present in `.env.local` | Source |
|----------|------------------------|--------|
| `DATABASE_URL` | ✅ | Docker postgres:16-alpine on port 5433 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk dashboard |
| `CLERK_SECRET_KEY` | ✅ | Clerk dashboard |
| `CLERK_WEBHOOK_SECRET` | ✅ | Clerk dashboard → Webhooks |

Verify `.env.local` is gitignored:
```bash
grep ".env.local" .gitignore  # must return a match
git status  # .env.local must NOT appear
```

### 2.3 Docker / Database Connectivity

```bash
docker ps  # wassalha_db container is running
psql postgresql://wassalha:wassalha_dev@localhost:5433/wassalha -c "\dt"
# Expected: lists "users" table
```

---

## 3. Manual Smoke Tests

Run `pnpm dev` and test in browser at `http://localhost:3000`.

### 3.1 Landing Page

| # | Action | Expected |
|---|--------|----------|
| M1 | Navigate to `/` | Page renders with "Wassalha" heading |
| M2 | Check French tagline | "Comparez, réservez et suivez vos livraisons COD au Maroc." is visible |
| M3 | "Commencer" button | Links to `/sign-up` |
| M4 | "Se connecter" button | Links to `/sign-in` |
| M5 | Page has no console errors | Browser dev tools → 0 errors |

### 3.2 Authentication — Sign-Up Flow

| # | Action | Expected |
|---|--------|----------|
| A1 | Navigate to `/sign-up` | Clerk hosted sign-up UI renders |
| A2 | Sign up with a new email | Multi-step Clerk flow (email verification) completes |
| A3 | Post sign-up redirect | Redirected to `/dashboard` |
| A4 | Dashboard shows userId | `User ID: user_2abc...` displayed |
| A5 | DB row created | `pnpm db:studio` → `users` table has 1 row with matching `id`, `email`, `role = retailer` |

### 3.3 Authentication — Sign-In + Sign-Out

| # | Action | Expected |
|---|--------|----------|
| B1 | Navigate to `/sign-in` | Clerk hosted sign-in UI renders |
| B2 | Sign in with existing account | Redirected to `/dashboard` |
| B3 | `UserButton` visible in header | Top-right corner of dashboard header |
| B4 | Click UserButton → Sign out | Session cleared |
| B5 | Navigate to `/dashboard` after sign-out | Redirected to `/sign-in` |

### 3.4 Route Protection (Middleware)

| # | Route | Auth State | Expected |
|---|-------|-----------|----------|
| P1 | `/dashboard` | Signed out | 302 → `/sign-in` |
| P2 | `/dashboard` | Signed in (retailer) | 200 — dashboard page |
| P3 | `/admin` | Signed in (retailer) | 302 → `/dashboard` |
| P4 | `/admin` | Signed in (admin) | 200 — (if admin page exists) |
| P5 | `/sign-in` | Signed in | Clerk handles — no crash |

> **To test P3/P4:** Set `publicMetadata.role = "admin"` on a user via Clerk dashboard → Users → [user] → Metadata.

### 3.5 Clerk Webhook Handler

| # | Action | Expected |
|---|--------|----------|
| W1 | Missing `svix-id` header | `POST /api/webhooks/clerk` → 400 "Missing svix headers" |
| W2 | Invalid signature | → 400 "Invalid webhook signature" |
| W3 | `user.created` event (via Clerk dashboard test) | Row inserted in `users` table |
| W4 | `user.updated` event | Row updated — `email`, `name`, `updated_at` |
| W5 | `user.deleted` event | Row deleted from `users` table |
| W6 | Missing `CLERK_WEBHOOK_SECRET` env | → 500 "CLERK_WEBHOOK_SECRET not set" |

> Use Clerk dashboard → Webhooks → your endpoint → "Send test event" to trigger W3–W5.
> Use curl with bad headers to test W1–W2.

```bash
# Test W1 — missing svix headers
curl -X POST http://localhost:3000/api/webhooks/clerk \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Missing svix headers
```

### 3.6 shadcn/ui Components

| # | Check | Expected |
|---|-------|----------|
| U1 | `Button` on landing page renders | Correct variant styles (default + outline) |
| U2 | `UserButton` in dashboard header | Clerk avatar renders |
| U3 | Tailwind 4 CSS variables loaded | `--background`, `--foreground`, `--primary` visible in computed styles |
| U4 | `components.json` matches New York / Zinc / CSS vars | Verify file content |

---

## 4. CI/CD Tests

### 4.1 GitHub Actions Pipeline

Trigger: push to `main` or `dev`, or open a PR.

| Step | Expected |
|------|----------|
| Lint | ✅ passes |
| Typecheck | ✅ passes |
| Unit tests | ✅ 1+ tests pass |
| Build | ✅ exits 0 |
| Total runtime | < 5 minutes |

Verify at: `https://github.com/rhorba/Wassalha/actions`

### 4.2 Branch Protection

| Check | Expected |
|-------|----------|
| PR to `main` requires CI pass | ✅ merge blocked until CI green |
| Direct push to `main` blocked | ✅ (if branch protection rule set) |
| All 4 GitHub Secrets present | `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` |

---

## 5. Pass Criteria Summary

All of the following must be ✅ before Phase 2:

| Category | Gate |
|----------|------|
| `pnpm typecheck` | 0 errors |
| `pnpm lint` | 0 errors |
| `pnpm test:run` | All tests pass |
| `pnpm build` | Exit 0, 5 pages generated |
| `pnpm db:migrate` | Idempotent, `users` table exists |
| Docker DB | Running, accessible on port 5433 |
| Manual: Landing page | Renders correctly |
| Manual: Sign-up → dashboard | Full flow works, DB row created |
| Manual: Route protection | Unauthenticated → redirect |
| Manual: Webhook | `user.created` syncs to DB |
| GitHub Actions CI | Latest run on `main` is green |

---

## 6. Next Step

Once all gates above are ✅:

```
/brainstorming
```

→ Design session for Phase 2: Address Autocomplete + Carrier Database + Admin CRUD.
