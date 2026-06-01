export type AdminDateRange = {
  from: Date;
  fromIso: string;
  to: Date;
  toIso: string;
};

type AdminDateRangeOptions = {
  defaultDays?: number;
  maxDays?: number;
  now?: Date;
};

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

export class AdminDateRangeError extends Error {
  readonly code = 'invalid_date_range';
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'AdminDateRangeError';
  }
}

function parseDateParam(value: string | null, paramName: string): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new AdminDateRangeError(`Invalid ${paramName} date.`);
  }

  return parsed;
}

export function parseAdminDateRange(
  searchParams: URLSearchParams,
  options: AdminDateRangeOptions = {},
): AdminDateRange {
  const now = options.now ?? new Date();
  const defaultDays = options.defaultDays ?? DEFAULT_DAYS;
  const maxDays = options.maxDays ?? MAX_DAYS;
  const to = parseDateParam(searchParams.get('to'), 'to') ?? now;
  const from =
    parseDateParam(searchParams.get('from'), 'from') ??
    new Date(to.getTime() - defaultDays * DAY_MS);

  if (from.getTime() > to.getTime()) {
    throw new AdminDateRangeError('The from date must be before the to date.');
  }

  if (to.getTime() - from.getTime() > maxDays * DAY_MS) {
    throw new AdminDateRangeError(
      `Date range cannot be longer than ${maxDays} days.`,
    );
  }

  return {
    from,
    fromIso: from.toISOString(),
    to,
    toIso: to.toISOString(),
  };
}
