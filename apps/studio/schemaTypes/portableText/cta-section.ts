import { FeedbackIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptCtaSection = defineType({
  name: 'ptCtaSection',
  type: 'object',
  title: 'Wezwanie do działania',
  icon: FeedbackIcon,
  fields: [
    defineField({
      name: 'heading',
      title: 'Nagłówek',
      type: 'string',
      description: 'Główny nagłówek sekcji CTA',
      validation: (Rule) => Rule.required().error('Nagłówek jest wymagany'),
    }),
    defineField({
      name: 'button',
      title: 'Przycisk',
      type: 'buttonWithNoVariant',
      description: 'Przycisk wezwania do działania',
      validation: (Rule) => Rule.required().error('Przycisk jest wymagany'),
    }),
    defineField({
      name: 'products',
      title: 'Produkty',
      type: 'array',
      description: 'Wybierz 2 produkty do wyświetlenia poniżej tekstu',
      of: [
        {
          type: 'reference',
          to: [{ type: 'product' }],
          options: {
            filter: ({ parent }) => {
              const parentData = parent as any;
              const selectedIds = Array.isArray(parentData?.products)
                ? parentData.products
                    .map((item: any) => item._ref)
                    .filter(Boolean)
                : [];
              return {
                filter: '!(_id in path("drafts.**")) && !(_id in $selectedIds)',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.required().length(2).error('Musisz wybrać dokładnie 2 produkty'),
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      buttonText: 'button.text',
      urlType: 'button.url.type',
      externalUrl: 'button.url.external',
      internalUrl: 'button.url.internal.slug.current',
    },
    prepare: ({ heading, buttonText, urlType, externalUrl, internalUrl }) => {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;
      return {
        title: heading || 'Wezwanie do działania',
        subtitle: buttonText
          ? `${buttonText} → ${truncatedUrl || '(brak linku)'}`
          : 'Brak przycisku',
        media: FeedbackIcon,
      };
    },
  },
});
