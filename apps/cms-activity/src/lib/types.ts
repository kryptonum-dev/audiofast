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
