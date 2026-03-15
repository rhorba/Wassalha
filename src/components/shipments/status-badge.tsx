import type { Shipment } from "@/lib/db/schema";

type ShipmentStatus = Shipment["status"];

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; colors: string }> = {
  pending:    { label: "Pending",    colors: "bg-gray-100 text-gray-700"   },
  confirmed:  { label: "Confirmed",  colors: "bg-blue-100 text-blue-700"   },
  picked_up:  { label: "Picked Up",  colors: "bg-yellow-100 text-yellow-700" },
  in_transit: { label: "In Transit", colors: "bg-orange-100 text-orange-700" },
  delivered:  { label: "Delivered",  colors: "bg-green-100 text-green-700" },
  failed:     { label: "Failed",     colors: "bg-red-100 text-red-700"     },
  cancelled:  { label: "Cancelled",  colors: "bg-gray-100 text-gray-500"   },
};

interface StatusBadgeProps {
  status: ShipmentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, colors } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
