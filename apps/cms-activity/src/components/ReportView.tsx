import { useCallback, useMemo, useState } from 'react';
import { Stack } from '@sanity/ui';

import type { Report } from '../lib/build-report.js';
import type { ImageCdnTarget } from '../lib/images.js';
import {
  buildSessionViews,
  buildSummaryTiles,
  buildTimeline,
  groupSessionsByDay,
} from '../lib/report-view.js';
import { DayTimeline } from './DayTimeline.js';
import { SessionList } from './SessionList.js';
import { SummaryTiles } from './SummaryTiles.js';

/** Days are expanded by default up to this many. */
const AUTO_EXPAND_DAYS = 10;

type ReportViewProps = {
  report: Report;
  gapMinutes: number;
  studioUrl: string;
  timeZone: string;
  cdn: ImageCdnTarget;
};

/**
 * Tiles, day timeline and session cards of one loaded report. Mount with a
 * `key` per report so expansion state resets on reload.
 */
export function ReportView({
  report,
  gapMinutes,
  studioUrl,
  timeZone,
  cdn,
}: ReportViewProps) {
  const tiles = useMemo(() => buildSummaryTiles(report.daily), [report]);
  const timeline = useMemo(
    () => buildTimeline(report.daily, report.sessions, report.events, timeZone),
    [report, timeZone],
  );
  const views = useMemo(
    () => buildSessionViews(report.events, report.sessions, timeZone),
    [report, timeZone],
  );

  const days = useMemo(
    () => groupSessionsByDay(views, report.daily),
    [views, report.daily],
  );

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() =>
    days.length <= AUTO_EXPAND_DAYS
      ? new Set(days.map((day) => day.date))
      : new Set(),
  );
  const [scrollTarget, setScrollTarget] = useState<{
    date: string;
    nonce: number;
  } | null>(null);

  const toggle = useCallback((date: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(open ? new Set(days.map((day) => day.date)) : new Set());
    },
    [days],
  );

  // Timeline rows point at a session; open the day group that holds it.
  const reveal = useCallback(
    (sessionIndex: number) => {
      const day = days.find((group) =>
        group.sessions.some((view) => view.session.index === sessionIndex),
      );
      if (!day) return;
      setExpanded((current) =>
        current.has(day.date) ? current : new Set(current).add(day.date),
      );
      setScrollTarget((current) => ({
        date: day.date,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    },
    [days],
  );

  return (
    <Stack space={5}>
      {tiles ? <SummaryTiles gapMinutes={gapMinutes} tiles={tiles} /> : null}
      <DayTimeline
        onSelectSession={reveal}
        timeZone={timeZone}
        timeline={timeline}
      />
      <SessionList
        cdn={cdn}
        days={days}
        documents={report.documents}
        expanded={expanded}
        onSetAll={setAll}
        onToggle={toggle}
        scrollTarget={scrollTarget}
        sessionCount={views.length}
        studioUrl={studioUrl}
        timeZone={timeZone}
      />
    </Stack>
  );
}
