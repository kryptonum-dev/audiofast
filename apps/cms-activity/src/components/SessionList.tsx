import {
  ChevronDownIcon,
  CogIcon,
  CommentIcon,
  DocumentIcon,
  DocumentTextIcon,
  FolderIcon,
  HomeIcon,
  ImageIcon,
  LaunchIcon,
  PackageIcon,
  StarIcon,
  TagIcon,
  UserIcon,
} from '@sanity/icons';
import { Badge, Button, Card, Flex, Heading, Stack, Text } from '@sanity/ui';
import { type ComponentType, useEffect, useId, useState } from 'react';

import { assetSummary, countLabel, PLURALS } from '../lib/assets.js';
import { studioEditUrl } from '../lib/documents.js';
import { documentLabel, documentTypeLabel } from '../lib/labels.js';
import { RECONSTRUCTION_FAILED } from '../lib/reconstruct.js';
import {
  actionKind,
  type ActionCount,
  type DocumentGroup,
  type SessionView,
} from '../lib/report-view.js';
import { formatDayLabel, formatDuration, formatTime } from '../lib/time.js';
import type { ResolvedDocument } from '../lib/types.js';
import {
  actionBadgeText,
  actionKindLabel,
  actionKindTone,
  actionTimesTitle,
} from './actions.js';

/** Field chips shown before the "+ N" toggle. */
const VISIBLE_FIELDS = 4;
/** Action badges shown in a collapsed session summary. */
const SUMMARY_BADGES = 3;

const TYPE_ICONS: Record<string, ComponentType> = {
  product: PackageIcon,
  cpoProduct: PackageIcon,
  brand: TagIcon,
  award: StarIcon,
  review: CommentIcon,
  reviewAuthor: UserIcon,
  'blog-article': DocumentTextIcon,
  'blog-category': FolderIcon,
  productCategoryParent: FolderIcon,
  productCategorySub: FolderIcon,
  homePage: HomeIcon,
  settings: CogIcon,
  navbar: CogIcon,
  footer: CogIcon,
  socialMedia: CogIcon,
  redirects: CogIcon,
};

function TypeIcon({ type }: { type: string | undefined }) {
  const Icon = (type && TYPE_ICONS[type]) || DocumentIcon;
  return <Icon aria-hidden="true" />;
}

function ActionBadges({
  actions,
  timeZone,
  limit,
}: {
  actions: readonly ActionCount[];
  timeZone: string;
  limit?: number;
}) {
  const shown = limit ? actions.slice(0, limit) : actions;
  const hidden = actions.length - shown.length;
  return (
    <span className="badgeRow">
      {shown.map((action) => (
        <Badge
          key={action.kind}
          tone={actionKindTone(action.kind)}
          title={actionTimesTitle(action.times, timeZone)}
        >
          {actionBadgeText(action.kind, action.count)}
        </Badge>
      ))}
      {hidden > 0 ? <Text muted size={1}>{`+${hidden}`}</Text> : null}
    </span>
  );
}

function DocumentName({
  group,
  doc,
  studioUrl,
}: {
  group: DocumentGroup;
  doc: ResolvedDocument | undefined;
  studioUrl: string;
}) {
  const label = documentLabel(group.documentId, doc);
  const type = doc?.type ?? group.docType;
  if (!type || doc?.deleted) {
    return (
      <Text className="docItem__name" size={2} weight="medium">
        {label}
      </Text>
    );
  }
  return (
    <Text className="docItem__name" size={2} weight="medium">
      <a
        href={studioEditUrl(studioUrl, group.documentId, type)}
        rel="noreferrer noopener"
        target="_blank"
      >
        {label}
        <LaunchIcon aria-hidden="true" className="docItem__linkIcon" />
        <span className="srOnly"> (otwiera się w nowej karcie)</span>
      </a>
    </Text>
  );
}

