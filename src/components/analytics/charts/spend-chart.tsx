"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ChartWeekPoint } from "@/lib/services/analytics";

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
      Aucune donnée pour cette période
    </div>
  );
}

export default function SpendChart({ data }: { data: ChartWeekPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tickFormatter={(v: string) => v.slice(0, 10)} />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip formatter={(v) => typeof v === "number" ? `${v.toFixed(2)} MAD` : v} />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="spendMad"
          stroke="#2563eb"
          name="Dépenses (MAD)"
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="commissionMad"
          stroke="#16a34a"
          name="Commission (MAD)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
