"use client";

import { StatCard } from "./stat-card";
import type { AnalyticsSummary } from "@/lib/services/analytics";

function formatMad(value: number): string {
  return value.toLocaleString("fr-MA", {
    style:                 "currency",
    currency:              "MAD",
    minimumFractionDigits: 2,
  });
}

interface KpiRowProps {
  summary: AnalyticsSummary;
  isAdmin: boolean;
}

export function KpiRow({ summary, isAdmin }: KpiRowProps) {
  const hasData = summary.totalShipments > 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Expéditions"      value={hasData ? summary.totalShipments : null} />
        <StatCard title="En cours"         value={hasData ? summary.activeShipments : null} />
        <StatCard title="Taux livraison"   value={hasData ? `${summary.successRate}%` : null} />
        <StatCard title="Dépenses"         value={hasData ? formatMad(summary.totalSpendMad) : null} />
        <StatCard title="COD collecté"     value={hasData ? formatMad(summary.totalCodMad) : null} />
        <StatCard title="Commission payée" value={hasData ? formatMad(summary.commissionPaidMad) : null} />
      </div>

      {isAdmin && summary.pipeline && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Commission en attente"
            value={formatMad(summary.pipeline.pendingMad)}
            description="À facturer"
          />
          <StatCard
            title="Commission facturée"
            value={formatMad(summary.pipeline.invoicedMad)}
            description="En attente paiement"
          />
          <StatCard
            title="Commission encaissée"
            value={formatMad(summary.pipeline.paidMad)}
            description="Reçue"
          />
        </div>
      )}
    </div>
  );
}
