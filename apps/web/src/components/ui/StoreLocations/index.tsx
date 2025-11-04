import styles from './styles.module.scss';

export default function StoreLocations() {
  // Dummy store data
  const dummyStores = [
    {
      name: 'Salon AudioFast Warszawa',
      address: 'ul. Marszałkowska 15, 00-624 Warszawa',
      phone: '+48 22 123 45 67',
      website: 'https://www.audiofast.pl',
    },
    {
      name: 'Salon AudioFast Kraków',
      address: 'ul. Floriańska 10, 31-019 Kraków',
      phone: '+48 12 345 67 89',
      website: 'https://www.audiofast.pl',
    },
    {
      name: 'Salon AudioFast Gdańsk',
      address: 'ul. Długi Targ 28, 80-828 Gdańsk',
      phone: '+48 58 765 43 21',
      website: 'https://www.audiofast.pl',
    },
  ];

  return (
    <section className={styles.storeLocations}>
      <div className={styles.container}>
        <div className={styles.mapContainer}>
          <div className={styles.map} />
        </div>
        <div className={styles.storesContainer}>
          <h2 className={styles.heading}>Gdzie kupić</h2>
          <div className={styles.storesList}>
            {dummyStores.map((store, index) => (
              <div key={index} className={styles.store}>
                <div className={styles.storeInfo}>
                  <h3 className={styles.storeName}>{store.name}</h3>
                  <p className={styles.storeAddress}>{store.address}</p>
                </div>
                <div className={styles.storeContact}>
                  {store.phone && (
                    <div className={styles.contactItem}>
                      <div className={styles.icon}>
                        <PhoneIcon />
                      </div>
                      <span className={styles.contactText}>{store.phone}</span>
                    </div>
                  )}
                  {store.website && (
                    <div className={styles.contactItem}>
                      <div className={styles.icon}>
                        <LinkIcon />
                      </div>
                      <a
                        href={store.website}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.contactText}
                      >
                        {store.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const PhoneIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 15 15"
    fill="none"
    width="14"
    height="14"
  >
    <g clipPath="url(#phone-clip)">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.859}
        d="M3.417 2.454H5.75l1.167 2.917-1.459.875a6.417 6.417 0 0 0 2.917 2.916l.875-1.458 2.917 1.167v2.333A1.167 1.167 0 0 1 11 12.371a9.334 9.334 0 0 1-8.75-8.75 1.167 1.167 0 0 1 1.167-1.167Z"
      />
    </g>
    <defs>
      <clipPath id="phone-clip">
        <path fill="#fff" d="M.5.121h14v14H.5z" />
      </clipPath>
    </defs>
  </svg>
);

const LinkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 15 15"
    fill="none"
    width="14"
    height="14"
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={0.859}
      d="M4.5 10.5L10.5 4.5M10.5 4.5H6M10.5 4.5V9"
    />
  </svg>
);

