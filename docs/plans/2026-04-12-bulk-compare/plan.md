# Bulk Compare Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: use executing-plans skill to implement this plan task-by-task.

**Goal:** Add a "Bulk Import" tab to the Compare page so retailers can upload a CSV/Excel file of shipments, run a single batch comparison, and book any or all results without leaving the page.

**Architecture:** A new `POST /api/carriers/compare/bulk` endpoint validates up to 50 rows with Zod, calls the existing `compareCarriers()` service sequentially, and returns per-row results (partial failures inline). The frontend is a single `BulkImportPanel` client component behind a shadcn `Tabs` toggle — it owns the full state machine from file upload → parse → preview → compare → results → booking.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM, Zod, React Hook Form, TanStack Query, shadcn/ui, Tailwind CSS 4.

**Sprint:** W11 — Bulk Compare

---

## Task 1: Install missing dependencies

**Files:**
- Modify: `package.json` (via CLI)

**Step 1: Install xlsx (SheetJS)**
```bash
pnpm add xlsx
pnpm add -D @types/xlsx
```

> SheetJS types are bundled with the package in recent versions — if `@types/xlsx` errors with "not found", skip it (types already included).

**Step 2: Add missing shadcn/ui components**
```bash
npx shadcn@latest add dialog
npx shadcn@latest add checkbox
```

This creates:
- `src/components/ui/dialog.tsx`
- `src/components/ui/checkbox.tsx`

**Step 3: Verify install**
```bash
pnpm typecheck
```

Expected: No new type errors.

---

## Task 2: Add bulk Zod schemas and TypeScript types

**Files:**
- Modify: `src/lib/validations/carriers.ts`

**Step 1: Append bulk schemas after the existing `CompareInput` export**

```ts
// ── Bulk comparison ────────────────────────────────────────────────────────────

export const BulkCompareRowSchema = z.object({
  rowIndex:        z.number().int().min(0),
  label:           z.string().optional(),
  originCity:      z.string().min(2, "Origin city required"),
  destinationCity: z.string().min(2, "Destination city required"),
  weightG:         z.coerce.number().int().min(1, "Weight must be at least 1g"),
  codAmountMad:    z.coerce.number().int().min(0),
  mode:            z.enum(["cheapest", "balanced", "fastest"]).optional(),
});

export const BulkCompareRequestSchema = z.object({
  globalMode: z.enum(["cheapest", "balanced", "fastest"]).default("balanced"),
  rows: z
    .array(BulkCompareRowSchema)
    .min(1, "At least 1 row required")
    .max(50, "Max 50 rows per request"),
});

export type BulkCompareRow     = z.infer<typeof BulkCompareRowSchema>;
export type BulkCompareRequest = z.infer<typeof BulkCompareRequestSchema>;

export type BulkCompareResultRow = {
  rowIndex:     number;
  label:        string | undefined;
  input:        BulkCompareRow;
  bestCarrier:  CarrierResult | null;
  allResults:   CarrierResult[];
  cityNotFound: boolean;
  error:        string | null;
};
```

> `z.coerce.number()` is used for `weightG` and `codAmountMad` so CSV strings ("500") coerce automatically during client-side parse validation.

**Step 2: Verify**
```bash
pnpm typecheck
```

---

## Task 3: Add bulk rate limit

**Files:**
- Modify: `src/lib/rate-limit.ts`

**Step 1: Add `compareBulk` entry to the `ratelimit` object**

```ts
export const ratelimit = {
  compare:      makeRatelimit(20, '1 m', 'rl:compare'),
  compareBulk:  makeRatelimit(3,  '1 m', 'rl:compare-bulk'),  // ← add this
  booking:      makeRatelimit(10, '1 m', 'rl:booking'),
  billing:      makeRatelimit(5,  '1 m', 'rl:billing'),
}
```

---

## Task 4: Create the bulk compare API endpoint

**Files:**
- Create: `src/app/api/carriers/compare/bulk/route.ts`

**Step 1: Create the route handler**