function FieldChips({
  fields,
  failed,
}: {
  fields: readonly string[];
  failed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (fields.length === 0 && !failed) return null;
  const shown = open ? fields : fields.slice(0, VISIBLE_FIELDS);
  const hidden = fields.length - shown.length;

  return (
    <div className="badgeRow">
      <span className="srOnly">Zmienione pola:</span>
      <ul className="plainList badgeRow" id={listId}>
        {shown.map((field) => (
          <li className="fieldChip" key={field}>
            {field}
          </li>
        ))}
        {failed ? (
          <li className="fieldChip" data-tone="caution">
            {RECONSTRUCTION_FAILED}
          </li>
        ) : null}
      </ul>
      {fields.length > VISIBLE_FIELDS ? (
        <button
          aria-controls={listId}
          aria-expanded={open}
          aria-label={
            open
              ? 'Pokaż mniej pól'
              : `Pokaż jeszcze ${countLabel(hidden, PLURALS.field)}`
          }
          className="textButton"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? 'Pokaż mniej' : `+ ${hidden}`}
        </button>
      ) : null}
    </div>
  );
}

function EventTimes({
  group,
  timeZone,
}: {
  group: DocumentGroup;
  timeZone: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div className="docItem__events">
      <button
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        className="textButton"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? 'Ukryj godziny zmian' : 'Pokaż godziny zmian'}
      </button>
      {open ? (
        <ol className="eventList tabular" id={listId}>
          {group.events.map((event) => {
            const fields = event.changedFields.join(', ');
            const end =
              event.lastAt !== event.at
                ? `–${formatTime(event.lastAt, timeZone)}`
                : '';
            return (
              <li key={event.id}>
                <time dateTime={event.at}>
                  {formatTime(event.at, timeZone)}
                  {end}
                </time>{' '}
                {actionKindLabel(actionKind(event))}
                {event.mergedCount > 1
                  ? ` · ${countLabel(event.mergedCount, PLURALS.save)}`
                  : ''}
                {fields !== '' ? ` · ${fields}` : ''}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

function DocumentItem({
  group,
  doc,
  studioUrl,
  timeZone,
}: {
  group: DocumentGroup;
  doc: ResolvedDocument | undefined;
  studioUrl: string;
  timeZone: string;
}) {
  const type = doc?.type ?? group.docType;
  return (
    <li className="docItem">
      <div className="docItem__main">
        <DocumentName doc={doc} group={group} studioUrl={studioUrl} />
        <Flex align="center" gap={2} wrap="wrap">
          <Text muted size={1}>
            <TypeIcon type={type} />
          </Text>
          <Text muted size={1}>
            {`${documentTypeLabel(type) || 'Dokument'} · ${countLabel(group.saves, PLURALS.save)}`}
          </Text>
        </Flex>
        <FieldChips failed={group.failed} fields={group.fields} />
      </div>
      <div className="docItem__side">
        <ActionBadges actions={group.actions} timeZone={timeZone} />
      </div>
      <EventTimes group={group} timeZone={timeZone} />
    </li>
  );
}

type SessionCardProps = {
  view: SessionView;
  expanded: boolean;
  onToggle: (index: number) => void;
  documents: ReadonlyMap<string, ResolvedDocument>;
  studioUrl: string;
  timeZone: string;
};

function SessionCard({
  view,
  expanded,
  onToggle,
  documents,
  studioUrl,
  timeZone,
}: SessionCardProps) {
  const { session } = view;
  const bodyId = `session-${session.index}-body`;
  const assets = assetSummary(view.assets);
  const first = view.documents[0];
  const others = view.documents.length - 1;
  const meta = [
    `sesja ${session.index}`,
    formatDuration(session.durationMinutes),
    countLabel(view.documents.length, PLURALS.document),
  ];
  const assetCount = view.assets.images + view.assets.files;
  if (assetCount > 0 && view.documents.length === 0 && assets) {
    meta.push(assets.replace('Dodano ', ''));
  }

  return (
    <li id={`session-${session.index}`}>
      <Card border radius={3}>
        <h3 className="sessionCard__heading">
          <button
            aria-controls={expanded ? bodyId : undefined}
            aria-expanded={expanded}
            className="sessionCard__toggle tabular"
            data-session-toggle={session.index}
            onClick={() => onToggle(session.index)}
            type="button"
          >
            <ChevronDownIcon
              aria-hidden="true"
              className="sessionCard__chevron"
            />
            <span className="sessionCard__title">
              {`${formatDayLabel(view.date)} · ${formatTime(session.start, timeZone)}–${formatTime(session.end, timeZone)}`}
            </span>
            <span className="sessionCard__meta">{meta.join(' · ')}</span>
          </button>
        </h3>

        {!expanded && (first || assets) ? (
          <div className="sessionCard__summary">
            <Flex align="center" gap={3} wrap="wrap">
              {first ? (
                <Text muted size={1}>
                  {documentLabel(first.documentId, documents.get(first.documentId)) +
                    (others > 0
                      ? ` i ${countLabel(others, PLURALS.other)}`
                      : '')}
                </Text>
              ) : null}
              <ActionBadges
                actions={view.actions}
                limit={SUMMARY_BADGES}
                timeZone={timeZone}
              />
            </Flex>
          </div>
        ) : null}

        {expanded ? (
          <div className="sessionCard__body" id={bodyId}>
            {view.documents.length > 0 ? (
              <ul className="plainList">
                {view.documents.map((group) => (
                  <DocumentItem
                    doc={documents.get(group.documentId)}
                    group={group}
                    key={group.documentId}
                    studioUrl={studioUrl}
                    timeZone={timeZone}
                  />
                ))}
              </ul>
            ) : null}
            {assets ? (
              <p className="assetLine">
                <ImageIcon aria-hidden="true" />
                {assets}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>
    </li>
  );
}

type SessionListProps = {
  views: readonly SessionView[];
  expanded: ReadonlySet<number>;
  onToggle: (index: number) => void;
  onSetAll: (open: boolean) => void;
  /** Session to scroll to after the next render, if any. */
  scrollTarget: { index: number; nonce: number } | null;
  documents: ReadonlyMap<string, ResolvedDocument>;
  studioUrl: string;
  timeZone: string;
};

/** Instant scroll for reduced motion, and in hidden tabs (no animation). */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  if (document.visibilityState === 'hidden') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}

/** "Sesje i zmiany": one collapsible card per session, chronological. */
export function SessionList({
  views,
  expanded,
  onToggle,
  onSetAll,
  scrollTarget,
  documents,
  studioUrl,
  timeZone,
}: SessionListProps) {
  const allOpen = views.length > 0 && expanded.size >= views.length;

  useEffect(() => {
    if (!scrollTarget) return;
    const item = document.getElementById(`session-${scrollTarget.index}`);
    if (!item) return;
    item.scrollIntoView({
      behavior: scrollBehavior(),
      block: 'start',
    });
    item
      .querySelector<HTMLButtonElement>('[data-session-toggle]')
      ?.focus({ preventScroll: true });
  }, [scrollTarget]);

  return (
    <Stack as="section" aria-labelledby="sessions-heading" space={3}>
      <Flex align="center" gap={3} justify="space-between" wrap="wrap">
        <Heading as="h2" id="sessions-heading" size={1}>
          {`Sesje i zmiany (${views.length})`}
        </Heading>
        {views.length > 1 ? (
          <Button
            mode="ghost"
            onClick={() => onSetAll(!allOpen)}
            text={allOpen ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
          />
        ) : null}
      </Flex>
      <ol className="plainList sessionList">
        {views.map((view) => (
          <SessionCard
            documents={documents}
            expanded={expanded.has(view.session.index)}
            key={view.session.index}
            onToggle={onToggle}
            studioUrl={studioUrl}
            timeZone={timeZone}
            view={view}
          />
        ))}
      </ol>
    </Stack>
  );
}
