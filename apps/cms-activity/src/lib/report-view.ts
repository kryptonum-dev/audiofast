import { assetKind, type AssetCounts } from './assets.js';
import { RECONSTRUCTION_FAILED } from './reconstruct.js';
import { dateKey, minutesOfDay } from './time.js';
import type {
  ActivityAction,
  DailyRow,
  DailySummary,
  Session,
  SessionedEvent,
} from './types.js';

/**
 * Derived view models for the report screen: summary tiles, the day
 * timeline and per-session document groups. Pure, so the screen can
 * memoize them per loaded report.
 */

/** Action variant shown as one badge; direct edits are a separate kind. */
export type ActionKind = ActivityAction | 'directEdit';

/** Badge order inside a document group and a session summary. */
export const ACTION_ORDER: readonly ActionKind[] = [
  'create',
  'edit',
  'directEdit',
  'publish',
  'unpublish',
  'delete',
  'discard',
];

export function actionKind(
  event: Pick<SessionedEvent, 'action' | 'direct'>,
): ActionKind {
  return event.action === 'edit' && event.direct ? 'directEdit' : event.action;
}

export type ActionCount = {
  kind: ActionKind;
  count: number;
  /** UTC ISO start of every event of this kind, ascending. */
  times: string[];
};

export type DocumentGroup = {
  documentId: string;
  docType?: string;
  /** Events on this document within the session, ascending. */
  events: SessionedEvent[];
  /** Sum of merged saves. */
  saves: number;
  actions: ActionCount[];
  /** Union of changed fields (reconstruction marker excluded). */
  fields: string[];
  /** At least one event could not be replayed. */
  failed: boolean;
};

export type SessionView = {
  session: Session;
  /** `YYYY-MM-DD` of the session start in the report zone. */
  date: string;
  documents: DocumentGroup[];
  assets: AssetCounts;
  /** Ids of the image assets uploaded in this session (thumbnails). */
  imageAssetIds: string[];
  /** Action counts over all document groups (assets excluded). */
  actions: ActionCount[];
};

function countActions(events: readonly SessionedEvent[]): ActionCount[] {
  const byKind = new Map<ActionKind, ActionCount>();
  for (const event of events) {
    const kind = actionKind(event);
    const entry = byKind.get(kind) ?? { kind, count: 0, times: [] };
    entry.count += 1;
    entry.times.push(event.at);
    byKind.set(kind, entry);
  }
  return ACTION_ORDER.flatMap((kind) => {
    const entry = byKind.get(kind);
    return entry ? [entry] : [];
  });
}

/**
 * One view per session (chronological, like the export): events grouped by
 * document in order of first appearance, assets counted separately.
 */
export function buildSessionViews(
  events: readonly SessionedEvent[],
  sessions: readonly Session[],
  timeZone: string,
): SessionView[] {
  const bySession = new Map<number, SessionedEvent[]>();
  for (const event of events) {
    const list = bySession.get(event.sessionIndex) ?? [];
    list.push(event);
    bySession.set(event.sessionIndex, list);
  }

  return sessions.map((session) => {
    const sessionEvents = bySession.get(session.index) ?? [];
    const assets: AssetCounts = { images: 0, files: 0 };
    const imageAssetIds: string[] = [];
    const groups = new Map<string, SessionedEvent[]>();
    const contentEvents: SessionedEvent[] = [];

    for (const event of sessionEvents) {
      const asset = assetKind(event.docType);
      if (asset === 'image') {
        assets.images += 1;
        if (!imageAssetIds.includes(event.documentId)) {
          imageAssetIds.push(event.documentId);
        }
        continue;
      }
      if (asset === 'file') {
        assets.files += 1;
        continue;
      }
      contentEvents.push(event);
      const list = groups.get(event.documentId) ?? [];
      list.push(event);
      groups.set(event.documentId, list);
    }

    const documents: DocumentGroup[] = [...groups].map(
      ([documentId, docEvents]) => {
        const fields = new Set<string>();
        let failed = false;
        for (const event of docEvents) {
          for (const field of event.changedFields) {
            if (field === RECONSTRUCTION_FAILED) failed = true;
            else fields.add(field);
          }
        }
        return {
          documentId,
          docType: docEvents.find((event) => event.docType)?.docType,
          events: docEvents,
          saves: docEvents.reduce((sum, event) => sum + event.mergedCount, 0),
          actions: countActions(docEvents),
          fields: [...fields],
          failed,
        };
      },
    );

    return {
      session,
      date: dateKey(session.start, timeZone),
      documents,
      assets,
      imageAssetIds,
      actions: countActions(contentEvents),
    };
  });
}

