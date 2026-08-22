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
      name: 'showProducts',
      title: 'Wyświetl produkty',
      type: 'boolean',
      description: 'Czy wyświetlić polecane produkty poniżej tekstu?',
      initialValue: false,
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
                filter:
                  '!(_id in path("drafts.**")) && !(_id in $selectedIds) && isArchived != true',
                params: { selectedIds },
              };
            },
          },
        },
      ],
      hidden: ({ parent }: any) => !parent?.showProducts,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const showProducts = (context.parent as any)?.showProducts;
          if (showProducts && (!value || value.length !== 2)) {
            return 'Musisz wybrać dokładnie 2 produkty gdy opcja "Wyświetl produkty" jest włączona';
          }
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      buttonText: 'button.text',
      urlType: 'button.url.type',
      externalUrl: 'button.url.external',
      internalUrl: 'button.url.internal.slug.current',
      showProducts: 'showProducts',
    },
    prepare: ({
      heading,
      buttonText,
      urlType,
      externalUrl,
      internalUrl,
      showProducts,
    }) => {
      const url = urlType === 'external' ? externalUrl : internalUrl;
      const truncatedUrl =
        url?.length > 30 ? `${url.substring(0, 30)}...` : url;
      const productsLabel = showProducts ? ' • Z produktami' : '';
      return {
        title: heading || 'Wezwanie do działania',
        subtitle: buttonText
          ? `${buttonText} → ${truncatedUrl || '(brak linku)'}${productsLabel}`
          : 'Brak przycisku',
        media: FeedbackIcon,
      };
    },
  },
});
