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
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Expéditions"      value={summary.totalShipments} />
        <StatCard title="En cours"         value={summary.activeShipments} />
        <StatCard title="Taux livraison"   value={`${summary.successRate}%`} />
        <StatCard title="Dépenses"         value={formatMad(summary.totalSpendMad)} />
        <StatCard title="COD collecté"     value={formatMad(summary.totalCodMad)} />
        <StatCard title="Commission payée" value={formatMad(summary.commissionPaidMad)} />
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
