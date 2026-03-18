import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRetailersBillingOverview } from "@/lib/services/billing";
import { getAnalyticsSummary } from "@/lib/services/analytics";
import { RetailerBillingTable } from "@/components/billing/retailer-billing-table";
import { InvoiceHistoryTable } from "@/components/billing/invoice-history-table";
import { StatCard } from "@/components/dashboard/stat-card";

function formatMad(value: number): string {
  return value.toLocaleString("fr-MA", {
    style:                 "currency",
    currency:              "MAD",
    minimumFractionDigits: 2,
  });
}

export default async function BillingPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin") redirect("/dashboard");

  const [summary, retailers] = await Promise.all([
    getAnalyticsSummary(userId, "admin"),
    getRetailersBillingOverview(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Facturation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipeline de commissions et génération de factures Stripe
        </p>
      </div>

      {summary.pipeline && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="En attente"
            value={formatMad(summary.pipeline.pendingMad)}
            description="À facturer"
          />
          <StatCard
            title="Facturé"
            value={formatMad(summary.pipeline.invoicedMad)}
            description="En attente paiement"
          />
          <StatCard
            title="Encaissé"
            value={formatMad(summary.pipeline.paidMad)}
            description="Reçu"
          />
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Revendeurs avec commissions en attente
        </h2>
        <RetailerBillingTable rows={retailers} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Historique des factures</h2>
        <InvoiceHistoryTable />
      </div>
    </div>
  );
}
