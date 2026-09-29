import { SearchIcon } from '@sanity/icons';
import {
  Button,
  Card,
  Flex,
  Grid,
  Select,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import type { ReactNode } from 'react';

import type { FilterErrors, ReportFilters } from '../lib/filters.js';
import type { Person } from './usePeople.js';

type FiltersProps = {
  value: ReportFilters;
  onChange: (next: ReportFilters) => void;
  onSubmit: () => void;
  onCancel: () => void;
  people: Person[];
  loadingPeople: boolean;
  peopleError: boolean;
  errors: FilterErrors;
  /** `YYYY-MM-DD`: oldest allowed from-date. */
  minDate: string;
  /** `YYYY-MM-DD`: today in the report zone. */
  maxDate: string;
  loading: boolean;
};

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <Stack space={2}>
      <Text as="label" htmlFor={id} size={1} weight="medium">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <Card id={id} padding={3} radius={2} role="alert" tone="critical">
      <Text size={1}>{message}</Text>
    </Card>
  );
}

export function Filters({
  value,
  onChange,
  onSubmit,
  onCancel,
  people,
  loadingPeople,
  peopleError,
  errors,
  minDate,
  maxDate,
  loading,
}: FiltersProps) {
  const set = <K extends keyof ReportFilters>(key: K, next: ReportFilters[K]) =>
    onChange({ ...value, [key]: next });

  const invalid =
    errors.author !== null || errors.range !== null || errors.gap !== null;

  return (
    <Card border padding={4} radius={3}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid && !loading) onSubmit();
        }}
      >
        <Stack space={4}>
          <Grid columns={[1, 2, 4]} gap={3}>
            <Field id="filter-author" label="Osoba">
              <Select
                disabled={people.length === 0}
                id="filter-author"
                onChange={(event) => set('authorId', event.currentTarget.value)}
                value={value.authorId}
              >
                <option value="">
                  {loadingPeople ? 'Wczytywanie osób…' : 'Wybierz osobę'}
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.email && person.email !== person.label
                      ? `${person.label} (${person.email})`
                      : person.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="filter-from" label="Od">
              <TextInput
                aria-describedby={
                  errors.range ? 'filter-range-error' : undefined
                }
                id="filter-from"
                max={maxDate}
                min={minDate}
                onChange={(event) => set('from', event.currentTarget.value)}
                type="date"
                value={value.from}
              />
            </Field>
            <Field id="filter-to" label="Do">
              <TextInput
                aria-describedby={
                  errors.range ? 'filter-range-error' : undefined
                }
                id="filter-to"
                max={maxDate}
                min={minDate}
                onChange={(event) => set('to', event.currentTarget.value)}
                type="date"
                value={value.to}
              />
            </Field>
            <Field id="filter-gap" label="Przerwa między sesjami (min)">
              <TextInput
                aria-describedby={errors.gap ? 'filter-gap-error' : undefined}
                id="filter-gap"
                inputMode="numeric"
                max={480}
                min={1}
                onChange={(event) =>
                  set('gapMinutes', event.currentTarget.value)
                }
                step={1}
                type="number"
                value={value.gapMinutes}
              />
            </Field>
          </Grid>

          {peopleError ? (
            <Text muted size={1}>
              Nie udało się wczytać nazw osób; lista pokazuje identyfikatory.
            </Text>
          ) : null}
          <FieldError id="filter-range-error" message={errors.range} />
          <FieldError id="filter-gap-error" message={errors.gap} />

          <Flex align="center" gap={3} wrap="wrap">
            <Button
              disabled={invalid || loading}
              icon={SearchIcon}
              text="Pobierz raport"
              tone="primary"
              type="submit"
            />
            {loading ? (
              <Button mode="bleed" onClick={onCancel} text="Anuluj" />
            ) : null}
            {errors.author && !loading ? (
              <Text muted size={1}>
                {errors.author}
              </Text>
            ) : null}
          </Flex>
        </Stack>
      </form>
    </Card>
  );
}
