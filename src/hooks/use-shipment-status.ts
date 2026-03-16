"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Shipment } from "@/lib/db/schema";

type ShipmentStatus = Shipment["status"];

const POLL_INTERVAL_MS = 10_000;

export function useShipmentStatus(
  shipmentId:    string,
  initialStatus: ShipmentStatus,
): ShipmentStatus {
  const [status, setStatus] = useState<ShipmentStatus>(initialStatus);
  const latestStatus = useRef<ShipmentStatus>(initialStatus);

  // Keep ref in sync so the poll callback always compares against current value
  useEffect(() => {
    latestStatus.current = status;
  }, [status]);

  // Realtime subscription (best-effort — fires instantly when it works)
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
          const row = payload.new as { id: string; status: ShipmentStatus };
          if (row.id === shipmentId) setStatus(row.status);
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [shipmentId]);

  // Polling fallback — catches updates that Realtime misses
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/shipments/${shipmentId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { shipment: { status: ShipmentStatus } };
        const next = data.shipment?.status;
        if (next && next !== latestStatus.current) {
          setStatus(next);
        }
      } catch {
        // silently ignore network errors during polling
      }
    };

    const timer = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [shipmentId]);

  return status;
}
