import { addDays, validateRange } from './time.js';

/** Filter values as held by the form (dates are `YYYY-MM-DD`). */
export type ReportFilters = {
  authorId: string;
  from: string;
  to: string;
  /** Raw input value, validated with `validateGap`. */
  gapMinutes: string;
};

export const MIN_GAP_MINUTES = 1;
export const MAX_GAP_MINUTES = 480;

export function defaultFilters(
  today: string,
  limits: { defaultRangeDays: number; defaultSessionGapMinutes: number },
): ReportFilters {
  return {
    authorId: '',
    from: addDays(today, -limits.defaultRangeDays),
    to: today,
    gapMinutes: String(limits.defaultSessionGapMinutes),
  };
}

/** Parsed gap in minutes, or null when the input is not a valid number. */
export function parseGap(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  if (minutes < MIN_GAP_MINUTES || minutes > MAX_GAP_MINUTES) return null;
  return minutes;
}

export type FilterErrors = {
  author: string | null;
  range: string | null;
  gap: string | null;
};

/** Polish validation messages per field; all null when the form is valid. */
export function validateFilters(
  filters: ReportFilters,
  options: { maxRangeDays: number; today: string },
): FilterErrors {
  return {
    author: filters.authorId === '' ? 'Wybierz osobę.' : null,
    range: validateRange(filters.from, filters.to, options),
    gap:
      parseGap(filters.gapMinutes) === null
        ? `Podaj liczbę całkowitą od ${MIN_GAP_MINUTES} do ${MAX_GAP_MINUTES} minut.`
        : null,
  };
}

export function hasErrors(errors: FilterErrors): boolean {
  return errors.author !== null || errors.range !== null || errors.gap !== null;
}
