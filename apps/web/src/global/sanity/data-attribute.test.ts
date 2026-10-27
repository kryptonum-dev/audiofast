import { beforeAll, describe, expect, test, vi } from 'vitest';

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SANITY_PROJECT_ID', 'fsw3likv');
});

async function load() {
  vi.resetModules();
  return import('./data-attribute');
}

describe('getDataAttribute', () => {
  test('is null outside draft mode, so published HTML gets no data-sanity', async () => {
    const { getDataAttribute, dataSanity, referencedDataSanity } = await load();
    const attr = getDataAttribute({
      id: 'homePage',
      type: 'homePage',
      isDraft: false,
    });
    expect(attr).toBeNull();
    expect(dataSanity(attr, 'pageBuilder')).toBeUndefined();
    expect(
      referencedDataSanity({ _id: 'faq-1', _type: 'faq' }, false, 'question'),
    ).toBeUndefined();
  });

  test('is null without an id or a type', async () => {
    const { getDataAttribute } = await load();
    expect(
      getDataAttribute({ id: undefined, type: 'page', isDraft: true }),
    ).toBeNull();
    expect(getDataAttribute({ id: 'x', type: null, isDraft: true })).toBeNull();
  });

  test('builds a keyed path in draft mode', async () => {
    const { getDataAttribute, dataSanity } = await load();
    const attr = getDataAttribute({
      id: 'homePage',
      type: 'homePage',
      isDraft: true,
    });
    const value = dataSanity(attr, ['pageBuilder', { _key: 'abc' }]);
    expect(value).toContain('id=homePage');
    expect(value).toContain('type=homePage');
    expect(value).toContain('path=pageBuilder:abc');
    const scoped = attr!.scope(['pageBuilder', { _key: 'abc' }]);
    expect(dataSanity(scoped)).toBe(value);
    expect(dataSanity(scoped, 'image')).toContain('path=pageBuilder:abc.image');
  });

  test('a referenced document opens itself', async () => {
    const { referencedDataSanity } = await load();
    const value = referencedDataSanity(
      { _id: 'faq-1', _type: 'faq' },
      true,
      'question',
    );
    expect(value).toContain('id=faq-1');
    expect(value).toContain('path=question');
  });
});
