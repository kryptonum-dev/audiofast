import {
  Dispatch,
  ReactNode,
  SetStateAction,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ObjectField, SchemaType } from 'sanity';

import { Options, orderColumnDefault, rowsPerPage } from './constants';
import { ColumnOrder, useStickyStateOrder } from './hooks/useStickyStateOrder';
import { useStickyStateSet } from './hooks/useStickyStateSet';
import { FilterConfig, ReferenceFilterConfig } from './types';
import usePaginatedClient, { PaginatedClient } from './usePaginatedClient';
import { sanitizeGroqInput } from './utils/sanitization';

const BulkActionsTableContext = createContext({
  options: {} as Options,
  schemaType: {} as SchemaType,
  searchValue: '',
  setSearchValue: (searchValue: string) => {},
  pageSize: rowsPerPage[0],
  setPageSize: (num: number) => {},
  selectedColumns: new Set<string>(),
  setSelectedColumns: (set: Set<string>) => {},
  orderColumn: orderColumnDefault as ColumnOrder,
  setOrderColumn: (obj: ColumnOrder) => {},
  selectedIds: new Set<string>(),
  setSelectedIds: (() => {}) as Dispatch<SetStateAction<Set<string>>>,
  isSelectState: false,
  setIsSelectState: (bool: boolean) => {},
  paginatedClient: {} as PaginatedClient,
  activeFilters: {} as Record<string, string | null>,
  setActiveFilter: (field: string, value: string | null) => {},
  filterConfigs: [] as FilterConfig[],
  referenceFilterConfigs: [] as ReferenceFilterConfig[],
  selectedReferenceIds: {} as Record<string, Set<string>>,
  setSelectedReferenceIds: (field: string, ids: Set<string>) => {},
});

export const useBulkActionsTableContext = () =>
  useContext(BulkActionsTableContext);

export const BulkActionsTableProvider = ({
  options,
  children,
}: {
  options: Options;
  children: ReactNode;
}) => {
  const {
    type,
    schema,
    client,
    filters: filterConfigs = [],
    referenceFilters: referenceFilterConfigs = [],
  } = options;
  const schemaType = useMemo(
    () => schema.get(type) as SchemaType,
    [type, schema],
  );

  const [searchValue, setSearchValue] = useState('');
  const [pageSize, setPageSize] = useState(rowsPerPage[0]);
  const [selectedColumns, setSelectedColumns] = useStickyStateSet(
    new Set<string>(),
    `bulk-actions-table-${type}-selected-columns`,
  );
  const [orderColumn, setOrderColumn] = useStickyStateOrder(
    orderColumnDefault,
    `bulk-actions-table-${type}-order-column`,
  );
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [isSelectState, setIsSelectState] = useState<boolean>(false);

  // Initialize filter state from config defaults
  const [activeFilters, setActiveFilters] = useState<
    Record<string, string | null>
  >(() => {
    const initial: Record<string, string | null> = {};
    for (const filter of filterConfigs) {
      const defaultIdx = filter.defaultIndex ?? 0;
      initial[filter.field] = filter.options[defaultIdx]?.value ?? null;
    }
    return initial;
  });

  const setActiveFilter = (field: string, value: string | null) => {
    setActiveFilters((prev) => ({ ...prev, [field]: value }));
  };

  // Reference filter state: Record<referenceField, Set<selectedDocumentIds>>
  const [selectedReferenceIds, setSelectedReferenceIdsState] = useState<
    Record<string, Set<string>>
  >(() => {
    const initial: Record<string, Set<string>> = {};
    for (const refFilter of referenceFilterConfigs) {
      initial[refFilter.referenceField] = new Set<string>();
    }
    return initial;
  });

  const setSelectedReferenceIds = (field: string, ids: Set<string>) => {
    setSelectedReferenceIdsState((prev) => ({ ...prev, [field]: ids }));
  };

  // Build the filter query string from active filters + reference filters
  const filterQuery = useMemo(() => {
    // Simple dropdown filters
    const simpleFilterClauses = Object.values(activeFilters)
      .filter((clause): clause is string => clause !== null)
      .map((clause) => ` && ${clause}`);

    // Reference multi-select filters
    const refFilterClauses: string[] = [];
    for (const refFilter of referenceFilterConfigs) {
      const ids = selectedReferenceIds[refFilter.referenceField];
      if (ids && ids.size > 0) {
        const idList = Array.from(ids)
          .map((id) => `"${id}"`)
          .join(', ');
        refFilterClauses.push(
          ` && ${refFilter.referenceField} in [${idList}]`,
        );
      }
    }

    return [...simpleFilterClauses, ...refFilterClauses].join('');
  }, [activeFilters, selectedReferenceIds, referenceFilterConfigs]);

  const searchableFields = useMemo(
    () =>
      ('fields' in schemaType ? schemaType.fields : []).reduce(
        (agg, field: ObjectField) => {
          const name = field.name as string;

          // Validate field name for security
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            return agg; // Skip invalid field names
          }

          if (field?.type?.jsonType === 'string') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `${name} match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          if (field?.type?.name === 'slug') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `${name}.current match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          if (field?.type?.name === 'number') {
            agg.push((query: string) => {
              const sanitizedQuery = sanitizeGroqInput(query);
              return sanitizedQuery
                ? `string(${name}) match "${sanitizedQuery}*"`
                : 'true';
            });
          }
          return agg;
        },
        [] as ((q: string) => string)[],
      ),
    [schemaType],
  );

  const paginatedClient = usePaginatedClient({
    type,
    pageSize,
    selectedColumns,
    searchableFields,
    orderColumn,
    client,
    filterQuery,
  });

  const contextValue = {
    options,
    schemaType,
    searchValue,
    setSearchValue,
    pageSize,
    setPageSize,
    selectedColumns,
    setSelectedColumns,
    orderColumn,
    setOrderColumn,
    selectedIds,
    setSelectedIds,
    isSelectState,
    setIsSelectState,
    paginatedClient,
    activeFilters,
    setActiveFilter,
    filterConfigs,
    referenceFilterConfigs,
    selectedReferenceIds,
    setSelectedReferenceIds,
  };

  return (
    <BulkActionsTableContext.Provider value={contextValue}>
      {children}
    </BulkActionsTableContext.Provider>
  );
};