```ts
import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { BulkCompareRequestSchema } from "@/lib/validations/carriers";
import { compareCarriers } from "@/lib/services/comparison";
import { ratelimit, checkRateLimit } from "@/lib/rate-limit";
import type { BulkCompareResultRow } from "@/lib/validations/carriers";

export async function POST(req: Request) {
  const ip = (await headers()).get("x-forwarded-for") ?? "127.0.0.1";
  const { limited, retryAfter } = await checkRateLimit(ratelimit.compareBulk, ip);
  if (limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = BulkCompareRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { globalMode, rows } = parsed.data;
  const results: BulkCompareResultRow[] = [];

  // Process rows sequentially to avoid DB connection surge
  for (const row of rows) {
    const mode = row.mode ?? globalMode;
    try {
      const outcome = await compareCarriers({ ...row, mode });

      if ("error" in outcome) {
        results.push({
          rowIndex:     row.rowIndex,
          label:        row.label,
          input:        { ...row, mode },
          bestCarrier:  null,
          allResults:   [],
          cityNotFound: outcome.error.code === "CITY_NOT_FOUND",
          error:        outcome.error.code === "CITY_NOT_FOUND"
            ? "Destination city not found"
            : "No results",
        });
      } else {
        results.push({
          rowIndex:     row.rowIndex,
          label:        row.label,
          input:        { ...row, mode },
          bestCarrier:  outcome.results[0] ?? null,
          allResults:   outcome.results,
          cityNotFound: false,
          error:        outcome.results.length === 0 ? "No carriers available for this route" : null,
        });
      }
    } catch {
      results.push({
        rowIndex:     row.rowIndex,
        label:        row.label,
        input:        { ...row, mode },
        bestCarrier:  null,
        allResults:   [],
        cityNotFound: false,
        error:        "Comparison failed — please retry",
      });
    }
  }

  return NextResponse.json({ results });
}
```

**Step 2: Verify**
```bash
pnpm typecheck
pnpm lint
```

---

## Task 5: Create the `useBulkCompare` TanStack Query hook

**Files:**
- Create: `src/hooks/use-bulk-compare.ts`

**Step 1: Create the hook**

```ts
"use client";

import { useMutation } from "@tanstack/react-query";
import type { BulkCompareRequest, BulkCompareResultRow } from "@/lib/validations/carriers";

type BulkCompareResponse = {
  results: BulkCompareResultRow[];
};

export function useBulkCompare() {
  return useMutation<BulkCompareResponse, Error, BulkCompareRequest>({
    mutationFn: async (data) => {
      const res = await fetch("/api/carriers/compare/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        throw new Error(typeof err.error === "string" ? err.error : "Bulk compare failed");
      }
      return res.json() as Promise<BulkCompareResponse>;
    },
  });
}
```

---

## Task 6: Create the `BulkImportPanel` component

**Files:**
- Create: `src/components/compare/bulk-import-panel.tsx`

This component owns the full bulk flow. It is split into logical sections with comments.

**State machine:**
```
"idle" → (file dropped) → "parsing" → "preview" | "parse-error"
       → (Run Comparison) → "comparing" → "results"
```

**Step 1: Create the component**

