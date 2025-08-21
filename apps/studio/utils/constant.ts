import {
  BlockElementIcon,
  ComposeIcon,
  InlineElementIcon,
  InsertAboveIcon,
  SearchIcon,
  UsersIcon,
} from '@sanity/icons';
import type { FieldGroupDefinition } from 'sanity';
import { isProduction } from './helper';

export const GROUP = {
  SEO: 'seo',
  MAIN_CONTENT: 'main-content',
  CARD: 'card',
  RELATED: 'related',
  OG: 'og',
  CONTACT: 'contact',
};

export const GROUPS: FieldGroupDefinition[] = [
  // { name: CONST.MAIN_CONTENT, default: true },
  {
    name: GROUP.MAIN_CONTENT,
    icon: ComposeIcon,
    title: 'Treść',
  },
  {
    name: GROUP.CONTACT,
    icon: UsersIcon,
    title: 'Dane kontaktowe',
  },
  { name: GROUP.SEO, icon: SearchIcon, title: 'SEO' },
  {
    name: GROUP.OG,
    icon: InsertAboveIcon,
    title: 'Open Graph (OG)',
  },
  {
    name: GROUP.CARD,
    icon: BlockElementIcon,
    title: 'Karty',
  },
  {
    name: GROUP.RELATED,
    icon: InlineElementIcon,
    title: 'Powiązane',
  },
];

/**
 * Global declaration of the base url for the application.
 * This constant is used for constructing full URLs and determining external links.
 * @constant
 * @type {string}
 */
export const WEB_BASE_URL: string = isProduction()
  ? 'https://www.audiofast.pl/'
  : 'http://localhost:3000';
