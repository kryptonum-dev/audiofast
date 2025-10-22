import { PackageIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptFeaturedProducts = defineType({
  name: 'ptFeaturedProducts',
  type: 'object',
  title: 'Polecane produkty',
  icon: PackageIcon,
  fields: [
    defineField({
      name: 'products',
      title: 'Produkty',
      type: 'array',
      description: 'Wybierz 2 produkty do wyświetlenia obok siebie',
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
      product0: 'products.0.name',
      product1: 'products.1.name',
    },
    prepare: ({ product0, product1 }) => {
      const hasProducts = product0 && product1;
      return {
        title: 'Polecane produkty',
        subtitle: hasProducts
          ? `${product0} • ${product1}`
          : 'Nie wybrano produktów',
        media: PackageIcon,
      };
    },
  },
});

