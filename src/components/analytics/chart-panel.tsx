"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAnalyticsCharts } from "@/hooks/use-analytics-charts";
import { DateRangePicker } from "./date-range-picker";
import type { ChartWeekPoint, CarrierBreakdownPoint } from "@/lib/services/analytics";

// SSR-safe — Recharts uses browser APIs
const VolumeChart  = dynamic(() => import("./charts/volume-chart"),  { ssr: false });
const SpendChart   = dynamic(() => import("./charts/spend-chart"),   { ssr: false });
const CarrierChart = dynamic(() => import("./charts/carrier-chart"), { ssr: false });

export function ChartPanel() {
  const now = new Date();
  const [from, setFrom] = useState<Date>(
    new Date(now.getFullYear(), now.getMonth() - 2, 1),
  );
  const [to, setTo] = useState<Date>(now);

  const { data, isPending, isError } = useAnalyticsCharts(from, to);

  function handleExport() {
    const params = new URLSearchParams({
      from: from.toISOString(),
      to:   to.toISOString(),
    });
    window.location.href = `/api/shipments/export?${params}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <DateRangePicker
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
        />
        <Button variant="outline" size="sm" onClick={handleExport}>
          Exporter CSV
        </Button>
      </div>

      {isPending && (
        <p className="text-sm text-muted-foreground py-4">Chargement...</p>
      )}
      {isError && (
        <p className="text-sm text-destructive py-4">Erreur de chargement des données</p>
      )}

      {data && (
        <Tabs defaultValue="volume">
          <TabsList>
            <TabsTrigger value="volume">Volume</TabsTrigger>
            <TabsTrigger value="spend">Dépenses</TabsTrigger>
            <TabsTrigger value="carriers">Transporteurs</TabsTrigger>
          </TabsList>
          <TabsContent value="volume" className="pt-4">
            <VolumeChart data={data.timeSeries as ChartWeekPoint[]} />
          </TabsContent>
          <TabsContent value="spend" className="pt-4">
            <SpendChart data={data.timeSeries as ChartWeekPoint[]} />
          </TabsContent>
          <TabsContent value="carriers" className="pt-4">
            <CarrierChart data={data.carrierBreakdown as CarrierBreakdownPoint[]} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
