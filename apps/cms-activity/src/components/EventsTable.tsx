import { LaunchIcon } from '@sanity/icons';
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  Flex,
  Heading,
  Stack,
  Text,
} from '@sanity/ui';
import { Fragment, useState } from 'react';

import { studioEditUrl } from '../lib/documents.js';
import { actionLabel, documentLabel, EMPTY_CELL } from '../lib/labels.js';
import { formatDateTime, formatMinutes, formatTime } from '../lib/time.js';
import type {
  ActivityEvent,
  ResolvedDocument,
  Session,
  SessionedEvent,
} from '../lib/types.js';

/** Rows rendered at once; more are added on demand to keep the DOM light. */
const PAGE_SIZE = 500;

const COLUMNS = [
  'Data i godzina',
  'Redaktor',
  'Dokument',
  'Typ',
  'Akcja',
  'Zmienione pola',
  'Zapisy',
  'Sesja',
] as const;

type EventsTableProps = {
  events: SessionedEvent[];
  sessions: Session[];
  documents: ReadonlyMap<string, ResolvedDocument>;
  authorName: string;
  studioUrl: string;
  timeZone: string;
};

function actionTone(
  event: Pick<ActivityEvent, 'action' | 'direct'>,
): BadgeTone {
  switch (event.action) {
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
      return event.direct ? 'caution' : 'default';
  }
}

function SessionSeparator({
  session,
  timeZone,
}: {
  session: Session | undefined;
  timeZone: string;
}) {
  if (!session) return null;
  return (
    <tr className="reportTable__session">
      <td colSpan={COLUMNS.length}>
        <Text muted size={1} weight="semibold">
          {`Sesja ${session.index} · ${formatDateTime(session.start, timeZone)}–${formatTime(session.end, timeZone)} · ${formatMinutes(session.durationMinutes)} · zdarzeń: ${session.eventCount}`}
        </Text>
      </td>
    </tr>
  );
}

function DocumentCell({
  event,
  doc,
  studioUrl,
}: {
  event: SessionedEvent;
  doc: ResolvedDocument | undefined;
  studioUrl: string;
}) {
  const label = documentLabel(event.documentId, doc);
  const type = doc?.type ?? event.docType;
  if (!type || doc?.deleted) return <Text size={1}>{label}</Text>;
  return (
    <Text size={1}>
      <a
        href={studioEditUrl(studioUrl, event.documentId, type)}
        rel="noreferrer noopener"
        target="_blank"
      >
        {label}
        <LaunchIcon aria-hidden="true" className="reportTable__linkIcon" />
        <span className="srOnly"> (otwiera się w nowej karcie)</span>
      </a>
    </Text>
  );
}

export function EventsTable({
  events,
  sessions,
  documents,
  authorName,
  studioUrl,
  timeZone,
}: EventsTableProps) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sessionByIndex = new Map(sessions.map((s) => [s.index, s]));
  const shown = events.slice(0, visible);
  const remaining = events.length - shown.length;

  return (
    <Card border padding={4} radius={3}>
      <Stack space={4}>
        <Heading as="h2" id="events-heading" size={1}>
          {`Zmiany w treściach (${events.length})`}
        </Heading>
        <div className="reportTable__scroll">
          <table aria-labelledby="events-heading" className="reportTable">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} scope="col">
                    <Text size={1} weight="semibold">
                      {column}
                    </Text>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((event, index) => {
                const doc = documents.get(event.documentId);
                const newSession =
                  index === 0 ||
                  shown[index - 1]?.sessionIndex !== event.sessionIndex;
                return (
                  <Fragment key={event.id}>
                    {newSession ? (
                      <SessionSeparator
                        session={sessionByIndex.get(event.sessionIndex)}
                        timeZone={timeZone}
                      />
                    ) : null}
                    <tr>
                      <td className="reportTable__nowrap">
                        <Text size={1}>
                          {formatDateTime(event.at, timeZone)}
                        </Text>
                      </td>
                      <td>
                        <Text size={1}>{authorName}</Text>
                      </td>
                      <td>
                        <DocumentCell
                          doc={doc}
                          event={event}
                          studioUrl={studioUrl}
                        />
                      </td>
                      <td>
                        <Text muted size={1}>
                          {doc?.type ?? event.docType ?? EMPTY_CELL}
                        </Text>
                      </td>
                      <td>
                        <Badge tone={actionTone(event)}>
                          {actionLabel(event)}
                        </Badge>
                      </td>
                      <td>
                        <Text size={1}>
                          {event.changedFields.length > 0
                            ? event.changedFields.join(', ')
                            : EMPTY_CELL}
                        </Text>
                      </td>
                      <td className="reportTable__numeric">
                        <Text size={1}>{String(event.mergedCount)}</Text>
                      </td>
                      <td className="reportTable__numeric">
                        <Text size={1}>{String(event.sessionIndex)}</Text>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {remaining > 0 ? (
          <Flex align="center" gap={3} wrap="wrap">
            <Button
              mode="ghost"
              onClick={() => setVisible((count) => count + PAGE_SIZE)}
              text={`Pokaż kolejne (${Math.min(PAGE_SIZE, remaining)} z ${remaining})`}
            />
            <Text muted size={1}>
              Eksport CSV zawiera wszystkie wiersze.
            </Text>
          </Flex>
        ) : null}
      </Stack>
    </Card>
  );
}
