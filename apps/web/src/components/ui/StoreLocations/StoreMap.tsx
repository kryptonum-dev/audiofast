'use client';

import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

import type { StoreWithLocation } from './index';

// Custom SVG marker icon
const createCustomIcon = (isSelected: boolean) => {
  const color = isSelected ? '#C54E47' : '#333333';
  const svg = `
    <svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41C12.5 41 25 21.9 25 12.5C25 5.6 19.4 0 12.5 0Z" 
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12.5" cy="12.5" r="5" fill="white"/>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'custom-marker-icon',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

interface MapUpdaterProps {
  selectedStoreId: string | null;
  stores: StoreWithLocation[];
}

function MapUpdater({ selectedStoreId, stores }: MapUpdaterProps) {
  const map = useMap();
  const prevSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      selectedStoreId &&
      selectedStoreId !== prevSelectedIdRef.current &&
      stores
    ) {
      const selectedStore = stores.find(
        (store) => store._id === selectedStoreId,
      );
      if (selectedStore?.location) {
        map.setView(
          [selectedStore.location.lat, selectedStore.location.lng],
          13,
          { animate: true },
        );
      }
      prevSelectedIdRef.current = selectedStoreId;
    }
  }, [selectedStoreId, stores, map]);

  return null;
}

interface StoreMapProps {
  stores: StoreWithLocation[];
  mapCenter: [number, number];
}

export default function StoreMap({ stores, mapCenter }: StoreMapProps) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Handle marker click - scroll to store in list
  const handleMarkerClick = (storeId: string) => {
    setSelectedStoreId(storeId);
    const storeElement = document.getElementById(storeId);
    if (storeElement) {
      storeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  };

  // Listen for store clicks from the list (if we want to highlight on map)
  useEffect(() => {
    const handleStoreClick = (e: Event) => {
      const customEvent = e as CustomEvent<{ storeId: string }>;
      if (customEvent.detail?.storeId) {
        setSelectedStoreId(customEvent.detail.storeId);
      }
    };

    window.addEventListener('store-selected', handleStoreClick);
    return () => window.removeEventListener('store-selected', handleStoreClick);
  }, []);

  return (
    <MapContainer
      center={mapCenter}
      zoom={stores.length === 1 ? 13 : 6}
      style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapUpdater selectedStoreId={selectedStoreId} stores={stores} />
      {stores.map((store) => {
        if (!store.location) return null;

        return (
          <Marker
            key={store._id}
            position={[store.location.lat, store.location.lng]}
            icon={createCustomIcon(selectedStoreId === store._id)}
            eventHandlers={{
              click: () => {
                handleMarkerClick(store._id);
              },
            }}
          >
            <Popup>
              <div style={{ minWidth: '200px' }}>
                <strong style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                  {store.name}
                </strong>
                {store.address && (
                  <p
                    style={{
                      fontSize: '0.875rem',
                      margin: '0.5rem 0',
                      color: '#666',
                    }}
                  >
                    {store.address.street}
                    <br />
                    {store.address.postalCode} {store.address.city}
                  </p>
                )}
                {store.phone && (
                  <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                    <a
                      href={`tel:${store.phone}`}
                      style={{ color: '#C54E47', textDecoration: 'none' }}
                    >
                      {store.phone}
                    </a>
                  </p>
                )}
                {store.website && (
                  <p style={{ fontSize: '0.875rem', margin: '0.25rem 0' }}>
                    <a
                      href={store.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#C54E47', textDecoration: 'none' }}
                    >
                      Odwiedź stronę →
                    </a>
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
