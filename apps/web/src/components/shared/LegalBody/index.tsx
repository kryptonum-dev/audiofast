import type { PortableTextValue } from '@/global/types';

import TableOfContent from '../../ui/TableOfContent';
import PortableText from '../PortableText';
import styles from './styles.module.scss';
type Props = {
  headings: PortableTextValue[];
  name: string;
  description: PortableTextValue;
  content: PortableTextValue;
};

export function LegalBody({ headings, name, description, content }: Props) {
  return (
    <article className={styles.container + ' content'}>
      <TableOfContent headings={headings} />
      <header className={styles.header}>
        <h1 className={styles.heading}>{name}</h1>
        <PortableText value={description} className={styles.description} />
      </header>
      <PortableText
        enablePortableTextStyles
        addHeadingIds
        value={content}
        className={`${styles.body} content-body`}
      />
    </article>
  );
}
