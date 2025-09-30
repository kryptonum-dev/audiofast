import { MessageCircleQuestion } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { formState } from '../definitions/form-state';
import { customPortableText } from '../definitions/portable-text';

const title = 'Sekcja FAQ';

export const faqSection = defineType({
  name: 'faqSection',
  icon: MessageCircleQuestion,
  type: 'object',
  title,
  description:
    'Sekcja z najczęściej zadawanymi pytaniami, opcją kontaktu z zespołem i formularzem kontaktowym',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description:
        'Główny tytuł sekcji FAQ, np. "Najczęściej zadawane pytania"',
      type: 'heading',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description:
        'Krótki opis wprowadzający do sekcji FAQ, wyjaśniający czego można się spodziewać',
    }),
    defineField({
      name: 'showFaqList',
      title: 'Pokazuj listę FAQ',
      type: 'boolean',
      description: 'Czy wyświetlać listę pytań i odpowiedzi na tej sekcji',
      initialValue: true,
    }),
    defineField({
      name: 'faqList',
      title: 'Lista pytań FAQ',
      type: 'array',
      description:
        'Wybierz pytania i odpowiedzi, które mają być wyświetlane w tej sekcji (minimum 4, maksimum 20)',
      of: [
        {
          type: 'reference',
          to: [{ type: 'faq' }],
          options: {
            disableNew: true,
            filter: ({ parent }) => {
              const selectedIds =
                (parent as { _ref?: string }[])
                  ?.filter((item) => item._ref)
                  .map((item) => item._ref) || [];

              return {
                filter: '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) => [
        Rule.custom((value, { parent }) => {
          const showFaqList = (parent as { showFaqList?: boolean })
            ?.showFaqList;
          if (showFaqList && (!value || value.length < 4)) {
            return 'Musisz wybrać co najmniej 4 pytania FAQ gdy lista jest włączona';
          }
          if (value && value.length > 20) {
            return 'Możesz wybrać maksymalnie 20 pytań FAQ';
          }
          return true;
        }),
        Rule.unique().error(
          'Nie możesz wybrać tego samego pytania więcej niż raz'
        ),
      ],
      hidden: ({ parent }) =>
        !(parent as { showFaqList?: boolean })?.showFaqList,
    }),
    defineField({
      name: 'contactPeople',
      title: 'Osoby kontaktowe',
      type: 'object',
      description: 'Sekcja z osobami, z którymi można się skontaktować',
      fields: [
        customPortableText({
          name: 'heading',
          title: 'Nagłówek sekcji osób kontaktowych',
          description:
            'Tytuł dla sekcji z osobami kontaktowymi, np. "Jesteśmy do Twojej dyspozycji!"',
          type: 'heading',
          initialValue: 'Jesteśmy do Twojej dyspozycji!',
        }),
        defineField({
          name: 'contactPersons',
          title: 'Lista osób kontaktowych',
          type: 'array',
          description: 'Dodaj osoby kontaktowe (minimum 1, maksimum 2)',
          of: [
            defineField({
              name: 'contactPerson',
              title: 'Osoba kontaktowa',
              type: 'object',
              fields: [
                defineField({
                  name: 'image',
                  title: 'Zdjęcie osoby',
                  type: 'image',
                  description: 'Profesjonalne zdjęcie osoby kontaktowej',
                  validation: (Rule) =>
                    Rule.required().error(
                      'Zdjęcie osoby kontaktowej jest wymagane'
                    ),
                }),
                defineField({
                  name: 'name',
                  title: 'Imię i nazwisko',
                  type: 'string',
                  description: 'Pełne imię i nazwisko osoby kontaktowej',
                  validation: (Rule) =>
                    Rule.required().error('Imię i nazwisko jest wymagane'),
                }),
                defineField({
                  name: 'phoneNumber',
                  title: 'Numer telefonu',
                  type: 'string',
                  description: 'Numer telefonu w formacie +48 XXX XXX XXX',
                  validation: (Rule) =>
                    Rule.required().error('Numer telefonu jest wymagany'),
                }),
              ],
              preview: {
                select: {
                  title: 'name',
                  subtitle: 'phoneNumber',
                  media: 'image',
                },
              },
            }),
          ],
          validation: (Rule) => [
            Rule.min(1).error(
              'Musisz dodać co najmniej jedną osobę kontaktową'
            ),
            Rule.max(2).error('Możesz dodać maksymalnie 2 osoby kontaktowe'),
            Rule.required().error('Lista osób kontaktowych jest wymagana'),
          ],
        }),
      ],
      validation: (Rule) =>
        Rule.required().error('Sekcja osób kontaktowych jest wymagana'),
      options: {
        collapsible: true,
        collapsed: false,
      },
    }),
    defineField({
      name: 'contactForm',
      title: 'Formularz kontaktowy',
      type: 'object',
      description: 'Formularz do wysyłania zapytań',
      fields: [
        customPortableText({
          name: 'heading',
          title: 'Nagłówek formularza',
          description:
            'Tytuł dla formularza kontaktowego, np. "Zadaj nam pytanie"',
          type: 'heading',
          initialValue: 'Zadaj nam pytanie',
        }),
        defineField({
          name: 'buttonText',
          title: 'Tekst przycisku',
          type: 'string',
          description: 'Tekst wyświetlany na przycisku wysyłania formularza',
          validation: (Rule) =>
            Rule.required().error('Tekst przycisku jest wymagany'),
          initialValue: 'Wyślij wiadomość',
        }),
        formState,
      ],
      validation: (Rule) =>
        Rule.required().error('Formularz kontaktowy jest wymagany'),
      options: {
        collapsible: true,
        collapsed: false,
      },
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      description: 'description',
      showFaqList: 'showFaqList',
    },
    prepare: ({ heading, description, showFaqList }) => {
      return {
        title,
        subtitle:
          toPlainText(heading) ||
          toPlainText(description) ||
          `FAQ ${showFaqList ? 'z listą pytań' : 'bez listy pytań'}`,
        media: MessageCircleQuestion,
      };
    },
  },
});
