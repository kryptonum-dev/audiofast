import { useCallback, useMemo, useState } from 'react';
import { Stack } from '@sanity/ui';

import type { Report } from '../lib/build-report.js';
import {
  buildSessionViews,
  buildSummaryTiles,
  buildTimeline,
} from '../lib/report-view.js';
import { DayTimeline } from './DayTimeline.js';
import { SessionList } from './SessionList.js';
import { SummaryTiles } from './SummaryTiles.js';

/** Sessions are expanded by default up to this many. */
const AUTO_EXPAND_LIMIT = 20;

type ReportViewProps = {
  report: Report;
  gapMinutes: number;
  studioUrl: string;
  timeZone: string;
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

  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() =>
    views.length <= AUTO_EXPAND_LIMIT
      ? new Set(views.map((view) => view.session.index))
      : new Set(),
  );
  const [scrollTarget, setScrollTarget] = useState<{
    index: number;
    nonce: number;
  } | null>(null);

  const toggle = useCallback((index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (open: boolean) => {
      setExpanded(
        open ? new Set(views.map((view) => view.session.index)) : new Set(),
      );
    },
    [views],
  );

  const reveal = useCallback((index: number) => {
    setExpanded((current) =>
      current.has(index) ? current : new Set(current).add(index),
    );
    setScrollTarget((current) => ({
      index,
      nonce: (current?.nonce ?? 0) + 1,
    }));
  }, []);

  return (
    <Stack space={5}>
      {tiles ? <SummaryTiles gapMinutes={gapMinutes} tiles={tiles} /> : null}
      <DayTimeline
        onSelectSession={reveal}
        timeZone={timeZone}
        timeline={timeline}
      />
      <SessionList
        documents={report.documents}
        expanded={expanded}
        onSetAll={setAll}
        onToggle={toggle}
        scrollTarget={scrollTarget}
        studioUrl={studioUrl}
        timeZone={timeZone}
        views={views}
      />
    </Stack>
  );
}
