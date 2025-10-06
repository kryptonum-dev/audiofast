import { MapPinIcon } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = 'Mapa kontaktowa';

export const contactMap = defineType({
  name: 'contactMap',
  icon: MapPinIcon,
  type: 'object',
  title,
  description:
    'Sekcja z mapą Google i informacjami kontaktowymi. Domyślnie używa danych z ustawień globalnych.',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description: 'Główny nagłówek nad informacjami kontaktowymi',
      type: 'heading',
    }),
    defineField({
      name: 'useCustomAddress',
      type: 'boolean',
      title: 'Użyj niestandardowych danych kontaktowych',
      description:
        'Włącz tę opcję, aby zastąpić domyślne dane z ustawień globalnych',
      initialValue: false,
    }),
    defineField({
      name: 'customAddress',
      type: 'string',
      title: 'Niestandardowy adres',
      description: 'Adres do wyświetlenia (jeśli włączono nadpisywanie)',
      hidden: ({ parent }) => !parent?.useCustomAddress,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const useCustom = (context.parent as { useCustomAddress?: boolean })
            ?.useCustomAddress;
          if (useCustom && !value) {
            return 'Adres jest wymagany, jeśli używasz niestandardowych danych';
          }
          return true;
        }),
    }),
    defineField({
      name: 'customPhone',
      type: 'string',
      title: 'Niestandardowy telefon',
      description:
        'Numer telefonu do wyświetlenia (jeśli włączono nadpisywanie)',
      hidden: ({ parent }) => !parent?.useCustomAddress,
    }),
    defineField({
      name: 'customEmail',
      type: 'string',
      title: 'Niestandardowy email',
      description: 'Adres email do wyświetlenia (jeśli włączono nadpisywanie)',
      hidden: ({ parent }) => !parent?.useCustomAddress,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const useCustom = (context.parent as { useCustomAddress?: boolean })
            ?.useCustomAddress;
          if (useCustom && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return 'Podaj poprawny adres email';
          }
          return true;
        }),
    }),
    defineField({
      name: 'mapLocation',
      type: 'string',
      title: 'Lokalizacja mapy',
      description:
        'Pełny adres do wyświetlenia na mapie Google (np. "Romanowska 55e, 91-174 Łódź, Polska")',
      validation: (Rule) =>
        Rule.required().error('Lokalizacja mapy jest wymagana'),
    }),
    defineField({
      name: 'mapZoom',
      type: 'number',
      title: 'Poziom zbliżenia mapy',
      description: 'Poziom powiększenia mapy (10-20, domyślnie: 15)',
      initialValue: 15,
      validation: (Rule) =>
        Rule.min(10).max(20).error('Poziom zbliżenia musi być między 10 a 20'),
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      mapLocation: 'mapLocation',
    },
    prepare: ({ heading, mapLocation }) => {
      return {
        title,
        subtitle:
          toPlainText(heading) ||
          mapLocation ||
          'Mapa kontaktowa - czekamy na Ciebie',
        media: MapPinIcon,
      };
    },
  },
});
