import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { getShipmentById } from "@/lib/services/bookings";
import { getTrackingEvents } from "@/lib/services/tracking";
import { LiveStatusBadge } from "@/components/tracking/live-shipment-detail";
import { TrackingTimeline } from "@/components/tracking/tracking-timeline";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ShipmentDetailPage({ params }: Props) {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const { id } = await params;
  const role = (sessionClaims?.publicMetadata as { role?: string })?.role === "admin"
    ? "admin"
    : "retailer";

  const shipment = await getShipmentById(id, userId, role);
  if (!shipment) notFound();

  const events = await getTrackingEvents(id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Shipment Details</h1>
          <p className="font-mono text-sm text-gray-500">{shipment.carrierTrackingNumber}</p>
        </div>
        <LiveStatusBadge shipmentId={shipment.id} initialStatus={shipment.status} />
      </div>

      {/* Shipment info */}
      <div className="mb-8 space-y-1 rounded-lg border p-4 text-sm">
        <p><span className="text-gray-500">Carrier:</span> {shipment.carrier.name}</p>
        <p><span className="text-gray-500">Recipient:</span> {shipment.recipientName} — {shipment.recipientCity}</p>
        <p><span className="text-gray-500">Origin:</span> {shipment.originCity}</p>
        <p><span className="text-gray-500">Weight:</span> {(shipment.weightG / 1000).toFixed(2)} kg</p>
        <p><span className="text-gray-500">COD:</span> {(shipment.codAmountMad / 100).toFixed(2)} MAD</p>
      </div>

      {/* Tracking timeline */}
      <h2 className="mb-4 text-base font-medium">Tracking History</h2>
      <TrackingTimeline
        shipment={{ id: shipment.id, status: shipment.status }}
        initialEvents={events}
      />
    </div>
  );
}
