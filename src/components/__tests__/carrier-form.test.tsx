// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CarrierForm } from "@/components/carriers/carrier-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

const mockCreate = vi.fn().mockResolvedValue({});
const mockUpdate = vi.fn().mockResolvedValue({});

vi.mock("@/hooks/use-carriers", () => ({
  useCreateCarrier: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateCarrier: () => ({ mutateAsync: mockUpdate, isPending: false }),
}));

describe("CarrierForm — create mode", () => {
  it("renders empty fields", () => {
    render(<CarrierForm />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
  });

  it("shows validation error for empty name on submit", async () => {
    render(<CarrierForm />);
    fireEvent.click(screen.getByText("Create Carrier"));
    await waitFor(() => {
      expect(screen.getByText(/Name is required/i)).toBeInTheDocument();
    });
  });

  it("calls createCarrier on valid submission", async () => {
    render(<CarrierForm />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Amana" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "amana" } });
    fireEvent.click(screen.getByText("Create Carrier"));
    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith({ name: "Amana", slug: "amana" })
    );
  });
});

describe("CarrierForm — edit mode", () => {
  const carrier = {
    id: "uuid-1",
    name: "Amana",
    slug: "amana",
    logoUrl: null,
    isActive: true,
    reliabilityScore: 80,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("shows Update button in edit mode", () => {
    render(<CarrierForm carrier={carrier} />);
    expect(screen.getByText("Update Carrier")).toBeInTheDocument();
  });

  it("pre-fills form with carrier data", () => {
    render(<CarrierForm carrier={carrier} />);
    expect(screen.getByDisplayValue("Amana")).toBeInTheDocument();
    expect(screen.getByDisplayValue("amana")).toBeInTheDocument();
  });
});
