"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsSummary } from "@/lib/services/analytics";

export function useAnalyticsSummary() {
  return useQuery<AnalyticsSummary>({
    queryKey: ["analytics", "summary"],
    queryFn:  async () => {
      const res = await fetch("/api/analytics/summary");
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json() as Promise<AnalyticsSummary>;
    },
    staleTime: 60_000, // 1 minute
  });
}
