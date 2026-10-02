import { Card, Heading, Stack } from '@sanity/ui';
import type { CSSProperties } from 'react';

import { countLabel, PLURALS } from '../lib/assets.js';
import type { Timeline, TimelineDay } from '../lib/report-view.js';
import {
  formatDayLabel,
  formatDuration,
  formatMinutes,
  formatTime,
} from '../lib/time.js';

type DayTimelineProps = {
  timeline: Timeline;
  timeZone: string;
  /** Reveal and scroll to a session card. */
  onSelectSession: (sessionIndex: number) => void;
};

/** `a`, `a i b`, `a, b i c`. */
function joinPl(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} i ${items[items.length - 1]}`;
}

function span(start: string, end: string, timeZone: string): string {
  return `${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`;
}

function rowLabel(day: TimelineDay, timeZone: string): string {
  const spans = day.blocks.map((block) =>
    span(block.start, block.end, timeZone),
  );
  const parts = [
    countLabel(day.sessions, PLURALS.session) +
      (spans.length > 0 ? `, ${joinPl(spans)}` : ''),
    `łącznie ${formatMinutes(day.activeMinutes)}`,
    countLabel(day.documents, PLURALS.document),
    countLabel(day.publishes, PLURALS.publish),
  ];
  return `${formatDayLabel(day.date)}: ${parts.join(', ')}`;
}

function percent(minute: number, startHour: number, hours: number): number {
  return ((minute - startHour * 60) / (hours * 60)) * 100;
}

/** One row per active day with a block per session on a shared hour axis. */
export function DayTimeline({
  timeline,
  timeZone,
  onSelectSession,
}: DayTimelineProps) {
  const { axisStartHour, axisEndHour, days } = timeline;
  const hours = axisEndHour - axisStartHour;
  const tickStep = hours > 12 ? 2 : 1;
  const ticks: number[] = [];
  for (let hour = axisStartHour; hour <= axisEndHour; hour += tickStep) {
    ticks.push(hour);
  }
  if (ticks[ticks.length - 1] !== axisEndHour) ticks.push(axisEndHour);
  const trackStyle = { '--hours': hours } as CSSProperties;

  return (
    <Card border padding={[3, 4]} radius={3}>
      <Stack space={4}>
        <Heading as="h2" id="timeline-heading" size={1}>
          Dzień po dniu
        </Heading>

        <div>
          <div aria-hidden="true" className="timeline__axis">
            <span />
            <div className="timeline__ticks tabular">
              {ticks.map((hour, index) => (
                <span
                  className="timeline__tick"
                  data-minor={index % 2 === 1 || undefined}
                  key={hour}
                  style={{
                    left: `${((hour - axisStartHour) / hours) * 100}%`,
                  }}
                >
                  {`${hour}:00`}
                </span>
              ))}
            </div>
            <span />
          </div>

          <ol aria-labelledby="timeline-heading" className="plainList">
            {days.map((day) => {
              const target = day.firstSessionIndex ?? day.blocks[0]?.sessionIndex;
              return (
                <li key={day.date}>
                  <button
                    aria-label={rowLabel(day, timeZone)}
                    className="timeline__row tabular"
                    disabled={target === undefined}
                    onClick={() => {
                      if (target !== undefined) onSelectSession(target);
                    }}
                    type="button"
                  >
                    <span className="timeline__date">
                      <span className="timeline__primary">
                        {formatDayLabel(day.date)}
                      </span>
                      <span className="timeline__secondary">
                        {span(day.firstAt, day.lastAt, timeZone)}
                      </span>
                    </span>
                    <span className="timeline__track" style={trackStyle}>
                      {day.blocks.map((block) => {
                        const left = percent(
                          block.startMinute,
                          axisStartHour,
                          hours,
                        );
                        const width =
                          percent(block.endMinute, axisStartHour, hours) - left;
                        return (
                          <span
                            className="timeline__block"
                            key={block.sessionIndex}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={`${span(block.start, block.end, timeZone)} (${formatDuration((Date.parse(block.end) - Date.parse(block.start)) / 60_000)})`}
                          />
                        );
                      })}
                    </span>
                    <span className="timeline__total">
                      <span className="timeline__primary">
                        {formatDuration(day.activeMinutes)}
                      </span>
                      <span className="timeline__secondary">
                        {`${day.documents} dok. · ${day.publishes} publ.`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Stack>
    </Card>
  );
}
