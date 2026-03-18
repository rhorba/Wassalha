# Future Sprints — notifications + audit_logs + Web Push

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Add a notifications log table, a full admin audit trail, and browser Web Push alerts for shipment status changes.

**Architecture:** Three new Drizzle tables (`notifications`, `audit_logs`, `push_subscriptions`) share a single migration. The `notifications` table is written to by all three notification services (email, WhatsApp, web_push). Web Push is triggered server-side from the existing cron tracking poller. `audit_logs` is written fire-and-forget from inline call sites in existing API route handlers.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W9 — Notifications + Audit + Web Push

---

## Task 1: Three New Drizzle Schemas + Migration 0008

**Files:**
- Create: `src/lib/db/schema/notifications.ts`
- Create: `src/lib/db/schema/audit-logs.ts`
- Create: `src/lib/db/schema/push-subscriptions.ts`
- Modify: `src/lib/db/schema/index.ts`

**Step 1: Create `notifications` schema**

```ts
// src/lib/db/schema/notifications.ts
import { pgEnum, pgTable, uuid, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { shipments } from "./shipments";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "whatsapp",
  "web_push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "sent",
  "failed",
]);

export const notifications = pgTable("notifications", {
  id:         uuid("id").primaryKey().defaultRandom(),
  shipmentId: uuid("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  channel:    notificationChannelEnum("channel").notNull(),
  status:     notificationStatusEnum("status").notNull(),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  shipment: one(shipments, { fields: [notifications.shipmentId], references: [shipments.id] }),
}));

export type Notification    = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
```

**Step 2: Create `audit_logs` schema**

```ts
// src/lib/db/schema/audit-logs.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const auditLogs = pgTable("audit_logs", {
  id:         uuid("id").primaryKey().defaultRandom(),
  actorId:    text("actor_id").notNull(),    // Clerk user ID
  actorRole:  text("actor_role").notNull(),   // "admin" | "retailer"
  action:     text("action").notNull(),       // e.g. "carrier.create"
  targetType: text("target_type").notNull(), // "carrier" | "invoice" | "user" | "shipment"
  targetId:   text("target_id").notNull(),   // UUID or Clerk user ID string
  createdAt:  timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog    = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
```

**Step 3: Create `push_subscriptions` schema**

```ts
// src/lib/db/schema/push-subscriptions.ts
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id:        uuid("id").primaryKey().defaultRandom(),
    userId:    text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    endpoint:  text("endpoint").notNull(),
    p256dh:    text("p256dh").notNull(),
    auth:      text("auth").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("push_subscriptions_endpoint_unique").on(t.endpoint)],
);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, { fields: [pushSubscriptions.userId], references: [users.id] }),
}));

export type PushSubscription    = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
```

**Step 4: Update schema index**

```ts
// src/lib/db/schema/index.ts
export * from "./users";
export * from "./carriers";
export * from "./shipments";
export * from "./tracking";
export * from "./feedback";
export * from "./notifications";      // add
export * from "./audit-logs";         // add
export * from "./push-subscriptions"; // add
```

**Step 5: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

Expected: new file `src/lib/db/migrations/0008_*.sql` created and applied. Three new tables visible in Drizzle Studio (`pnpm db:studio`).

---

## Task 2: Notifications Log — Update Email + WhatsApp Services

**Files:**
- Modify: `src/lib/notifications/email.ts`
- Modify: `src/lib/notifications/whatsapp.ts`

**Context:** Both services are fire-and-forget. They receive a `shipmentId` implicitly via `params.shipment.id` (email) or need it passed in (WhatsApp). The notifications insert must never throw or block the primary send.

**Step 1: Update `email.ts`**

Add `shipmentId` to `BookingEmailParams` and insert a notifications row after the Resend call:

