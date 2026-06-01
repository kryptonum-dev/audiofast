export const CUSTOMER_ORDERS_ITEMS_PER_PAGE = 8;

export const CUSTOMER_ORDERS_SORT_OPTIONS = [
  { value: 'newest', label: 'Najnowsze' },
  { value: 'oldest', label: 'Najstarsze' },
  { value: 'totalDesc', label: 'Najwyższa wartość' },
  { value: 'totalAsc', label: 'Najniższa wartość' },
] as const;

export type CustomerOrdersSortBy =
  (typeof CUSTOMER_ORDERS_SORT_OPTIONS)[number]['value'];

export type CustomerOrdersSearchParams = {
  page?: string | string[];
  sortBy?: string | string[];
};

export function parseCustomerOrdersPage(value: unknown): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const page = Number(candidate);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function parseCustomerOrdersSortBy(
  value: unknown,
): CustomerOrdersSortBy {
  const candidate = Array.isArray(value) ? value[0] : value;

  return CUSTOMER_ORDERS_SORT_OPTIONS.some(
    (option) => option.value === candidate,
  )
    ? (candidate as CustomerOrdersSortBy)
    : 'newest';
}
