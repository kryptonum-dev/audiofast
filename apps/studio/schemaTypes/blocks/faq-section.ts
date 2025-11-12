import { MessageCircleQuestion } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { formState } from '../definitions/form-state';
import { customPortableText } from '../portableText';
import { contactPeopleField } from '../shared';

const title = 'Sekcja FAQ';

export const faqSection = defineType({
  name: 'faqSection',
  title,
  icon: MessageCircleQuestion,
  type: 'object',
  description:
    'Sekcja z najczęściej zadawanymi pytaniami, opcją kontaktu z zespołem i formularzem kontaktowym',
  fields: [
    defineField({
      name: 'displayMode',
      title: 'Co wyświetlić w sekcji',
      type: 'string',
      description: 'Wybierz, które elementy mają być widoczne w tej sekcji',
      options: {
        list: [
          { title: 'FAQ i sekcja kontaktowa', value: 'both' },
          { title: 'Tylko FAQ', value: 'faqOnly' },
          { title: 'Tylko sekcja kontaktowa', value: 'contactOnly' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'both',
      validation: (Rule) =>
        Rule.required().error('Musisz wybrać tryb wyświetlania'),
    }),
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description:
        'Główny tytuł sekcji FAQ, np. "Najczęściej zadawane pytania"',
      type: 'heading',
      validation: (Rule) =>
        Rule.custom((value, { parent }) => {
          const displayMode = (parent as { displayMode?: string })?.displayMode;
          const hiddenForContactOnly = displayMode === 'contactOnly';
          if (hiddenForContactOnly) {
            return true;
          }
          if (!value) {
            return 'Nagłówek jest wymagany gdy sekcja FAQ jest włączona';
          }
          return true;
        }),
      hidden: ({ parent }) =>
        (parent as { displayMode?: string })?.displayMode === 'contactOnly',
    }),
    customPortableText({
      name: 'description',
      title: 'Opis sekcji',
      description:
        'Krótki opis wprowadzający do sekcji FAQ, wyjaśniający czego można się spodziewać',
      validation: (Rule) =>
        Rule.custom((value, { parent }) => {
          const displayMode = (parent as { displayMode?: string })?.displayMode;
          const hiddenForContactOnly = displayMode === 'contactOnly';
          if (hiddenForContactOnly) {
            return true;
          }
          return true;
        }),
      hidden: ({ parent }) =>
        (parent as { displayMode?: string })?.displayMode === 'contactOnly',
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
          const displayMode = (parent as { displayMode?: string })?.displayMode;
          const showFaqList =
            displayMode === 'both' || displayMode === 'faqOnly';
          if (showFaqList && (!value || value.length < 4)) {
            return 'Musisz wybrać co najmniej 4 pytania FAQ gdy lista FAQ jest włączona';
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
      hidden: ({ parent }) => {
        const displayMode = (parent as { displayMode?: string })?.displayMode;
        return displayMode === 'contactOnly';
      },
    }),
    contactPeopleField({
      conditionalValidation: true,
      headingInitialValue: 'Jesteśmy do Twojej dyspozycji!',
      hidden: ({ parent }) => {
        const displayMode = (parent as { displayMode?: string })?.displayMode;
        return displayMode === 'faqOnly';
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
            Rule.custom((value, context) => {
              const document = context.document as any;
              const displayMode = document?.displayMode;
              const showContactSection =
                displayMode === 'both' || displayMode === 'contactOnly';

              if (!showContactSection) {
                return true;
              }

              if (!value) {
                return 'Tekst przycisku jest wymagany';
              }
              return true;
            }),
          initialValue: 'Wyślij wiadomość',
        }),
        {
          ...formState,
          validation: (Rule) =>
            Rule.custom((value, context) => {
              const document = context.document as any;
              const displayMode = document?.displayMode;
              const showContactSection =
                displayMode === 'both' || displayMode === 'contactOnly';

              if (!showContactSection) {
                return true;
              }

              if (!value) {
                return 'Stan formularza jest wymagany';
              }
              return true;
            }),
        },
      ],
      validation: (Rule) =>
        Rule.custom((value, { parent }) => {
          const displayMode = (parent as { displayMode?: string })?.displayMode;
          const showContactSection =
            displayMode === 'both' || displayMode === 'contactOnly';
          if (showContactSection && !value) {
            return 'Formularz kontaktowy jest wymagany gdy sekcja kontaktowa jest włączona';
          }
          return true;
        }),
      hidden: ({ parent }) => {
        const displayMode = (parent as { displayMode?: string })?.displayMode;
        return displayMode === 'faqOnly';
      },
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
      displayMode: 'displayMode',
    },
    prepare: ({ heading, description, displayMode }) => {
      const displayModeText =
        displayMode === 'both'
          ? 'FAQ i kontakt'
          : displayMode === 'faqOnly'
            ? 'Tylko FAQ'
            : displayMode === 'contactOnly'
              ? 'Tylko kontakt'
              : '';
      return {
        title,
        subtitle:
          toPlainText(heading) || toPlainText(description) || displayModeText,
        media: MessageCircleQuestion,
      };
    },
  },
});
