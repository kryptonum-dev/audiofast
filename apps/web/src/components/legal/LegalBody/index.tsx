import type { PortableTextProps } from '@/global/types';

import PortableText from '../../portableText';
import TableOfContent from '../../ui/TableOfContent';
import styles from './styles.module.scss';
type Props = {
  headings: PortableTextProps[];
  name: string;
  description: PortableTextProps;
  content: PortableTextProps;
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
