import { CogIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';
import { GROUP, GROUPS } from '../../../utils/constant';

export const settings = defineType({
  name: 'settings',
  type: 'document',
  title: 'Ustawienia globalne',
  description:
    'Globalne ustawienia i konfiguracja dla Twojej strony internetowej',
  icon: CogIcon,
  groups: GROUPS,
  fields: [
    defineField({
      name: 'email',
      type: 'string',
      title: 'Email kontaktowy',
      group: GROUP.CONTACT,
      validation: (Rule) => Rule.required().email(),
    }),
    defineField({
      name: 'tel',
      type: 'string',
      title: 'Telefon kontaktowy (opcjonalny)',
      group: GROUP.CONTACT,
    }),
    defineField({
      name: 'seo',
      type: 'object',
      title: 'SEO globalne',
      group: GROUP.SEO,
      fields: [
        defineField({
          name: 'img',
          type: 'image',
          title: 'Obraz Open Graph',
          description:
            'Obraz Open Graph jest widoczny podczas udostępniania strony w mediach społecznościowych. Rozmiar obrazu powinien wynosić 1200x630px. Dla maksymalnej kompatybilności, użyj formatów JPG lub PNG, ponieważ WebP może nie być obsługiwany wszędzie.',
          validation: (Rule) => Rule.required(),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: 'contactEmail',
      type: 'string',
      title: 'E-mail kontaktowy',
      description:
        'Główny adres e-mail kontaktowy dla Twojej strony internetowej',
      validation: (rule) => rule.email(),
    }),
  ],
  preview: {
    select: {
      label: 'label',
    },
    prepare: ({ label }) => ({
      title: label || 'Ustawienia globalne',
      media: CogIcon,
    }),
  },
});
