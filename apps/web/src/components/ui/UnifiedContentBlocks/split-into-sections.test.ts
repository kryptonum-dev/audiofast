import { describe, expect, it } from 'vitest';

import type { PortableTextProps } from '@/src/global/types';

import { splitIntoSections } from './split-into-sections';

const text = (key: string) => ({ _type: 'block', _key: key });
const pageBreak = { _type: 'ptPageBreak', _key: 'break' };
const newSection = { _type: 'ptTwoColumnLine', _key: 'section' };
const line = { _type: 'ptHorizontalLine', _key: 'line' };

const split = (items: unknown[]) =>
  splitIntoSections(items as PortableTextProps).map((section) =>
    section.type === 'single'
      ? { single: (section.content ?? []).map((item) => item._key) }
      : {
          left: (section.leftContent ?? []).map((item) => item._key),
          right: (section.rightContent ?? []).map((item) => item._key),
        },
  );

describe('splitIntoSections', () => {
  it('renders content without markers as one column', () => {
    expect(split([text('a'), text('b')])).toEqual([{ single: ['a', 'b'] }]);
  });

  it('splits a section at the page break', () => {
    expect(split([text('a'), pageBreak, text('b')])).toEqual([
      { left: ['a'], right: ['b'] },
    ]);
  });

  it('handles one column, two columns, one column', () => {
    expect(
      split([
        text('intro'),
        newSection,
        text('l'),
        pageBreak,
        text('r'),
        newSection,
        text('outro'),
      ]),
    ).toEqual([
      { single: ['intro'] },
      { left: ['l'], right: ['r'] },
      { single: ['outro'] },
    ]);
  });

  it('renders a section without a page break as one column', () => {
    // Presence: sections separated by "new section, line, new section"
    expect(
      split([
        text('l1'),
        pageBreak,
        text('r1'),
        newSection,
        line,
        newSection,
        text('a'),
        text('b'),
        newSection,
        line,
        newSection,
        text('l2'),
        pageBreak,
        text('r2'),
      ]),
    ).toEqual([
      { left: ['l1'], right: ['r1'] },
      { single: ['line'] },
      { single: ['a', 'b'] },
      { single: ['line'] },
      { left: ['l2'], right: ['r2'] },
    ]);
  });

  it('renders one column when a side of the page break is empty', () => {
    expect(split([text('a'), pageBreak])).toEqual([{ single: ['a'] }]);
    expect(split([pageBreak, text('b')])).toEqual([{ single: ['b'] }]);
  });

  it('drops empty sections from leading, trailing or repeated markers', () => {
    expect(
      split([
        newSection,
        text('a'),
        pageBreak,
        text('b'),
        newSection,
        newSection,
      ]),
    ).toEqual([{ left: ['a'], right: ['b'] }]);
  });

  it('keeps everything after a second page break in the right column', () => {
    expect(
      split([text('a'), pageBreak, text('b'), pageBreak, text('c')]),
    ).toEqual([{ left: ['a'], right: ['b', 'c'] }]);
  });

  it('returns no sections for empty or invalid content', () => {
    expect(split([])).toEqual([]);
    expect(splitIntoSections(null as unknown as PortableTextProps)).toEqual([]);
  });
});
