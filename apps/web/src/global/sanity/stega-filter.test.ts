import { describe, expect, test, vi } from 'vitest';

import { STEGA_LOGIC_ONLY_FIELDS, stegaFilter } from './stega-filter';

type Props = Parameters<typeof stegaFilter>[0];

function run(sourcePath: Props['sourcePath']) {
  const filterDefault = vi.fn(() => true);
  const result = stegaFilter({
    sourcePath,
    resultPath: sourcePath,
    sourceDocument: { _id: 'x', _type: 'product' },
    value: 'tekst',
    filterDefault,
  } as unknown as Props);
  return { result, filterDefault };
}

describe('stegaFilter', () => {
  test('a listed leaf is never encoded', () => {
    expect(run(['availabilityStatus']).result).toBe(false);
    expect(
      run(['pageBuilder', { _key: 'a', _index: 0 }, 'displayMode']).result,
    ).toBe(false);
    expect(run(['contactPersons', 0, 'phoneNumber']).result).toBe(false);
  });

  test('a primitive array member is matched by its array name', () => {
    expect(run(['keywords', 2]).result).toBe(false);
    expect(run(['denormCategorySlugs', 0]).result).toBe(false);
  });

  test('every string under a logic-only subtree is skipped', () => {
    expect(
      run(['customFilters', { _key: 'f', _index: 0 }, 'name']).result,
    ).toBe(false);
    expect(run(['analytics', 'gtm_id']).result).toBe(false);
  });

  test('display copy falls through to the vendor default', () => {
    const { result, filterDefault } = run(['name']);
    expect(result).toBe(true);
    expect(filterDefault).toHaveBeenCalledOnce();
    expect(run(['pageBuilder', { _key: 'a', _index: 0 }, 'title']).result).toBe(
      true,
    );
  });

  test('never lists display-copy names', () => {
    expect(STEGA_LOGIC_ONLY_FIELDS.has('name')).toBe(false);
    expect(STEGA_LOGIC_ONLY_FIELDS.has('title')).toBe(false);
  });
});
