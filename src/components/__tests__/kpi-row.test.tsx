// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiRow } from "@/components/dashboard/kpi-row";
import type { AnalyticsSummary } from "@/lib/services/analytics";

const baseSummary: AnalyticsSummary = {
  totalShipments:    10,
  activeShipments:   3,
  deliveredCount:    7,
  successRate:       70,
  totalSpendMad:     1500,
  totalCodMad:       20000,
  commissionPaidMad: 150,
  pipeline:          null,
};

describe("KpiRow", () => {
  it("renders 6 stat card titles for retailer (no pipeline)", () => {
    render(<KpiRow summary={baseSummary} isAdmin={false} />);
    expect(screen.getByText("Expéditions")).toBeTruthy();
    expect(screen.getByText("En cours")).toBeTruthy();
    expect(screen.getByText("Taux livraison")).toBeTruthy();
    expect(screen.getByText("Dépenses")).toBeTruthy();
    expect(screen.getByText("COD collecté")).toBeTruthy();
    expect(screen.getByText("Commission payée")).toBeTruthy();
    // Pipeline cards should not appear
    expect(screen.queryByText("Commission en attente")).toBeNull();
  });

  it("renders 3 extra pipeline cards for admin", () => {
    const adminSummary: AnalyticsSummary = {
      ...baseSummary,
      pipeline: { pendingMad: 500, invoicedMad: 200, paidMad: 150 },
    };
    render(<KpiRow summary={adminSummary} isAdmin={true} />);
    expect(screen.getByText("Commission en attente")).toBeTruthy();
    expect(screen.getByText("Commission facturée")).toBeTruthy();
    expect(screen.getByText("Commission encaissée")).toBeTruthy();
  });

  it("shows success rate as percentage string", () => {
    render(<KpiRow summary={baseSummary} isAdmin={false} />);
    expect(screen.getByText("70%")).toBeTruthy();
  });

  it("shows total shipments as number", () => {
    render(<KpiRow summary={baseSummary} isAdmin={false} />);
    expect(screen.getByText("10")).toBeTruthy();
  });
});
