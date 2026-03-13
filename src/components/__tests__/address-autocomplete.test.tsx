// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";

// Simulate no API key → plain-text fallback
vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");

describe("AddressAutocomplete — fallback mode (no API key)", () => {
  it("renders a plain input when no API key is set", async () => {
    await act(async () => {
      render(<AddressAutocomplete onChange={vi.fn()} placeholder="Enter address" />);
    });
    expect(screen.getByPlaceholderText("Enter address")).toBeInTheDocument();
  });

  it("calls onChange with address text on input", async () => {
    const onChange = vi.fn();
    await act(async () => {
      render(<AddressAutocomplete onChange={onChange} />);
    });
    const input = screen.getByPlaceholderText("Enter address...");
    fireEvent.change(input, { target: { value: "Casablanca" } });
    expect(onChange).toHaveBeenCalledWith({ address: "Casablanca", lat: 0, lng: 0 });
  });
});
