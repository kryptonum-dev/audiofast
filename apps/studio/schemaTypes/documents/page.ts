import { DocumentIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { PathnameFieldComponent } from '../../components/slug-field-component';
import { GROUP, GROUPS } from '../../utils/constant';
import { createSlug, isUnique } from '../../utils/slug';
import { createSlugValidator } from '../../utils/slug-validation';
import { pageBuilderField } from '../shared';
import { ogFields, seoFields } from '../shared/seo';

export const page = defineType({
  name: 'page',
  title: 'Strona',
  type: 'document',
  icon: DocumentIcon,
  description:
    "Utwórz nową stronę dla swojej witryny, taką jak 'O nas' lub 'Kontakt'. Każda strona ma swój własny adres internetowy i treść, którą możesz dostosować.",
  groups: GROUPS,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      title: 'Tytuł',
      description:
        'Główny nagłówek, który pojawia się na górze strony i w zakładkach przeglądarki',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) => Rule.required().error('Tytuł strony jest wymagany'),
    }),
    defineField({
      name: 'description',
      type: 'text',
      title: 'Opis',
      description:
        'Krótkie podsumowanie tego, o czym jest ta strona. Ten tekst pomaga wyszukiwarkom zrozumieć Twoją stronę i może pojawić się w wynikach wyszukiwania.',
      rows: 3,
      group: GROUP.MAIN_CONTENT,
      validation: (rule) => [
        rule
          .min(140)
          .warning(
            'Meta opis powinien mieć co najmniej 140 znaków dla optymalnej widoczności SEO w wynikach wyszukiwania',
          ),
        rule
          .max(160)
          .warning(
            'Meta opis nie powinien przekraczać 160 znaków, ponieważ zostanie obcięty w wynikach wyszukiwania',
          ),
      ],
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      title: 'Adres URL',
      description:
        "Adres internetowy dla tej strony (na przykład, '/o-nas' utworzy stronę pod adresem twoja-domena.com/o-nas)",
      group: GROUP.MAIN_CONTENT,
      components: {
        field: PathnameFieldComponent,
      },
      options: {
        source: 'title',
        slugify: createSlug,
        isUnique,
      },
      validation: (Rule) =>
        Rule.required()
          .error('Slug URL jest wymagany dla strony')
          .custom((slug) => {
            // First run basic validation
            const basicValidation = createSlugValidator({
              documentType: 'Strona',
            })(slug);

            if (basicValidation !== true) return basicValidation;

            // Then check that pages don't use blog prefixes
            if (slug?.current?.startsWith('/blog')) {
              return 'Strony nie mogą używać prefiksu "/blog" - jest zarezerwowany dla treści bloga';
            }

            return true;
          }),
    }),
    defineField({
      name: 'image',
      type: 'image',
      title: 'Obraz',
      description:
        'Główny obraz dla tej strony, który może być używany podczas udostępniania w mediach społecznościowych lub w wynikach wyszukiwania',
      group: GROUP.MAIN_CONTENT,
      options: {
        hotspot: true,
      },
    }),
    pageBuilderField,
    ...seoFields.filter((field) => field.name !== 'seoHideFromLists'),
    ...ogFields,
  ],
  preview: {
    select: {
      title: 'title',
      slug: 'slug.current',
      media: 'image',
      isPrivate: 'seoNoIndex',
      hasPageBuilder: 'pageBuilder',
    },
    prepare: ({ title, slug, media, isPrivate, hasPageBuilder }) => {
      const statusEmoji = isPrivate ? '🔒' : '🌎';
      const builderEmoji = hasPageBuilder?.length
        ? `🧱 ${hasPageBuilder.length}`
        : '🏗️';

      return {
        title: `${title || 'Untitled Page'}`,
        subtitle: `${statusEmoji} ${builderEmoji} | 🔗 ${slug || 'no-slug'}`,
        media,
      };
    },
  },
});
