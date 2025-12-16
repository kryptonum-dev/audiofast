import { cacheLife, cacheTag } from "next/cache";

import type { QueryBrandBySlugResult } from "@/src/global/sanity/sanity.types";

import StoreMapWrapper from "./StoreMapWrapper";
import styles from "./styles.module.scss";

export type Store = NonNullable<
  NonNullable<
    NonNullable<NonNullable<QueryBrandBySlugResult>["stores"]>[number]
  >
>;

export interface StoreWithLocation extends Store {
  location: {
    lat: number;
    lng: number;
  };
}

export interface StoreLocationsProps {
  stores: Store[];
  customId?: string;
}

// Clean street address for geocoding
function cleanStreetForGeocoding(street: string): string {
  return (
    street
      // Remove "ul." prefix
      .replace(/^ul\.?\s*/i, "")
      // Remove apartment/office numbers: "lok. 9", "lokal 5", etc.
      .replace(/,?\s*(lok\.?|lokal)\s*\d+[a-zA-Z]?/gi, "")
      // Remove "pasaż" and similar
      .replace(/,?\s*pasaż\s*/gi, " ")
      // Remove trailing letters after building numbers for cleaner search
      // "55e" stays as is, but clean up any trailing punctuation
      .replace(/\s+/g, " ")
      .trim()
  );
}

// Server-side geocoding function using Nominatim structured search
async function geocodeAddress(address: {
  street: string;
  city: string;
  postalCode: string;
}): Promise<{ lat: number; lng: number } | null> {
  "use cache";
  cacheLife("weeks");
  cacheTag("store-locations");

  const cleanStreet = cleanStreetForGeocoding(address.street);

  // Helper to make Nominatim request
  const fetchNominatim = async (
    params: URLSearchParams,
  ): Promise<{ lat: number; lng: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          cache: "force-cache",
          headers: {
            "User-Agent": "Audiofast-Website/1.0",
          },
          next: {
            revalidate: 60 * 60 * 24,
          },
        },
      );

      if (!response.ok) return null;

      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  // Strategy 1: Structured search with street, city, postalcode (most accurate)
  const structuredParams = new URLSearchParams({
    street: cleanStreet,
    city: address.city,
    postalcode: address.postalCode,
    country: "Poland",
    format: "json",
    limit: "1",
    "accept-language": "pl",
  });

  let result = await fetchNominatim(structuredParams);
  if (result) return result;

  // Strategy 2: Structured search without postal code (in case it's causing issues)
  const noPostalParams = new URLSearchParams({
    street: cleanStreet,
    city: address.city,
    country: "Poland",
    format: "json",
    limit: "1",
    "accept-language": "pl",
  });

  result = await fetchNominatim(noPostalParams);
  if (result) return result;

  // Strategy 3: Free-form search with full address
  const freeFormParams = new URLSearchParams({
    q: `${cleanStreet}, ${address.city}, Poland`,
    format: "json",
    limit: "1",
    "accept-language": "pl",
    countrycodes: "pl",
  });

  result = await fetchNominatim(freeFormParams);
  if (result) return result;

  // Strategy 4: Search just the street name in the city (for streets with complex numbering)
  const streetNameOnly = cleanStreet.replace(/\s*\d+[a-zA-Z]?$/, "").trim();
  if (streetNameOnly !== cleanStreet) {
    const streetOnlyParams = new URLSearchParams({
      street: streetNameOnly,
      city: address.city,
      country: "Poland",
      format: "json",
      limit: "1",
      "accept-language": "pl",
    });

    result = await fetchNominatim(streetOnlyParams);
    if (result) return result;
  }

  // Strategy 5: Fallback to postal code + city center
  const postalFallbackParams = new URLSearchParams({
    postalcode: address.postalCode,
    city: address.city,
    country: "Poland",
    format: "json",
    limit: "1",
    "accept-language": "pl",
  });

  result = await fetchNominatim(postalFallbackParams);
  if (result) return result;

  console.error(
    `Could not geocode address: ${cleanStreet}, ${address.postalCode} ${address.city}`,
  );
  return null;
}

