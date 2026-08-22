import styles from './styles.module.scss';

/**
 * Shared placeholder for the map pane. Used both while the Leaflet bundle is
 * being loaded on the client (`StoreMapWrapper`) and while the geocoded stores
 * are still streaming in on the server (`StoreLocationsSkeleton`), so the two
 * loading states are visually identical.
 */
export default function MapSkeleton() {
  return (
    <div className={styles.mapSkeleton}>
      <div className={styles.skeletonPulse}>
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
            fill="currentColor"
            opacity="0.3"
          />
        </svg>
        <p>Ładowanie mapy...</p>
      </div>
    </div>
  );
}
