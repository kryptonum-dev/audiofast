import { BlockElementIcon } from '@sanity/icons/BlockElement';
import { ComposeIcon } from '@sanity/icons/Compose';
import { InlineElementIcon } from '@sanity/icons/InlineElement';
import { InsertAboveIcon } from '@sanity/icons/InsertAbove';
import { SearchIcon } from '@sanity/icons/Search';
import { UsersIcon } from '@sanity/icons/Users';
import type { FieldGroupDefinition } from 'sanity';

import {
  LOCAL_WEB_ORIGIN,
  PRODUCTION_WEB_ORIGIN,
} from '../presentation/settings';
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
 * The public site origin, without a trailing slash (slugs start with `/`).
 * The deployed Studio points at production; `sanity dev` at the local web app
 * (P5: no dev-branch deployment URL). Same origins as Presentation
 * (`presentation/settings.ts`).
 * @constant
 * @type {string}
 */
export const WEB_BASE_URL: string = isProduction()
  ? PRODUCTION_WEB_ORIGIN
  : LOCAL_WEB_ORIGIN;
