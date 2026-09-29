import { classifyTransactions } from './classify.js';
import { throwIfAborted } from './concurrency.js';
import { resolveDocuments } from './documents.js';
import {
  fetchAllTransactions,
  type HistoryRequestClient,
} from './history-client.js';
import { mergeNoise } from './merge.js';
import { assignSessions } from './sessions.js';
import { buildDailySummary } from './summary.js';
import { toRangeIso } from './time.js';
import type {
  DailySummary,
  ResolvedDocument,
  Session,
  SessionedEvent,
} from './types.js';

/**
 * The subset of the app config the report needs. Structural, so `src/lib`
 * never imports project ids from `src/config.ts`.
 */
export type ReportConfig = {
  dataset: string;
  timeZone: string;
  limits: {
    pageSize: number;
    mergeWindowMinutes: number;
    minSessionMinutes: number;
    snapshotBatchSize: number;
  };
};

export type ReportProgressStage =
  'transactions' | 'documents' | 'changes' | 'summary';

export type ReportProgress = {
  stage: ReportProgressStage;
  /** Ready-to-show Polish status line. */
  message: string;
  loaded?: number;
  total?: number;
};

export type BuildReportParams = {
  authorId: string;
  /** `YYYY-MM-DD` in `config.timeZone`. */
  from: string;
  /** `YYYY-MM-DD` in `config.timeZone`. */
  to: string;
  gapMinutes: number;
  onProgress?: (progress: ReportProgress) => void;
  signal?: AbortSignal;
  /** Injected for determinism; defaults to the current time. */
  now?: Date;
};

export type Report = {
  events: SessionedEvent[];
  sessions: Session[];
  daily: DailySummary;
  /** Name and type per published document id. */
  documents: Map<string, ResolvedDocument>;
  meta: {
    authorId: string;
    fromTime: string;
    toTime: string;
    /** Transactions returned by the History API for the author. */
    transactionCount: number;
    /** True when paging hit its hard stop; the report may be incomplete. */
    truncated: boolean;
  };
};

/**
 * Build the whole report for one author and date range:
 * transactions → classify → resolve documents → mergeNoise →
 * (Phase 4: changed fields) → assignSessions → buildDailySummary.
 */
export async function buildReport(
  client: HistoryRequestClient,
  config: ReportConfig,
  params: BuildReportParams,
): Promise<Report> {
  const { authorId, from, to, gapMinutes, onProgress, signal } = params;
  const range = toRangeIso(from, to, config.timeZone);
  const now = (params.now ?? new Date()).toISOString();
  // Never ask for the future: the upper bound of "today" is now.
  const toTime = range.toTime > now ? now : range.toTime;
  const fromTime = range.fromTime;

  onProgress?.({
    stage: 'transactions',
    message: 'Pobieranie historii…',
    loaded: 0,
  });
  const paged = await fetchAllTransactions(client, {
    dataset: config.dataset,
    authors: [authorId],
    fromTime,
    toTime,
    pageSize: config.limits.pageSize,
    signal,
    onProgress: (loaded) =>
      onProgress?.({
        stage: 'transactions',
        message: `Pobrano ${loaded} transakcji…`,
        loaded,
      }),
  });
  throwIfAborted(signal);

  // Defensive: the API filters by author, but never attribute others' work.
  const transactions = paged.transactions.filter(
    (tx) => tx.author === authorId,
  );
  const classified = classifyTransactions(transactions);

  const documentIds = [...new Set(classified.map((event) => event.documentId))];
  onProgress?.({
    stage: 'documents',
    message: `Wczytywanie nazw dokumentów (0/${documentIds.length})…`,
    loaded: 0,
    total: documentIds.length,
  });
  const documents = await resolveDocuments(client, {
    dataset: config.dataset,
    ids: documentIds,
    signal,
    onProgress: (loaded, total) =>
      onProgress?.({
        stage: 'documents',
        message: `Wczytywanie nazw dokumentów (${loaded}/${total})…`,
        loaded,
        total,
      }),
  });
  throwIfAborted(signal);

  const typed = classified.map((event) => {
    const type = documents.get(event.documentId)?.type;
    return type ? { ...event, docType: type } : event;
  });
  const merged = mergeNoise(typed, {
    mergeWindowMinutes: config.limits.mergeWindowMinutes,
  });

  // Phase 4: attachChangedFields(client, config, { events: merged, ... }).

  onProgress?.({ stage: 'summary', message: 'Przygotowywanie podsumowania…' });
  const { events, sessions } = assignSessions(merged, {
    gapMinutes,
    minSessionMinutes: config.limits.minSessionMinutes,
  });
  const daily = buildDailySummary(events, sessions, config.timeZone);

  return {
    events,
    sessions,
    daily,
    documents,
    meta: {
      authorId,
      fromTime,
      toTime,
      transactionCount: transactions.length,
      truncated: paged.truncated,
    },
  };
}
