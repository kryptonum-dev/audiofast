import { Flex, Label, Select } from '@sanity/ui';

import { useBulkActionsTableContext } from '../context';

function FilterDropdown() {
  const { filterConfigs, activeFilters, setActiveFilter, paginatedClient } =
    useBulkActionsTableContext();

  if (!filterConfigs.length) return null;

  return (
    <>
      {filterConfigs.map((filter) => (
        <Flex key={filter.field} align="center" gap={2}>
          <Label
            style={{ whiteSpace: 'nowrap', fontSize: '0.6875rem' }}
            size={0}
          >
            {filter.label}
          </Label>
          <Select
            fontSize={1}
            padding={2}
            value={
              // Find the index of the currently active option
              String(
                filter.options.findIndex(
                  (opt) => opt.value === activeFilters[filter.field],
                ),
              )
            }
            onChange={(e) => {
              const selectedIndex = parseInt(e.currentTarget.value, 10);
              const selectedOption = filter.options[selectedIndex];
              setActiveFilter(filter.field, selectedOption?.value ?? null);
              // Reset to page 0 when filter changes
              paginatedClient.setPage(0);
            }}
          >
            {filter.options.map((option, idx) => (
              <option key={`${filter.field}-${idx}`} value={String(idx)}>
                {option.label}
              </option>
            ))}
          </Select>
        </Flex>
      ))}
    </>
  );
}

export default FilterDropdown;