export default async function StoreLocations({
  stores,
  customId = "gdzie-kupic",
}: StoreLocationsProps) {
  // Deduplicate stores by _id
  const uniqueStoresMap = new Map<string, Store>();
  stores.forEach((store) => {
    if (store && store._id) {
      uniqueStoresMap.set(store._id, store);
    }
  });

  const uniqueStores = Array.from(uniqueStoresMap.values());

  if (uniqueStores.length === 0) {
    return null;
  }

  // Geocode all stores on the server with delays between requests
  const storesWithLocations: StoreWithLocation[] = [];

  for (const store of uniqueStores) {
    if (
      !store ||
      !store.address?.city ||
      !store.address?.street ||
      !store.address?.postalCode
    ) {
      continue;
    }

    const location = await geocodeAddress({
      street: store.address.street,
      city: store.address.city,
      postalCode: store.address.postalCode,
    });
    if (location) {
      storesWithLocations.push({
        ...store,
        location,
      });
    }
  }

  if (storesWithLocations.length === 0) {
    return null;
  }

  // Calculate map center
  let mapCenter: [number, number];

  if (storesWithLocations.length === 1) {
    const firstStore = storesWithLocations[0];
    if (firstStore) {
      mapCenter = [firstStore.location.lat, firstStore.location.lng];
    } else {
      mapCenter = [52.0693, 19.4803]; // Default to Poland center
    }
  } else {
    const avgLat =
      storesWithLocations.reduce((sum, store) => sum + store.location.lat, 0) /
      storesWithLocations.length;
    const avgLng =
      storesWithLocations.reduce((sum, store) => sum + store.location.lng, 0) /
      storesWithLocations.length;
    mapCenter = [avgLat, avgLng];
  }

  return (
    <section
      id={customId}
      className={`${styles.storeLocations} max-width-block`}
    >
      <div className={styles.mapWrapper}>
        <StoreMapWrapper stores={storesWithLocations} mapCenter={mapCenter} />
      </div>
      <h2 className={styles.heading}>Gdzie kupić</h2>
      <ul className={styles.storesList}>
        {[...storesWithLocations].map((store, index) => (
          <li key={store._id + index} id={store._id} className={styles.store}>
            <div className={styles.storeInfo}>
              <p className={styles.storeName}>{store.name}</p>
              {store.address && (
                <p className={styles.storeAddress}>
                  {store.address.postalCode} {store.address.city},{" "}
                  {store.address.street}
                </p>
              )}
            </div>
            <div className={styles.storeContact}>
              <a href={`tel:${store.phone}`} className={styles.contactItem}>
                <span className={styles.icon}>
                  <PhoneIcon />
                </span>
                <span className={styles.contactText}>
                  {store.phone?.replace("+48", "")}
                </span>
              </a>
              {store.website && (
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.contactItem}
                >
                  <span className={styles.icon}>
                    <ComputerIcon />
                  </span>
                  <span className={styles.contactText}>
                    {store.website
                      .replace("https://", "")
                      .replace("http://", "")
                      .replace("www.", "")
                      .replace(/\/$/, "")}
                  </span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#FE0140"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.859}
        d="M2.917 2.333H5.25L6.417 5.25l-1.459.875A6.417 6.417 0 0 0 7.875 9.04l.875-1.458 2.917 1.167v2.333A1.167 1.167 0 0 1 10.5 12.25 9.334 9.334 0 0 1 1.75 3.5a1.167 1.167 0 0 1 1.167-1.167Z"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h14v14H0z" />
      </clipPath>
    </defs>
  </svg>
);

const ComputerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.859}
      clipPath="url(#a)"
    >
      <path d="M1.75 2.333a.583.583 0 0 1 .583-.583h9.334a.583.583 0 0 1 .583.583v7a.583.583 0 0 1-.583.584H2.333a.583.583 0 0 1-.583-.584v-7ZM1.75 7.583h10.5M4.668 12.25h4.667M5.833 9.916 5.54 12.25M8.168 9.916l.292 2.334" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h14v14H0z" />
      </clipPath>
    </defs>
  </svg>
);
