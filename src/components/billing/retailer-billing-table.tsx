"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCreateInvoice } from "@/hooks/use-billing";
import type { RetailerBillingRow } from "@/lib/services/billing";

function formatMad(value: number): string {
  return value.toLocaleString("fr-MA", {
    style:                 "currency",
    currency:              "MAD",
    minimumFractionDigits: 2,
  });
}

export function RetailerBillingTable({ rows }: { rows: RetailerBillingRow[] }) {
  const { mutate, isPending } = useCreateInvoice();

  function handleGenerate(userId: string) {
    mutate(userId, {
      onSuccess: (data) => {
        toast.success("Facture envoyée", {
          description: "La facture a été envoyée au client par email.",
          action: {
            label:   "Voir",
            onClick: () => window.open(data.invoiceUrl, "_blank"),
          },
        });
      },
      onError: (err) => toast.error(err.message),
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Aucune commission en attente.
      </p>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm" data-testid="billing-table">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Revendeur</th>
            <th className="px-4 py-3 text-right font-medium">Expéditions</th>
            <th className="px-4 py-3 text-right font-medium">Commission en attente</th>
            <th className="px-4 py-3 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.userId}>
              <td className="px-4 py-3">
                <div className="font-medium">{row.email}</div>
                {row.name && (
                  <div className="text-xs text-muted-foreground">{row.name}</div>
                )}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {row.pendingCount}
              </td>
              <td className="px-4 py-3 text-right font-medium">
                {formatMad(row.pendingTotalMad)}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  disabled={isPending || row.pendingTotalMad === 0}
                  onClick={() => handleGenerate(row.userId)}
                  title={
                    row.pendingTotalMad === 0
                      ? "Aucune commission en attente"
                      : undefined
                  }
                >
                  Générer facture
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
