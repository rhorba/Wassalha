"use client";

import { useShipments } from "@/hooks/use-shipments";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending:    "secondary",
  confirmed:  "default",
  picked_up:  "default",
  in_transit: "default",
  delivered:  "outline",
  failed:     "destructive",
  cancelled:  "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  pending:    "En attente",
  confirmed:  "Confirmé",
  picked_up:  "Collecté",
  in_transit: "En transit",
  delivered:  "Livré",
  failed:     "Échoué",
  cancelled:  "Annulé",
};

export function ShipmentsTable() {
  const { data, isLoading, isError } = useShipments();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Chargement...</p>;
  }
  if (isError) {
    return <p className="text-sm text-destructive">Erreur de chargement.</p>;
  }
  if (!data || data.shipments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun envoi pour le moment. Commencez par{" "}
        <a href="/compare" className="underline underline-offset-4">
          comparer les transporteurs
        </a>
        .
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Destinataire</TableHead>
          <TableHead>Ville</TableHead>
          <TableHead>Numéro de suivi</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Coût (MAD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.shipments.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="font-medium">{s.recipientName}</TableCell>
            <TableCell>{s.recipientCity}</TableCell>
            <TableCell className="font-mono text-xs">
              {s.carrierTrackingNumber ?? "—"}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[s.status] ?? "secondary"}>
                {STATUS_LABEL[s.status] ?? s.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              {(s.shippingCostMad / 100).toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