```ts
// src/lib/notifications/email.ts
import { Resend } from "resend";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import type { Shipment, Carrier } from "@/lib/db/schema";
import type { CommissionBreakdown } from "@/lib/services/commission";

interface BookingEmailParams {
  retailerEmail: string;
  retailerName:  string;
  shipment:      Shipment;
  carrier:       Carrier;
  commission:    CommissionBreakdown;
}

export async function sendBookingConfirmationEmail(
  params: BookingEmailParams,
): Promise<void> {
  if (!params.retailerEmail) {
    console.warn("[email] No retailer email — skipping confirmation email");
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping confirmation email");
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const costMad       = (params.shipment.shippingCostMad / 100).toFixed(2);
  const commissionMad = (params.commission.totalCommissionMad / 100).toFixed(2);
  const codMad        = (params.shipment.codAmountMad / 100).toFixed(2);

  const { error } = await resend.emails.send({
    from:    process.env.RESEND_FROM_EMAIL ?? "Wassalha <onboarding@resend.dev>",
    to:      params.retailerEmail,
    subject: `Réservation confirmée — ${params.carrier.name} — ${params.shipment.carrierTrackingNumber ?? ""}`,
    html: `
      <h2>Réservation confirmée ✓</h2>
      <p>Bonjour ${params.retailerName},</p>
      <p>Votre envoi a été réservé avec succès.</p>
      <table cellpadding="8" style="border-collapse:collapse">
        <tr><td><strong>Transporteur</strong></td><td>${params.carrier.name}</td></tr>
        <tr><td><strong>Numéro de suivi</strong></td><td>${params.shipment.carrierTrackingNumber ?? "—"}</td></tr>
        <tr><td><strong>Destinataire</strong></td><td>${params.shipment.recipientName} — ${params.shipment.recipientCity}</td></tr>
        <tr><td><strong>Montant COD</strong></td><td>${codMad} MAD</td></tr>
        <tr><td><strong>Frais de transport</strong></td><td>${costMad} MAD</td></tr>
        <tr><td><strong>Commission Wassalha</strong></td><td>${commissionMad} MAD</td></tr>
      </table>
      <p>Merci d'utiliser Wassalha.</p>
    `,
  });

  if (error) {
    console.error("[email] Failed to send booking confirmation:", error);
  }

  // Log notification (fire-and-forget — never throws)
  try {
    await db.insert(notifications).values({
      shipmentId: params.shipment.id,
      channel:    "email",
      status:     error ? "failed" : "sent",
    });
  } catch (logErr) {
    console.error("[email] Failed to log notification:", logErr);
  }
}
```

**Step 2: Update `whatsapp.ts`**

Add `shipmentId` parameter and insert notifications row:

```ts
// src/lib/notifications/whatsapp.ts
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";

interface WhatsAppShipmentParams {
  shipmentId:         string;   // add this field
  recipientPhone:     string;
  recipientName:      string;
  carrierName:        string;
  trackingNumber:     string;
  senderBusinessName: string;
}

export async function sendRecipientWhatsApp(
  params: WhatsAppShipmentParams,
): Promise<void> {
  const phoneId      = process.env.WHATSAPP_PHONE_ID      ?? "";
  const token        = process.env.WHATSAPP_API_TOKEN     ?? "";
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME ?? "shipment_notification";

  if (!phoneId || !token) {
    console.warn("[whatsapp] Missing credentials — skipping WhatsApp notification");
    return;
  }

  const phone = params.recipientPhone.replace(/\s/g, "");

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to:                phone,
        type:              "template",
        template: {
          name:     templateName,
          language: { code: "fr" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: params.recipientName },
                { type: "text", text: params.senderBusinessName },
                { type: "text", text: params.trackingNumber },
                { type: "text", text: params.carrierName },
              ],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = (await res.json()) as unknown;
    console.error("[whatsapp] Failed to send notification:", err);
  }

  // Log notification (fire-and-forget — never throws)
  try {
    await db.insert(notifications).values({
      shipmentId: params.shipmentId,
      channel:    "whatsapp",
      status:     res.ok ? "sent" : "failed",
    });
  } catch (logErr) {
    console.error("[whatsapp] Failed to log notification:", logErr);
  }
}
```

**Step 3: Update `bookings.ts` call site**

Find the call to `sendRecipientWhatsApp` in `src/lib/services/bookings.ts` and add `shipmentId: shipment.id` to the params object. The field name must match the updated interface above.

**Step 4: Verify**

```bash
pnpm typecheck
```

Expected: No type errors on the updated WhatsApp params (TypeScript will catch if `shipmentId` is missing at the call site).

---

## Task 3: Audit Service + Call Sites

**Files:**
- Create: `src/lib/services/audit.ts`
- Modify: `src/app/api/carriers/route.ts`
- Modify: `src/app/api/carriers/[id]/route.ts`
- Modify: `src/app/api/billing/invoices/route.ts`
- Modify: `src/app/api/webhooks/clerk/route.ts`

**Step 1: Create `audit.ts` service**

```ts
// src/lib/services/audit.ts
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";

interface AuditEventParams {
  actorId:    string;
  actorRole:  string;
  action:     string;
  targetType: string;
  targetId:   string;
}

/**
 * Fire-and-forget audit log. Never throws — errors are swallowed and logged only.
 * Call inline at admin write sites without awaiting if you want non-blocking.
 * Awaiting is fine too — the insert is fast.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    await db.insert(auditLogs).values(params);
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
```

