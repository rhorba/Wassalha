import cityZonesMap from "./city-zones.json";

type CityZoneMap = Record<string, Record<string, string>>;

/**
 * Normalize a city string: lowercase, trim whitespace, strip diacritics.
 * Handles Google Places returns like "Fès" → "fes", "Tétouan" → "tetouan".
 */
function normalizeCity(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Look up the zone code for a given city + carrier slug.
 * Returns undefined if the city is not in the static map.
 * Returns undefined if the carrier slug has no mapping for this city.
 */
export function cityToCarrierZoneCode(
  city: string,
  carrierSlug: string
): string | undefined {
  return (cityZonesMap as CityZoneMap)[normalizeCity(city)]?.[carrierSlug];
}

/**
 * Check whether a city exists in the mapping at all.
 * Used to return a 422 before querying the DB.
 */
export function isCityKnown(city: string): boolean {
  return normalizeCity(city) in (cityZonesMap as CityZoneMap);
}
