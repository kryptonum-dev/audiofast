import type { FaqSection } from '@/src/global/sanity/sanity.types';

import PortableText from '../../shared/PortableText';
import ContactPerson from '../../ui/ContactPerson';
import ContactForm from './ContactForm';
import FaqList from './FaqList';
import styles from './styles.module.scss';

// Extract the FAQ section type from the resolved query result

export default function FaqSection({
  heading,
  description,
  showFaqList,
  faqList,
  contactPeople,
  contactForm,
  index,
}: FaqSection & { index: number }) {
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
            <ContactPerson
              person={person}
              id={idx.toString()}
              key={idx}
              className={styles.faqPerson}
            />
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
