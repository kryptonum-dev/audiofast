import type { BadgeTone } from '@sanity/ui';

import { ACTION_LABELS, DIRECT_EDIT_LABEL } from '../lib/labels.js';
import type { ActionKind } from '../lib/report-view.js';
import { formatTime } from '../lib/time.js';

export function actionKindLabel(kind: ActionKind): string {
  return kind === 'directEdit' ? DIRECT_EDIT_LABEL : ACTION_LABELS[kind];
}

/** Badge tone per action, the same everywhere on the screen. */
export function actionKindTone(kind: ActionKind): BadgeTone {
  switch (kind) {
    case 'publish':
      return 'positive';
    case 'create':
      return 'primary';
    case 'unpublish':
      return 'caution';
    case 'delete':
    case 'discard':
      return 'critical';
    case 'edit':
    case 'directEdit':
      return 'default';
  }
}

/** `Publikacja`, or `5× edycja` for repeated actions. */
export function actionBadgeText(kind: ActionKind, count: number): string {
  const label = actionKindLabel(kind);
  return count > 1 ? `${count}× ${label.toLowerCase()}` : label;
}

/** Tooltip with the times of the counted events. */
export function actionTimesTitle(times: readonly string[], timeZone: string) {
  const list = times.map((time) => formatTime(time, timeZone)).join(', ');
  return times.length > 1 ? `Godziny: ${list}` : `Godzina: ${list}`;
}
