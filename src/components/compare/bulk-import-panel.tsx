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
    label:           raw["label"]          || undefined,
    originCity:      raw["originCity"]      ?? "",
    destinationCity: raw["destinationCity"] ?? "",
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

type ParseError = { rowIndex: number; errors: string[]; raw: RawRow };

type PanelState =
  | { stage: "idle" }
  | { stage: "parsing" }
  | { stage: "preview";   valid: BulkCompareRow[]; parseErrors: ParseError[] }
  | { stage: "comparing" }
  | { stage: "results";   results: BulkCompareResultRow[] };

type BookingRowState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "booked";  trackingNumber: string }
  | { status: "error";   message: string };

// ── Main component ────────────────────────────────────────────────────────────

export function BulkImportPanel() {
  const [globalMode,       setGlobalMode]       = useState<CompareInput["mode"]>("balanced");
  const [panelState,       setPanelState]       = useState<PanelState>({ stage: "idle" });
  const [isDragOver,       setIsDragOver]       = useState(false);
  const [selected,         setSelected]         = useState<Set<number>>(new Set());
  const [bookingRows,      setBookingRows]      = useState<Record<number, BookingRowState>>({});
  const [confirmOpen,      setConfirmOpen]      = useState(false);
  const [bookingProgress,  setBookingProgress]  = useState<{ done: number; total: number } | null>(null);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const bulkCompare    = useBulkCompare();
  const createShipment = useCreateShipment();

  // ── File handling ─────────────────────────────────────────────────────────

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
      if (rawRows.length > 50) {
        toast.warning(`File has ${rawRows.length} rows — only the first 50 will be compared`);
        rawRows = rawRows.slice(0, 50);
      }

      const valid: BulkCompareRow[] = [];
      const parseErrors: ParseError[] = [];

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

  // ── Comparison ────────────────────────────────────────────────────────────

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
          setPanelState({ stage: "idle" });
        },
      },
    );
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleRow(rowIndex: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  }

  function toggleAll(results: BulkCompareResultRow[]) {
    const bookable = results
      .filter((r) => r.bestCarrier !== null)
      .map((r) => r.rowIndex);
    setSelected((prev) =>
      prev.size === bookable.length ? new Set() : new Set(bookable),
    );
  }

  // ── Booking ───────────────────────────────────────────────────────────────

  async function bookRow(result: BulkCompareResultRow): Promise<void> {
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
            recipientPhone:   "0600000000",
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

  // ── CSV export ────────────────────────────────────────────────────────────

  function exportResults(results: BulkCompareResultRow[]) {
    const header =
      "row,label,origin,destination,weightG,codAmountMad,bestCarrier,costMAD,daysMin,daysMax,error\n";
    const rows = results
      .map((r) =>
        [
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
        ].join(","),
      )
      .join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "bulk-compare-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* Drop zone — shown in all states except results */}
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
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse · .csv .xlsx .xls · max 50 rows · 2MB
              </p>
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
                  <li key={rowIndex}>
                    Row {rowIndex + 1}: {errors.join(", ")}
                  </li>
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
                <Button onClick={() => runComparison(panelState.valid)}>
                  Run Comparison ▶
                </Button>
                <Button variant="outline" onClick={() => setPanelState({ stage: "idle" })}>
                  Upload New File
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                No valid rows found — fix the file and re-upload.
              </p>
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
          onBookRow={(r) => void bookRow(r)}
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

// ── ResultsSection ────────────────────────────────────────────────────────────

interface ResultsSectionProps {
  results:         BulkCompareResultRow[];
  selected:        Set<number>;
  bookingRows:     Record<number, BookingRowState>;
  bookingProgress: { done: number; total: number } | null;
  globalMode:      CompareInput["mode"];
  confirmOpen:     boolean;
  onToggleRow:     (i: number) => void;
  onToggleAll:     () => void;
  onBookRow:       (r: BulkCompareResultRow) => void;
  onOpenConfirm:   () => void;
  onConfirmBook:   () => void;
  onCancelConfirm: () => void;
  onExport:        () => void;
  onReset:         () => void;
}

function ResultsSection({
  results,
  selected,
  bookingRows,
  bookingProgress,
  globalMode,
  confirmOpen,
  onToggleRow,
  onToggleAll,
  onBookRow,
  onOpenConfirm,
  onConfirmBook,
  onCancelConfirm,
  onExport,
  onReset,
}: ResultsSectionProps) {
  const bookableCount = results.filter((r) => r.bestCarrier !== null).length;

  const selectedBookable = results.filter(
    (r) => selected.has(r.rowIndex) && r.bestCarrier !== null,
  );

  const totalSelectedCost = selectedBookable.reduce(
    (sum, r) => sum + (r.bestCarrier?.totalCostMad ?? 0),
    0,
  );

  const allBooked =
    bookableCount > 0 &&
    results
      .filter((r) => r.bestCarrier !== null)
      .every((r) => bookingRows[r.rowIndex]?.status === "booked");

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            id="select-all"
            checked={selected.size === bookableCount && bookableCount > 0}
            onCheckedChange={onToggleAll}
            disabled={bookableCount === 0}
          />
          <label htmlFor="select-all" className="text-sm cursor-pointer select-none">
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

      {/* Results table + accordion */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-10">#</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Route</TableHead>
              <TableHead className="hidden md:table-cell">Weight</TableHead>
              <TableHead className="hidden md:table-cell">COD</TableHead>
              <TableHead>Best Carrier</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="hidden sm:table-cell text-center">Days</TableHead>
              <TableHead className="text-right">Action</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
        </Table>

        <Accordion type="multiple" className="w-full">
          {results.map((result) => {
            const booking   = bookingRows[result.rowIndex];
            const isBooked  = booking?.status === "booked";
            const isLoading = booking?.status === "loading";
            const hasError  = booking?.status === "error";

            return (
              <AccordionItem
                key={result.rowIndex}
                value={String(result.rowIndex)}
                className={[
                  "border-b last:border-0",
                  result.cityNotFound || (result.error && !result.bestCarrier)
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : "",
                  isBooked ? "bg-green-50 dark:bg-green-950/20" : "",
                  hasError  ? "bg-red-50 dark:bg-red-950/20"    : "",
                ].filter(Boolean).join(" ")}
              >
                <div className="flex items-center gap-2 px-4 py-3 text-sm">
                  {/* Checkbox */}
                  <div className="w-8 flex-shrink-0">
                    <Checkbox
                      checked={selected.has(result.rowIndex)}
                      onCheckedChange={() => onToggleRow(result.rowIndex)}
                      disabled={!result.bestCarrier || isBooked}
                    />
                  </div>

                  {/* Row number */}
                  <span className="w-10 flex-shrink-0 text-muted-foreground">
                    {result.rowIndex + 1}
                  </span>

                  {/* Label */}
                  <span className="w-28 flex-shrink-0 truncate font-medium">
                    {result.label ?? "—"}
                  </span>

                  {/* Route */}
                  <span className="hidden sm:block w-44 flex-shrink-0 truncate text-muted-foreground text-xs">
                    {result.input.originCity} → {result.input.destinationCity}
                  </span>

                  {/* Weight */}
                  <span className="hidden md:block w-20 flex-shrink-0 text-muted-foreground text-xs">
                    {result.input.weightG}g
                  </span>

                  {/* COD */}
                  <span className="hidden md:block w-24 flex-shrink-0 text-muted-foreground text-xs">
                    {(result.input.codAmountMad / 100).toFixed(0)} MAD
                  </span>

                  {/* Best carrier */}
                  <span className="flex-1 min-w-0 truncate">
                    {result.cityNotFound ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                        City not found
                      </Badge>
                    ) : result.error ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                        {result.error}
                      </Badge>
                    ) : result.bestCarrier ? (
                      <span className="font-medium">{result.bestCarrier.name}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>

                  {/* Cost */}
                  <span className="w-20 flex-shrink-0 text-right tabular-nums">
                    {result.bestCarrier
                      ? `${(result.bestCarrier.totalCostMad / 100).toFixed(2)}`
                      : "—"}
                  </span>

                  {/* Days */}
                  <span className="hidden sm:block w-16 flex-shrink-0 text-center text-muted-foreground text-xs">
                    {result.bestCarrier
                      ? `${result.bestCarrier.deliveryDaysMin}–${result.bestCarrier.deliveryDaysMax}j`
                      : "—"}
                  </span>

                  {/* Action */}
                  <div className="w-24 flex-shrink-0 flex justify-end">
                    {isBooked ? (
                      <Badge className="bg-green-600 text-white text-xs">Booked</Badge>
                    ) : isLoading ? (
                      <span className="text-xs text-muted-foreground animate-pulse">Booking…</span>
                    ) : hasError ? (
                      <span className="text-xs text-destructive">
                        {(booking as { status: "error"; message: string }).message}
                      </span>
                    ) : result.bestCarrier ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onBookRow(result)}
                      >
                        Book
                      </Button>
                    ) : null}
                  </div>

                  {/* Accordion trigger */}
                  {result.allResults.length > 0 && (
                    <AccordionTrigger className="ml-1 py-0 flex-shrink-0" />
                  )}
                  {result.allResults.length === 0 && <div className="w-6 flex-shrink-0" />}
                </div>

                {result.allResults.length > 0 && (
                  <AccordionContent className="px-4 pb-4 pt-1 bg-muted/30">
                    <p className="text-xs text-muted-foreground mb-3">
                      All carriers for row {result.rowIndex + 1} — {result.input.originCity} →{" "}
                      {result.input.destinationCity}:
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

          <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
            {selectedBookable.map((r) => (
              <div key={r.rowIndex} className="flex justify-between">
                <span className="truncate mr-4">
                  {r.label ?? `Row ${r.rowIndex + 1}`} — {r.bestCarrier?.name}
                </span>
                <span className="font-medium flex-shrink-0">
                  {r.bestCarrier
                    ? `${(r.bestCarrier.totalCostMad / 100).toFixed(2)} MAD`
                    : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 flex justify-between font-semibold text-sm">
            <span>Total estimated cost</span>
            <span>{(totalSelectedCost / 100).toFixed(2)} MAD</span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onCancelConfirm}>
              Cancel
            </Button>
            <Button onClick={onConfirmBook}>Confirm &amp; Book All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Empty state */}
      {results.every((r) => r.bestCarrier === null) && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No carriers available for any of the uploaded routes. Download the template and verify
          city names match the autocomplete options.
        </p>
      )}
    </div>
  );
}

