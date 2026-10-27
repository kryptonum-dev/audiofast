import { describe, expect, it } from 'vitest';

import { minifyGroq } from './minify-groq';

describe('minifyGroq', () => {
  it('collapses indentation and spaces around punctuation and operators', () => {
    expect(
      minifyGroq(`
        *[_type == "brand" && !(_id in path("drafts.**"))] | order(name asc) {
          "slug": slug.current,
          name
        }
      `),
    ).toBe(
      '*[_type=="brand"&& !(_id in path("drafts.**"))]|order(name asc) {"slug":slug.current,name}',
    );
  });

  it('keeps the space between two operator characters', () => {
    expect(minifyGroq('select(a => *[_type == "x"])')).toBe(
      'select(a=> *[_type=="x"])',
    );
    expect(minifyGroq('count(x) > -1')).toBe('count(x)> -1');
  });

  it('copies double- and single-quoted strings verbatim', () => {
    expect(minifyGroq(`"a,  b" + 'c ,  d'`)).toBe(`"a,  b"+'c ,  d'`);
    expect(minifyGroq(`"say \\"hi,  you\\"" + x`)).toBe(
      `"say \\"hi,  you\\""+x`,
    );
  });

  it('drops // comments outside strings but not inside them', () => {
    expect(
      minifyGroq(`{
        // a comment, with "quotes"
        "url": "https://audiofast.pl//x"
      }`),
    ).toBe('{"url":"https://audiofast.pl//x"}');
  });

  it('returns the same result for repeated calls', () => {
    const query = '*[ _type == "page" ]';
    expect(minifyGroq(query)).toBe(minifyGroq(query));
  });
});
