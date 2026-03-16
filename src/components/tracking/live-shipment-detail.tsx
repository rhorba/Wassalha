"use client";

import { useShipmentStatus } from "@/hooks/use-shipment-status";
import { StatusBadge } from "@/components/shipments/status-badge";
import type { Shipment } from "@/lib/db/schema";

interface Props {
  shipmentId:    string;
  initialStatus: Shipment["status"];
}

export function LiveStatusBadge({ shipmentId, initialStatus }: Props) {
  const status = useShipmentStatus(shipmentId, initialStatus);
  return <StatusBadge status={status} />;
}
