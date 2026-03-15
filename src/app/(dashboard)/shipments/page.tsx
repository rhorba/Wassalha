import { ShipmentsTable } from "@/components/shipments/shipments-table";

export default function ShipmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes envois</h1>
        <p className="text-sm text-muted-foreground">
          Historique de toutes vos réservations.
        </p>
      </div>
      <ShipmentsTable />
    </div>
  );
}
