import { LinkIcon } from '@sanity/icons';
import type { Rule } from 'sanity';
import { defineArrayMember, defineField } from 'sanity';

import { CustomInput } from '../../components/custom-input';

// Default building blocks for the portable text "block" member
const ALL_STYLES = [{ title: 'Normalny', value: 'normal' }] as const;
const ALL_LISTS = [
  { title: 'Numerowana', value: 'number' },
  { title: 'Wypunktowana', value: 'bullet' },
] as const;
const ALL_DECORATORS = [
  { title: 'Pogrubienie', value: 'strong' },
  { title: 'Kursywa', value: 'em' },
] as const;
const ALL_ANNOTATIONS = [
  {
    name: 'customLink',
    type: 'object' as const,
    title: 'Link wewnętrzny/zewnętrzny',
    icon: LinkIcon,
    fields: [
      defineField({
        name: 'customLink',
        type: 'customUrl',
      }),
    ],
  },
] as const;

type PortableTextInclude = {
  members?: ReadonlyArray<'block'>;
  styles?: ReadonlyArray<(typeof ALL_STYLES)[number]['value']>;
  lists?: ReadonlyArray<(typeof ALL_LISTS)[number]['value']>;
  decorators?: ReadonlyArray<(typeof ALL_DECORATORS)[number]['value']>;
  annotations?: ReadonlyArray<(typeof ALL_ANNOTATIONS)[number]['name']>;
};

function filterByKey<T extends Record<string, any>, K extends keyof T>(
  items: readonly T[],
  allowed: ReadonlyArray<string> | undefined,
  key: K
) {
  if (allowed === undefined) return items as T[]; // undefined => all
  if (Array.isArray(allowed) && allowed.length === 0) return [] as T[]; // [] => none
  return (items as T[]).filter((item) => allowed.includes(String(item[key])));
}

function buildBlockMember(include?: PortableTextInclude) {
  const styles = filterByKey(ALL_STYLES, include?.styles, 'value');
  const lists = filterByKey(ALL_LISTS, include?.lists, 'value');
  const annotations = filterByKey(
    ALL_ANNOTATIONS,
    include?.annotations,
    'name'
  );
  const decorators = filterByKey(ALL_DECORATORS, include?.decorators, 'value');

  // Build marks config: if caller specified annotations/decorators, honor them
  // even when empty (to explicitly disable). Otherwise fall back to defaults.
  const specifiedAnnotations = include?.annotations !== undefined;
  const specifiedDecorators = include?.decorators !== undefined;
  const hasExplicitMarks = specifiedAnnotations || specifiedDecorators;

  const marks = hasExplicitMarks
    ? {
        ...(specifiedAnnotations ? { annotations } : {}),
        ...(specifiedDecorators ? { decorators } : {}),
      }
    : {
        annotations,
        decorators,
      };

  const specifiedLists = include?.lists !== undefined;

  return defineArrayMember({
    name: 'block',
    type: 'block',
    styles: styles.length ? styles : (ALL_STYLES as unknown as any[]),
    ...(specifiedLists ? { lists } : {}),
    marks,
  });
}

// Note: We intentionally export only the builder below.

// Builder for configurable fields. Defaults to all members & marks.
export const customPortableText = (options?: {
  name?: string;
  title?: string;
  group?: string;
  description?: string;
  validation?: (rule: Rule) => unknown;
  optional?: boolean;
  type?: 'default' | 'heading';
  include?: PortableTextInclude;
}) => {
  const {
    name,
    include,
    optional,
    validation,
    type: variant,
    ...rest
  } = options ?? {};

  // Determine include config (heading enforces bold-only, no lists/annotations, normal style)
  const effectiveInclude: PortableTextInclude | undefined =
    variant === 'heading'
      ? {
          styles: ['normal'],
          lists: [],
          decorators: ['strong'],
          annotations: [],
        }
      : include;

  // Currently only the "block" member is available. This is structured
  // to be easily extended with additional members in the future.
  const members = (effectiveInclude?.members ?? ['block']).includes('block')
    ? [buildBlockMember(effectiveInclude)]
    : [];

  const ofMembers =
    members.length > 0 ? members : [buildBlockMember(effectiveInclude)];

  const finalValidation =
    validation ??
    (optional
      ? undefined
      : (rule: Rule) => rule.required().error('To pole jest wymagane'));

  return defineField({
    ...rest,
    name: name ?? 'portableText',
    type: 'array',
    of: ofMembers,
    ...(finalValidation ? { validation: finalValidation } : {}),
    components: {
      // @ts-ignore
      input: CustomInput,
    },
  });
};
