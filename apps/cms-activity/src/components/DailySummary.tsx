import { Card, Heading, Stack, Text } from '@sanity/ui';

import {
  formatDate,
  formatDateTime,
  formatMinutes,
  formatTime,
} from '../lib/time.js';
import type { DailySummary as DailySummaryData } from '../lib/types.js';

type DailySummaryProps = {
  daily: DailySummaryData;
  timeZone: string;
};

const COLUMNS = [
  'Data',
  'Pierwsza aktywność',
  'Ostatnia aktywność',
  'Sesje',
  'Czas aktywny (ok.)',
  'Dokumenty',
  'Publikacje',
] as const;

function Cell({ children, numeric }: { children: string; numeric?: boolean }) {
  return (
    <td className={numeric ? 'reportTable__numeric' : undefined}>
      <Text size={1}>{children}</Text>
    </td>
  );
}

export function DailySummary({ daily, timeZone }: DailySummaryProps) {
  const { rows, totals } = daily;

  return (
    <Card border padding={4} radius={3}>
      <Stack space={4}>
        <Heading as="h2" id="daily-summary-heading" size={1}>
          Podsumowanie dzienne
        </Heading>
        <div className="reportTable__scroll">
          <table
            aria-labelledby="daily-summary-heading"
            className="reportTable"
          >
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
              {rows.map((row) => (
                <tr key={row.date}>
                  <Cell>{formatDate(row.date)}</Cell>
                  <Cell>{formatTime(row.firstAt, timeZone)}</Cell>
                  <Cell>{formatTime(row.lastAt, timeZone)}</Cell>
                  <Cell numeric>{String(row.sessions)}</Cell>
                  <Cell numeric>{formatMinutes(row.activeMinutes)}</Cell>
                  <Cell numeric>{String(row.documents)}</Cell>
                  <Cell numeric>{String(row.publishes)}</Cell>
                </tr>
              ))}
            </tbody>
            {totals ? (
              <tfoot>
                <tr className="reportTable__totals">
                  <th scope="row">
                    <Text size={1} weight="semibold">
                      {`Razem (dni: ${totals.days})`}
                    </Text>
                  </th>
                  <Cell>
                    {totals.firstAt
                      ? formatDateTime(totals.firstAt, timeZone)
                      : '—'}
                  </Cell>
                  <Cell>
                    {totals.lastAt
                      ? formatDateTime(totals.lastAt, timeZone)
                      : '—'}
                  </Cell>
                  <Cell numeric>{String(totals.sessions)}</Cell>
                  <Cell numeric>{formatMinutes(totals.activeMinutes)}</Cell>
                  <Cell numeric>{String(totals.documents)}</Cell>
                  <Cell numeric>{String(totals.publishes)}</Cell>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <Text muted size={1}>
          Czas aktywny to przybliżenie aktywności w CMS, nie czasu pracy.
        </Text>
      </Stack>
    </Card>
  );
}
