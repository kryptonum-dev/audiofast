import { ptArrowList } from '../portableText/arrow-list';
import { ptButton } from '../portableText/button';
import { ptCircleNumberedList } from '../portableText/circle-numbered-list';
import { ptCtaSection } from '../portableText/cta-section';
import { ptFeaturedProducts } from '../portableText/featured-products';
import { ptHeading } from '../portableText/heading';
import { ptImage } from '../portableText/image';
import { ptMinimalImage } from '../portableText/minimal-image';
import { ptQuote } from '../portableText/quote';
import { ptTwoColumnTable } from '../portableText/two-column-table';
import { ptYoutubeVideo } from '../portableText/youtube-video';
import { contactPersonField } from '../shared/contact-person';
import { button, buttonWithNoVariant } from './button';
import { customUrl } from './custom-url';
import { formState } from './form-state';
import { pageBuilder } from './pagebuilder';

export const definitions = [
  customUrl,
  button,
  buttonWithNoVariant,
  pageBuilder,
  formState,
  contactPersonField,
  ptImage,
  ptMinimalImage,
  ptArrowList,
  ptCircleNumberedList,
  ptCtaSection,
  ptTwoColumnTable,
  ptFeaturedProducts,
  ptQuote,
  ptButton,
  ptHeading,
  ptYoutubeVideo,
];
