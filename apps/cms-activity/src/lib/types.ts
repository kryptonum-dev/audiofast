/** One mutation as returned with `excludeContent=true` (ids only, no content). */
export type HistoryMutation = {
  create?: { _id?: string; [key: string]: unknown };
  createIfNotExists?: { _id?: string; [key: string]: unknown };
  createOrReplace?: { _id?: string; [key: string]: unknown };
  createSquashed?: { [key: string]: unknown };
  delete?: { id?: string; purge?: boolean; [key: string]: unknown };
  patch?: { id?: string; unsetIsEmpty?: boolean; [key: string]: unknown };
  [key: string]: unknown;
};

/** Mendoza patch pair for one document touched by a transaction. */
export type HistoryEffect = {
  apply: unknown[];
  revert: unknown[];
};

/** One NDJSON line of `/data/history/{dataset}/transactions`. */
export type HistoryTransaction = {
  id: string;
  timestamp: string;
  author: string;
  documentIDs: string[];
  mutations: HistoryMutation[];
  effects?: Record<string, HistoryEffect>;
  sequenceNumber?: number;
};

/** What an editor did to a document, derived from effect shapes. */
export type ActivityAction =
  'edit' | 'create' | 'publish' | 'unpublish' | 'delete' | 'discard';

/** One row of the events table (before sessions are assigned). */
export type ActivityEvent = {
  /** Stable id: `<first transaction id>:<published document id>`. */
  id: string;
  /** UTC ISO timestamp of the first transaction in this event. */
  at: string;
  /** UTC ISO timestamp of the last transaction (equals `at` unless merged). */
  lastAt: string;
  authorId: string;
  /** Published document id (without `drafts.` / `versions.<id>.` prefix). */
  documentId: string;
  docType?: string;
  action: ActivityAction;
  /** Edit written straight to the published document (no draft involved). */
  direct?: boolean;
  /** Number of transactions collapsed into this event. */
  mergedCount: number;
  /** Changed field labels; filled by the changed-fields step (Phase 4). */
  changedFields: string[];
  /** Every transaction id collapsed into this event, ascending by time. */
  transactionIds: string[];
  /** Raw document ids (published, draft, version) touched by this event. */
  touchedIds: string[];
};

/** Event with its 1-based session number within the whole range. */
export type SessionedEvent = ActivityEvent & { sessionIndex: number };

export type Session = {
  /** 1-based, contiguous across the whole range. */
  index: number;
  /** UTC ISO timestamp of the first event. */
  start: string;
  /** UTC ISO timestamp of the last activity (last event's `lastAt`). */
  end: string;
  /** `max(end - start, minSessionMinutes)` in minutes. */
  durationMinutes: number;
  eventCount: number;
};

/** One row of the daily summary (dates in the report time zone). */
export type DailyRow = {
  /** `YYYY-MM-DD` in the report time zone. */
  date: string;
  /** UTC ISO timestamp of the first activity that day. */
  firstAt: string;
  /** UTC ISO timestamp of the last activity that day. */
  lastAt: string;
  /** Distinct sessions with at least one event that day. */
  sessions: number;
  /** Duration of the sessions that started that day, in minutes. */
  activeMinutes: number;
  /** Distinct documents touched that day. */
  documents: number;
  publishes: number;
};

export type DailyTotals = Omit<DailyRow, 'date'> & { days: number };

export type DailySummary = {
  rows: DailyRow[];
  /** Null when there are no events. */
  totals: DailyTotals | null;
};

/** Project member as exposed by `useProject().members` (structural subset). */
export type ProjectMember = {
  id: string;
  isRobot: boolean;
  role?: string;
  roles?: unknown[];
  isCurrentUser?: boolean;
};

export type UserProfile = {
  displayName: string;
  email: string | null;
};

export type ResolvedDocument = {
  /** Human-readable name, or null when the document has none (singletons). */
  name: string | null;
  type: string | null;
  /** True when neither the published nor the draft version exists today. */
  deleted: boolean;
};

/** A raw Sanity document as returned by snapshot / last-revision endpoints. */
export type SanityDocumentLike = {
  _id: string;
  _type: string;
  [key: string]: unknown;
};
