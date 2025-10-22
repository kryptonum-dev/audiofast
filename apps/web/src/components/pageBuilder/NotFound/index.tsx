import { urlFor } from '@/global/sanity/client';

import type { QueryNotFoundPageResult } from '../../../global/sanity/sanity.types';
import PortableText from '../../portableText';
import Button from '../../ui/Button';
import styles from './styles.module.scss';

type NotFoundProps = NonNullable<QueryNotFoundPageResult>;

export default async function NotFound({
  backgroundImage,
  heading,
  description,
  buttons,
}: NotFoundProps) {
  const bgImageUrl = urlFor({
    asset: { _ref: backgroundImage!.id },
    ...(backgroundImage!.hotspot && { hotspot: backgroundImage!.hotspot }),
    ...(backgroundImage!.crop && { crop: backgroundImage!.crop }),
  })
    .width(500)
    .height(282)
    .fit('crop')
    .auto('format')
    .quality(80)
    .url();

  return (
    <section className={styles.notFound}>
      <span
        className={styles.fourOhFour}
        style={{
          ...(bgImageUrl && {
            backgroundImage: `url(${bgImageUrl})`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }),
        }}
      >
        404
      </span>
      <PortableText
        value={heading}
        headingLevel="h1"
        className={styles.heading}
      />
      <PortableText
        value={description}
        className={styles.description}
        enablePortableTextStyles
      />
      <nav className={styles.buttons}>
        {buttons!.map((button) => (
          <Button key={button._key} {...button} />
        ))}
      </nav>
    </section>
  );
}
