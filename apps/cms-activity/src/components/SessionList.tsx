import { ChevronDownIcon, LaunchIcon } from '@sanity/icons';
import { Badge, Button, Card, Flex, Heading, Stack, Text } from '@sanity/ui';
import { useEffect, useId, useState } from 'react';

import {
  assetSummary,
  countLabel,
  pluralForm,
  PLURALS,
} from '../lib/assets.js';
import { studioEditUrl } from '../lib/documents.js';
import type { ImageCdnTarget } from '../lib/images.js';
import { documentLabel, documentTypeLabel } from '../lib/labels.js';
import { RECONSTRUCTION_FAILED } from '../lib/reconstruct.js';
import {
  actionKind,
  type ActionCount,
  type DayGroup,
  type DocumentGroup,
  type SessionView,
} from '../lib/report-view.js';
import { formatDayHeading, formatDuration, formatTime } from '../lib/time.js';
import type { ResolvedDocument } from '../lib/types.js';
import {
  actionBadgeText,
  actionKindLabel,
  actionKindTone,
  actionTimesTitle,
} from './actions.js';
import { Thumbnail, TypeIcon } from './Thumbnail.js';

/** Field chips shown before the "+ N" toggle. */
const VISIBLE_FIELDS = 4;
/** Action badges shown in a collapsed session row. */
const SUMMARY_BADGES = 3;
/** Document thumbnails shown in a collapsed session row. */
const ROW_THUMBNAILS = 3;
/** Uploaded-image thumbnails shown in the assets line. */
const ASSET_THUMBNAILS = 4;

const THUMB_EXPANDED = 52;
const THUMB_ROW = 32;
const THUMB_ASSET = 28;

type Shared = {
  documents: ReadonlyMap<string, ResolvedDocument>;
  studioUrl: string;
  timeZone: string;
  cdn: ImageCdnTarget;
};

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
    <Flex align="center" gap={2} wrap="wrap">
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
    </Flex>
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
      <Text className="docBlock__name" size={2} weight="medium">
        {label}
      </Text>
    );
  }
  return (
    <Text className="docBlock__name" size={2} weight="medium">
      <a
        href={studioEditUrl(studioUrl, group.documentId, type)}
        rel="noreferrer noopener"
        target="_blank"
      >
        {label}
        <span aria-hidden="true" className="docBlock__linkIcon">
          <LaunchIcon />
        </span>
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
    <div className="chipRow">
      <span className="srOnly">Zmienione pola:</span>
      <ul className="plainList chipRow" id={listId}>
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
    <Stack space={3}>
      <div>
        <button
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          className="textButton textButton--flush"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? 'Ukryj godziny zmian' : 'Pokaż godziny zmian'}
        </button>
      </div>
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
    </Stack>
  );
}

function DocumentBlock({
  group,
  shared,
}: {
  group: DocumentGroup;
  shared: Shared;
}) {
  const doc = shared.documents.get(group.documentId);
  const type = doc?.type ?? group.docType;
  return (
    <li className="docBlock">
      <Thumbnail
        assetId={doc?.imageRef ?? null}
        cdn={shared.cdn}
        size={THUMB_EXPANDED}
        type={type}
      />
      <Stack className="docBlock__body" space={3}>
        <Flex align="flex-start" gap={3} justify="space-between" wrap="wrap">
          <DocumentName doc={doc} group={group} studioUrl={shared.studioUrl} />
          <ActionBadges actions={group.actions} timeZone={shared.timeZone} />
        </Flex>
        <Flex align="center" gap={2}>
          <Text muted size={1}>
            <TypeIcon type={type} />
          </Text>
          <Text muted size={1}>
            {`${documentTypeLabel(type) || 'Dokument'} · ${countLabel(group.saves, PLURALS.save)}`}
          </Text>
        </Flex>
        <FieldChips failed={group.failed} fields={group.fields} />
        <EventTimes group={group} timeZone={shared.timeZone} />
      </Stack>
    </li>
  );
}

