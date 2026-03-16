"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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

export default function VolumeChart({ data }: { data: ChartWeekPoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" tickFormatter={(v: string) => v.slice(0, 10)} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="shipments" fill="#2563eb" name="Expéditions" />
      </BarChart>
    </ResponsiveContainer>
  );
}
