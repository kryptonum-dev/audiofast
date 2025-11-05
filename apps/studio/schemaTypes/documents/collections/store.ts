import { MapPin } from 'lucide-react';
import { defineField, defineType } from 'sanity';

export const store = defineType({
  name: 'store',
  title: 'Salon',
  type: 'document',
  icon: MapPin,
  description:
    'Salon sprzedaży produktów audio. Dodaj nazwę, adres i informacje kontaktowe salonu.',
  fields: [
    defineField({
      name: 'name',
      title: 'Nazwa',
      type: 'string',
      validation: (Rule) => Rule.required().error('Nazwa jest wymagana'),
    }),
    defineField({
      name: 'address',
      title: 'Adres',
      type: 'object',
      description: 'Pełny adres salonu',
      fields: [
        defineField({
          name: 'postalCode',
          title: 'Kod pocztowy',
          type: 'string',
          description: 'Kod pocztowy w formacie xx-xxx (np. 00-001)',
          validation: (Rule) =>
            Rule.required()
              .regex(/^\d{2}-\d{3}$/, {
                name: 'postal-code',
                invert: false,
              })
              .error('Kod pocztowy musi być w formacie xx-xxx (np. 00-001)'),
        }),
        defineField({
          name: 'city',
          title: 'Miasto',
          type: 'string',
          description: 'Nazwa miasta',
          validation: (Rule) => Rule.required().error('Miasto jest wymagane'),
        }),
        defineField({
          name: 'street',
          title: 'Ulica i numer',
          type: 'string',
          description: 'Ulica i numer budynku (np. ul. Marszałkowska 1)',
          validation: (Rule) =>
            Rule.required().error('Ulica i numer są wymagane'),
        }),
      ],
      validation: (Rule) => Rule.required().error('Adres jest wymagany'),
    }),
    defineField({
      name: 'phone',
      title: 'Numer telefonu',
      type: 'string',
      description: 'Numer telefonu zaczynający się od +48',
      validation: (Rule) =>
        Rule.required()
          .regex(/^\+48\d{9}$/, {
            name: 'phone',
            invert: false,
          })
          .error(
            'Numer telefonu musi zaczynać się od +48 i zawierać 9 kolejnych cyfr (np. +48123456789)'
          ),
    }),
    defineField({
      name: 'website',
      title: 'Strona internetowa',
      type: 'url',
      description: 'Link do strony internetowej salonu (opcjonalne)',
    }),
  ],
  preview: {
    select: {
      name: 'name',
      city: 'address.city',
      street: 'address.street',
    },
    prepare: ({ name, city, street }) => ({
      title: name || 'Salon',
      media: MapPin,
      subtitle:
        city && street
          ? `${street}, ${city}`
          : city || street || 'Salon sprzedaży',
    }),
  },
});