function AssetLine({ view, shared }: { view: SessionView; shared: Shared }) {
  const summary = assetSummary(view.assets);
  if (!summary) return null;
  const shown = view.imageAssetIds.slice(0, ASSET_THUMBNAILS);
  const more = view.imageAssetIds.length - shown.length;
  return (
    <Flex align="center" className="assetLine" gap={3} wrap="wrap">
      <Text muted size={1}>
        {summary}
      </Text>
      {shown.length > 0 ? (
        <Flex align="center" gap={2}>
          {shown.map((id) => (
            <Thumbnail
              assetId={id}
              cdn={shared.cdn}
              key={id}
              size={THUMB_ASSET}
              type="sanity.imageAsset"
            />
          ))}
          {more > 0 ? <Text muted size={1}>{`+${more}`}</Text> : null}
        </Flex>
      ) : null}
    </Flex>
  );
}

function SessionRow({ view, shared }: { view: SessionView; shared: Shared }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const summaryId = useId();
  const { session } = view;

  const names = view.documents.map((group) =>
    documentLabel(group.documentId, shared.documents.get(group.documentId)),
  );
  const assets = assetSummary(view.assets);
  const summaryText = names.length > 0 ? names.join(', ') : (assets ?? '');
  const span = `${formatTime(session.start, shared.timeZone)}–${formatTime(session.end, shared.timeZone)}`;
  const meta = [formatDuration(session.durationMinutes)];
  if (view.documents.length > 1) {
    meta.push(countLabel(view.documents.length, PLURALS.document));
  }

  return (
    <li className="sessionRow">
      <div className="sessionRow__summary">
        <button
          aria-controls={open ? detailsId : undefined}
          aria-describedby={open ? undefined : summaryId}
          aria-expanded={open}
          aria-label={`${span} · ${meta.join(' · ')}`}
          className="sessionRow__toggle tabular"
          onClick={() => setOpen((value) => !value)}
          title={summaryText}
          type="button"
        >
          <ChevronDownIcon aria-hidden="true" className="chevron" />
          <span className="sessionRow__time">{span}</span>
          <span className="sessionRow__meta">{meta.join(' · ')}</span>
        </button>
        <div className="sessionRow__docs" hidden={open} id={summaryId}>
          {view.documents.length > 0 ? (
            <span aria-hidden="true" className="sessionRow__thumbs">
              {view.documents.slice(0, ROW_THUMBNAILS).map((group) => {
                const doc = shared.documents.get(group.documentId);
                return (
                  <Thumbnail
                    assetId={doc?.imageRef ?? null}
                    cdn={shared.cdn}
                    key={group.documentId}
                    size={THUMB_ROW}
                    type={doc?.type ?? group.docType}
                  />
                );
              })}
            </span>
          ) : null}
          <span className="sessionRow__names">{summaryText}</span>
        </div>
        <div className="sessionRow__badges" hidden={open}>
          <ActionBadges
            actions={view.actions}
            limit={SUMMARY_BADGES}
            timeZone={shared.timeZone}
          />
        </div>
        <span className="sessionRow__index">{`sesja ${session.index}`}</span>
      </div>

      {open ? (
        <div className="sessionRow__details" id={detailsId}>
          <Stack space={4}>
            {view.documents.length > 0 ? (
              <Stack as="ul" className="plainList" space={4}>
                {view.documents.map((group) => (
                  <DocumentBlock
                    group={group}
                    key={group.documentId}
                    shared={shared}
                  />
                ))}
              </Stack>
            ) : null}
            <AssetLine shared={shared} view={view} />
          </Stack>
        </div>
      ) : null}
    </li>
  );
}

function dayMeta(day: DayGroup): string {
  const parts = [countLabel(day.sessions.length, PLURALS.session)];
  if (day.daily) {
    parts.push(
      formatDuration(day.daily.activeMinutes),
      `${day.daily.documents} dok.`,
      `${day.daily.publishes} publ.`,
    );
  }
  return parts.join(' · ');
}

