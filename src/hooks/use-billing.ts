"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InvoiceListRow } from "@/lib/services/billing";

export function useInvoices() {
  return useQuery<InvoiceListRow[]>({
    queryKey: ["billing", "invoices"],
    queryFn:  async () => {
      const res = await fetch("/api/billing/invoices");
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json() as Promise<InvoiceListRow[]>;
    },
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch("/api/billing/invoices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ userId: targetUserId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error ?? "Failed to create invoice");
      }
      return res.json() as Promise<{ invoiceId: string; invoiceUrl: string }>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["billing", "invoices"] });
      void qc.invalidateQueries({ queryKey: ["analytics", "summary"] });
    },
  });
}
