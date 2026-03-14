// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarrierTable } from "@/components/carriers/carrier-table";

// Mock hooks
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-carriers", () => ({
  useDeleteCarrier: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return { ...actual, useQueryClient: () => ({ invalidateQueries: vi.fn() }) };
});

const mockCarriers = [
  {
    id: "uuid-1",
    name: "Amana",
    slug: "amana",
    logoUrl: null,
    isActive: true,
    reliabilityScore: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("CarrierTable", () => {
  it("renders carrier name and slug", () => {
    render(<CarrierTable carriers={mockCarriers} />);
    expect(screen.getByText("Amana")).toBeInTheDocument();
    expect(screen.getByText("amana")).toBeInTheDocument();
  });

  it("shows Active badge for active carriers", () => {
    render(<CarrierTable carriers={mockCarriers} />);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows empty state when no carriers", () => {
    render(<CarrierTable carriers={[]} />);
    expect(screen.getByText(/No carriers yet/)).toBeInTheDocument();
  });

  it("shows Inactive badge for inactive carrier", () => {
    const inactive = [{ ...mockCarriers[0], isActive: false }];
    render(<CarrierTable carriers={inactive} />);
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });
});
