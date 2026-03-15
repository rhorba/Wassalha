"use client";

import Link from "next/link";
import { useShipments } from "@/hooks/use-shipments";
import { useShipmentStatus } from "@/hooks/use-shipment-status";
import { StatusBadge } from "@/components/shipments/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Shipment } from "@/lib/db/schema";

function LiveStatusCell({ id, status }: { id: string; status: Shipment["status"] }) {
  const live = useShipmentStatus(id, status);
  return <StatusBadge status={live} />;
}

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
          <TableHead />
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
              <LiveStatusCell id={s.id} status={s.status} />
            </TableCell>
            <TableCell className="text-right">
              {(s.shippingCostMad / 100).toFixed(2)}
            </TableCell>
            <TableCell>
              <Link
                href={`/shipments/${s.id}`}
                className="text-xs text-blue-600 hover:underline"
              >
                Voir suivi
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
