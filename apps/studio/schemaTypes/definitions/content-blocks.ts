import { BlockContentIcon, DocumentVideoIcon, RemoveIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { toPlainText } from '../../utils/helper';
import { customPortableText } from '../portableText';

/**
 * Content Block: Text
 * Rich text section with inline images, links, YouTube/Vimeo videos, and page breaks
 */
export const contentBlockText = defineType({
  name: 'contentBlockText',
  type: 'object',
  title: 'Blok tekstowy',
  icon: BlockContentIcon,
  description:
    'Sekcja z tekstem sformatowanym, możliwością dodawania zdjęć, linków, filmów YouTube/Vimeo i podziałów kolumn.',
  fields: [
    customPortableText({
      name: 'content',
      title: 'Treść',
      description:
        'Tekst z formatowaniem i elementami multimedialnymi. Możesz dodać maksymalnie jeden podział kolumn.',
      include: {
        styles: ['normal', 'h3', 'blockquote'],
        lists: ['bullet', 'number'],
        decorators: ['strong', 'em'],
        annotations: ['customLink'],
      },
      components: [
        'ptMinimalImage',
        'ptInlineImage',
        'ptHeading',
        'ptYoutubeVideo',
        'ptVimeoVideo',
        'ptPageBreak',
      ],
      validation: (Rule) =>
        Rule.required()
          .error('Treść bloku jest wymagana')
          .custom((value) => {
            if (!value || !Array.isArray(value)) return true;

            // Count page breaks in the content
            const pageBreakCount = value.filter(
              (item: any) => item?._type === 'ptPageBreak'
            ).length;

            if (pageBreakCount > 1) {
              return 'Możesz dodać maksymalnie jeden podział kolumn w bloku tekstowym (max 2 kolumny)';
            }

            return true;
          }),
    }),
  ],
  preview: {
    select: {
      content: 'content',
    },
    prepare: ({ content }) => {
      const text = toPlainText(content);
      const truncated =
        text.length > 80 ? `${text.substring(0, 80)}...` : text;
      return {
        title: 'Blok tekstowy',
        subtitle: truncated || 'Brak treści',
        media: BlockContentIcon,
      };
    },
  },
});

/**
 * Content Block: YouTube Video
 * Standalone YouTube video embed (full width, not inline)
 */
export const contentBlockYoutube = defineType({
  name: 'contentBlockYoutube',
  type: 'object',
  title: 'Wideo YouTube',
  icon: DocumentVideoIcon,
  description: 'Osadzone wideo YouTube wyświetlane na pełną szerokość.',
  fields: [
    defineField({
      name: 'youtubeId',
      title: 'ID wideo YouTube',
      type: 'string',
      description:
        'Wprowadź ID wideo YouTube (np. dla https://www.youtube.com/watch?v=dQw4w9WgXcQ, ID to: dQw4w9WgXcQ)',
      validation: (Rule) =>
        Rule.required().error('ID wideo YouTube jest wymagane'),
    }),
    defineField({
      name: 'title',
      title: 'Tytuł wideo',
      type: 'string',
      description:
        'Tytuł wyświetlany w prawym górnym rogu miniaturki (opcjonalne).',
    }),
    defineField({
      name: 'thumbnail',
      title: 'Miniatura wideo',
      type: 'image',
      description:
        'Opcjonalna miniatura wideo. Jeśli nie zostanie wybrana, zostanie użyta domyślna miniatura YouTube.',
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      youtubeId: 'youtubeId',
      title: 'title',
      thumbnail: 'thumbnail',
    },
    prepare: ({ youtubeId, title, thumbnail }) => ({
      title: title || 'Wideo YouTube',
      subtitle: youtubeId ? `ID: ${youtubeId}` : 'Brak ID',
      media: thumbnail || DocumentVideoIcon,
    }),
  },
});

/**
 * Content Block: Vimeo Video
 * Standalone Vimeo video embed (full width, not inline)
 */
export const contentBlockVimeo = defineType({
  name: 'contentBlockVimeo',
  type: 'object',
  title: 'Wideo Vimeo',
  icon: DocumentVideoIcon,
  description: 'Osadzone wideo Vimeo wyświetlane na pełną szerokość.',
  fields: [
    defineField({
      name: 'vimeoId',
      title: 'ID wideo Vimeo',
      type: 'string',
      description:
        'Wprowadź ID wideo Vimeo (np. dla https://vimeo.com/328584595, ID to: 328584595)',
      validation: (Rule) =>
        Rule.required().error('ID wideo Vimeo jest wymagane'),
    }),
    defineField({
      name: 'title',
      title: 'Tytuł wideo',
      type: 'string',
      description:
        'Tytuł wyświetlany w prawym górnym rogu miniaturki (opcjonalne).',
    }),
    defineField({
      name: 'thumbnail',
      title: 'Miniatura wideo',
      type: 'image',
      description:
        'Opcjonalna miniatura wideo. Jeśli nie zostanie wybrana, zostanie użyta domyślna miniatura Vimeo.',
      options: { hotspot: true },
    }),
  ],
  preview: {
    select: {
      vimeoId: 'vimeoId',
      title: 'title',
      thumbnail: 'thumbnail',
    },
    prepare: ({ vimeoId, title, thumbnail }) => ({
      title: title || 'Wideo Vimeo',
      subtitle: vimeoId ? `ID: ${vimeoId}` : 'Brak ID',
      media: thumbnail || DocumentVideoIcon,
    }),
  },
});

/**
 * Content Block: Horizontal Line
 * Visual separator between content sections
 */
export const contentBlockHorizontalLine = defineType({
  name: 'contentBlockHorizontalLine',
  type: 'object',
  title: 'Linia pozioma',
  icon: RemoveIcon,
  description: 'Pozioma linia oddzielająca sekcje treści.',
  fields: [
    defineField({
      name: 'style',
      title: 'Styl',
      type: 'string',
      initialValue: 'horizontalLine',
      hidden: true,
      readOnly: true,
    }),
  ],
  preview: {
    prepare: () => ({
      title: 'Linia pozioma',
      subtitle: 'Wizualny separator',
      media: RemoveIcon,
    }),
  },
});

