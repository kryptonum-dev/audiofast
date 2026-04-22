import type { SanityRawImage } from '@/components/shared/Image';
import Image from '@/components/shared/Image';

import styles from './SupportCard.module.scss';

export type SupportCardData = {
  paragraph?: string | null;
  phoneNumber?: string | null;
  image?: SanityRawImage | null;
};

type SupportCardProps = {
  supportCard?: SupportCardData | null;
};

export default function SupportCard({ supportCard }: SupportCardProps) {
  const paragraph = supportCard?.paragraph?.trim() || null;
  const phoneNumber = supportCard?.phoneNumber?.trim() || null;
  const image = supportCard?.image ?? null;
  const hasSupportCard = Boolean(paragraph || phoneNumber || image);

  if (!hasSupportCard) {
    return null;
  }

  const href = phoneNumber ? `tel:${phoneNumber.replace(/\s/g, '')}` : null;

  return (
    <section className={styles.supportCardSection} aria-label="Wsparcie">
      {href ? (
        <a
          href={href}
          className={styles.supportCardLink}
          aria-label={phoneNumber ?? ''}
        >
          <SupportCardContent image={image} paragraph={paragraph} />
          <div className={styles.supportPhone}>
            <div className={styles.supportPhoneIcon} aria-hidden="true">
              <PhoneIcon />
            </div>
            <span className={styles.supportPhoneText}>{phoneNumber}</span>
          </div>
        </a>
      ) : (
        <div className={styles.supportCard}>
          <SupportCardContent image={image} paragraph={paragraph} />
        </div>
      )}
    </section>
  );
}

function SupportCardContent({
  image,
  paragraph,
}: {
  image: SanityRawImage | null;
  paragraph: string | null;
}) {
  return (
    <>
      {image ? (
        <div className={styles.supportImage}>
          <Image image={image} sizes="64px" />
        </div>
      ) : null}
      {paragraph ? (
        <p className={styles.supportParagraph}>{paragraph}</p>
      ) : null}
    </>
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
