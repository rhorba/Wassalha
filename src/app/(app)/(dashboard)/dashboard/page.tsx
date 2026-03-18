import { auth } from "@clerk/nextjs/server";
import { getAnalyticsSummary } from "@/lib/services/analytics";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { ShipmentsTable } from "@/components/shipments/shipments-table";

export default async function DashboardPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;

  const role =
    (sessionClaims?.metadata as { role?: string })?.role === "admin"
      ? "admin"
      : "retailer";

  const summary = await getAnalyticsSummary(userId, role);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      <KpiRow summary={summary} isAdmin={role === "admin"} />

      <div>
        <h2 className="text-lg font-semibold mb-4">Expéditions récentes</h2>
        <ShipmentsTable />
      </div>
    </div>
  );
}
