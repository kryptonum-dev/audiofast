import { LinkIcon } from '@sanity/icons';
import type { Rule } from 'sanity';
import { defineArrayMember, defineField } from 'sanity';

import { CustomInput } from '../../components/custom-input';
import { toPlainText } from '../../utils/helper';

// Default building blocks for the portable text "block" member
const ALL_STYLES = [
  { title: 'Normalny', value: 'normal' },
  { title: 'Nagłówek H1', value: 'h1' },
  { title: 'Nagłówek H2', value: 'h2' },
  { title: 'Nagłówek H3', value: 'h3' },
  { title: 'Nagłówek H4', value: 'h4' },
  { title: 'Nagłówek H5', value: 'h5' },
  { title: 'Nagłówek H6', value: 'h6' },
] as const;
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
  const specifiedStyles = include?.styles !== undefined;

  // Default to only 'normal' style if no styles specified
  const finalStyles = specifiedStyles
    ? styles
    : [{ title: 'Normalny', value: 'normal' }];

  return defineArrayMember({
    name: 'block',
    type: 'block',
    styles: finalStyles.length
      ? finalStyles
      : [{ title: 'Normalny', value: 'normal' }],
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
  /** Maksymalna liczba znaków dozwolona w treści Portable Text */
  maxLength?: number;
  /** Alias wspierający literówkę – traktowany tak samo jak maxLength */
  maxLenght?: number;
  /** Początkowa wartość jako zwykły tekst, który zostanie przekonwertowany na bloki Portable Text */
  initialValue?: string;
}) => {
  const {
    name,
    include,
    optional,
    validation,
    type: variant,
    maxLength: maxLengthProp,
    maxLenght: maxLenghtAlias,
    initialValue: initialValueText,
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

  const userMaxLength =
    typeof maxLengthProp === 'number'
      ? maxLengthProp
      : typeof maxLenghtAlias === 'number'
        ? maxLenghtAlias
        : undefined;

  // Compose validation into a single custom rule so the correct message is shown
  const finalValidation = (rule: Rule) => {
    let composed = rule.custom((value) => {
      const isEmpty = !value || !Array.isArray(value) || value.length === 0;
      if (isEmpty) {
        return optional ? true : 'To pole jest wymagane';
      }
      if (typeof userMaxLength === 'number' && userMaxLength > 0) {
        const plain = toPlainText(value as any);
        const len = plain.trim().length;
        if (len > userMaxLength) {
          return `Przekroczono maksymalną długość tekstu: ${userMaxLength} znaków (obecnie ${len}).`;
        }
      }
      return true;
    }) as unknown as Rule;

    // Allow caller to chain more rules if needed
    if (typeof validation === 'function') {
      composed = validation(composed) as Rule;
    }

    return composed;
  };

  // Convert initial value string to portable text blocks
  const initialValueBlocks = initialValueText
    ? [
        {
          _key: `initial-block-${Math.random().toString(36).substr(2, 9)}`,
          _type: 'block',
          children: [
            {
              _key: `initial-span-${Math.random().toString(36).substr(2, 9)}`,
              _type: 'span',
              marks: [],
              text: initialValueText,
            },
          ],
          markDefs: [],
          style: 'normal',
        },
      ]
    : undefined;

  return defineField({
    ...rest,
    name: name ?? 'portableText',
    type: 'array',
    of: ofMembers,
    validation: finalValidation as any,
    ...(initialValueBlocks ? { initialValue: initialValueBlocks } : {}),
    components: {
      // @ts-ignore
      input: CustomInput,
    },
  });
};