export type SummaryTiles = {
  activeMinutes: number;
  activeDays: number;
  /** Average active time per active day. */
  averageMinutesPerDay: number;
  sessions: number;
  /** Distinct documents, image/file assets excluded. */
  documents: number;
  publishes: number;
};

export function buildSummaryTiles(daily: DailySummary): SummaryTiles | null {
  const { totals } = daily;
  if (!totals) return null;
  return {
    activeMinutes: totals.activeMinutes,
    activeDays: totals.days,
    averageMinutesPerDay:
      totals.days > 0 ? totals.activeMinutes / totals.days : 0,
    sessions: totals.sessions,
    documents: totals.documents,
    publishes: totals.publishes,
  };
}

export type TimelineBlock = {
  sessionIndex: number;
  start: string;
  end: string;
  /** Minutes since local midnight. */
  startMinute: number;
  /** Minutes since local midnight, clamped to the end of the day. */
  endMinute: number;
};

export type TimelineDay = DailyRow & {
  blocks: TimelineBlock[];
  /** First session with an event that day (scroll target). */
  firstSessionIndex: number | null;
};

export type Timeline = {
  days: TimelineDay[];
  /** Whole hours, `axisStartHour < axisEndHour`, within 0–24. */
  axisStartHour: number;
  axisEndHour: number;
};

const DEFAULT_AXIS = { start: 7, end: 17 } as const;
const DAY_MINUTES = 24 * 60;

/**
 * One row per active day with one block per session that started that day
 * (active time is attributed to the start day too). The axis spans the
 * floor of the earliest start to the ceil of the latest end, widened to at
 * least the default working day 7:00–17:00.
 */
export function buildTimeline(
  daily: DailySummary,
  sessions: readonly Session[],
  events: readonly SessionedEvent[],
  timeZone: string,
): Timeline {
  const blocksByDay = new Map<string, TimelineBlock[]>();
  let minStart: number = DEFAULT_AXIS.start * 60;
  let maxEnd: number = DEFAULT_AXIS.end * 60;

  for (const session of sessions) {
    const day = dateKey(session.start, timeZone);
    const startMinute = minutesOfDay(session.start, timeZone);
    const sameDay = dateKey(session.end, timeZone) === day;
    const endMinute = sameDay
      ? Math.max(startMinute, minutesOfDay(session.end, timeZone))
      : DAY_MINUTES;
    const list = blocksByDay.get(day) ?? [];
    list.push({
      sessionIndex: session.index,
      start: session.start,
      end: session.end,
      startMinute,
      endMinute,
    });
    blocksByDay.set(day, list);
    minStart = Math.min(minStart, startMinute);
    maxEnd = Math.max(maxEnd, endMinute);
  }

  const firstSessionByDay = new Map<string, number>();
  for (const event of events) {
    const day = dateKey(event.at, timeZone);
    const current = firstSessionByDay.get(day);
    if (current === undefined || event.sessionIndex < current) {
      firstSessionByDay.set(day, event.sessionIndex);
    }
  }

  const axisStartHour = Math.max(0, Math.floor(minStart / 60));
  const axisEndHour = Math.min(
    24,
    Math.max(axisStartHour + 1, Math.ceil(maxEnd / 60)),
  );

  return {
    days: daily.rows.map((row) => ({
      ...row,
      blocks: blocksByDay.get(row.date) ?? [],
      firstSessionIndex: firstSessionByDay.get(row.date) ?? null,
    })),
    axisStartHour,
    axisEndHour,
  };
}

export type DayGroup = {
  /** `YYYY-MM-DD` in the report zone. */
  date: string;
  /** Sessions that started that day, chronological. */
  sessions: SessionView[];
  /** The day's row of the daily summary (active time, documents, publishes). */
  daily: DailyRow | null;
};

/** Session views grouped by the day they started on, chronological. */
export function groupSessionsByDay(
  views: readonly SessionView[],
  daily: DailySummary,
): DayGroup[] {
  const rows = new Map(daily.rows.map((row) => [row.date, row]));
  const groups: DayGroup[] = [];
  for (const view of views) {
    const last = groups[groups.length - 1];
    if (last && last.date === view.date) {
      last.sessions.push(view);
    } else {
      groups.push({
        date: view.date,
        sessions: [view],
        daily: rows.get(view.date) ?? null,
      });
    }
  }
  return groups;
}
