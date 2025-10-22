import { ptArrowList } from '../portableText/arrow-list';
import { ptCircleNumberedList } from '../portableText/circle-numbered-list';
import { ptCtaSection } from '../portableText/cta-section';
import { ptImage } from '../portableText/image';
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
  ptArrowList,
  ptCircleNumberedList,
  ptCtaSection,
];
