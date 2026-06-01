import type { AdminOrdersPagination } from "../types.js";
import { AdminPagination } from "./AdminPagination.js";

type OrdersPaginationProps = {
  disabled?: boolean;
  pagination: AdminOrdersPagination;
  onPageChange: (page: number) => void;
};

export function OrdersPagination({
  disabled = false,
  onPageChange,
  pagination,
}: OrdersPaginationProps) {
  return (
    <AdminPagination
      disabled={disabled}
      itemLabel="zamówień"
      pagination={pagination}
      onPageChange={onPageChange}
    />
  );
}
