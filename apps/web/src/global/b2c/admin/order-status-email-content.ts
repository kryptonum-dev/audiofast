export type AdminOrderStatusEmailStatus =
  | 'processing'
  | 'shipped'
  | 'cancelled'
  | 'returned';

export const STATUS_EMAIL_CONTENT: Record<
  AdminOrderStatusEmailStatus,
  {
    label: string;
    message: string;
    subject: (orderNumber: string) => string;
  }
> = {
  processing: {
    label: 'w realizacji',
    message:
      'Zespół Audiofast rozpoczął obsługę zamówienia. Poinformujemy Cię, gdy przesyłka zostanie nadana.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} jest w realizacji`,
  },
  shipped: {
    label: 'wysłane',
    message:
      'Zamówienie zostało wysłane. Jeżeli numer śledzenia jest już dostępny, znajdziesz go poniżej.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} zostało wysłane`,
  },
  cancelled: {
    label: 'anulowane',
    message:
      'Zamówienie zostało anulowane. W razie pytań skontaktuj się z zespołem Audiofast.',
    subject: (orderNumber) => `Zamówienie ${orderNumber} zostało anulowane`,
  },
  returned: {
    label: 'zwrócone',
    message:
      'Obsługa zwrotu została zakończona po stronie Audiofast. W razie pytań skontaktuj się z zespołem Audiofast.',
    subject: (orderNumber) =>
      `Zwrot zamówienia ${orderNumber} został zakończony`,
  },
};

export function getAdminOrderStatusEmailStatus(
  status: string,
): AdminOrderStatusEmailStatus | null {
  return status === 'processing' ||
    status === 'shipped' ||
    status === 'cancelled' ||
    status === 'returned'
    ? status
    : null;
}
