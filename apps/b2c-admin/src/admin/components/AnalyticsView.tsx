import { RefreshIcon, ResetIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Spinner,
  Stack,
  Text,
} from "@sanity/ui";
import { useAuthToken } from "@sanity/sdk-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getAdminErrorMessage, fetchAdminAnalytics } from "../api.js";
import { formatMoney, formatOptionalDate } from "../formatters.js";
import type {
  AdminAnalyticsResult,
  AdminAnalyticsSeriesPoint,
  AnalyticsFilters,
} from "../types.js";
import { AdminFilterSelect } from "./AdminFilterSelect.js";
import { AdminStateCard } from "./AdminStateCard.js";
import { DateRangePicker } from "./DateRangePicker.js";

type AnalyticsState =
  | {
      status: "idle" | "loading";
      data: AdminAnalyticsResult | null;
      error: null;
    }
  | {
      status: "ready";
      data: AdminAnalyticsResult;
      error: null;
    }
  | {
      status: "error";
      data: AdminAnalyticsResult | null;
      error: string;
    };

type AnalyticsChartPoint = {
  digitalSalesCount: number;
  discountTotalCents: number;
  grossPaidRevenueCents: number;
  label: string;
  paidOrderCount: number;
  revenueCents: number;
  tooltipLabel: string;
  xLabel: string;
};

