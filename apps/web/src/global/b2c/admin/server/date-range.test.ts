import { describe, expect, it } from 'vitest';

import { AdminDateRangeError, parseAdminDateRange } from './date-range';

const NOW = new Date('2026-05-06T08:00:00.000Z');

describe('parseAdminDateRange', () => {
  it('defaults to the configured trailing window', () => {
    expect(
      parseAdminDateRange(new URLSearchParams(), {
        defaultDays: 7,
        now: NOW,
      }),
    ).toEqual({
      from: new Date('2026-04-29T08:00:00.000Z'),
      fromIso: '2026-04-29T08:00:00.000Z',
      to: NOW,
      toIso: '2026-05-06T08:00:00.000Z',
    });
  });

  it('parses explicit from and to dates', () => {
    expect(
      parseAdminDateRange(
        new URLSearchParams(
          'from=2026-05-01T00%3A00%3A00.000Z&to=2026-05-05T00%3A00%3A00.000Z',
        ),
        { now: NOW },
      ),
    ).toEqual({
      from: new Date('2026-05-01T00:00:00.000Z'),
      fromIso: '2026-05-01T00:00:00.000Z',
      to: new Date('2026-05-05T00:00:00.000Z'),
      toIso: '2026-05-05T00:00:00.000Z',
    });
  });

  it('rejects invalid and reversed ranges', () => {
    expect(() =>
      parseAdminDateRange(new URLSearchParams('from=not-a-date'), {
        now: NOW,
      }),
    ).toThrow(AdminDateRangeError);

    expect(() =>
      parseAdminDateRange(
        new URLSearchParams(
          'from=2026-05-06T00%3A00%3A00.000Z&to=2026-05-01T00%3A00%3A00.000Z',
        ),
        { now: NOW },
      ),
    ).toThrow(AdminDateRangeError);
  });
});
