import { useClient } from '@sanity/sdk-react';
import { Card, Flex, Heading, Spinner, Stack, Text } from '@sanity/ui';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { appConfig } from '../config.js';
import { buildReport, type Report } from '../lib/build-report.js';
import {
  defaultFilters,
  hasErrors,
  parseGap,
  type ReportFilters,
  validateFilters,
} from '../lib/filters.js';
import { addDays, formatRangeLabel, todayInZone } from '../lib/time.js';
import { ExportButton } from './ExportButton.js';
import { Filters } from './Filters.js';
import { ReportView } from './ReportView.js';
import { StateCard } from './StateCard.js';
import { usePeople } from './usePeople.js';

/** The filters a loaded report was built with (labels, CSV file name). */
type LoadedParams = {
  authorId: string;
  authorName: string;
  from: string;
  to: string;
  gapMinutes: number;
};

type LoadedReport = { report: Report; params: LoadedParams };

/**
 * `idle | loading | ready | error`. `previous` keeps the last loaded report
 * on screen while a new one is loading or after a failed reload.
 */
type ReportState =
  | { status: 'idle' }
  | { status: 'loading'; progress: string; previous: LoadedReport | null }
  | { status: 'ready'; data: LoadedReport }
  | { status: 'error'; error: unknown; previous: LoadedReport | null };

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return (
    !!error &&
    typeof error === 'object' &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function currentData(state: ReportState): LoadedReport | null {
  if (state.status === 'ready') return state.data;
  if (state.status === 'idle') return null;
  return state.previous;
}

function PeopleFallback() {
  return (
    <Card border padding={4} radius={3}>
      <Flex align="center" gap={3}>
        <Spinner muted />
        <Text muted size={1}>
          Wczytywanie listy osób…
        </Text>
      </Flex>
    </Card>
  );
}

function ReportScreen() {
  const client = useClient({ apiVersion: appConfig.apiVersion });
  const { people, loadingProfiles, profileError } = usePeople();
  const { limits, timeZone, studioUrl } = appConfig;

  // "Today" is fixed for the lifetime of the screen; a reload picks up a new day.
  const today = useMemo(() => todayInZone(timeZone), [timeZone]);
  const minDate = addDays(today, -limits.maxRangeDays);

  const [filters, setFilters] = useState<ReportFilters>(() =>
    defaultFilters(today, limits),
  );
  const [state, setState] = useState<ReportState>({ status: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  const errors = validateFilters(filters, {
    maxRangeDays: limits.maxRangeDays,
    today,
  });

  useEffect(() => () => controllerRef.current?.abort(), []);

  const load = useCallback(
    async (params: ReportFilters) => {
      const gapMinutes = parseGap(params.gapMinutes);
      if (
        gapMinutes === null ||
        hasErrors(
          validateFilters(params, { maxRangeDays: limits.maxRangeDays, today }),
        )
      ) {
        return;
      }

      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      const person = people.find((p) => p.id === params.authorId);
      const loadedParams: LoadedParams = {
        authorId: params.authorId,
        authorName: person?.label ?? params.authorId,
        from: params.from,
        to: params.to,
        gapMinutes,
      };

      setState((prev) => ({
        status: 'loading',
        progress: 'Pobieranie historii…',
        previous: currentData(prev),
      }));

      try {
        const report = await buildReport(client, appConfig, {
          authorId: params.authorId,
          from: params.from,
          to: params.to,
          gapMinutes,
          signal: controller.signal,
          onProgress: (progress) => {
            if (controllerRef.current !== controller) return;
            setState((prev) =>
              prev.status === 'loading'
                ? { ...prev, progress: progress.message }
                : prev,
            );
          },
        });
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        setState({ status: 'ready', data: { report, params: loadedParams } });
      } catch (error) {
        if (controllerRef.current !== controller) return;
        controllerRef.current = null;
        if (isAbortError(error, controller.signal)) {
          // Cancelled: fall back to whatever was on screen before.
          setState((prev) => {
            const previous = currentData(prev);
            return previous
              ? { status: 'ready', data: previous }
              : { status: 'idle' };
          });
          return;
        }
        setState((prev) => ({
          status: 'error',
          error,
          previous: currentData(prev),
        }));
      }
    },
    [client, limits.maxRangeDays, people, today],
  );

  const cancel = useCallback(() => {
    // Keep the controller in the ref so the catch branch recognises the abort.
    controllerRef.current?.abort();
  }, []);

  const [lastRequested, setLastRequested] = useState<ReportFilters | null>(
    null,
  );
  const submit = () => {
    setLastRequested(filters);
    void load(filters);
  };
  const retry = () => {
    if (lastRequested) void load(lastRequested);
  };

  const data = currentData(state);
  const loading = state.status === 'loading';

  return (
    <Stack space={5}>
      <Filters
        errors={errors}
        loading={loading}
        loadingPeople={loadingProfiles}
        maxDate={today}
        minDate={minDate}
        onCancel={cancel}
        onChange={setFilters}
        onSubmit={submit}
        people={people}
        peopleError={profileError}
        value={filters}
      />

      {state.status === 'loading' ? (
        <Card padding={4} radius={3} role="status" tone="primary">
          <Flex align="center" gap={3}>
            <Spinner muted />
            <Text size={1}>{state.progress}</Text>
          </Flex>
        </Card>
      ) : null}

      {state.status === 'error' ? (
        <StateCard error={state.error} kind="error" onRetry={retry} />
      ) : null}

      {data ? (
        <Stack as="section" aria-labelledby="report-heading" space={5}>
          <Flex align="flex-end" gap={3} justify="space-between" wrap="wrap">
            <Stack space={3}>
              <Heading as="h2" id="report-heading" size={3}>
                {data.params.authorName}
              </Heading>
              <Text className="tabular" muted size={2}>
                {formatRangeLabel(data.params.from, data.params.to)}
                {state.status !== 'ready' ? ' · poprzedni wynik' : ''}
              </Text>
            </Stack>
            <ExportButton
              authorName={data.params.authorName}
              disabled={loading}
              from={data.params.from}
              report={data.report}
              to={data.params.to}
            />
          </Flex>

          {data.report.meta.truncated ? (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>
                Historia jest zbyt obszerna, aby pobrać ją w całości. Raport
                może być niepełny; zawęź zakres dat.
              </Text>
            </Card>
          ) : null}

          {data.report.events.length === 0 ? (
            <StateCard kind="empty" />
          ) : (
            <ReportView
              gapMinutes={data.params.gapMinutes}
              key={`${data.params.authorId}|${data.params.from}|${data.params.to}|${data.params.gapMinutes}|${data.report.meta.toTime}`}
              report={data.report}
              studioUrl={studioUrl}
              timeZone={timeZone}
            />
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}

/** Report screen: filters, summary tiles, day timeline, sessions, CSV. */
export function ReportApp() {
  return (
    <main className="page">
      <Stack space={5}>
        <Stack space={3}>
          <Heading as="h1" size={4}>
            Raport pracy CMS
          </Heading>
          <Text muted size={2}>
            Aktywność redaktorów w CMS na podstawie historii zmian Sanity.
          </Text>
        </Stack>
        <Suspense fallback={<PeopleFallback />}>
          <ReportScreen />
        </Suspense>
      </Stack>
    </main>
  );
}
