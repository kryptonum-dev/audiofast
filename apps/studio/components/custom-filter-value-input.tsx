import { TrashIcon } from '@sanity/icons';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Flex,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ArrayOfObjectsInputProps } from 'sanity';
import { set, unset, useClient, useFormValue } from 'sanity';

type FilterValue = {
  _key: string;
  filterName?: string;
  value?: string;
};

export function CustomFilterValueInput(props: ArrayOfObjectsInputProps) {
  const { value = [], onChange } = props;
  const client = useClient({ apiVersion: '2024-01-01' });
  const [availableFilters, setAvailableFilters] = useState<string[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Get the document to access selected categories
  const document = useFormValue([]) as any;

  // Memoize category IDs to prevent unnecessary re-fetches
  const categoryIds = useMemo(() => {
    if (
      !document ||
      !document.categories ||
      !Array.isArray(document.categories)
    ) {
      return [];
    }
    return document.categories
      .map((cat: any) => cat._ref)
      .filter(Boolean)
      .sort(); // Sort to ensure consistent comparison
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document?.categories]);

  // Fetch available filters from selected categories
  useEffect(() => {
    const fetchFilters = async () => {
      if (categoryIds.length === 0) {
        setAvailableFilters([]);
        setInitialLoading(false);
        return;
      }

      try {
        // Fetch all customFilters from selected categories
        const result = await client.fetch<Array<{ customFilters?: string[] }>>(
          `*[_type == "productCategorySub" && _id in $categoryIds]{customFilters}`,
          { categoryIds }
        );

        // Combine all filters from all categories and remove duplicates
        const allFilters = result
          .flatMap((cat) => cat.customFilters || [])
          .filter((filter, index, self) => self.indexOf(filter) === index)
          .sort();

        setAvailableFilters(allFilters);
      } catch (error) {
        console.error('Error fetching filters:', error);
        setAvailableFilters([]);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchFilters();
  }, [categoryIds, client]);

  const handleAdd = useCallback(() => {
    const newKey = `filter-${Date.now()}`;
    const newValue: FilterValue = {
      _key: newKey,
      filterName: undefined,
      value: undefined,
    };
    onChange(set([...(value as FilterValue[]), newValue]));
  }, [value, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      const newValue = [...(value as FilterValue[])];
      newValue.splice(index, 1);
      onChange(newValue.length > 0 ? set(newValue) : unset());
    },
    [value, onChange]
  );

  const handleFilterNameChange = useCallback(
    (index: number, filterName: string) => {
      const newValue = [...(value as FilterValue[])];
      newValue[index] = { ...newValue[index], filterName };
      onChange(set(newValue));
    },
    [value, onChange]
  );

  const handleValueChange = useCallback(
    (index: number, filterValue: string) => {
      const newValue = [...(value as FilterValue[])];
      newValue[index] = { ...newValue[index], value: filterValue };
      onChange(set(newValue));
    },
    [value, onChange]
  );

  const filterValues = (value as FilterValue[]) || [];

  // Only show loading on initial load, not on subsequent updates
  if (initialLoading) {
    return (
      <Card padding={3}>
        <Text size={1}>Ładowanie filtrów...</Text>
      </Card>
    );
  }

  // Show message when no filters are available
  if (categoryIds.length > 0 && availableFilters.length === 0) {
    return (
      <Card padding={3} tone="caution">
        <Stack space={3}>
          <Text size={1} weight="semibold">
            Brak dostępnych filtrów
          </Text>
          <Text size={1} muted>
            Wybrane kategorie nie mają zdefiniowanych niestandardowych filtrów.
            Dodaj filtry w kategoriach, aby móc przypisać wartości.
          </Text>
        </Stack>
      </Card>
    );
  }

  // If no categories selected, show informative message
  if (categoryIds.length === 0) {
    return (
      <Card padding={3} tone="transparent">
        <Text size={1} muted>
          Wybierz kategorie produktu, aby zobaczyć dostępne filtry.
        </Text>
      </Card>
    );
  }

  return (
    <Stack space={3}>
      {filterValues.map((item, index) => (
        <Card key={item._key} padding={3} border>
          <Stack space={3}>
            <Flex gap={2} align="flex-start">
              <Box flex={1}>
                <Stack space={2}>
                  <Text size={1} weight="semibold">
                    Nazwa filtra
                  </Text>
                  <Autocomplete
                    id={`filter-name-${index}`}
                    fontSize={2}
                    padding={3}
                    placeholder="Wybierz filtr..."
                    options={availableFilters.map((filter) => ({
                      value: filter,
                    }))}
                    value={item.filterName || ''}
                    onChange={(newValue) =>
                      handleFilterNameChange(index, newValue)
                    }
                    filterOption={(query, option) =>
                      option.value.toLowerCase().includes(query.toLowerCase())
                    }
                  />
                </Stack>
              </Box>
              <Box flex={1}>
                <Stack space={2}>
                  <Text size={1} weight="semibold">
                    Wartość
                  </Text>
                  <TextInput
                    fontSize={2}
                    padding={3}
                    placeholder="np. 2m, 100W, 8Ω"
                    value={item.value || ''}
                    onChange={(event) =>
                      handleValueChange(index, event.currentTarget.value)
                    }
                  />
                </Stack>
              </Box>
              <Button
                icon={TrashIcon}
                mode="bleed"
                tone="critical"
                onClick={() => handleRemove(index)}
                title="Usuń filtr"
              />
            </Flex>
            {!item.filterName && (
              <Card padding={2} tone="caution" radius={2}>
                <Text size={1}>Wybierz nazwę filtra</Text>
              </Card>
            )}
            {!item.value && item.filterName && (
              <Card padding={2} tone="caution" radius={2}>
                <Text size={1}>Podaj wartość dla filtra</Text>
              </Card>
            )}
          </Stack>
        </Card>
      ))}

      <Button text="Dodaj wartość filtra" mode="ghost" onClick={handleAdd} />

      {availableFilters.length > 0 && (
        <Card padding={3} tone="primary" radius={2}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              Dostępne filtry z wybranych kategorii:
            </Text>
            <Text size={1} muted>
              {availableFilters.join(', ')}
            </Text>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
