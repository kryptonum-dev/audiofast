import { ResetIcon, SearchIcon } from "@sanity/icons";
import { Box, Button, Card, Flex, Grid, Label, TextInput } from "@sanity/ui";
import { useEffect, useState } from "react";

import type { CouponsFilters as CouponsFiltersValue } from "../types.js";
import { AdminFilterSelect } from "./AdminFilterSelect.js";

type CouponsFiltersProps = {
  filters: CouponsFiltersValue;
  onChange: (filters: CouponsFiltersValue) => void;
  onReset: () => void;
};

export const DEFAULT_COUPONS_FILTERS: CouponsFiltersValue = {
  search: "",
  status: "all",
  discountType: "all",
};

export function CouponsFilters({
  filters,
  onChange,
  onReset,
}: CouponsFiltersProps) {
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
          <Grid columns={[1, 1, 5]} gap={3}>
            <Box column={[1, 1, 2]}>
              <Label muted size={1}>
                Szukaj
              </Label>
              <Box marginTop={2}>
                <TextInput
                  aria-label="Szukaj kuponów"
                  fontSize={1}
                  icon={SearchIcon}
                  onChange={(event) =>
                    setSearchDraft(event.currentTarget.value)
                  }
                  padding={3}
                  placeholder="Kod kuponu"
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
                  status: value as CouponsFiltersValue["status"],
                })
              }
              options={[
                ["all", "Wszystkie"],
                ["active", "Aktywne"],
                ["inactive", "Nieaktywne"],
                ["scheduled", "Zaplanowane"],
                ["expired", "Wygasłe"],
                ["usage_limit_reached", "Limit osiągnięty"],
              ]}
            />

            <AdminFilterSelect
              label="Typ rabatu"
              value={filters.discountType}
              onChange={(value) =>
                onChange({
                  ...filters,
                  discountType: value as CouponsFiltersValue["discountType"],
                })
              }
              options={[
                ["all", "Wszystkie"],
                ["fixed_order", "Kwota na koszyk"],
                ["fixed_product", "Kwota na produkty"],
                ["percent_order", "% na koszyk"],
                ["percent_product", "% na produkty"],
              ]}
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
