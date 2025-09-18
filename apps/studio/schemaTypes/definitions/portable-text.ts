import { LinkIcon } from '@sanity/icons';
import { defineArrayMember, defineField, defineType } from 'sanity';

import { CustomInput } from '../../components/custom-input';

const portableTextMembers = [
  defineArrayMember({
    name: 'block',
    type: 'block',
    styles: [{ title: 'Normalny', value: 'normal' }],
    lists: [
      { title: 'Numerowana', value: 'number' },
      { title: 'Wypunktowana', value: 'bullet' },
    ],
    marks: {
      annotations: [
        {
          name: 'customLink',
          type: 'object',
          title: 'Link wewnętrzny/zewnętrzny',
          icon: LinkIcon,
          fields: [
            defineField({
              name: 'customLink',
              type: 'customUrl',
            }),
          ],
        },
      ],
      decorators: [
        { title: 'Pogrubienie', value: 'strong' },
        { title: 'Kursywa', value: 'em' },
      ],
    },
  }),
];

export const portableText = defineType({
  name: 'portableText',
  components: {
    // @ts-ignore
    input: CustomInput,
  },
  type: 'array',
  of: portableTextMembers,
});

export const portableTextHeading = defineType({
  name: 'portableTextHeading',
  components: {
    // @ts-ignore
    input: CustomInput,
  },
  type: 'array',
  of: [
    defineArrayMember({
      type: 'block',
      styles: [{ title: 'Normalny', value: 'normal' }],
      lists: [],
      marks: {
        annotations: [],
        decorators: [{ title: 'Pogrubienie', value: 'strong' }],
      },
    }),
  ],
});

export const memberTypes = portableTextMembers.map((member) => member.name);

type Type = NonNullable<(typeof memberTypes)[number]>;

export const customPortableText = (
  type: Type[],
  options?: { name?: string; title?: string; group?: string }
) => {
  const { name } = options ?? {};
  const customMembers = portableTextMembers.filter(
    (member) => member.name && type.includes(member.name)
  );
  return defineField({
    ...options,
    name: name ?? 'portableText',
    type: 'array',
    of: customMembers,
    components: {
      // @ts-ignore
      input: CustomInput,
    },
  });
};
