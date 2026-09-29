import { dateKey } from './time.js';
import type {
  DailyRow,
  DailySummary,
  Session,
  SessionedEvent,
} from './types.js';

function ms(iso: string): number {
  return Date.parse(iso);
}

type DayAccumulator = {
  firstAt: string;
  lastAt: string;
  sessions: Set<number>;
  documents: Set<string>;
  publishes: number;
  activeMinutes: number;
};

/**
 * Daily rollup in `timeZone`. Active time of a session is attributed to the
 * day it started; the session count of a day is the number of distinct
 * sessions with at least one event that day. The totals row counts every
 * session and document once.
 */
export function buildDailySummary(
  events: readonly SessionedEvent[],
  sessions: readonly Session[],
  timeZone: string,
): DailySummary {
  if (events.length === 0) return { rows: [], totals: null };

  const days = new Map<string, DayAccumulator>();
  const day = (key: string, at: string): DayAccumulator => {
    let acc = days.get(key);
    if (!acc) {
      acc = {
        firstAt: at,
        lastAt: at,
        sessions: new Set(),
        documents: new Set(),
        publishes: 0,
        activeMinutes: 0,
      };
      days.set(key, acc);
    }
    return acc;
  };

  for (const event of events) {
    const acc = day(dateKey(event.at, timeZone), event.at);
    if (ms(event.at) < ms(acc.firstAt)) acc.firstAt = event.at;
    const last = ms(event.lastAt) > ms(event.at) ? event.lastAt : event.at;
    if (ms(last) > ms(acc.lastAt)) acc.lastAt = last;
    acc.sessions.add(event.sessionIndex);
    acc.documents.add(event.documentId);
    if (event.action === 'publish') acc.publishes += 1;
  }

  for (const session of sessions) {
    day(dateKey(session.start, timeZone), session.start).activeMinutes +=
      session.durationMinutes;
  }

  const rows: DailyRow[] = [...days.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, acc]) => ({
      date,
      firstAt: acc.firstAt,
      lastAt: acc.lastAt,
      sessions: acc.sessions.size,
      activeMinutes: acc.activeMinutes,
      documents: acc.documents.size,
      publishes: acc.publishes,
    }));

  const first = rows[0];
  const lastRow = rows[rows.length - 1];
  const totals = {
    days: rows.length,
    firstAt: first ? first.firstAt : '',
    lastAt: lastRow ? lastRow.lastAt : '',
    sessions: sessions.length,
    activeMinutes: sessions.reduce((sum, s) => sum + s.durationMinutes, 0),
    documents: new Set(events.map((event) => event.documentId)).size,
    publishes: rows.reduce((sum, row) => sum + row.publishes, 0),
  };

  return { rows, totals };
}
