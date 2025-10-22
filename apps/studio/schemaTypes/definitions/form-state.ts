import { defineField } from 'sanity';

import { customPortableText } from '../portableText';

export const formState = defineField({
  name: 'formState',
  type: 'object',
  title: 'Stan formularza',
  fields: [
    defineField({
      name: 'success',
      type: 'object',
      title: 'Sukces',
      fields: [
        defineField({
          type: 'boolean',
          name: 'withIcon',
          title: 'Czy ma ikonę?',
          initialValue: true,
        }),
        customPortableText({
          name: 'heading',
          title: 'Nagłówek',
          type: 'heading',
        }),
        customPortableText({
          name: 'paragraph',
          title: 'Paragraf',
        }),
        defineField({
          name: 'refreshButton',
          type: 'boolean',
          title: 'Przycisk odświeżenia',
          validation: (Rule) => Rule.required(),
          initialValue: true,
        }),

        defineField({
          name: 'refreshButtonText',
          type: 'string',
          title: 'Tekst przycisku odświeżenia',
          hidden: ({ parent }) => !parent?.refreshButton,
          validation: (Rule) =>
            Rule.custom((value, { parent }) => {
              if (
                !value &&
                (parent as { refreshButton?: boolean })?.refreshButton
              )
                return 'Tekst przycisku odświeżenia jest wymagany';
              return true;
            }),
          initialValue: 'Odśwież',
        }),
      ],
      validation: (Rule) => Rule.required(),
      options: {
        collapsible: true,
        collapsed: false,
      },
    }),
    defineField({
      name: 'error',
      type: 'object',
      title: 'Błąd',
      fields: [
        defineField({
          type: 'boolean',
          name: 'withIcon',
          title: 'Czy ma ikonę?',
          initialValue: true,
        }),
        customPortableText({
          name: 'heading',
          title: 'Nagłówek',
          type: 'heading',
        }),
        customPortableText({
          name: 'paragraph',
          title: 'Paragraf',
        }),
        defineField({
          name: 'refreshButton',
          type: 'boolean',
          title: 'Przycisk odświeżenia',
          validation: (Rule) => Rule.required(),
          initialValue: true,
        }),

        defineField({
          name: 'refreshButtonText',
          type: 'string',
          title: 'Tekst przycisku odświeżenia',
          hidden: ({ parent }) => !parent?.refreshButton,
          validation: (Rule) =>
            Rule.custom((value, { parent }) => {
              if (
                !value &&
                (parent as { refreshButton?: boolean })?.refreshButton
              )
                return 'Tekst przycisku odświeżenia jest wymagany';
              return true;
            }),
          initialValue: 'Odśwież',
        }),
      ],
      validation: (Rule) => Rule.required(),
      options: {
        collapsible: true,
        collapsed: false,
      },
    }),
  ],
  initialValue: {
    error: {
      withIcon: true,
      heading: [
        {
          _key: '8a0d68722eaf',
          _type: 'block',
          children: [
            {
              _key: 'b0c030ee3f460',
              _type: 'span',
              marks: [],
              text: 'Ups… coś poszło nie tak. Spróbuj ponownie.',
            },
          ],
          markDefs: [],
          style: 'normal',
        },
      ],
      paragraph: [
        {
          _key: 'ebb0292e568a',
          _type: 'block',
          children: [
            {
              _key: '640c8ab70cba0',
              _type: 'span',
              marks: [],
              text: 'Niestety nie udało się wysłać formularza. Mogło to być spowodowane chwilowym problemem technicznym lub brakiem połączenia z internetem.',
            },
          ],
          markDefs: [],
          style: 'normal',
        },
      ],
      refreshButton: true,
      refreshButtonText: 'Spróbuj ponownie',
    },
    success: {
      withIcons: true,
      heading: [
        {
          _key: '4b59f811d0a8',
          _type: 'block',
          children: [
            {
              _key: '539e16d1343b0',
              _type: 'span',
              marks: [],
              text: 'Dziękujemy za wysłanie nam wiadomości!',
            },
          ],
          markDefs: [],
          style: 'normal',
        },
      ],
      paragraph: [
        {
          _key: 'ab95362f4845',
          _type: 'block',
          children: [
            {
              _key: 'b1c1d6105cb50',
              _type: 'span',
              marks: [],
              text: 'Nasz zespół skontaktuje się z Tobą tak szybko, jak to możliwe.',
            },
          ],
          markDefs: [],
          style: 'normal',
        },
      ],
      refreshButton: false,
    },
  },
  validation: (Rule) => Rule.required(),
});