**Step 2: Update `POST /api/carriers`**

In `src/app/api/carriers/route.ts`, after `const carrier = await createCarrier(parsed.data);`, add:

```ts
// import at top of file
import { logAuditEvent } from "@/lib/services/audit";

// in POST, after createCarrier succeeds:
const { userId, sessionClaims } = await auth();
// Note: userId is already available from the existing auth() call — destructure it there
await logAuditEvent({
  actorId:    userId ?? "unknown",
  actorRole:  "admin",
  action:     "carrier.create",
  targetType: "carrier",
  targetId:   carrier.id,
});
```

**Step 3: Update `PUT /api/carriers/[id]` and `DELETE /api/carriers/[id]`**

In `src/app/api/carriers/[id]/route.ts`:

For `PUT` — after `const updated = await updateCarrier(id, parsed.data);`:
```ts
const { userId } = await auth(); // already called above — destructure userId
await logAuditEvent({
  actorId:    userId ?? "unknown",
  actorRole:  "admin",
  action:     "carrier.update",
  targetType: "carrier",
  targetId:   id,
});
```

For `DELETE` — after `const carrier = await softDeleteCarrier(id);`:
```ts
await logAuditEvent({
  actorId:    userId ?? "unknown",
  actorRole:  "admin",
  action:     "carrier.delete",
  targetType: "carrier",
  targetId:   id,
});
```

Note: `auth()` is already called in both handlers. Destructure `userId` from that existing call — do not call `auth()` twice.

**Step 4: Update `POST /api/billing/invoices`**

In `src/app/api/billing/invoices/route.ts`, after `const result = await createRetailerInvoice(parsed.data.userId);`:

```ts
import { logAuditEvent } from "@/lib/services/audit";

// after createRetailerInvoice succeeds:
await logAuditEvent({
  actorId:    userId,   // already destructured from auth() at top of handler
  actorRole:  "admin",
  action:     "invoice.generate",
  targetType: "invoice",
  targetId:   parsed.data.userId,  // the retailer whose invoice was generated
});
```

**Step 5: Update `POST /api/webhooks/clerk`**

In `src/app/api/webhooks/clerk/route.ts`, the webhook fires on `user.updated` when Clerk syncs `publicMetadata.role`. There is no easy way to detect a role change from the payload alone without comparing to the DB — keep it simple: log every `user.updated` event as a potential role change.

After the `user.updated` db.update block:

```ts
import { logAuditEvent } from "@/lib/services/audit";

if (type === "user.updated") {
  await db
    .update(users)
    .set({ email: getPrimaryEmail(data), name: getFullName(data), updatedAt: new Date() })
    .where(eq(users.id, data.id));

  // Log potential role sync
  await logAuditEvent({
    actorId:    "clerk_webhook",
    actorRole:  "system",
    action:     "role.change",
    targetType: "user",
    targetId:   data.id,
  });
}
```

**Step 6: Verify**

```bash
pnpm typecheck
pnpm lint
```

---

## Task 4: Audit Logs Admin Page

**Files:**
- Create: `src/app/(app)/(dashboard)/admin/audit-logs/page.tsx`
- Modify: `src/app/(app)/(dashboard)/layout.tsx`

**Step 1: Create RSC audit logs page**

```tsx
// src/app/(app)/(dashboard)/admin/audit-logs/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AuditLogsPage() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  if (role !== "admin") redirect("/dashboard");

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Journal d&apos;audit</h1>
        <p className="text-sm text-muted-foreground mt-1">
          100 dernières actions admin
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Acteur</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Cible</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                Aucune action enregistrée
              </TableCell>
            </TableRow>
          )}
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString("fr-MA", {
                  day:    "2-digit",
                  month:  "short",
                  hour:   "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell className="text-sm font-mono text-xs">{log.actorId}</TableCell>
              <TableCell>
                <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800">
                  {log.action}
                </span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                <span className="font-medium">{log.targetType}</span>
                {" / "}
                <span className="font-mono">{log.targetId.slice(0, 8)}…</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 2: Add audit logs link to dashboard layout**

In `src/app/(app)/(dashboard)/layout.tsx`, inside the `{isAdmin && (...)}` block after the Facturation link:

```tsx
{isAdmin && (
  <Link
    href="/admin/audit-logs"
    className="text-muted-foreground hover:text-foreground"
  >
    Audit
  </Link>
)}
```

**Step 3: Verify**

```bash
pnpm typecheck
pnpm lint
```

Visit `/admin/audit-logs` as admin — table renders (empty or with rows from Task 3 call sites).

---

## Task 5: Install `web-push` + Env Vars

**Files:**
- Modify: `.env.example`

**Step 1: Install dependency**

```bash
pnpm add web-push
pnpm add -D @types/web-push
```

**Step 2: Generate VAPID keys**

Run once (locally, store output in your password manager):

```bash
npx web-push generate-vapid-keys
```

Output example:
```
Public Key: BExample...
Private Key: example...
```

**Step 3: Update `.env.example`**

Add after the existing Upstash block:

```bash
# Web Push (VAPID) — generate keys: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@wassalha.ma
NEXT_PUBLIC_VAPID_PUBLIC_KEY=   # same value as VAPID_PUBLIC_KEY
```

**Step 4: Add to `.env.local`**

Copy the generated keys into your local `.env.local`. Both `VAPID_PUBLIC_KEY` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` get the same public key value.

