import { describe, expect, it } from 'vitest';

import {
  needsBrandStores,
  pickEffectiveStores,
} from './brand-stores';

type Store = { _id: string };
const a: Store = { _id: 'a' };
const b: Store = { _id: 'b' };

describe('pickEffectiveStores', () => {
  it("prefers the product's own stores", () => {
    expect(pickEffectiveStores<Store>([a], [b])).toEqual([a]);
  });

  it("falls back to the brand's stores", () => {
    expect(pickEffectiveStores<Store>(null, [b])).toEqual([b]);
    expect(pickEffectiveStores<Store>([], [b])).toEqual([b]);
  });

  it('ignores dangling (null) references on both levels', () => {
    expect(pickEffectiveStores<Store>([null], [null, b])).toEqual([b]);
  });

  it('returns null when nothing is listed', () => {
    expect(pickEffectiveStores<Store>(undefined, undefined)).toBeNull();
    expect(pickEffectiveStores<Store>([], [null])).toBeNull();
  });
});

describe('needsBrandStores', () => {
  it('is true only when the product has no usable own stores', () => {
    expect(needsBrandStores(null)).toBe(true);
    expect(needsBrandStores([])).toBe(true);
    expect(needsBrandStores([null])).toBe(true);
    expect(needsBrandStores([a])).toBe(false);
  });
});
