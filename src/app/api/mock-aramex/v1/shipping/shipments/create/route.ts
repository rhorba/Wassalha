/**
 * Mock Aramex Create Shipment API — simulation only, not for production.
 */
export async function POST() {
  const mockTrackingNumber = `ARX-MOCK-${Date.now()}`;

  return Response.json({
    HasErrors: false,
    ProcessedShipment: {
      ID:          mockTrackingNumber,
      ForeignHAWB: `HAWB-${Date.now()}`,
      LabelURL:    "https://example.com/mock-label.pdf",
    },
  });
}
