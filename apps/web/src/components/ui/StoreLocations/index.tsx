import type { QueryBrandBySlugResult } from '@/src/global/sanity/sanity.types';

import StoreMapWrapper from './StoreMapWrapper';
import styles from './styles.module.scss';

export type Store = NonNullable<
  NonNullable<
    NonNullable<NonNullable<QueryBrandBySlugResult>['stores']>[number]
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

// Server-side geocoding function
async function geocodeCity(
  city: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const params = new URLSearchParams({
      q: `${city}, Poland`,
      format: 'json',
      limit: '1',
      'accept-language': 'pl',
      countrycodes: 'pl',
    });

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          'User-Agent': 'Audiofast-Website/1.0',
        },
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    );

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
  } catch (error) {
    console.error(`Error geocoding city "${city}":`, error);
  }

  return null;
}

export default async function StoreLocations({
  stores,
  customId = 'gdzie-kupic',
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

  for (let i = 0; i < uniqueStores.length; i++) {
    const store = uniqueStores[i];
    if (!store || !store.address?.city) {
      continue;
    }

    const location = await geocodeCity(store.address.city);
    if (location) {
      storesWithLocations.push({
        ...store,
        location,
      });
    }

    // Add delay between requests (except for the last one) to respect rate limits
    if (i < uniqueStores.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
        {[...storesWithLocations].map((store) => (
          <li
            key={store._id + Math.random()}
            id={store._id}
            className={styles.store}
          >
            <div className={styles.storeInfo}>
              <p className={styles.storeName}>{store.name}</p>
              {store.address && (
                <p className={styles.storeAddress}>
                  {store.address.postalCode} {store.address.city},{' '}
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
                  {store.phone?.replace('+48', '')}
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
                      .replace('https://', '')
                      .replace('http://', '')
                      .replace('www.', '')
                      .replace(/\/$/, '')}
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
