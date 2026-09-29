import type { ActivityEvent, Session, SessionedEvent } from './types.js';

function ms(iso: string): number {
  return Date.parse(iso);
}

/**
 * Split events into sessions: a new session starts when the gap between the
 * previous activity (its `lastAt`) and the next event exceeds `gapMinutes`.
 * Session numbers are 1-based and contiguous across the whole range. A
 * session lasts `max(end - start, minSessionMinutes)` so a single save still
 * counts as a few minutes of activity.
 */
export function assignSessions(
  events: readonly ActivityEvent[],
  options: { gapMinutes: number; minSessionMinutes: number },
): { events: SessionedEvent[]; sessions: Session[] } {
  const gapMs = Math.max(0, options.gapMinutes) * 60_000;
  const sorted = [...events].sort((a, b) => ms(a.at) - ms(b.at));

  const result: SessionedEvent[] = [];
  const sessions: Session[] = [];
  let current: {
    index: number;
    startMs: number;
    endMs: number;
    count: number;
  } | null = null;

  const close = () => {
    if (!current) return;
    const minutes = (current.endMs - current.startMs) / 60_000;
    sessions.push({
      index: current.index,
      start: new Date(current.startMs).toISOString(),
      end: new Date(current.endMs).toISOString(),
      durationMinutes: Math.max(minutes, options.minSessionMinutes),
      eventCount: current.count,
    });
  };

  for (const event of sorted) {
    const startMs = ms(event.at);
    const endMs = Math.max(startMs, ms(event.lastAt));

    if (!current || startMs - current.endMs > gapMs) {
      close();
      current = {
        index: sessions.length + 1,
        startMs,
        endMs,
        count: 0,
      };
    }

    current.endMs = Math.max(current.endMs, endMs);
    current.count += 1;
    result.push({ ...event, sessionIndex: current.index });
  }
  close();

  return { events: result, sessions };
}
