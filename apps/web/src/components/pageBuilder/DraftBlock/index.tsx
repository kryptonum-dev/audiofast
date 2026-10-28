import type { ReactNode } from 'react';

import type { PageBuilderBlock } from '../../shared/PageBuilder';
import styles from './styles.module.scss';

type BlockType = PageBuilderBlock['_type'];

/**
 * The Studio's block titles (`apps/studio/schemaTypes/blocks/*`), so the
 * handle names a section the way the „Page Builder" list in the form does.
 */
const BLOCK_LABELS = {
  heroCarousel: 'Sekcja Hero z karuzelą',
  heroStatic: 'Statyczna sekcja Hero',
  latestPublication: 'Najnowsza publikacja',
  imageTextColumns: 'Obraz i tekst w kolumnach',
  blurLinesTextImage: 'Tekst z obrazem i rozmytymi liniami',
  imageWithVideo: 'Obraz z wideo',
  imageWithTextBoxes: 'Obraz z polami tekstowymi',
  featuredPublications: 'Wyróżnione publikacje',
  featuredProducts: 'Wyróżnione produkty',
  productsCarousel: 'Karuzela produktów',
  cpoProductsListing: 'Lista produktów CPO',
  brandsMarquee: 'Lista marek z tekstem',
  brandsList: 'Lista wszystkich marek',
  brandsByCategoriesSection: 'Marki według kategorii',
  faqSection: 'Sekcja FAQ',
  contactForm: 'Formularz Kontaktowy',
  contactMap: 'Mapa kontaktowa',
  teamSection: 'Sekcja zespołu',
  gallerySection: 'Galeria obrazów',
  phoneImageCta: 'Zdjęcie z telefonem CTA',
  stepList: 'Lista kroków',
} satisfies Record<BlockType, string>;

/**
 * Draft-only wrapper of one PageBuilder block: the `data-sanity` element that
 * makes the whole block click-to-edit and draggable in Presentation.
 *
 * The overlay starts a drag only when the INNERMOST hovered overlay is the
 * block itself (`@sanity/visual-editing` `mousedown`). Headings, text and
 * referenced cards each carry their own overlay, so on content-heavy sections
 * almost every press lands on one of those and nothing moves. The handle has
 * no `data-sanity` and sits above the block's content, so pressing it always
 * hovers the block itself: a drag that starts every time. Plain text only, so
 * no stega ever reaches it; published renders never mount this component.
 *
 * The drop still has to land near the edge between two blocks, where the
 * overlay draws its insert line: a release over the middle of a block
 * inserts nothing (`findClosestIntersection`). The tooltip says so.
 */
export default function DraftBlock({
  type,
  dataSanity,
  children,
}: {
  type: BlockType;
  dataSanity: string;
  children: ReactNode;
}) {
  return (
    <div data-sanity={dataSanity} className={styles.draftBlock}>
      <span
        className={styles.dragHandle}
        title="Przeciągnij, aby przenieść sekcję, i upuść, gdy między sekcjami pojawi się linia. Na długiej stronie przytrzymaj Shift i przewiń, aby zobaczyć całą stronę."
        aria-hidden="true"
      >
        <span className={styles.grip}>⠿</span>
        {BLOCK_LABELS[type] ?? 'Sekcja'}
      </span>
      {children}
    </div>
  );
}
