import type { PagebuilderType } from "@/src/global/types";

import PortableText from "../../portableText";
import ContactPerson from "../../ui/ContactPerson";
import ContactFormComponent from "./ContactForm";
import styles from "./styles.module.scss";

export type ContactFormProps = PagebuilderType<"contactForm"> & {
  index: number;
};

export default function ContactForm({
  heading,
  description,
  contactPeople,
  accountList,
  formState,
  index,
}: ContactFormProps) {
  return (
    <section className={`${styles.contactForm} max-width-block`}>
      <header className={styles.header}>
        <PortableText
          value={heading}
          className={styles.heading}
          headingLevel={index === 0 ? "h1" : "h2"}
        />
        <PortableText
          value={description}
          className={styles.description}
          enablePortableTextStyles
        />
      </header>
      <div className={styles.contactPeople}>
        <PortableText
          value={contactPeople!.heading}
          className={styles.heading}
          headingLevel={index === 0 ? "h2" : "h3"}
        />
        <ul className={styles.personList}>
          {contactPeople!.contactPersons!.map((person) => (
            <li key={person._id}>
              <ContactPerson
                person={person}
                id={person._id}
                startPos="left"
                index={index}
              />
            </li>
          ))}
        </ul>
      </div>
      <ul className={styles.accountList}>
        {accountList!.map((account, idx: number) => (
          <li className={styles.accountItem} key={idx}>
            <PortableText
              value={account.heading}
              className={styles.heading}
              headingLevel={index === 0 ? "h3" : "h4"}
            />
            <div className={styles.accountDetails}>
              {account.accountDetails!.map((detail, idx: number) => (
                <span key={idx}>{detail}</span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <ContactFormComponent formState={formState} />
    </section>
  );
}
