/**
 * Mock Aramex Tracking API — simulation only, not for production.
 * Simulates a realistic Aramex TrackShipments response with 3 events.
 */
export async function POST() {
  const now = new Date();

  const response = {
    HasErrors: false,
    TrackingResults: [
      {
        Value: [
          {
            UpdateCode: "SH001",
            UpdateDescription: "Shipment Booked",
            UpdateDateTime: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
            UpdateLocation: "Casablanca Hub",
          },
          {
            UpdateCode: "SH005",
            UpdateDescription: "Shipment Picked Up by Aramex",
            UpdateDateTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
            UpdateLocation: "Casablanca Hub",
          },
          {
            UpdateCode: "SH010",
            UpdateDescription: "In Transit to Destination",
            UpdateDateTime: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
            UpdateLocation: "Rabat Sorting Facility",
          },
          {
            UpdateCode: "SH006",
            UpdateDescription: "Shipment Delivered",
            UpdateDateTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
            UpdateLocation: "Rabat",
          },
        ],
      },
    ],
  };

  return Response.json(response);
}
