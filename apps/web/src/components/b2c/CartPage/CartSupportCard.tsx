import Image from '@/components/shared/Image';

import styles from './styles.module.scss';
import type { CartSupportCardData } from './types';

type CartSupportCardProps = {
  supportCard?: CartSupportCardData | null;
};

export default function CartSupportCard({ supportCard }: CartSupportCardProps) {
  const hasSupportCard = Boolean(
    supportCard?.paragraph || supportCard?.phoneNumber || supportCard?.image,
  );

  if (!hasSupportCard) {
    return null;
  }

  const phoneNumber = supportCard?.phoneNumber ?? '';
  const href = phoneNumber ? `tel:${phoneNumber.replace(/\s/g, '')}` : null;

  return (
    <section className={styles.sidebarCard} aria-label="Wsparcie">
      {href ? (
        <a
          href={href}
          className={styles.supportCardLink}
          aria-label={phoneNumber}
        >
          <div className={styles.supportImage}>
            <Image image={supportCard!.image!} sizes="64px" />
          </div>
          <p className={styles.supportParagraph}>{supportCard!.paragraph}</p>
          <div className={styles.supportPhone}>
            <div className={styles.supportPhoneIcon} aria-hidden="true">
              <PhoneIcon />
            </div>
            <span className={styles.supportPhoneText}>{phoneNumber}</span>
          </div>
        </a>
      ) : (
        <div className={styles.supportCard}>
          <div className={styles.supportImage}>
            <Image image={supportCard!.image!} sizes="64px" />
          </div>
          <p className={styles.supportParagraph}>{supportCard!.paragraph}</p>
        </div>
      )}
    </section>
  );
}

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none">
    <g clipPath="url(#support-card-phone-icon)">
      <path
        stroke="#FE0140"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.859}
        d="M3.417 2.454H5.75l1.167 2.917-1.459.875a6.417 6.417 0 0 0 2.917 2.916l.875-1.458 2.917 1.167v2.333A1.167 1.167 0 0 1 11 12.371a9.334 9.334 0 0 1-8.75-8.75 1.167 1.167 0 0 1 1.167-1.167Z"
      />
    </g>
    <defs>
      <clipPath id="support-card-phone-icon">
        <path fill="#fff" d="M.5.121h14v14H.5z" />
      </clipPath>
    </defs>
  </svg>
);
