import { StarIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

export const ptReviewEmbed = defineType({
  name: 'ptReviewEmbed',
  type: 'object',
  title: 'Osadzona recenzja',
  icon: StarIcon,
  description: 'Wyświetla kartę recenzji inline w treści',
  fields: [
    defineField({
      name: 'review',
      title: 'Recenzja',
      type: 'reference',
      to: [{ type: 'review' }],
      validation: (Rule) =>
        Rule.required().error('Wybierz recenzję do osadzenia'),
    }),
  ],
  preview: {
    select: {
      reviewTitle: 'review.name',
      reviewImage: 'review.previewImage',
    },
    prepare: ({ reviewTitle, reviewImage }) => ({
      title: reviewTitle || 'Osadzona recenzja',
      subtitle: 'Karta recenzji inline',
      media: reviewImage || StarIcon,
    }),
  },
});
