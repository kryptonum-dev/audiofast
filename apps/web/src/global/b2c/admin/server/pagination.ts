export type AdminPagination = {
  cursor: string | null;
  limit: number;
};

export type AdminPagePagination = {
  page: number;
  limit: number;
};

type AdminPaginationOptions = {
  defaultLimit?: number;
  maxLimit?: number;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parseLimit(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

function parsePage(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : null;
}

export function parseAdminPagination(
  searchParams: URLSearchParams,
  options: AdminPaginationOptions = {},
): AdminPagination {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const parsedLimit = parseLimit(searchParams.get('limit')) ?? defaultLimit;
  const cursor = searchParams.get('cursor')?.trim() || null;

  return {
    cursor,
    limit: Math.min(Math.max(parsedLimit, 1), maxLimit),
  };
}

export function parseAdminPagePagination(
  searchParams: URLSearchParams,
  options: AdminPaginationOptions = {},
): AdminPagePagination {
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const parsedLimit = parseLimit(searchParams.get('limit')) ?? defaultLimit;
  const parsedPage = parsePage(searchParams.get('page')) ?? 1;

  return {
    page: Math.max(1, Math.floor(parsedPage)),
    limit: Math.min(Math.max(parsedLimit, 1), maxLimit),
  };
}
