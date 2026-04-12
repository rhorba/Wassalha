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
