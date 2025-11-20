import type { QuerySettingsResult } from '@/src/global/sanity/sanity.types';
import type { PagebuilderType } from '@/src/global/types';

import { sanityFetch } from '../../../global/sanity/fetch';
import { querySettings } from '../../../global/sanity/query';
import PortableText from '../../portableText';
import styles from './styles.module.scss';

type ContactMapProps = PagebuilderType<'contactMap'> & {
  index: number;
};

export default async function ContactMap({
  heading,
  useCustomAddress,
  customAddress,
  customPhone,
  customEmail,
  index,
}: ContactMapProps) {
  const settings = useCustomAddress
    ? null
    : await sanityFetch<QuerySettingsResult>({
        query: querySettings,
        tags: ['settings'],
      });

  // Format structured address into display string
  const formatAddress = (
    addr:
      | {
          streetAddress: string | null;
          postalCode: string | null;
          city: string | null;
          country: string | null;
        }
      | null
      | undefined
  ) => {
    if (!addr) return '';
    const parts = [addr.postalCode, addr.city, addr.streetAddress].filter(
      Boolean
    );
    return parts.join(', ');
  };

  const displayAddress = useCustomAddress
    ? customAddress
    : settings?.address
      ? formatAddress(settings.address)
      : '';
  const displayPhone = useCustomAddress ? customPhone : settings?.tel;
  const displayEmail = useCustomAddress ? customEmail : settings?.email;

  const mapEmbedUrl =
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2283.2174136792655!2d19.321189992147254!3d51.806389516969325!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x471bb4c103ae231b%3A0xe875c89c1b5fb082!2sAUDIOFAST%20Sp.%20z%20o.o.!5e1!3m2!1spl!2spl!4v1759732361294!5m2!1spl!2spl';

  return (
    <section className={styles.contactMap}>
      <header className={styles.content}>
        <PortableText
          value={heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
          className={styles.heading}
        />
        <div className={`${styles.contactItem} ${styles.addressItem}`}>
          <div className={styles.iconContainer}>
            <PinIcon />
          </div>
          <span>{displayAddress}</span>
        </div>
        {displayPhone && (
          <a
            href={`tel:${displayPhone.replace(/\s/g, '')}`}
            className={`${styles.contactItem} ${styles.phoneItem}`}
          >
            <div className={styles.iconContainer}>
              <PhoneIcon />
            </div>
            <span>{displayPhone}</span>
          </a>
        )}
        {displayEmail && (
          <a
            href={`mailto:${displayEmail}`}
            className={`${styles.contactItem} ${styles.emailItem}`}
          >
            <div className={styles.iconContainer}>
              <ChatIcon />
            </div>
            <span>{displayEmail}</span>
          </a>
        )}
      </header>
      <div className={styles.mapContainer}>
        <iframe
          src={mapEmbedUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading={index === 0 ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer-when-downgrade"
          title="Lokalizacja na mapie"
        />
      </div>
    </section>
  );
}

const PinIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={21} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M12.499 4.25 9.165 7.583l-3.333 1.25-1.25 1.25 5.833 5.834 1.25-1.25 1.25-3.334L16.25 8M7.5 13l-3.75 3.75M12.082 3.833l4.583 4.584" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .5h20v20H0z" />
      </clipPath>
    </defs>
  </svg>
);

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={19} fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#FE0140"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.203}
        d="M4.458 3.166h3.167l1.583 3.958L7.23 8.312a8.709 8.709 0 0 0 3.958 3.958l1.188-1.979 3.958 1.583v3.167a1.583 1.583 0 0 1-1.583 1.583A12.666 12.666 0 0 1 2.875 4.75a1.583 1.583 0 0 1 1.583-1.583Z"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M.5 0h19v19H.5z" />
      </clipPath>
    </defs>
  </svg>
);

const ChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={21} fill="none">
    <g
      stroke="#FE0140"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="m17.499 12.167-2.5-2.5H9.165a.833.833 0 0 1-.833-.834v-5A.833.833 0 0 1 9.165 3h7.5a.833.833 0 0 1 .834.833v8.334ZM11.667 13v1.667a.833.833 0 0 1-.834.833H5L2.5 18V9.667a.833.833 0 0 1 .833-.834H5" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 .5h20v20H0z" />
      </clipPath>
    </defs>
  </svg>
);
