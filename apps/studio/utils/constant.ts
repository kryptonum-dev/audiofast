import {
  BlockElementIcon,
  ComposeIcon,
  InlineElementIcon,
  InsertAboveIcon,
  SearchIcon,
  UsersIcon,
} from '@sanity/icons';
import type { FieldGroupDefinition } from 'sanity';

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
