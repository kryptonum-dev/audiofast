import { ResetIcon, SearchIcon } from "@sanity/icons";
import { Box, Button, Card, Flex, Grid, Label, TextInput } from "@sanity/ui";
import { useEffect, useState } from "react";

import type { OrdersFilters as OrdersFiltersValue } from "../types.js";
import { AdminFilterSelect } from "./AdminFilterSelect.js";
import { DateRangePicker } from "./DateRangePicker.js";

type OrdersFiltersProps = {
  filters: OrdersFiltersValue;
  onChange: (filters: OrdersFiltersValue) => void;
  onReset: () => void;
};

export const DEFAULT_ORDERS_FILTERS: OrdersFiltersValue = {
  search: "",
  status: "all",
  lineType: "all",
  dateRange: {
    from: "",
    to: "",
  },
  operations: "all",
};

export function OrdersFilters({
  filters,
  onChange,
  onReset,
}: OrdersFiltersProps) {
  const [searchDraft, setSearchDraft] = useState(filters.search);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (searchDraft === filters.search) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onChange({ ...filters, search: searchDraft });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [filters, onChange, searchDraft]);

  return (
    <Box paddingX={3} paddingBottom={3}>
      <Card border radius={2}>
        <Box padding={3}>
          <Grid columns={[1, 1, 7]} gap={3}>
            <Box column={[1, 1, 2]}>
              <Label muted size={1}>
                Szukaj
              </Label>
              <Box marginTop={2}>
                <TextInput
                  aria-label="Szukaj zamówień"
                  fontSize={1}
                  icon={SearchIcon}
                  onChange={(event) =>
                    setSearchDraft(event.currentTarget.value)
                  }
                  padding={3}
                  placeholder="Nr zamówienia, klient, e-mail"
                  radius={2}
                  value={searchDraft}
                />
              </Box>
            </Box>

            <AdminFilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) =>
                onChange({
                  ...filters,
                  status: value as OrdersFiltersValue["status"],
                })
              }
              options={[
                ["all", "Wszystkie"],
                ["awaiting_payment", "Oczekuje na płatność"],
                ["awaiting_confirmation", "Oczekiwanie na potwierdzenie"],
                ["processing", "W realizacji"],
                ["shipped", "Wysłane"],
                ["completed", "Zakończone"],
                ["cancelled", "Anulowane"],
                ["returned", "Zwrócone"],
              ]}
            />

            <AdminFilterSelect
              label="Typ"
              value={filters.lineType}
              onChange={(value) =>
                onChange({
                  ...filters,
                  lineType: value as OrdersFiltersValue["lineType"],
                })
              }
              options={[
                ["all", "Wszystkie"],
                ["standard", "Katalogowe"],
                ["cpo", "CPO"],
                ["mixed", "Mieszane"],
              ]}
            />

            <AdminFilterSelect
              label="Operacje"
              value={filters.operations}
              onChange={(value) =>
                onChange({
                  ...filters,
                  operations: value as OrdersFiltersValue["operations"],
                })
              }
              options={[
                ["all", "Wszystkie"],
                ["cancellation", "Anulowanie"],
                ["return", "Zwrot"],
              ]}
            />

            <DateRangePicker
              value={filters.dateRange}
              onChange={(dateRange) => onChange({ ...filters, dateRange })}
            />

            <Flex align="flex-end" gap={3}>
              <Button
                icon={ResetIcon}
                mode="ghost"
                onClick={onReset}
                padding={3}
                text="Wyczyść"
                type="button"
              />
            </Flex>
          </Grid>
        </Box>
      </Card>
    </Box>
  );
}
