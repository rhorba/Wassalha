import { ComparePageClient } from "./compare-page-client";

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Compare Carriers</h1>
        <p className="text-muted-foreground">
          Enter your shipment details to find the best carrier.
        </p>
      </div>
      <ComparePageClient />
    </div>
  );
}
