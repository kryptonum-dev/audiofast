import { DocumentIcon } from '@sanity/icons';
import { defineField, defineType } from 'sanity';

import { PathnameFieldComponent } from '../../../components/slug-field-component';
import { GROUP, GROUPS } from '../../../utils/constant';
import { createSlug, isUnique } from '../../../utils/slug';
import { createSlugValidator } from '../../../utils/slug-validation';
import { pageBuilderField } from '../../shared';
import { getSEOFields } from '../../shared/seo';
import { Book } from 'lucide-react';

export const page = defineType({
  name: 'page',
  title: 'Podstrona',
  type: 'document',
  icon: DocumentIcon,
  description:
    "Utwórz nową stronę dla swojej witryny, taką jak 'O nas' lub 'Kontakt'. Każda strona ma swój własny adres internetowy i treść, którą możesz dostosować.",
  groups: GROUPS,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      title: 'Nazwa',
      description:
        'Nazwa dokumentu, używana do wyświetlania w ścieżce nawigacyjnej.',
      group: GROUP.MAIN_CONTENT,
      validation: (Rule) => Rule.required().error('Nazwa strony jest wymagana'),
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
    pageBuilderField,
    ...getSEOFields(),
  ],
  preview: {
    select: {
      name: 'name',
      slug: 'slug.current',
      isPrivate: 'seoNoIndex',
    },
    prepare: ({ name, slug, isPrivate }) => {
      const statusEmoji = isPrivate ? '🔒' : '🌎';

      return {
        media: Book,
        title: `${name || 'Nienazwana podstrona'}`,
        subtitle: `${statusEmoji} | ${slug || 'no-slug'}`,
      };
    },
  },
});
