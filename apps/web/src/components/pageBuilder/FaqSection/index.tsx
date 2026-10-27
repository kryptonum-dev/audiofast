import {
  dataSanity,
  type ScopedDataAttribute,
} from '@/src/global/sanity/data-attribute';
import type { PagebuilderType } from '@/src/global/types';

import PortableText from '../../portableText';
import FaqSchema from '../../schema/FaqSchema';
import ContactPerson from '../../ui/ContactPerson';
import ContactForm from './ContactForm';
import FaqList from './FaqList';
import styles from './styles.module.scss';

type FaqSectionProps = PagebuilderType<'faqSection'> & {
  index: number;
  isDraft?: boolean;
  /**
   * Draft only: pre-scoped to this block. Items address the AUTHORED reference
   * item (`faqList[_key==…]`, `contactPeople.contactPersons[_key==…]`) so they
   * are draggable; the stega text inside still opens the referenced document.
   */
  dataAttribute?: ScopedDataAttribute;
};

export default function FaqSection({
  heading,
  description,
  displayMode,
  faqList,
  contactPeople,
  contactForm,
  index,
  dataAttribute,
}: FaqSectionProps) {
  // `FaqList` is a client island: pre-built strings per faq `_id`.
  const faqDataSanity = dataAttribute
    ? Object.fromEntries(
        (faqList ?? []).map((faq) => [
          faq._id,
          dataSanity(dataAttribute, ['faqList', { _key: faq._key }]),
        ]),
      )
    : undefined;

  const showFaqList =
    (displayMode === 'both' || displayMode === 'faqOnly') && faqList;
  const showContactSection =
    displayMode === 'both' || displayMode === 'contactOnly';

  const isContactOnly = displayMode === 'contactOnly';

  return (
    <section
      className={`${styles.faqSection} max-width`}
      data-display-mode={displayMode}
    >
      {showFaqList && <FaqSchema faqList={faqList} />}
      {!isContactOnly && (
        <header className={styles.header}>
          <PortableText
            value={heading}
            className={styles.heading}
            headingLevel={index === 0 ? 'h1' : 'h2'}
          />
          {description && (
            <PortableText value={description} className={styles.description} />
          )}
        </header>
      )}
      {showFaqList && (
        <FaqList faqList={faqList} dataSanityById={faqDataSanity} />
      )}
      {showContactSection && (
        <>
          <div className={styles.contactPeople}>
            <PortableText
              value={contactPeople!.heading}
              className={styles.heading}
              headingLevel={
                isContactOnly
                  ? index === 0
                    ? 'h1'
                    : 'h2'
                  : index === 0
                    ? 'h2'
                    : 'h3'
              }
            />
            <div className={styles.personList}>
              {contactPeople!.contactPersons!.map((person) => (
                <ContactPerson
                  person={person}
                  id={person._id}
                  key={person._id}
                  className={styles.faqPerson}
                  index={index}
                  dataSanity={dataSanity(dataAttribute, [
                    'contactPeople',
                    'contactPersons',
                    { _key: person._key },
                  ])}
                />
              ))}
            </div>
          </div>
          <div className={styles.divider}>Lub</div>
          <div className={styles.formWrapper}>
            <ContactForm
              contactForm={contactForm}
              index={index}
              isContactOnly={isContactOnly}
            />
          </div>
        </>
      )}
    </section>
  );
}
