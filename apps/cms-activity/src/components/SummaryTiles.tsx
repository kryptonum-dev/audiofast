import { Card, Stack, Text } from '@sanity/ui';

import { countLabel, PLURALS } from '../lib/assets.js';
import type { SummaryTiles as SummaryTilesData } from '../lib/report-view.js';
import { formatDuration, formatMinutes } from '../lib/time.js';

type Tile = { label: string; value: string; hint: string | null };

function Tile({ label, value, hint }: Tile) {
  // dt/dd must be direct children of the group element inside <dl>.
  return (
    <Card border className="tile" padding={4} radius={3}>
      <Text as="dt" muted size={1} weight="medium">
        {label}
      </Text>
      <Text as="dd" className="tabular" size={4} weight="semibold">
        {value}
      </Text>
      {hint ? (
        <Text as="dd" className="tabular" muted size={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

type SummaryTilesProps = {
  tiles: SummaryTilesData;
  gapMinutes: number;
};

/** Four headline numbers of the loaded report. */
export function SummaryTiles({ tiles, gapMinutes }: SummaryTilesProps) {
  const items: Tile[] = [
    {
      label: 'Czas aktywny (ok.)',
      value: formatMinutes(tiles.activeMinutes),
      hint: `śr. ${formatDuration(tiles.averageMinutesPerDay)} / dzień`,
    },
    {
      label: 'Dni z aktywnością',
      value: String(tiles.activeDays),
      hint: null,
    },
    {
      label: 'Sesje',
      value: String(tiles.sessions),
      hint: `przerwa > ${gapMinutes} min`,
    },
    {
      label: 'Dokumenty / publikacje',
      value: `${tiles.documents} / ${tiles.publishes}`,
      hint: `${countLabel(tiles.documents, PLURALS.document)}, ${countLabel(tiles.publishes, PLURALS.publish)}`,
    },
  ];

  return (
    <Stack space={3}>
      <dl className="tiles">
        {items.map((item) => (
          <Tile key={item.label} {...item} />
        ))}
      </dl>
      <Text muted size={1}>
        Czas aktywny to przybliżenie aktywności w CMS, nie czasu pracy.
      </Text>
    </Stack>
  );
}
