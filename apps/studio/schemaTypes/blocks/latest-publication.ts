import { Newspaper } from 'lucide-react';
import { defineField, defineType } from 'sanity';

import { customPortableText } from '../definitions/portable-text';

export const latestPublication = defineType({
  name: 'latestPublication',
  title: 'Najnowsza publikacja',
  icon: Newspaper,
  type: 'object',
  description:
    'Sekcja wyświetlająca najnowszą publikację - może być to artykuł blogowy lub recenzja produktu',
  fields: [
    customPortableText({
      name: 'heading',
      title: 'Nagłówek sekcji',
      description:
        'Główny nagłówek sekcji najnowszej publikacji (np. "Najnowsza publikacja")',
      type: 'heading',
      maxLength: 60,
    }),
    defineField({
      name: 'publication',
      title: 'Wybierz publikację',
      type: 'reference',
      description:
        'Wybierz najnowszą publikację do wyświetlenia - może być to artykuł blogowy lub recenzja',
      to: [{ type: 'blog-article' }, { type: 'review' }],
      validation: (Rule) => Rule.required().error('Publikacja jest wymagana'),
    }),
  ],
  preview: {
    select: {
      heading: 'heading',
      publication: 'publication',
      publicationType: 'publication._type',
      title: 'publication.title',
      name: 'publication.name',
    },
    prepare: ({ heading, publication, publicationType, title, name }) => {
      // Get heading text if available
      const headingText =
        heading?.[0]?.children?.[0]?.text || 'Najnowsza publikacja';

      // Get display name - prefer title if it's portable text, fallback to name
      const displayName = title || name || 'Brak tytułu';

      // Determine publication type for subtitle
      const typeLabel =
        publicationType === 'blog-article' ? 'Artykuł blogowy' : 'Recenzja';

      return {
        title: headingText,
        subtitle: publication
          ? `${typeLabel}: ${displayName}`
          : 'Nie wybrano publikacji',
        media: Newspaper,
      };
    },
  },
});
