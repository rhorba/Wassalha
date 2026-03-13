"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";

export interface AddressValue {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange: (value: AddressValue) => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Enter address...",
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState(false);
  const [inputValue, setInputValue] = useState(value ?? "");

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
          componentRestrictions: { country: "ma" }, // Morocco only
          fields: ["formatted_address", "geometry"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place.geometry?.location || !place.formatted_address) return;
          onChange({
            address: place.formatted_address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
          setInputValue(place.formatted_address);
        });
      })
      .catch(() => setFallback(true));
  }, [onChange]);

  if (fallback) {
    // Plain text fallback — no Google Maps API key or quota exceeded
    return (
      <Input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange({ address: e.target.value, lat: 0, lng: 0 });
        }}
        placeholder={placeholder}
      />
    );
  }

  return <Input ref={inputRef} defaultValue={value} placeholder={placeholder} />;
}
