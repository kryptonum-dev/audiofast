import { CogIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

const socialLinks = defineField({
  name: 'socialLinks',
  title: 'Linki mediów społecznościowych',
  description: 'Dodaj linki do swoich profili w mediach społecznościowych',
  type: 'object',
  options: {},
  fields: [
    defineField({
      name: 'linkedin',
      title: 'URL LinkedIn',
      description: 'Pełny URL do Twojego profilu LinkedIn/strony firmy',
      type: 'string',
    }),
    defineField({
      name: 'facebook',
      title: 'URL Facebook',
      description: 'Pełny URL do Twojego profilu/strony Facebook',
      type: 'string',
    }),
    defineField({
      name: 'twitter',
      title: 'URL Twitter/X',
      description: 'Pełny URL do Twojego profilu Twitter/X',
      type: 'string',
    }),
    defineField({
      name: 'instagram',
      title: 'URL Instagram',
      description: 'Pełny URL do Twojego profilu Instagram',
      type: 'string',
    }),
    defineField({
      name: 'youtube',
      title: 'URL YouTube',
      description: 'Pełny URL do Twojego kanału YouTube',
      type: 'string',
    }),
  ],
});

export const settings = defineType({
  name: 'settings',
  type: 'document',
  title: 'Ustawienia',
  description:
    'Globalne ustawienia i konfiguracja dla Twojej strony internetowej',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'label',
      type: 'string',
      initialValue: 'Ustawienia',
      title: 'Etykieta',
      description: 'Etykieta używana do identyfikacji ustawień w CMS',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'siteTitle',
      type: 'string',
      title: 'Tytuł strony',
      description:
        'Główny tytuł Twojej strony internetowej, używany w zakładkach przeglądarki i SEO',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'siteDescription',
      type: 'text',
      title: 'Opis strony',
      description: 'Krótki opis Twojej strony internetowej dla celów SEO',
      validation: (rule) => rule.required().min(50).max(160),
    }),
    defineField({
      name: 'logo',
      type: 'image',
      title: 'Logo strony',
      description: 'Prześlij logo swojej strony internetowej',
      options: {
        hotspot: true,
      },
    }),
    defineField({
      name: 'contactEmail',
      type: 'string',
      title: 'E-mail kontaktowy',
      description:
        'Główny adres e-mail kontaktowy dla Twojej strony internetowej',
      validation: (rule) => rule.email(),
    }),
    socialLinks,
  ],
  preview: {
    select: {
      title: 'label',
    },
    prepare: ({ title }) => ({
      title: title || 'Untitled Settings',
      media: CogIcon,
    }),
  },
});
