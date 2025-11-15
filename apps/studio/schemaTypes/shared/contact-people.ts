import type { FieldDefinition } from 'sanity';
import { defineField } from 'sanity';

import { customPortableText } from '../portableText';

export interface ContactPeopleFieldOptions {
  /**
   * Whether validation should be conditional based on displayMode (for FAQ section)
   * If false, field is always required (for Contact Form)
   */
  conditionalValidation?: boolean;
  /**
   * Initial value for the heading field
   */
  headingInitialValue?: string;
  /**
   * Function to determine if field should be hidden (for FAQ section)
   */
  hidden?: (context: { parent?: any }) => boolean;
}

/**
 * Reusable contact people field definition
 * Used in both FAQ section and Contact Form blocks
 */
export const contactPeopleField = (
  options: ContactPeopleFieldOptions = {}
): FieldDefinition<'object'> => {
  const {
    conditionalValidation = false,
    headingInitialValue,
    hidden,
  } = options;

  // Common validation for contactPersons array
  // Always validates min/max and duplicates when array exists
  const getContactPersonsValidation = (Rule: any) => {
    return [
      Rule.min(1).error('Musisz wybrać co najmniej jedną osobę kontaktową'),
      Rule.max(2).error('Możesz wybrać maksymalnie 2 osoby kontaktowe'),
      Rule.custom((value: any) => {
        // Check for duplicates
        const ids =
          value?.map((ref: unknown) => (ref as { _ref?: string })?._ref) || [];
        const hasDuplicates = ids.length !== new Set(ids).size;
        if (hasDuplicates) {
          return 'Nie możesz wybrać tej samej osoby więcej niż raz';
        }
        return true;
      }).error('Nie możesz wybrać tej samej osoby więcej niż raz'),
    ];
  };

  // Validation for contactPeople object
  // Makes the whole object required or optional based on displayMode
  const getContactPeopleValidation = (Rule: any) => {
    if (conditionalValidation) {
      // FAQ section: conditional - required when displayMode is 'both' or 'contactOnly'
      return Rule.custom((value: any, { parent }: any) => {
        // parent is the immediate parent (faqSection object) which contains displayMode
        const displayMode = (parent as { displayMode?: string })?.displayMode;

        // If displayMode is not found, allow (field might be hidden or not yet set)
        if (!displayMode) {
          return true;
        }

        const showContactSection =
          displayMode === 'both' || displayMode === 'contactOnly';

        if (showContactSection && (!value.heading || !value.contactPersons)) {
          return 'Sekcja osób kontaktowych jest wymagana gdy sekcja kontaktowa jest włączona';
        }
        return true;
      });
    } else {
      // Contact Form: always required
      return Rule.custom((value: any) => {
        if (!value?.heading || !value?.contactPersons) {
          return 'Sekcja osób kontaktowych jest wymagana';
        }
        return true;
      });
    }
  };

  return defineField({
    name: 'contactPeople',
    title: 'Osoby kontaktowe',
    type: 'object',
    description: 'Sekcja z osobami, z którymi można się skontaktować',
    fields: [
      customPortableText({
        name: 'heading',
        title: 'Nagłówek sekcji osób kontaktowych',
        description:
          'Tytuł dla sekcji z osobami kontaktowymi, np. "Jesteśmy do Twojej dyspozycji!"',
        type: 'heading',
        ...(headingInitialValue && { initialValue: headingInitialValue }),
      }),
      defineField({
        name: 'contactPersons',
        title: 'Lista osób kontaktowych',
        type: 'array',
        description:
          'Wybierz członków zespołu jako osoby kontaktowe (minimum 1, maksimum 2)',
        of: [
          {
            type: 'reference',
            to: [{ type: 'teamMember' }],
            options: {
              disableNew: true,
              filter: ({ parent }) => {
                const selectedIds =
                  (parent as { _ref?: string }[])
                    ?.filter((item) => item._ref)
                    .map((item) => item._ref) || [];

                return {
                  filter:
                    '!(_id in $selectedIds) && !(_id in path("drafts.**"))',
                  params: { selectedIds },
                };
              },
            },
          },
        ],
        validation: getContactPersonsValidation,
      }),
    ],
    validation: getContactPeopleValidation,
    ...(hidden && { hidden }),
    options: {
      collapsible: true,
      collapsed: false,
    },
  });
};