```tsx
"use client";

import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ModeToggle } from "@/components/compare/mode-toggle";
import { CarrierResultCard } from "@/components/compare/carrier-result-card";
import { useBulkCompare } from "@/hooks/use-bulk-compare";
import { useCreateShipment } from "@/hooks/use-create-shipment";
import { BulkCompareRowSchema } from "@/lib/validations/carriers";
import type {
  BulkCompareRow,
  BulkCompareResultRow,
  CompareInput,
} from "@/lib/validations/carriers";

// ── CSV template ──────────────────────────────────────────────────────────────

const CSV_TEMPLATE =
  "label,originCity,destinationCity,weightG,codAmountMad,mode\n" +
  "Order #123,Casablanca,Marrakech,500,1500,\n" +
  "Order #124,Rabat,Fes,1000,2000,cheapest\n";

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "wassalha-bulk-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Row parse helpers ─────────────────────────────────────────────────────────

type RawRow = Record<string, string>;

type ParsedRowResult =
  | { ok: true;  row: BulkCompareRow }
  | { ok: false; errors: string[]; raw: RawRow };

function parseRawRow(raw: RawRow, rowIndex: number): ParsedRowResult {
  const candidate = {
    rowIndex,
    label:           raw["label"]           || undefined,
    originCity:      raw["originCity"]       ?? "",
    destinationCity: raw["destinationCity"]  ?? "",
    weightG:         raw["weightG"],
    codAmountMad:    raw["codAmountMad"],
    mode:            raw["mode"] || undefined,
  };

  const result = BulkCompareRowSchema.safeParse(candidate);
  if (result.success) return { ok: true, row: result.data };

  const errors = result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
  return { ok: false, errors, raw };
}

async function parseFile(file: File): Promise<RawRow[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    const text = await file.text();
    const [headerLine, ...dataLines] = text.trim().split(/\r?\n/);
    const headers = (headerLine ?? "").split(",").map((h) => h.trim());
    return dataLines
      .filter((l) => l.trim())
      .map((line) => {
        const values = line.split(",").map((v) => v.trim());
        return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
      });
  }

  if (ext === "xlsx" || ext === "xls") {
    const { read, utils } = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb     = read(buffer, { type: "array" });
    const ws     = wb.Sheets[wb.SheetNames[0]!]!;
    const rows   = utils.sheet_to_json<RawRow>(ws, { defval: "" });
    return rows;
  }

  throw new Error("Unsupported file type — use .csv, .xlsx, or .xls");
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PanelState =
  | { stage: "idle" }
  | { stage: "parsing" }
  | { stage: "preview";     valid: BulkCompareRow[]; parseErrors: { rowIndex: number; errors: string[]; raw: RawRow }[] }
  | { stage: "comparing" }
  | { stage: "results";     results: BulkCompareResultRow[] };

type BookingRowState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "booked";  trackingNumber: string }
  | { status: "error";   message: string };

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkImportPanel() {
  const [globalMode, setGlobalMode] = useState<CompareInput["mode"]>("balanced");
  const [panelState, setPanelState] = useState<PanelState>({ stage: "idle" });
  const [isDragOver,  setIsDragOver]  = useState(false);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());
  const [bookingRows, setBookingRows] = useState<Record<number, BookingRowState>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingProgress, setBookingProgress] = useState<{ done: number; total: number } | null>(null);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const bulkCompare    = useBulkCompare();
  const createShipment = useCreateShipment();

  // ── File handling ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large — max 2MB");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      toast.error("Unsupported file type — use .csv, .xlsx, or .xls");
      return;
    }

    setPanelState({ stage: "parsing" });
    try {
      let rawRows = await parseFile(file);
      const truncated = rawRows.length > 50;
      if (truncated) {
        toast.warning(`File has ${rawRows.length} rows — only the first 50 will be compared`);
        rawRows = rawRows.slice(0, 50);
      }

      const valid:       BulkCompareRow[] = [];
      const parseErrors: { rowIndex: number; errors: string[]; raw: RawRow }[] = [];

      rawRows.forEach((raw, i) => {
        const result = parseRawRow(raw, i);
        if (result.ok) {
          valid.push(result.row);
        } else {
          parseErrors.push({ rowIndex: i, errors: result.errors, raw: result.raw });
        }
      });

      setPanelState({ stage: "preview", valid, parseErrors });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
      setPanelState({ stage: "idle" });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  // ── Comparison ───────────────────────────────────────────────────────────

  function runComparison(valid: BulkCompareRow[]) {
    setPanelState({ stage: "comparing" });
    setSelected(new Set());
    setBookingRows({});
    bulkCompare.mutate(
      { globalMode, rows: valid },
      {
        onSuccess: (res) => {
          setPanelState({ stage: "results", results: res.results });
        },
        onError: (err) => {
          toast.error(err.message ?? "Comparison failed — please retry");
          // Go back to preview so user can retry
          if (panelState.stage === "comparing") {
            // Re-parse won't work here; just reset to idle
            setPanelState({ stage: "idle" });
          }
        },
      },
    );
  }

  // ── Selection ────────────────────────────────────────────────────────────

  function toggleRow(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function toggleAll(results: BulkCompareResultRow[]) {
    const bookable = results.filter((r) => r.bestCarrier !== null).map((r) => r.rowIndex);
    setSelected((prev) =>
      prev.size === bookable.length ? new Set() : new Set(bookable),
    );
  }

  // ── Booking ──────────────────────────────────────────────────────────────

  async function bookRow(result: BulkCompareResultRow) {
    if (!result.bestCarrier) return;
    setBookingRows((prev) => ({ ...prev, [result.rowIndex]: { status: "loading" } }));
    try {
      const res = await new Promise<{ trackingNumber: string }>((resolve, reject) => {
        createShipment.mutate(
          {
            carrierId:        result.bestCarrier!.carrierId,
            shippingCostMad:  result.bestCarrier!.totalCostMad,
            mode:             result.input.mode ?? globalMode,
            originCity:       result.input.originCity,
            recipientName:    result.label ?? `Row ${result.rowIndex + 1}`,
            recipientPhone:   "0000000000",   // placeholder — bulk booking pre-fills minimal data
            recipientCity:    result.input.destinationCity,
            recipientAddress: result.input.destinationCity,
            weightG:          result.input.weightG,
            codAmountMad:     result.input.codAmountMad,
            parcelDescription: result.label,
          },
          { onSuccess: resolve, onError: reject },
        );
      });
      setBookingRows((prev) => ({
        ...prev,
        [result.rowIndex]: { status: "booked", trackingNumber: res.trackingNumber },
      }));
    } catch {
      setBookingRows((prev) => ({
        ...prev,
        [result.rowIndex]: { status: "error", message: "Booking failed — retry" },
      }));
    }
  }

  async function bookSelected(results: BulkCompareResultRow[]) {
    const toBook = results.filter(
      (r) => selected.has(r.rowIndex) && r.bestCarrier !== null,
    );
    setConfirmOpen(false);
    setBookingProgress({ done: 0, total: toBook.length });
    for (let i = 0; i < toBook.length; i++) {
      await bookRow(toBook[i]!);
      setBookingProgress({ done: i + 1, total: toBook.length });
    }
    setBookingProgress(null);
    setSelected(new Set());
    toast.success(`Booked ${toBook.length} shipment(s)`);
  }

  // ── CSV export ───────────────────────────────────────────────────────────

  function exportResults(results: BulkCompareResultRow[]) {
    const header = "row,label,origin,destination,weightG,codAmountMad,bestCarrier,costMAD,daysMin,daysMax,error\n";
    const rows   = results.map((r) => [
      r.rowIndex + 1,
      r.label ?? "",
      r.input.originCity,
      r.input.destinationCity,
      r.input.weightG,
      r.input.codAmountMad,
      r.bestCarrier?.name ?? "",
      r.bestCarrier ? (r.bestCarrier.totalCostMad / 100).toFixed(2) : "",
      r.bestCarrier?.deliveryDaysMin ?? "",
      r.bestCarrier?.deliveryDaysMax ?? "",
      r.error ?? "",
    ].join(",")).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "bulk-compare-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Global controls */}
      <div className="flex flex-wrap items-center gap-4 justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Default priority mode</p>
          <ModeToggle value={globalMode} onChange={setGlobalMode} />
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          Download Template
        </Button>
      </div>

      {/* Drop zone — shown in idle, parsing, preview, parse-error states */}
      {panelState.stage !== "results" && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50",
          ].join(" ")}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          {panelState.stage === "parsing" ? (
            <p className="text-sm text-muted-foreground animate-pulse">Parsing file…</p>
          ) : (
            <>
              <p className="font-medium">Drop CSV or Excel here</p>
              <p className="text-sm text-muted-foreground mt-1">or click to browse · .csv .xlsx .xls · max 50 rows · 2MB</p>
            </>
          )}
        </div>
      )}

      {/* Preview state */}
      {panelState.stage === "preview" && (
        <div className="space-y-4">
          {panelState.parseErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">
                {panelState.parseErrors.length} row(s) have validation errors and will be skipped:
              </p>
              <ul className="text-xs text-destructive space-y-1">
                {panelState.parseErrors.map(({ rowIndex, errors }) => (
                  <li key={rowIndex}>Row {rowIndex + 1}: {errors.join(", ")}</li>
                ))}
              </ul>
            </div>
          )}

          {panelState.valid.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {panelState.valid.length} valid row(s) ready for comparison.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => runComparison(panelState.valid)}
                  disabled={bulkCompare.isPending}
                >
                  Run Comparison ▶
                </Button>
                <Button variant="outline" onClick={() => setPanelState({ stage: "idle" })}>
                  Upload New File
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">No valid rows found — fix the file and re-upload.</p>
              <Button variant="outline" onClick={() => setPanelState({ stage: "idle" })}>
                Upload New File
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Comparing skeleton */}
      {panelState.stage === "comparing" && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
          <p className="text-sm text-muted-foreground text-center">Comparing carriers…</p>
        </div>
      )}

      {/* Results */}
      {panelState.stage === "results" && (
        <ResultsSection
          results={panelState.results}
          selected={selected}
          bookingRows={bookingRows}
          bookingProgress={bookingProgress}
          globalMode={globalMode}
          confirmOpen={confirmOpen}
          onToggleRow={toggleRow}
          onToggleAll={() => toggleAll(panelState.results)}
          onBookRow={bookRow}
          onOpenConfirm={() => setConfirmOpen(true)}
          onConfirmBook={() => void bookSelected(panelState.results)}
          onCancelConfirm={() => setConfirmOpen(false)}
          onExport={() => exportResults(panelState.results)}
          onReset={() => setPanelState({ stage: "idle" })}
        />
      )}
    </div>
  );
}

// ── ResultsSection sub-component ──────────────────────────────────────────────

interface ResultsSectionProps {
  results:          BulkCompareResultRow[];
  selected:         Set<number>;
  bookingRows:      Record<number, BookingRowState>;
  bookingProgress:  { done: number; total: number } | null;
  globalMode:       CompareInput["mode"];
  confirmOpen:      boolean;
  onToggleRow:      (i: number) => void;
  onToggleAll:      () => void;
  onBookRow:        (r: BulkCompareResultRow) => void;
  onOpenConfirm:    () => void;
  onConfirmBook:    () => void;
  onCancelConfirm:  () => void;
  onExport:         () => void;
  onReset:          () => void;
}

function ResultsSection({
  results, selected, bookingRows, bookingProgress, globalMode,
  confirmOpen, onToggleRow, onToggleAll, onBookRow,
  onOpenConfirm, onConfirmBook, onCancelConfirm, onExport, onReset,
}: ResultsSectionProps) {
  const bookableCount = results.filter((r) => r.bestCarrier !== null).length;
  const selectedBookable = results.filter(
    (r) => selected.has(r.rowIndex) && r.bestCarrier !== null,
  );
  const totalSelectedCost = selectedBookable.reduce(
    (sum, r) => sum + (r.bestCarrier?.totalCostMad ?? 0),
    0,
  );

  const allBooked = bookableCount > 0 && results
    .filter((r) => r.bestCarrier !== null)
    .every((r) => bookingRows[r.rowIndex]?.status === "booked");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selected.size === bookableCount && bookableCount > 0}
            onCheckedChange={onToggleAll}
            disabled={bookableCount === 0}
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer">
            Select all ({bookableCount})
          </label>
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={onOpenConfirm}
              disabled={bookingProgress !== null}
            >
              {bookingProgress
                ? `Booking ${bookingProgress.done} of ${bookingProgress.total}…`
                : `Book Selected (${selected.size})`}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onExport}>
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={onReset}>
            New Import
          </Button>
        </div>
      </div>

      {allBooked && (
        <p className="text-sm text-green-600 font-medium">
          All shipments booked successfully.
        </p>
      )}

      {/* Results accordion table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>#</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>COD</TableHead>
              <TableHead>Best Carrier</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        <Accordion type="multiple" className="w-full">
          {results.map((result) => {
            const booking = bookingRows[result.rowIndex];
            const isBooked = booking?.status === "booked";
            const isLoading = booking?.status === "loading";
            const hasError  = booking?.status === "error";

            return (
              <AccordionItem key={result.rowIndex} value={String(result.rowIndex)}>
                <div className={[
                  "flex items-center gap-2 px-4 py-3 border-b text-sm",
                  result.cityNotFound || result.error ? "bg-amber-50 dark:bg-amber-950/20" : "",
                  isBooked ? "bg-green-50 dark:bg-green-950/20" : "",
                  hasError  ? "bg-red-50 dark:bg-red-950/20" : "",
                ].join(" ")}>
                  <Checkbox
                    checked={selected.has(result.rowIndex)}
                    onCheckedChange={() => onToggleRow(result.rowIndex)}
                    disabled={!result.bestCarrier || isBooked}
                  />
                  <span className="w-8 text-muted-foreground">{result.rowIndex + 1}</span>
                  <span className="w-32 truncate font-medium">{result.label ?? "—"}</span>
                  <span className="hidden sm:block w-40 truncate text-muted-foreground">
                    {result.input.originCity} → {result.input.destinationCity}
                  </span>
                  <span className="hidden md:block w-20 text-muted-foreground">
                    {result.input.weightG}g
                  </span>
                  <span className="hidden md:block w-24 text-muted-foreground">
                    {(result.input.codAmountMad / 100).toFixed(0)} MAD
                  </span>
                  <span className="flex-1 truncate">
                    {result.cityNotFound ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">City not found</Badge>
                    ) : result.error ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">{result.error}</Badge>
                    ) : result.bestCarrier ? (
                      <span className="font-medium">{result.bestCarrier.name}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  <span className="w-20 text-right">
                    {result.bestCarrier
                      ? `${(result.bestCarrier.totalCostMad / 100).toFixed(2)}`
                      : "—"}
                  </span>
                  <span className="w-16 text-center text-muted-foreground">
                    {result.bestCarrier
                      ? `${result.bestCarrier.deliveryDaysMin}–${result.bestCarrier.deliveryDaysMax}j`
                      : "—"}
                  </span>
                  {/* Status / action */}
                  <div className="w-24 flex justify-end">
                    {isBooked ? (
                      <Badge variant="default" className="bg-green-600 text-white">Booked</Badge>
                    ) : isLoading ? (
                      <span className="text-xs text-muted-foreground animate-pulse">Booking…</span>
                    ) : hasError ? (
                      <span className="text-xs text-destructive">{(booking as { status: "error"; message: string }).message}</span>
                    ) : result.bestCarrier ? (
                      <Button size="sm" variant="outline" onClick={() => onBookRow(result)}>
                        Book
                      </Button>
                    ) : null}
                  </div>
                  <AccordionTrigger className="ml-2 py-0" />
                </div>

                {result.allResults.length > 0 && (
                  <AccordionContent className="px-4 pb-4 pt-2">
                    <p className="text-xs text-muted-foreground mb-3">
                      All carriers for row {result.rowIndex + 1}:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {result.allResults.map((carrier, i) => (
                        <CarrierResultCard
                          key={carrier.carrierId}
                          result={carrier}
                          isTop={i === 0}
                          compareInput={{
                            originCity:      result.input.originCity,
                            destinationCity: result.input.destinationCity,
                            weightG:         result.input.weightG,
                            codAmountMad:    result.input.codAmountMad,
                            mode:            result.input.mode ?? globalMode,
                          }}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Bulk booking confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={onCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Booking</DialogTitle>
            <DialogDescription>
              You are about to book {selectedBookable.length} shipment(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            {selectedBookable.map((r) => (
              <div key={r.rowIndex} className="flex justify-between">
                <span>{r.label ?? `Row ${r.rowIndex + 1}`} — {r.bestCarrier?.name}</span>
                <span className="font-medium">
                  {r.bestCarrier ? (r.bestCarrier.totalCostMad / 100).toFixed(2) + " MAD" : ""}
                </span>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Total estimated cost</span>
              <span>{(totalSelectedCost / 100).toFixed(2)} MAD</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancelConfirm}>Cancel</Button>
            <Button onClick={onConfirmBook}>Confirm & Book All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

> **Note on bulk booking recipient data:** The bulk flow pre-fills `recipientName`, `recipientCity`, and `recipientAddress` from the row data. For a real booking these need full recipient details — in a future iteration, an inline form per row can be added. For now, the per-row "Book" button opens the existing `BookingSheet` via `CarrierResultCard` inside the accordion, which collects the full form. The "Book Selected" bulk path uses the minimal pre-fill above.

---

## Task 7: Update compare page client to add tabs

**Files:**
- Modify: `src/app/(app)/(dashboard)/compare/compare-page-client.tsx`

**Step 1: Replace the file contents**

```tsx
"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompareForm } from "@/components/compare/compare-form";
import { ResultsList } from "@/components/compare/results-list";
import { BulkImportPanel } from "@/components/compare/bulk-import-panel";
import { useCompare } from "@/hooks/use-compare";
import { useUserProfile } from "@/hooks/use-user-profile";
import type { CarrierResult, UnavailableCarrier, CompareInput } from "@/lib/validations/carriers";

