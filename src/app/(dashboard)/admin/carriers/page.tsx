import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CarrierTable } from "@/components/carriers/carrier-table";
import { listCarriers } from "@/lib/services/carriers";

export default async function AdminCarriersPage() {
  const carriers = await listCarriers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Carriers</h1>
          <p className="text-muted-foreground">
            {carriers.length} carrier{carriers.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/carriers/new">+ Add Carrier</Link>
        </Button>
      </div>
      <CarrierTable carriers={carriers} />
    </div>
  );
}
