"use client";

import { useQuery } from "@tanstack/react-query";
import type { AnalyticsCharts } from "@/lib/services/analytics";

export function useAnalyticsCharts(from: Date, to: Date) {
  return useQuery<AnalyticsCharts>({
    queryKey: ["analytics", "charts", from.toISOString(), to.toISOString()],
    queryFn:  async () => {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to:   to.toISOString(),
      });
      const res = await fetch(`/api/analytics/charts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch charts");
      return res.json() as Promise<AnalyticsCharts>;
    },
    staleTime: 5 * 60_000, // 5 minutes
  });
}
