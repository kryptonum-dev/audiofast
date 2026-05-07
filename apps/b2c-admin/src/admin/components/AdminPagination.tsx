import { ChevronLeftIcon, ChevronRightIcon } from "@sanity/icons";
import { Box, Button, Card, Flex, Inline, Select, Text } from "@sanity/ui";

type AdminPaginationProps = {
  disabled?: boolean;
  itemLabel: string;
  onPageChange: (page: number) => void;
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

type PageSelectItem = {
  kind: "select";
  from: number;
  to: number;
};

type PageItem = number | PageSelectItem;

export function AdminPagination({
  disabled = false,
  itemLabel,
  onPageChange,
  pagination,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, pagination.totalPages);
  const currentPage = Math.min(pagination.currentPage, totalPages);
  const firstVisibleItem =
    pagination.totalCount === 0
      ? 0
      : (currentPage - 1) * pagination.pageSize + 1;
  const lastVisibleItem = Math.min(
    currentPage * pagination.pageSize,
    pagination.totalCount,
  );
  const pageItems = buildPageItems(currentPage, totalPages);

  return (
    <Box padding={3}>
      <Card border radius={2}>
        <Flex align="center" justify="space-between" padding={3} wrap="wrap">
          <Text muted size={1}>
            {firstVisibleItem}-{lastVisibleItem} z {pagination.totalCount}{" "}
            {itemLabel}
          </Text>

          <Inline space={2}>
            <Button
              disabled={disabled || currentPage <= 1}
              icon={ChevronLeftIcon}
              mode="ghost"
              onClick={() => onPageChange(currentPage - 1)}
              padding={2}
              text="Poprzednia"
              type="button"
            />
            {pageItems.map((item) =>
              typeof item !== "number" ? (
                <Select
                  aria-label="Wybierz stronę"
                  disabled={disabled}
                  fontSize={1}
                  key={`${item.from}-${item.to}`}
                  onChange={(event) =>
                    onPageChange(Number.parseInt(event.currentTarget.value, 10))
                  }
                  padding={2}
                  radius={2}
                  value=""
                >
                  <option value="" disabled>
                    ...
                  </option>
                  {Array.from(
                    { length: item.to - item.from + 1 },
                    (_, index) => item.from + index,
                  ).map((page) => (
                    <option key={page} value={page}>
                      {page}
                    </option>
                  ))}
                </Select>
              ) : (
                <Button
                  key={item}
                  disabled={disabled}
                  mode={item === currentPage ? "default" : "bleed"}
                  onClick={() => onPageChange(item)}
                  padding={2}
                  selected={item === currentPage}
                  text={String(item)}
                  type="button"
                />
              ),
            )}
            <Button
              disabled={disabled || currentPage >= totalPages}
              iconRight={ChevronRightIcon}
              mode="ghost"
              onClick={() => onPageChange(currentPage + 1)}
              padding={2}
              text="Następna"
              type="button"
            />
          </Inline>
        </Flex>
      </Card>
    </Box>
  );
}

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, currentPage, totalPages]);
  const sortedPages = [...visiblePages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const items: PageItem[] = [];

  for (const page of sortedPages) {
    const previous = items.at(-1);

    if (typeof previous === "number" && page - previous > 1) {
      items.push({
        kind: "select",
        from: previous + 1,
        to: page - 1,
      });
    }

    items.push(page);
  }

  return items;
}