Also add to Vercel environment variables (Production + Preview).

---

## Task 6: Web Push Service

**Files:**
- Create: `src/lib/notifications/web-push.ts`

**Step 1: Create service**

```ts
// src/lib/notifications/web-push.ts
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, notifications } from "@/lib/db/schema";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT ?? "mailto:admin@wassalha.ma",
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? "",
);

interface PushPayload {
  title: string;
  body:  string;
}

/**
 * Send a Web Push notification to all subscriptions for a given user.
 * Fire-and-forget safe — never throws.
 * Auto-removes stale subscriptions (410 Gone).
 * Inserts a notifications row per send attempt.
 */
export async function sendWebPushToUser(
  userId:    string,
  shipmentId: string,
  payload:   PushPayload,
): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("[web-push] VAPID keys not set — skipping push notification");
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  await Promise.allSettled(
    subs.map(async (sub) => {
      let sent = false;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent = true;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410) {
          // Subscription expired — remove it
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint));
          console.info("[web-push] Removed stale subscription:", sub.endpoint);
        } else {
          console.error("[web-push] Send failed:", err);
        }
      }

      // Log notification attempt (fire-and-forget)
      try {
        await db.insert(notifications).values({
          shipmentId,
          channel: "web_push",
          status:  sent ? "sent" : "failed",
        });
      } catch (logErr) {
        console.error("[web-push] Failed to log notification:", logErr);
      }
    }),
  );
}
```

---

## Task 7: Push API Routes

**Files:**
- Create: `src/app/api/push/vapid-public-key/route.ts`
- Create: `src/app/api/push/subscribe/route.ts`

**Step 1: VAPID public key endpoint**

```ts
// src/app/api/push/vapid-public-key/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });

  return NextResponse.json({ key });
}
```

**Step 2: Subscribe/unsubscribe endpoint**

```ts
// src/app/api/push/subscribe/route.ts
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json() as unknown;
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;

  // Upsert — update userId if endpoint already exists (e.g. user re-subscribes)
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set:    { userId, p256dh: keys.p256dh, auth: keys.auth },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body   = await req.json() as unknown;
  const parsed = z.object({ endpoint: z.string().url() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, parsed.data.endpoint));

  return NextResponse.json({ ok: true });
}
```

---

## Task 8: Service Worker

**Files:**
- Create: `public/sw.js`

**Step 1: Create service worker**

```js
// public/sw.js
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const { title, body } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.png",
      badge: "/icon.png",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/shipments")
  );
});
```

Note: `icon.png` can be the existing favicon or any 192×192 PNG in `/public`. If none exists, omit the `icon` field — it is optional.

---

## Task 9: `useWebPush` Hook

**Files:**
- Create: `src/hooks/use-web-push.ts`

**Step 1: Create hook**

```ts
// src/hooks/use-web-push.ts
"use client";

import { useState, useEffect, useCallback } from "react";

interface UseWebPush {
  supported:   boolean;
  permission:  NotificationPermission;
  subscribed:  boolean;
  subscribe:   () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function useWebPush(): UseWebPush {
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [sub,        setSub]        = useState<PushSubscription | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    void (async () => {
      const reg     = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSub(existing);
        setSubscribed(true);
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    const reg  = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    // Fetch VAPID public key from server
    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return;
    const { key } = (await res.json()) as { key: string };

    const newSub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: key,
    });

    // Save to DB
    await fetch("/api/push/subscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newSub.toJSON()),
    });

    setSub(newSub);
    setSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!sub) return;

    await fetch("/api/push/subscribe", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    setSub(null);
    setSubscribed(false);
  }, [sub]);

  return { supported, permission, subscribed, subscribe, unsubscribe };
}
```

---

