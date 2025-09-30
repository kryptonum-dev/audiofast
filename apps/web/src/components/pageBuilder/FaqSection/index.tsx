import type { QueryHomePageResult } from '@/src/global/sanity/sanity.types';

import Image from '../../shared/Image';
import PortableText from '../../shared/PortableText';
import ContactForm from './ContactForm';
import FaqList from './FaqList';
import styles from './styles.module.scss';

// Extract the FAQ section type from the resolved query result
export type ResolvedFaqSection = Extract<
  NonNullable<NonNullable<QueryHomePageResult>['pageBuilder']>[number],
  { _type: 'faqSection' }
> & {
  index: number;
};

export default function FaqSection({
  heading,
  description,
  showFaqList,
  faqList,
  contactPeople,
  contactForm,
  index,
}: ResolvedFaqSection) {
  return (
    <section className={`${styles.faqSection} max-width`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          className={styles.heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
        />
        <PortableText value={description} className={styles.description} />
      </header>
      {showFaqList && <FaqList faqList={faqList!} />}
      <div className={styles.contactPeople}>
        <PortableText
          value={contactPeople!.heading}
          className={styles.heading}
          headingLevel={index === 0 ? 'h2' : 'h3'}
        />
        <div className={styles.personList}>
          {contactPeople!.contactPersons!.map((person, idx) => (
            <a href={`tel:${person.phoneNumber}`} key={idx}>
              <span className={styles.name}>{person.name}</span>
              <span className={styles.phone}>{person.phoneNumber}</span>
              <div className={styles.iconContainer}>
                <PhoneIcon />
              </div>
              <div className={styles.imageContainer}>
                <Image image={person.image} sizes="55px" />
              </div>
            </a>
          ))}
        </div>
      </div>
      <div className={styles.divider}>Lub</div>
      <div className={styles.formWrapper}>
        <ContactForm contactForm={contactForm} index={index} />
      </div>
    </section>
  );
}

const PhoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15" fill="none">
    <g clipPath="url(#a)">
      <path
        stroke="#FE0140"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={0.859}
        d="M3.417 2.454H5.75l1.167 2.917-1.459.875a6.417 6.417 0 0 0 2.917 2.916l.875-1.458 2.917 1.167v2.333A1.167 1.167 0 0 1 11 12.371a9.334 9.334 0 0 1-8.75-8.75 1.167 1.167 0 0 1 1.167-1.167Z"
      />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M.5.121h14v14H.5z" />
      </clipPath>
    </defs>
  </svg>
);
