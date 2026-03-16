"use client";

import { useInvoices } from "@/hooks/use-billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  draft:         "Brouillon",
  open:          "Ouverte",
  paid:          "Payée",
  uncollectible: "Irrécouvrable",
  void:          "Annulée",
  unknown:       "Inconnu",
};

function formatMad(value: number): string {
  return value.toLocaleString("fr-MA", {
    style:                 "currency",
    currency:              "MAD",
    minimumFractionDigits: 2,
  });
}

export function InvoiceHistoryTable() {
  const { data, isPending, isError } = useInvoices();

  if (isPending) {
    return <p className="text-sm text-muted-foreground py-4">Chargement...</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive py-4">Erreur de chargement</p>;
  }
  if (!data?.length) {
    return <p className="text-sm text-muted-foreground py-4">Aucune facture.</p>;
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Revendeur</th>
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Montant</th>
            <th className="px-4 py-3 text-left font-medium">Statut</th>
            <th className="px-4 py-3 text-right font-medium">PDF</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((inv) => (
            <tr key={inv.invoiceId}>
              <td className="px-4 py-3">{inv.retailer}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(inv.date).toLocaleDateString("fr-MA")}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMad(inv.amountMad)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={inv.status === "paid" ? "default" : "secondary"}>
                  {STATUS_LABELS[inv.status] ?? inv.status}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {inv.pdfUrl ? (
                  <Button variant="link" size="sm" asChild>
                    <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer">
                      Voir PDF
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
