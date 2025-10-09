import { Star } from 'lucide-react';
import { defineArrayMember, defineField, defineType } from 'sanity';

import { parsePortableTextToString } from '../../utils/helper';
import { customPortableText } from '../definitions/portable-text';

const title = 'Sekcja Hero z karuzelą';

export const heroCarousel = defineType({
  name: 'heroCarousel',
  title,
  icon: Star,
  type: 'object',
  fields: [
    defineField({
      name: 'slides',
      type: 'array',
      title: 'Slajdy',
      description:
        'Dodaj jeden lub więcej slajdów do karuzeli hero. Każdy slajd może zawierać obraz, nagłówek, tekst i przycisk',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'heroSlide',
          title: 'Slajd Hero',
          fields: [
            customPortableText({
              name: 'title',
              title: 'Nagłówek',
              description: 'Główny nagłówek slajdu',
              type: 'heading',
              maxLength: 90,
            }),
            customPortableText({
              name: 'description',
              title: 'Paragraf',
              description: 'Tekst opisowy pod tytułem',
              maxLength: 350,
            }),
            defineField({
              name: 'image',
              title: 'Zdjęcie w tle',
              type: 'image',
              description:
                'Główne zdjęcie slajdu (automatycznie optymalizowane dla różnych urządzeń)',
              options: {
                hotspot: true,
              },

              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'button',
              title: 'Przycisk',
              type: 'button',
              description:
                'Główny przycisk wezwania do działania dla tego slajdu',
              validation: (Rule) => Rule.required(),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              description: 'description',
              media: 'image',
            },
            prepare: ({ title, description, media }) => {
              const titleText = parsePortableTextToString(title);
              const descriptionText = parsePortableTextToString(description);

              return {
                title:
                  titleText === 'No Content'
                    ? 'Slajd bez tytułu'
                    : titleText || 'Slajd bez tytułu',
                subtitle:
                  descriptionText === 'No Content'
                    ? 'Slajd Hero'
                    : descriptionText || 'Slajd Hero',
                media,
              };
            },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.min(1)
          .error('Minimum 1 slajd')
          .max(5)
          .error('Maksimum 5 slajdów')
          .required()
          .error('Slajdy są wymagane'),
    }),
    defineField({
      name: 'brands',
      title: 'Marki',
      type: 'array',
      description: 'Wybierz marki do wyświetlenia pod sekcją hero',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'brand' }],
        }),
      ],
      validation: (Rule) => [
        Rule.min(6).error('Minimum 6 marek'),
        Rule.max(16).error('Maksimum 16 marek'),
        Rule.required().error('Marki są wymagane'),
      ],
    }),
  ],
  preview: {
    select: {
      slides: 'slides',
      brands: 'brands',
    },
    prepare: ({ slides, brands }) => {
      const slideCount = slides?.length || 0;
      const brandCount = brands?.length || 0;

      // Polish pluralization for slides (slajd)
      const getSlideText = (count: number) => {
        if (count === 1) return 'slajd';
        if (count >= 2 && count <= 4) return 'slajdy';
        return 'slajdów'; // 0, 5+
      };

      // Polish pluralization for brands (marka)
      const getBrandText = (count: number) => {
        if (count === 1) return 'marka';
        if (count >= 2 && count <= 4) return 'marki';
        return 'marek'; // 0, 5+
      };

      return {
        title,
        subtitle: `${slideCount} ${getSlideText(slideCount)}, ${brandCount} ${getBrandText(brandCount)}`,
      };
    },
  },
});
