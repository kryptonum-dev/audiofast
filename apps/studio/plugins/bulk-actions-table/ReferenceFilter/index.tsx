import { FilterIcon, SearchIcon } from '@sanity/icons';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Flex,
  Popover,
  Stack,
  Text,
  TextInput,
} from '@sanity/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';

import { useBulkActionsTableContext } from '../context';
import { ReferenceFilterConfig } from '../types';

interface ReferenceOption {
  _id: string;
  name: string;
  imageUrl?: string | null;
}

const PopoverContent = styled(Box)`
  width: 20rem;
  max-height: 25rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const OptionsList = styled(Box)`
  overflow-y: auto;
  max-height: 18.75rem;
  -webkit-overflow-scrolling: touch;
`;

const OptionRow = styled(Flex)`
  cursor: pointer;
  padding: 0.375rem 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 100ms ease;

  &:hover {
    background-color: var(--card-code-bg-color);
  }
`;

const BrandImage = styled.img`
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
  border-radius: 0.1875rem;
  background-color: var(--card-code-bg-color);
`;

const BrandImagePlaceholder = styled.div`
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.1875rem;
  background-color: var(--card-code-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
`;


function ReferenceFilterItem({
  config,
}: {
  config: ReferenceFilterConfig;
}) {
  const {
    options: { client },
    selectedReferenceIds,
    setSelectedReferenceIds,
    paginatedClient,
  } = useBulkActionsTableContext();

  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ReferenceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const selectedIds = selectedReferenceIds[config.referenceField] || new Set<string>();

  // Fetch reference options
  useEffect(() => {
    let canceled = false;

    async function fetchOptions() {
      setLoading(true);
      try {
        const projection =
          config.groqProjection ||
          '{ _id, name }';
        const extraFilter = config.groqFilter
          ? ` && ${config.groqFilter}`
          : '';
        const results = await client.fetch<ReferenceOption[]>(
          `*[_type == $refType && !(_id in path("drafts.**"))${extraFilter}] | order(name asc) ${projection}`,
          { refType: config.referenceType },
        );
        if (!canceled) {
          setOptions(results);
        }
      } catch (err) {
        console.error('Failed to fetch reference filter options:', err);
      } finally {
        if (!canceled) setLoading(false);
      }
    }

    fetchOptions();
    return () => {
      canceled = true;
    };
  }, [client, config.referenceType, config.groqProjection, config.groqFilter]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const lower = searchTerm.toLowerCase();
    return options.filter((opt) =>
      opt.name?.toLowerCase().includes(lower),
    );
  }, [options, searchTerm]);

  const toggleOption = useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      setSelectedReferenceIds(config.referenceField, next);
      paginatedClient.setPage(0);
    },
    [selectedIds, setSelectedReferenceIds, config.referenceField, paginatedClient],
  );

  const clearAll = useCallback(() => {
    setSelectedReferenceIds(config.referenceField, new Set<string>());
    paginatedClient.setPage(0);
  }, [setSelectedReferenceIds, config.referenceField, paginatedClient]);

  const popoverContent = (
    <PopoverContent padding={2}>
      <Box marginBottom={2}>
        <TextInput
          placeholder={`Szukaj ${config.label.toLowerCase()}...`}
          value={searchTerm}
          fontSize={1}
          padding={2}
          icon={SearchIcon}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
        />
      </Box>
      {selectedIds.size > 0 && (
        <Box marginBottom={2}>
          <Flex align="center" justify="space-between" marginBottom={1}>
            <Text size={0} muted>
              Wybrane ({selectedIds.size})
            </Text>
            <Button
              fontSize={0}
              padding={1}
              text="Wyczyść"
              mode="bleed"
              tone="critical"
              onClick={clearAll}
            />
          </Flex>
        </Box>
      )}
      <OptionsList>
        {loading ? (
          <Box padding={3}>
            <Text size={1} muted align="center">
              Ładowanie...
            </Text>
          </Box>
        ) : filteredOptions.length === 0 ? (
          <Box padding={3}>
            <Text size={1} muted align="center">
              {searchTerm ? 'Brak wyników' : 'Brak opcji'}
            </Text>
          </Box>
        ) : (
          <Stack space={1}>
            {filteredOptions.map((option) => {
              const isSelected = selectedIds.has(option._id);
              return (
                <OptionRow
                  key={option._id}
                  align="center"
                  gap={2}
                  onClick={() => toggleOption(option._id)}
                >
                  <Checkbox
                    checked={isSelected}
                    readOnly
                    style={{ pointerEvents: 'none' }}
                  />
                  {option.imageUrl ? (
                    <BrandImage
                      src={`${option.imageUrl}?w=48&h=48&fit=crop`}
                      alt={option.name}
                    />
                  ) : (
                    <BrandImagePlaceholder>
                      <Text size={0} muted>
                        ?
                      </Text>
                    </BrandImagePlaceholder>
                  )}
                  <Text size={1} weight={isSelected ? 'bold' : 'regular'}>
                    {option.name || 'Bez nazwy'}
                  </Text>
                </OptionRow>
              );
            })}
          </Stack>
        )}
      </OptionsList>
    </PopoverContent>
  );

  return (
    <Flex align="center" gap={1} style={{ flexShrink: 0 }}>
      <Popover
        content={popoverContent}
        open={open}
        portal
        placement="bottom-start"
        fallbackPlacements={['bottom-end', 'top-start']}
      >
        <Button
          ref={buttonRef}
          fontSize={1}
          padding={2}
          icon={FilterIcon}
          text={
            selectedIds.size > 0
              ? `${config.label} (${selectedIds.size})`
              : config.label
          }
          mode={selectedIds.size > 0 ? 'default' : 'ghost'}
          tone={selectedIds.size > 0 ? 'primary' : 'default'}
          onClick={() => setOpen((prev) => !prev)}
        />
      </Popover>
    </Flex>
  );
}

function ReferenceFilter() {
  const { referenceFilterConfigs } = useBulkActionsTableContext();

  if (!referenceFilterConfigs.length) return null;

  return (
    <>
      {referenceFilterConfigs.map((config) => (
        <ReferenceFilterItem
          key={config.referenceField}
          config={config}
        />
      ))}
    </>
  );
}

export default ReferenceFilter;
