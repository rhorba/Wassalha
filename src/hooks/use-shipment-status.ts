"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Shipment } from "@/lib/db/schema";

type ShipmentStatus = Shipment["status"];

export function useShipmentStatus(
  shipmentId:    string,
  initialStatus: ShipmentStatus,
): ShipmentStatus {
  const [status, setStatus] = useState<ShipmentStatus>(initialStatus);

  useEffect(() => {
    const channel = supabase
      .channel(`shipment-status:${shipmentId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "shipments",
          filter: `id=eq.${shipmentId}`,
        },
        (payload) => {
          const newStatus = (payload.new as { status: ShipmentStatus }).status;
          setStatus(newStatus);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [shipmentId]);

  return status;
}
