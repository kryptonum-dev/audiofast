import { defineField } from 'sanity';

import { GROUP } from '../../utils/constant';

export const seoFields = [
  defineField({
    name: 'seoTitle',
    title: 'Nadpisanie meta tytułu SEO',
    description:
      'To nadpisze meta tytuł. Jeśli pozostanie puste, odziedziczy tytuł strony.',
    type: 'string',
    validation: (rule) => rule.warning('Tytuł strony jest wymagany'),
    group: GROUP.SEO,
  }),
  defineField({
    name: 'seoDescription',
    title: 'Nadpisanie meta opisu SEO',
    description:
      'To nadpisze meta opis. Jeśli pozostanie puste, odziedziczy opis ze strony.',
    type: 'text',
    rows: 2,
    validation: (rule) => [
      rule.warning('Opis jest wymagany'),
      rule.max(160).warning('Nie więcej niż 160 znaków'),
    ],
    group: GROUP.SEO,
  }),
  defineField({
    name: 'seoImage',
    title: 'Nadpisanie obrazu SEO',
    description:
      'To nadpisze główny obraz. Jeśli pozostanie puste, odziedziczy obraz z głównego obrazu.',
    type: 'image',
    group: GROUP.SEO,
    options: {
      hotspot: true,
    },
  }),
  defineField({
    name: 'seoNoIndex',
    title: 'Nie indeksuj tej strony',
    description:
      'Jeśli zaznaczone, ta treść nie będzie indeksowana przez wyszukiwarki.',
    type: 'boolean',
    initialValue: () => false,
    group: GROUP.SEO,
  }),
  defineField({
    name: 'seoHideFromLists',
    title: 'Ukryj z list',
    description:
      'Jeśli zaznaczone, ta treść nie pojawi się na żadnych stronach z listami.',
    type: 'boolean',
    initialValue: () => false,
    group: GROUP.SEO,
  }),
];

export const ogFields = [
  defineField({
    name: 'ogTitle',
    title: 'Nadpisanie tytułu Open Graph',
    description:
      'To nadpisze tytuł Open Graph. Jeśli pozostanie puste, odziedziczy tytuł strony.',
    type: 'string',
    validation: (Rule) => Rule.warning('Tytuł strony jest wymagany'),
    group: GROUP.OG,
  }),
  defineField({
    name: 'ogDescription',
    title: 'Nadpisanie opisu Open Graph',
    description:
      'To nadpisze meta opis. Jeśli pozostanie puste, odziedziczy opis ze strony.',
    type: 'text',
    rows: 2,
    validation: (Rule) => [
      Rule.warning('Opis jest wymagany'),
      Rule.max(160).warning('Nie więcej niż 160 znaków'),
    ],
    group: GROUP.OG,
  }),
];
