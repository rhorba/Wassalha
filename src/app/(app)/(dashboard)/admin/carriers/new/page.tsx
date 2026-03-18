import { CarrierForm } from "@/components/carriers/carrier-form";

export default function NewCarrierPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Carrier</h1>
        <p className="text-muted-foreground">Add a carrier to the Wassalha network</p>
      </div>
      <CarrierForm />
    </div>
  );
}
