import { PlayIcon } from '@sanity/icons';
import { parseYouTubeUrl } from '@workspace/youtube';
import { defineField, defineType } from 'sanity';

import { YouTubeDocumentInput } from '../../../components/youtube-document-input';
import { customPortableText } from '../../portableText';

export const youtubeVideo = defineType({
  name: 'youtubeVideo',
  title: 'Film YouTube',
  type: 'document',
  icon: PlayIcon,
  components: { input: YouTubeDocumentInput },
  initialValue: () => ({ publishedDate: new Date().toISOString() }),
  fields: [
    defineField({
      name: 'videoUrl',
      title: 'Link do filmu YouTube',
      type: 'url',
      description:
        'Link do pojedynczego filmu z dowolnego kanału, również youtu.be, Shorts lub nagranie transmisji.',
      validation: (Rule) =>
        Rule.required().custom((value) =>
          !value || parseYouTubeUrl(value)
            ? true
            : 'Wklej poprawny link HTTPS do pojedynczego filmu YouTube.',
        ),
    }),
    defineField({
      name: 'name',
      title: 'Tytuł filmu',
      type: 'string',
      validation: (Rule) => Rule.required().max(250),
    }),
    customPortableText({
      name: 'description',
      title: 'Opis (opcjonalnie)',
      optional: true,
      include: {
        styles: ['normal'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
    }),
    defineField({
      name: 'image',
      title: 'Miniatura',
      type: 'image',
      options: { hotspot: true },
      description: 'Pobierana z YouTube. Możesz zastąpić ją własnym obrazem.',
      fields: [
        defineField({
          name: 'alt',
          title: 'Opis obrazu',
          type: 'string',
          validation: (Rule) => Rule.required(),
        }),
      ],
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'publishedDate',
      title: 'Data publikacji na Audiofast',
      type: 'datetime',
      description:
        'Decyduje o kolejności nowości i zakresie dat newslettera. Nie musi odpowiadać dacie filmu na YouTube.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'metadataVideoId',
      type: 'string',
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: 'importedTitle',
      type: 'string',
      hidden: true,
      readOnly: true,
    }),
    defineField({
      name: 'importedImageRef',
      type: 'string',
      hidden: true,
      readOnly: true,
    }),
  ],
  orderings: [
    {
      title: 'Najnowsze',
      name: 'publishedDateDesc',
      by: [{ field: 'publishedDate', direction: 'desc' }],
    },
  ],
  preview: { select: { title: 'name', media: 'image', subtitle: 'videoUrl' } },
});