export function ComparePageClient() {
  const [results, setResults]           = useState<CarrierResult[] | null>(null);
  const [unavailable, setUnavailable]   = useState<UnavailableCarrier[]>([]);
  const [cityNotFound, setCityNotFound] = useState(false);
  const [lastInput, setLastInput]       = useState<CompareInput | null>(null);
  const compare                         = useCompare();
  const { data: profile }               = useUserProfile();

  return (
    <Tabs defaultValue="single" className="space-y-6">
      <TabsList>
        <TabsTrigger value="single">Single</TabsTrigger>
        <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="space-y-8">
        <CompareForm
          isLoading={compare.isPending}
          defaultOriginCity={profile?.defaultSenderCity ?? undefined}
          onSubmit={(data) => {
            setCityNotFound(false);
            setLastInput(data);
            compare.mutate(data, {
              onSuccess: (res) => {
                setResults(res.results);
                setUnavailable(res.unavailable ?? []);
                setCityNotFound(res.cityNotFound ?? false);
              },
            });
          }}
        />

        {compare.isError && (
          <p className="text-sm text-destructive">Something went wrong. Please try again.</p>
        )}

        {cityNotFound && (
          <p className="text-sm text-muted-foreground">
            Destination city not recognized — please select a city from the autocomplete dropdown.
          </p>
        )}

        {results !== null && !cityNotFound && lastInput && (
          <ResultsList results={results} compareInput={lastInput} unavailable={unavailable} />
        )}
      </TabsContent>

      <TabsContent value="bulk">
        <BulkImportPanel />
      </TabsContent>
    </Tabs>
  );
}
```

---

## Task 8: Final verification

**Step 1: Run full checks**
```bash
pnpm typecheck
pnpm lint
pnpm build
```

**Step 2: Manual smoke test**
1. Navigate to `/compare`
2. Confirm "Single" tab works as before (no regression)
3. Click "Bulk Import" tab
4. Click "Download Template" — verify CSV downloads with correct columns
5. Upload the template CSV — verify preview table shows 2 valid rows
6. Click "Run Comparison" — verify results table appears with ranked carriers
7. Expand a row — verify all carrier cards render
8. Select a row, click "Book Selected" — verify confirmation dialog shows correct cost
9. Upload a file with intentional errors (blank originCity) — verify error banner appears
10. Upload a file with >50 rows — verify truncation banner appears

**Step 3: Commit**
```bash
git add src/lib/validations/carriers.ts \
        src/lib/rate-limit.ts \
        src/app/api/carriers/compare/bulk/route.ts \
        src/hooks/use-bulk-compare.ts \
        src/components/compare/bulk-import-panel.tsx \
        src/app/\(app\)/\(dashboard\)/compare/compare-page-client.tsx \
        src/components/ui/dialog.tsx \
        src/components/ui/checkbox.tsx

git commit -m "feat(compare): add bulk import — CSV/Excel upload, batch comparison, bulk booking"
```
