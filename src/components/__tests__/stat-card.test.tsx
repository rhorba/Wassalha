// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCard } from "@/components/dashboard/stat-card";

describe("StatCard", () => {
  it("renders title and string value", () => {
    render(<StatCard title="Expéditions" value="42" />);
    expect(screen.getByText("Expéditions")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("renders title and numeric value", () => {
    render(<StatCard title="En cours" value={7} />);
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("shows em-dash when value is null", () => {
    render(<StatCard title="Dépenses" value={null} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows em-dash when value is undefined", () => {
    render(<StatCard title="Dépenses" value={undefined} />);
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows error state when error=true", () => {
    render(<StatCard title="Commission" value={100} error />);
    expect(screen.getByText("Erreur")).toBeTruthy();
  });

  it("renders optional description", () => {
    render(<StatCard title="Commission" value="0 MAD" description="À facturer" />);
    expect(screen.getByText("À facturer")).toBeTruthy();
  });
});
