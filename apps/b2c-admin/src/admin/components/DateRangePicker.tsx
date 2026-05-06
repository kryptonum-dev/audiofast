import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@sanity/icons";
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Inline,
  Label,
  Popover,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { useMemo, useState } from "react";

import type { AdminDateRangeFilter } from "../types.js";

type DateRangePickerProps = {
  value: AdminDateRangeFilter;
  onChange: (value: AdminDateRangeFilter) => void;
};

const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];
const MONTH_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});
const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function DateRangePicker({ onChange, value }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    value.from ? parseDate(value.from) : startOfMonth(new Date()),
  );
  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );
  const label = formatRangeLabel(value);

  function selectDate(dateValue: string) {
    if (!value.from || value.to) {
      onChange({
        from: dateValue,
        to: "",
      });
      return;
    }

    if (dateValue < value.from) {
      onChange({
        from: dateValue,
        to: value.from,
      });
    } else {
      onChange({
        from: value.from,
        to: dateValue,
      });
    }

    setOpen(false);
  }

  return (
    <Box>
      <Label muted size={1}>
        Data
      </Label>
      <Box marginTop={2}>
        <Popover
          content={
            <Card padding={3} radius={2}>
              <Stack space={3}>
                <Flex align="center" justify="space-between">
                  <Button
                    aria-label="Poprzedni miesiąc"
                    icon={ChevronLeftIcon}
                    mode="bleed"
                    onClick={() =>
                      setVisibleMonth(addMonths(visibleMonth, -1))
                    }
                    padding={2}
                    type="button"
                  />
                  <Text size={1} weight="medium">
                    {MONTH_FORMATTER.format(visibleMonth)}
                  </Text>
                  <Button
                    aria-label="Następny miesiąc"
                    icon={ChevronRightIcon}
                    mode="bleed"
                    onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}
                    padding={2}
                    type="button"
                  />
                </Flex>

                <Grid columns={7} gap={1}>
                  {WEEKDAYS.map((weekday) => (
                    <Text align="center" key={weekday} muted size={0}>
                      {weekday}
                    </Text>
                  ))}
                  {calendarDays.map((day, index) =>
                    day ? (
                      <Button
                        key={day.value}
                        mode={dayInRange(day.value, value) ? "default" : "bleed"}
                        onClick={() => selectDate(day.value)}
                        padding={2}
                        selected={
                          day.value === value.from || day.value === value.to
                        }
                        text={String(day.date.getDate())}
                        type="button"
                      />
                    ) : (
                      <Box key={`empty-${index}`} />
                    ),
                  )}
                </Grid>

                <Inline space={2}>
                  <Button
                    mode="ghost"
                    onClick={() => onChange({ from: "", to: "" })}
                    text="Wyczyść"
                    type="button"
                  />
                  <Button
                    mode="bleed"
                    onClick={() => setOpen(false)}
                    text="Zamknij"
                    type="button"
                  />
                </Inline>
              </Stack>
            </Card>
          }
          open={open}
          placement="bottom-start"
          portal
          radius={2}
          shadow={3}
          width={0}
        >
          <TextInput
            aria-label="Zakres dat"
            fontSize={1}
            icon={CalendarIcon}
            onClick={() => setOpen(true)}
            onFocus={() => setOpen(true)}
            padding={3}
            placeholder="Wybierz zakres dat"
            radius={2}
            readOnly
            value={label}
          />
        </Popover>
      </Box>
    </Box>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return startOfMonth(new Date());
  }

  return new Date(year, month - 1, day);
}

function buildCalendarDays(
  visibleMonth: Date,
): Array<{ date: Date; value: string } | null> {
  const firstDay = startOfMonth(visibleMonth);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();
  const days: Array<{ date: Date; value: string } | null> = Array.from(
    { length: leadingEmptyDays },
    () => null,
  );

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day,
    );
    days.push({
      date,
      value: toDateValue(date),
    });
  }

  return days;
}

function dayInRange(day: string, range: AdminDateRangeFilter): boolean {
  if (!range.from) {
    return false;
  }

  if (!range.to) {
    return day === range.from;
  }

  return day >= range.from && day <= range.to;
}

function formatRangeLabel(range: AdminDateRangeFilter): string {
  if (!range.from && !range.to) {
    return "";
  }

  if (range.from && !range.to) {
    return `${formatDate(range.from)} -`;
  }

  if (!range.from && range.to) {
    return `- ${formatDate(range.to)}`;
  }

  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

function formatDate(value: string): string {
  return DISPLAY_DATE_FORMATTER.format(parseDate(value));
}
