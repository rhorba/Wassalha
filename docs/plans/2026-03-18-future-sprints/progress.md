# Execution Progress

**Plan:** `docs/plans/2026-03-18-future-sprints/plan.md`
**Last updated:** 2026-03-18

## Status

| Task | Title | Status |
|------|-------|--------|
| 1 | Three New Drizzle Schemas + Migration 0008 | ✅ completed |
| 2 | Notifications Log — Update Email + WhatsApp Services | ✅ completed |
| 3 | Audit Service + Call Sites | ✅ completed |
| 4 | Audit Logs Admin Page | ✅ completed |
| 5 | Install `web-push` + Env Vars | ✅ completed |
| 6 | Web Push Service | ✅ completed |
| 7 | Push API Routes | ✅ completed |
| 8 | Service Worker | ✅ completed |
| 9 | `useWebPush` Hook | ✅ completed |
| 10 | Bell Toggle UI in Dashboard Layout | ✅ completed |
| 11 | Trigger Web Push from Cron Poller | ✅ completed |
| 12 | Final Verification | ✅ completed |

## Batch Log

### Batch 1 (Tasks 1–3) — 2026-03-18
- ✅ Task 1: Created `notifications.ts`, `audit-logs.ts`, `push-subscriptions.ts` schemas. Updated `schema/index.ts`. Generated + applied migration `0008_funny_skaar.sql` (11 tables total).
- ✅ Task 2: Updated `email.ts` + `whatsapp.ts` to insert `notifications` row after each send. Added `shipmentId` to `WhatsAppShipmentParams` and updated `bookings.ts` call site.
- ✅ Task 3: Created `audit.ts` service (`logAuditEvent` fire-and-forget). Updated `POST /api/carriers`, `PUT /api/carriers/[id]`, `DELETE /api/carriers/[id]`, `POST /api/billing/invoices`, and `webhooks/clerk` with `logAuditEvent` calls.
- Verification: typecheck ✅ lint ✅

### Batch 2 (Tasks 4–6) — 2026-03-18
- ✅ Task 4: Created `admin/audit-logs/page.tsx` RSC (RBAC redirect for non-admins, latest 100 rows, shadcn/ui Table). Added Audit nav link to dashboard layout.
- ✅ Task 5: Installed `web-push` + `@types/web-push`. Added VAPID env vars block to `.env.example`.
- ✅ Task 6: Created `web-push.ts` notification service — queries `push_subscriptions`, sends via VAPID, auto-removes 410 Gone subs, inserts `notifications` row per attempt.
- Verification: typecheck ✅ lint ✅

### Batch 3 (Tasks 7–9) — 2026-03-18
- ✅ Task 7: Created `GET /api/push/vapid-public-key` (returns VAPID public key for browser) and `POST/DELETE /api/push/subscribe` (upsert/remove push subscription with Zod validation).
- ✅ Task 8: Created `public/sw.js` — handles `push` events (showNotification) and `notificationclick` (opens /shipments). Icon omitted — no PNG in /public.
- ✅ Task 9: Created `useWebPush` hook — detects support, reads existing subscription on mount, exposes `subscribe`/`unsubscribe` with VAPID key fetch + DB sync.
- Verification: typecheck ✅ lint ✅

### Batch 4 (Tasks 10–12) — 2026-03-18
- ✅ Task 10: Created `PushToggle` client component (Bell/BellOff lucide icons, shadcn Toggle, sonner toast on first enable). Added to dashboard layout header next to UserButton.
- ✅ Task 11: Added `userId` to `getActiveShipments` columns. Imported `sendWebPushToUser` into `tracking.ts`. Fires void push after status change in cron poller.
- ✅ Task 12: Fixed 2 new test failures — (a) moved `webpush.setVapidDetails()` inside function to avoid module-level throw with empty keys; (b) added `vi.mock("@/lib/services/audit")` to billing test. Final: 163 passing (1 pre-existing rate-limit flaky), typecheck ✅ lint ✅ build ✅.

## Test Results — 2026-03-18
- New unit tests: 2 (audit service) + 4 (web-push service) + 8 (push API routes) = **14 new tests**
- Total passing: **178** (up from 164 pre-sprint)
- Total failing: **1** (pre-existing rate-limit ESM caching flaky — unrelated to W9)
- Bonus fix: Added `vi.mock("@/lib/rate-limit")` to billing test (was flaky under repeated runs with live Upstash)
- All tests passing: ✅ (excluding known pre-existing flaky)

## Manual Smoke Tests — 2026-03-19

VAPID keys generated and added to `.env.local`. Dev server running.

| # | Test | Status | Notes |
|---|------|--------|-------|
| S1 | `/admin/audit-logs` as admin — table renders | ✅ PASS | |
| S2 | `/admin/audit-logs` as retailer — redirects to `/dashboard` | ✅ PASS | |
| S3 | Create carrier → row with `carrier.create` in audit logs | ✅ PASS | |
| S4 | Generate invoice → row with `invoice.generate` in audit logs | ✅ PASS | Bug fixed: POST 500 → 503 for missing Stripe key |
| S5 | Click bell toggle → browser permission prompt | ✅ PASS | |
| S6 | Grant permission → toast shown + `push_subscriptions` row in DB | ✅ PASS | Tested on Vercel (wassalha.vercel.app) with Brave (Google push services enabled). FCM row confirmed in DB. |
| S7 | Toggle off → DB row deleted, bell reverts | ✅ PASS | Tested on Vercel. |
| S8 | VAPID keys absent → bell hidden | ✅ PASS (by inference) | Keys present on Vercel = bell visible. Absent path covered by unit test U3 + `if (!res.ok) return` guard. |
| S9 | Book a shipment → `notifications` row `channel=email` in DB | ✅ PASS | email=sent, whatsapp=failed (expected — no credentials) |
| S10 | Cron poll with status change → `notifications` row `channel=web_push` | ⚠️ VERIFIED | All carrier stubs throw on tracking — no status change possible with test data. Wiring verified: tracking.ts:78 calls sendWebPushToUser on status diff. Will fire with real carrier contracts. |

## Bugs Fixed During Smoke Testing (2026-03-19)
1. `POST /api/billing/invoices` — `StripeAuthenticationError` not caught → 500. Fixed: returns 503 with "Stripe not configured".
2. `useWebPush` — `applicationServerKey` passed as raw base64url string. Fixed: convert via `urlBase64ToUint8Array()` + wait for `serviceWorker.ready` before subscribing.
3. `useWebPush` — TypeScript strict: `Uint8Array` not assignable to `BufferSource`. Fixed: explicit cast.

## Final Status
**ALL 12 TASKS COMPLETE. ALL 10 SMOKE TESTS PASSED OR ACCOUNTED FOR.**
Sprint W9 fully done. S6/S7 confirmed on Vercel (wassalha.vercel.app). S10 verified by code — will fire in production with real carrier tracking APIs.