## Task 10: Bell Toggle UI in Dashboard Layout

**Files:**
- Create: `src/components/notifications/push-toggle.tsx`
- Modify: `src/app/(app)/(dashboard)/layout.tsx`

**Context:** The dashboard layout (`layout.tsx`) is a Server Component. The bell toggle needs `useWebPush` (client hook). Extract it as a Client Component and drop it into the header.

**Step 1: Create `PushToggle` Client Component**

```tsx
// src/components/notifications/push-toggle.tsx
"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { useWebPush } from "@/hooks/use-web-push";

export function PushToggle() {
  const { supported, subscribed, subscribe, unsubscribe } = useWebPush();

  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
      toast.success("Vous serez notifié des mises à jour de vos envois");
    }
  };

  return (
    <Toggle
      pressed={subscribed}
      onPressedChange={() => { void handleToggle(); }}
      aria-label="Activer les notifications push"
      size="sm"
      variant="outline"
    >
      {subscribed ? (
        <Bell className="h-4 w-4 text-blue-600" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Toggle>
  );
}
```

**Step 2: Add `PushToggle` to dashboard layout header**

In `src/app/(app)/(dashboard)/layout.tsx`, import and place `PushToggle` next to `UserButton`:

```tsx
import { PushToggle } from "@/components/notifications/push-toggle";

// in the header, replace:
<UserButton />

// with:
<div className="flex items-center gap-3">
  <PushToggle />
  <UserButton />
</div>
```

---

## Task 11: Trigger Web Push from Cron Poller

**Files:**
- Modify: `src/lib/services/tracking.ts`
- Modify: `src/app/api/cron/tracking/route.ts`

**Context:** `pollActiveShipments()` in `tracking.ts` updates shipment status when it changes. We need to fire web push when `next !== shipment.status`. The shipment's `userId` is already available in the query.

**Step 1: Update `getActiveShipments` query to include `userId`**

In `src/lib/services/tracking.ts`, update the `columns` selection in `getActiveShipments`:

```ts
columns: {
  id:                    true,
  userId:                true,   // add this
  carrierTrackingNumber: true,
  status:                true,
},
```

**Step 2: Import and call `sendWebPushToUser` on status change**

In `src/lib/services/tracking.ts`, add the import and trigger:

```ts
import { sendWebPushToUser } from "@/lib/notifications/web-push";
```

Inside the `pollActiveShipments` loop, after the `db.update` for status change:

```ts
if (next && next !== shipment.status) {
  await db
    .update(shipments)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(shipments.id, shipment.id));

  // Fire web push (non-blocking — sendWebPushToUser never throws)
  void sendWebPushToUser(shipment.userId, shipment.id, {
    title: "Colis mis à jour",
    body:  `Votre envoi est maintenant : ${next.replace("_", " ")}`,
  });
}
```

Note: `void` prefix makes it fire-and-forget. If you want to await it (slightly slower cron but guaranteed log writes), replace `void` with `await`.

---

## Task 12: Final Verification

**Step 1: Type check + lint + build**

```bash
pnpm typecheck
pnpm lint
pnpm build
```

Expected: No errors. Build output shows new routes:
- `GET /api/push/vapid-public-key`
- `POST /api/push/subscribe`
- `DELETE /api/push/subscribe`
- `GET /admin/audit-logs` (RSC)

**Step 2: Run existing tests**

```bash
pnpm test
```

Expected: All 164 existing tests still passing. New code has no unit tests in this sprint (integration surfaces only — tested manually).

**Step 3: Manual smoke tests**

| # | Test | Expected |
|---|------|----------|
| S1 | Open `/admin/audit-logs` as admin | Table renders (empty or with rows) |
| S2 | Open `/admin/audit-logs` as retailer | Redirects to `/dashboard` |
| S3 | Create a carrier in admin UI | Row appears in audit logs with `carrier.create` |
| S4 | Generate an invoice in billing | Row appears with `invoice.generate` |
| S5 | Click bell toggle in header (desktop Chrome/Android) | Browser permission prompt shown |
| S6 | Grant permission + toggle on | `push_subscriptions` row in DB; toast shown |
| S7 | Toggle off | DB row deleted; bell icon reverts |
| S8 | `VAPID_PUBLIC_KEY` not set in env | Bell toggle hidden (unsupported) |
| S9 | Book a shipment | `notifications` row with `channel=email` in DB |
| S10 | Check notification log after cron poll with status change | `notifications` row with `channel=web_push` in DB |

**Step 4: Commit**

```bash
git add -p
git commit -m "feat: add notifications log, audit trail, and Web Push status alerts"
```