function DayStats({ day }: { day: DayGroup }) {
  const stats: [string, string][] = [
    [
      String(day.sessions.length),
      pluralForm(day.sessions.length, PLURALS.session),
    ],
  ];
  if (day.daily) {
    stats.push(
      [formatDuration(day.daily.activeMinutes), 'aktywnie'],
      [
        String(day.daily.documents),
        pluralForm(day.daily.documents, PLURALS.document),
      ],
      [
        String(day.daily.publishes),
        pluralForm(day.daily.publishes, PLURALS.publish),
      ],
    );
  }
  return (
    <span aria-hidden="true" className="dayCard__stats">
      {stats.map(([value, word]) => (
        <span className="dayCard__stat" key={word}>
          <span className="dayCard__statValue">{value}</span> {word}
        </span>
      ))}
    </span>
  );
}

function DayCard({
  day,
  expanded,
  onToggle,
  shared,
}: {
  day: DayGroup;
  expanded: boolean;
  onToggle: (date: string) => void;
  shared: Shared;
}) {
  const bodyId = `day-${day.date}-sessions`;
  return (
    <li className="dayCard" id={`day-${day.date}`}>
      <Card border className="dayCard__card" radius={3}>
        <h3 className="dayCard__heading">
          <button
            aria-controls={expanded ? bodyId : undefined}
            aria-expanded={expanded}
            aria-label={`${formatDayHeading(day.date)} · ${dayMeta(day)}`}
            className="dayCard__toggle tabular"
            data-day-toggle={day.date}
            onClick={() => onToggle(day.date)}
            type="button"
          >
            <ChevronDownIcon aria-hidden="true" className="chevron" />
            <span className="dayCard__title">{formatDayHeading(day.date)}</span>
            <DayStats day={day} />
          </button>
        </h3>
        {expanded ? (
          <ol className="plainList dayCard__sessions" id={bodyId}>
            {day.sessions.map((view) => (
              <SessionRow
                key={view.session.index}
                shared={shared}
                view={view}
              />
            ))}
          </ol>
        ) : null}
      </Card>
    </li>
  );
}

type SessionListProps = Shared & {
  days: readonly DayGroup[];
  sessionCount: number;
  expanded: ReadonlySet<string>;
  onToggle: (date: string) => void;
  onSetAll: (open: boolean) => void;
  /** Day to scroll to after the next render, if any. */
  scrollTarget: { date: string; nonce: number } | null;
};

/** Instant scroll for reduced motion, and in hidden tabs (no animation). */
function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'auto';
  if (document.visibilityState === 'hidden') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
}

/** "Sesje i zmiany": one collapsible card per active day, chronological. */
export function SessionList({
  days,
  sessionCount,
  expanded,
  onToggle,
  onSetAll,
  scrollTarget,
  documents,
  studioUrl,
  timeZone,
  cdn,
}: SessionListProps) {
  const allOpen = days.length > 0 && expanded.size >= days.length;
  const shared: Shared = { documents, studioUrl, timeZone, cdn };

  useEffect(() => {
    if (!scrollTarget) return;
    const item = document.getElementById(`day-${scrollTarget.date}`);
    if (!item) return;
    item.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    item
      .querySelector<HTMLButtonElement>('[data-day-toggle]')
      ?.focus({ preventScroll: true });
  }, [scrollTarget]);

  return (
    <Stack as="section" aria-labelledby="sessions-heading" space={4}>
      <Flex align="center" gap={3} justify="space-between" wrap="wrap">
        <Heading as="h2" id="sessions-heading" size={1}>
          {`Sesje i zmiany (${sessionCount})`}
        </Heading>
        {days.length > 1 ? (
          <Button
            mode="ghost"
            onClick={() => onSetAll(!allOpen)}
            text={allOpen ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
          />
        ) : null}
      </Flex>
      <Stack as="ol" className="plainList" space={3}>
        {days.map((day) => (
          <DayCard
            day={day}
            expanded={expanded.has(day.date)}
            key={day.date}
            onToggle={onToggle}
            shared={shared}
          />
        ))}
      </Stack>
    </Stack>
  );
}