export function AnalyticsView() {
  const authToken = useAuthToken();
  const [filters, setFilters] = useState<AnalyticsFilters>(
    getDefaultAnalyticsFilters,
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>({
    status: "idle",
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!authToken) {
      setAnalyticsState({
        status: "idle",
        data: null,
        error: null,
      });
      return;
    }

    const controller = new AbortController();

    setAnalyticsState((current) => ({
      status: "loading",
      data: current.data,
      error: null,
    }));

    fetchAdminAnalytics({
      authToken,
      filters,
      signal: controller.signal,
    })
      .then((data) => {
        setAnalyticsState({
          status: "ready",
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setAnalyticsState((current) => ({
          status: "error",
          data: current.data,
          error: getAdminErrorMessage(
            error,
            "Nie udało się załadować analityki.",
          ),
        }));
      });

    return () => controller.abort();
  }, [authToken, filters, refreshToken]);

  if (!authToken) {
    return (
      <AdminStateCard
        heading="Łączenie z sesją Sanity"
        description="Panel analityki uruchomi się po otrzymaniu aktywnego tokenu operatora."
        loading
      />
    );
  }

  const data = analyticsState.data;

  return (
    <Box>
      <AnalyticsFiltersCard
        filters={filters}
        onChange={setFilters}
        onRefresh={() => setRefreshToken((value) => value + 1)}
        onReset={() => setFilters(getDefaultAnalyticsFilters())}
      />

      {analyticsState.status === "error" ? (
        <AdminStateCard
          action={
            <Button
              icon={RefreshIcon}
              onClick={() => setRefreshToken((value) => value + 1)}
              text="Spróbuj ponownie"
              tone="primary"
              type="button"
            />
          }
          heading="Nie udało się załadować analityki"
          description={analyticsState.error}
          tone="critical"
        />
      ) : null}

      {analyticsState.status === "loading" && !data ? (
        <AnalyticsLoadingState />
      ) : null}

      {data ? (
        <Stack space={3}>
          <AnalyticsMetricGrid
            data={data}
            loading={analyticsState.status === "loading"}
          />
          <RevenueChartCard
            data={data}
            loading={analyticsState.status === "loading"}
          />
        </Stack>
      ) : null}
    </Box>
  );
}

function AnalyticsFiltersCard(props: {
  filters: AnalyticsFilters;
  onChange: (filters: AnalyticsFilters) => void;
  onRefresh: () => void;
  onReset: () => void;
}) {
  return (
    <Box paddingX={3} paddingBottom={3}>
      <Card border radius={2}>
        <Box padding={3}>
          <Grid columns={[1, 1, 5]} gap={3}>
            <Box column={[1, 1, 2]}>
              <DateRangePicker
                value={props.filters.dateRange}
                onChange={(dateRange) =>
                  props.onChange({ ...props.filters, dateRange })
                }
              />
            </Box>

            <AdminFilterSelect
              label="Grupowanie"
              value={props.filters.groupBy}
              onChange={(value) =>
                props.onChange({
                  ...props.filters,
                  groupBy: value as AnalyticsFilters["groupBy"],
                })
              }
              options={[
                ["day", "Dzień"],
                ["week", "Tydzień"],
                ["month", "Miesiąc"],
              ]}
            />

            <Flex align="flex-end" gap={2} wrap="wrap">
              <Button
                icon={RefreshIcon}
                mode="ghost"
                onClick={props.onRefresh}
                padding={3}
                text="Odśwież"
                type="button"
              />
              <Button
                icon={ResetIcon}
                mode="ghost"
                onClick={props.onReset}
                padding={3}
                text="Reset"
                type="button"
              />
            </Flex>
          </Grid>
        </Box>
      </Card>
    </Box>
  );
}

function AnalyticsMetricGrid(props: {
  data: AdminAnalyticsResult;
  loading: boolean;
}) {
  return (
    <Box paddingX={3}>
      <Grid columns={[1, 2, 4]} gap={3}>
        <AnalyticsMetricCard
          label="Przychód"
          value={formatMoney(props.data.revenue.revenueCents)}
          loading={props.loading}
        />
        <AnalyticsMetricCard
          label="Zamówienia"
          value={String(props.data.revenue.revenueOrderCount)}
          loading={props.loading}
        />
        <AnalyticsMetricCard
          label="Średnia wartość"
          value={formatMoney(props.data.revenue.averageOrderValueCents)}
          loading={props.loading}
        />
        <AnalyticsMetricCard
          label="Rabaty"
          value={formatMoney(props.data.revenue.discountTotalCents)}
          loading={props.loading}
        />
      </Grid>
    </Box>
  );
}

function AnalyticsMetricCard(props: {
  label: string;
  loading: boolean;
  value: string;
}) {
  return (
    <Card border padding={4} radius={2}>
      <Flex align="flex-start" justify="space-between" gap={3}>
        <Stack space={3}>
          <Text muted size={1}>
            {props.label}
          </Text>
          <Heading as="p" size={3}>
            {props.value}
          </Heading>
        </Stack>
        {props.loading ? <Spinner muted /> : null}
      </Flex>
    </Card>
  );
}

function RevenueChartCard(props: {
  data: AdminAnalyticsResult;
  loading: boolean;
}) {
  const periodLabel = formatPeriodLabel(
    props.data.period.from,
    props.data.period.to,
  );
  const chartGroupBy = getRenderableGroupBy(props.data.period.groupBy);

  return (
    <Box paddingX={3} paddingBottom={3}>
      <Card border radius={2}>
        <Box padding={4}>
          <Stack space={4}>
            <Flex
              align="flex-start"
              justify="space-between"
              gap={3}
              wrap="wrap"
            >
              <Stack space={2}>
                <Flex align="center" gap={2}>
                  <Heading as="h2" size={1}>
                    Przychód w czasie
                  </Heading>
                  {props.loading ? <Spinner muted /> : null}
                </Flex>
                <Text muted size={1}>
                  Przychód nie obejmuje zamówień anulowanych i zwróconych.
                </Text>
              </Stack>
              <Text muted size={1}>
                {periodLabel}
              </Text>
            </Flex>

            <RevenueLineChart
              groupBy={chartGroupBy}
              period={props.data.period}
              series={props.data.series}
            />
          </Stack>
        </Box>
      </Card>
    </Box>
  );
}

function RevenueLineChart(props: {
  groupBy: AnalyticsFilters["groupBy"];
  period: AdminAnalyticsResult["period"];
  series: AdminAnalyticsSeriesPoint[];
}) {
  const chartData = useMemo(
    () => buildChartData(props.series, props.period, props.groupBy),
    [props.groupBy, props.period, props.series],
  );
  const maxRevenue = Math.max(
    ...chartData.map((point) => point.revenueCents),
    0,
  );
  const yMax = maxRevenue > 0 ? Math.ceil(maxRevenue * 1.12) : 100;

  if (chartData.length === 0) {
    return (
      <Card border padding={4} radius={2} tone="transparent">
        <Text align="center" muted size={1}>
          Wybierz zakres dat, aby zobaczyć przychód w czasie.
        </Text>
      </Card>
    );
  }

  return (
    <Box
      aria-label="Wykres przychodu w czasie"
      className="analyticsChartFrame"
      role="img"
    >
      <ResponsiveContainer height={360} width="100%">
        <LineChart
          accessibilityLayer
          data={chartData}
          margin={{ bottom: 12, left: 10, right: 18, top: 16 }}
        >
          <CartesianGrid
            stroke="var(--card-border-color, rgba(127, 127, 127, 0.22))"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            axisLine={false}
            dataKey="xLabel"
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: "var(--card-muted-fg-color, #9aa0ad)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[0, yMax]}
            tick={{ fill: "var(--card-muted-fg-color, #9aa0ad)", fontSize: 12 }}
            tickFormatter={formatCompactMoney}
            tickLine={false}
            width={64}
          />
          <Tooltip
            content={<AnalyticsChartTooltip />}
            cursor={{
              stroke: "var(--card-muted-fg-color, rgba(154, 160, 173, 0.45))",
              strokeDasharray: "4 4",
            }}
          />
          <Line
            activeDot={{ r: 6, strokeWidth: 2 }}
            dataKey="revenueCents"
            dot={{ r: 3, strokeWidth: 2 }}
            isAnimationActive={false}
            name="Przychód"
            stroke="var(--card-focus-ring-color, #556bff)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            type="linear"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

function AnalyticsChartTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload?: AnalyticsChartPoint }>;
}) {
  const point = props.payload?.[0]?.payload;

  if (!props.active || !point) {
    return null;
  }

  return (
    <Card className="analyticsChartTooltip" padding={3} radius={2} shadow={2}>
      <Stack space={3}>
        <Text size={1} weight="semibold">
          {point.tooltipLabel}
        </Text>
        <Stack space={2}>
          <TooltipRow
            label="Wolumen brutto"
            value={formatMoney(point.grossPaidRevenueCents)}
          />
          <TooltipRow
            label="Sprzedaże cyfrowe"
            value={String(point.digitalSalesCount)}
          />
          <TooltipRow label="Zamówienia" value={String(point.paidOrderCount)} />
          <TooltipRow
            label="Rabaty"
            value={formatMoney(point.discountTotalCents)}
          />
        </Stack>
      </Stack>
    </Card>
  );
}

function TooltipRow(props: { label: string; value: string }) {
  return (
    <Flex align="center" gap={4} justify="space-between">
      <Text muted size={1}>
        {props.label}
      </Text>
      <Text size={1} weight="semibold">
        {props.value}
      </Text>
    </Flex>
  );
}

function AnalyticsLoadingState() {
  return (
    <AdminStateCard
      heading="Ładowanie analityki"
      description="Pobieramy przychód i zamówienia dla wybranego okresu."
      loading
    />
  );
}

function buildChartData(
  series: AdminAnalyticsSeriesPoint[],
  period: AdminAnalyticsResult["period"],
  groupBy: AnalyticsFilters["groupBy"],
): AnalyticsChartPoint[] {
  const byLabel = new Map(series.map((point) => [point.label, point]));
  const labels = buildPeriodLabels(period.from, period.to, groupBy);

  return labels.map((label) => {
    const point = byLabel.get(label);
    const paidOrderCount = point?.paidOrderCount ?? 0;

    return {
      digitalSalesCount: point?.digitalSalesCount ?? paidOrderCount,
      discountTotalCents: point?.discountTotalCents ?? 0,
      grossPaidRevenueCents:
        point?.grossPaidRevenueCents ?? point?.revenueCents ?? 0,
      label,
      paidOrderCount,
      revenueCents: point?.revenueCents ?? 0,
      tooltipLabel: formatSeriesLabel(label, groupBy, period),
      xLabel: formatSeriesLabel(label, groupBy, period),
    };
  });
}

function buildPeriodLabels(
  fromIso: string,
  toIso: string,
  groupBy: AnalyticsFilters["groupBy"],
) {
  const from = parseIsoDateOnly(fromIso);
  const to = parseIsoDateOnly(toIso);

  if (!from || !to || from > to) {
    return [];
  }

  const labels: string[] = [];
  const cursor =
    groupBy === "month"
      ? startOfMonth(from)
      : groupBy === "week"
        ? startOfIsoWeek(from)
        : from;

  while (cursor <= to) {
    labels.push(toIsoDateOnly(cursor));

    if (groupBy === "month") {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    } else {
      cursor.setUTCDate(cursor.getUTCDate() + (groupBy === "week" ? 7 : 1));
    }
  }

  return labels;
}

function formatCompactMoney(cents: number): string {
  if (cents >= 100000) {
    return `${Math.round(cents / 100000) / 10}k`;
  }

  return formatMoney(cents).replace(",00", "");
}

function formatPeriodLabel(from: string, to: string): string {
  const fromLabel = formatOptionalDate(from);
  const toLabel = formatOptionalDate(to);

  if (!fromLabel && !toLabel) {
    return "";
  }

  return `${fromLabel} - ${toLabel}`;
}

function formatSeriesLabel(
  value: string,
  groupBy: AnalyticsFilters["groupBy"],
  period?: AdminAnalyticsResult["period"],
) {
  if (groupBy === "week" || groupBy === "month") {
    const range = getBucketRangeLabel(value, groupBy, period);

    return range || value;
  }

  return formatOptionalDate(value) || value;
}

function getBucketRangeLabel(
  value: string,
  groupBy: Exclude<AnalyticsFilters["groupBy"], "day">,
  period?: AdminAnalyticsResult["period"],
) {
  const start = parseIsoDateOnly(value);

  if (!start) {
    return "";
  }

  const end = new Date(start);

  if (groupBy === "month") {
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
  } else {
    end.setUTCDate(end.getUTCDate() + 6);
  }

  const periodFrom = period ? parseIsoDateOnly(period.from) : null;
  const periodTo = period ? parseIsoDateOnly(period.to) : null;
  const clippedStart = periodFrom && periodFrom > start ? periodFrom : start;
  const clippedEnd = periodTo && periodTo < end ? periodTo : end;

  return `${formatOptionalDate(toIsoDateOnly(clippedStart))} - ${formatOptionalDate(
    toIsoDateOnly(clippedEnd),
  )}`;
}

function parseIsoDateOnly(value: string) {
  const dateValue = value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00.000Z`);
}

function startOfIsoWeek(date: Date) {
  const weekStart = new Date(date);
  const day = weekStart.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;

  weekStart.setUTCDate(weekStart.getUTCDate() + diff);

  return weekStart;
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function toIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRenderableGroupBy(
  groupBy: AdminAnalyticsResult["period"]["groupBy"],
): AnalyticsFilters["groupBy"] {
  return groupBy === "none" ? "day" : groupBy;
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date();

  from.setDate(to.getDate() - 29);

  return {
    from: toDateValue(from),
    to: toDateValue(to),
  };
}

function getDefaultAnalyticsFilters(): AnalyticsFilters {
  return {
    dateRange: getDefaultDateRange(),
    groupBy: "day",
  };
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
