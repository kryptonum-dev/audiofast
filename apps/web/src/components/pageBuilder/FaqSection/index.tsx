import type { FaqSection } from '@/src/global/sanity/sanity.types';
import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import FaqSchema from '../../schema/FaqSchema';
import ContactPerson from '../../ui/ContactPerson';
import ContactForm from './ContactForm';
import FaqList from './FaqList';
import styles from './styles.module.scss';

type FaqSectionProps = PagebuilderType<'faqSection'> & {
  index: number;
};

export default function FaqSection({
  heading,
  description,
  displayMode,
  faqList,
  contactPeople,
  contactForm,
  index,
}: FaqSectionProps) {
  const showFaqList =
    (displayMode === 'both' || displayMode === 'faqOnly') && faqList;
  const showContactSection =
    displayMode === 'both' || displayMode === 'contactOnly';

  return (
    <section className={`${styles.faqSection} max-width`}>
      {showFaqList && <FaqSchema faqList={faqList} />}
      <header className={styles.header}>
        <PortableText
          value={heading}
          className={styles.heading}
          headingLevel={index === 0 ? 'h1' : 'h2'}
        />
        <PortableText value={description} className={styles.description} />
      </header>
      {showFaqList && <FaqList faqList={faqList} />}
      {showContactSection && (
        <>
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
                  index={index}
                />
              ))}
            </div>
          </div>
          <div className={styles.divider}>Lub</div>
          <div className={styles.formWrapper}>
            <ContactForm contactForm={contactForm} index={index} />
          </div>
        </>
      )}
    </section>
  );
}
