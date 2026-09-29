/**
 * Date helpers. Display and daily grouping happen in an IANA time zone via
 * `Intl.DateTimeFormat`; API parameters are UTC ISO strings. Plain calendar
 * dates are `YYYY-MM-DD` strings throughout.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const values: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    // Some engines still print midnight as 24 with h23.
    hour: (values.hour ?? 0) % 24,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Offset of `timeZone` from UTC at instant `ms`, in milliseconds. */
function zoneOffsetMs(ms: number, timeZone: string): number {
  const p = zonedParts(new Date(ms), timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC epoch. */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): number {
  const wall = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond,
  );
  let utc = wall - zoneOffsetMs(wall, timeZone);
  // Re-check once: the offset can differ on the other side of a DST switch.
  const corrected = wall - zoneOffsetMs(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return utc;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

/** Parse `YYYY-MM-DD`; returns null for malformed or impossible dates. */
export function parseDateOnly(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function dateOnlyToUtcDay(value: string): number | null {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day) / DAY_MS;
}

/** Calendar date (`YYYY-MM-DD`) of an instant in `timeZone`. */
export function dateKey(iso: string | Date, timeZone: string): string {
  const p = zonedParts(typeof iso === 'string' ? new Date(iso) : iso, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** Today's calendar date in `timeZone`. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  return dateKey(now, timeZone);
}

/** Add `days` (may be negative) to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const day = dateOnlyToUtcDay(date);
  if (day === null) throw new RangeError(`Invalid date: ${date}`);
  const shifted = new Date((day + days) * DAY_MS);
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * UTC bounds of a calendar-date range in `timeZone`: `from` local midnight to
 * `to` local 23:59:59.999.
 */
export function toRangeIso(
  from: string,
  to: string,
  timeZone: string,
): { fromTime: string; toTime: string } {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) throw new RangeError(`Invalid range: ${from}..${to}`);
  const fromMs = zonedWallTimeToUtc(
    start.year,
    start.month,
    start.day,
    0,
    0,
    0,
    0,
    timeZone,
  );
  const toMs = zonedWallTimeToUtc(
    end.year,
    end.month,
    end.day,
    23,
    59,
    59,
    999,
    timeZone,
  );
  return {
    fromTime: new Date(fromMs).toISOString(),
    toTime: new Date(toMs).toISOString(),
  };
}

/**
 * Validate a report range. Returns a Polish message for the UI, or null when
 * the range is fine. `today` is the current calendar date in the report zone.
 */
export function validateRange(
  from: string,
  to: string,
  options: { maxRangeDays: number; today: string },
): string | null {
  const fromDay = dateOnlyToUtcDay(from);
  const toDay = dateOnlyToUtcDay(to);
  const today = dateOnlyToUtcDay(options.today);
  if (fromDay === null || toDay === null || today === null) {
    return 'Podaj poprawne daty w obu polach.';
  }
  if (fromDay > toDay) {
    return 'Data początkowa nie może być późniejsza niż data końcowa.';
  }
  if (toDay > today) {
    return 'Data końcowa nie może być w przyszłości.';
  }
  if (fromDay < today - options.maxRangeDays) {
    return `Raport obejmuje maksymalnie ostatnie ${options.maxRangeDays} dni. Wybierz datę od ${formatDate(addDays(options.today, -options.maxRangeDays))}.`;
  }
  return null;
}

/** `YYYY-MM-DD` → `DD.MM.YYYY` (no time zone involved). */
export function formatDate(date: string): string {
  const parsed = parseDateOnly(date);
  if (!parsed) return date;
  return `${pad(parsed.day)}.${pad(parsed.month)}.${pad(parsed.year, 4)}`;
}

/** Instant → `DD.MM.YYYY HH:mm` in `timeZone`. */
export function formatDateTime(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone);
  return `${pad(p.day)}.${pad(p.month)}.${pad(p.year, 4)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Instant → `HH:mm` in `timeZone`. */
export function formatTime(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Instant → `YYYY-MM-DD HH:mm` in `timeZone` (CSV, sorts as text). */
export function formatIsoLocal(iso: string, timeZone: string): string {
  const p = zonedParts(new Date(iso), timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Minutes → `Xh Ymin` (rounded to whole minutes). */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h ${total % 60}min`;
}
