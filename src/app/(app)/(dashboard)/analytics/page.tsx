import { ChartPanel } from "@/components/analytics/chart-panel";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Analytiques</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Volume, dépenses et répartition par transporteur
        </p>
      </div>
      <ChartPanel />
    </div>
  );
}
