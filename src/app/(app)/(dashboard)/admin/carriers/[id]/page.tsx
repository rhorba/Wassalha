import { notFound } from "next/navigation";
import { CarrierForm } from "@/components/carriers/carrier-form";
import { ZoneAccordion } from "@/components/carriers/zone-accordion";
import { getCarrierById } from "@/lib/services/carriers";
import type { CarrierZone, CarrierPricing } from "@/lib/db/schema";

interface CarrierWithZones {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  reliabilityScore: number;
  createdAt: Date;
  updatedAt: Date;
  zones: (CarrierZone & { pricing: CarrierPricing[] })[];
}

export default async function EditCarrierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const carrier = (await getCarrierById(id)) as CarrierWithZones | undefined;

  if (!carrier) notFound();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Edit Carrier</h1>
        <p className="text-muted-foreground">{carrier.name}</p>
      </div>
      <CarrierForm carrier={carrier} />
      <hr />
      <ZoneAccordion carrierId={carrier.id} zones={carrier.zones} />
    </div>
  );
}
