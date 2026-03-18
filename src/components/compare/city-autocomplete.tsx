"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";

interface CityAutocompleteProps {
  id?: string;
  placeholder?: string;
  onChange: (cityName: string) => void;
}

/**
 * City-only autocomplete (Morocco-restricted).
 * Uses Google Places with types=["(cities)"] and extracts place.name
 * (the most reliable field for city-type results).
 * Falls back to plain text input when no API key is set.
 */
export function CityAutocomplete({
  id,
  placeholder = "Enter city...",
  onChange,
}: CityAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState(false);
  const [fallbackValue, setFallbackValue] = useState("");

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setFallback(true);
      return;
    }

    const loader = new Loader({ apiKey, version: "weekly", libraries: ["places"] });

    loader
      .load()
      .then(() => {
        if (!inputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "ma" },
          types: ["(cities)"],
          // place.name is the city name for city-type results (e.g. "Casablanca")
          // address_components used as fallback for the locality long_name
          fields: ["name", "address_components"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();

          // place.name for city-type = the city name directly ("Casablanca", "Marrakech")
          const localityComponent = place.address_components?.find((c) =>
            c.types.includes("locality")
          );
          const cityName =
            localityComponent?.long_name ??
            place.name ??
            "";

          if (cityName) onChange(cityName);
        });
      })
      .catch(() => setFallback(true));
    // onChange ref is stable from Controller — intentionally excluded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (fallback) {
    return (
      <Input
        id={id}
        value={fallbackValue}
        onChange={(e) => {
          setFallbackValue(e.target.value);
          onChange(e.target.value);
        }}
        placeholder={placeholder}
      />
    );
  }

  // Uncontrolled — Google Places writes directly to the DOM input.
  // Do NOT add value= here; it breaks the Places autocomplete interaction.
  // onChange propagates manual typing (needed for E2E tests and non-Places usage).
  return <Input ref={inputRef} id={id} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}
