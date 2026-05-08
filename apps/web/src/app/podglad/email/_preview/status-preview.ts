import type { OrderStatusUpdateTemplateProps } from '@/src/emails/order-status-update-template';
import {
  STATUS_EMAIL_CONTENT,
  type AdminOrderStatusEmailStatus,
} from '@/src/global/b2c/admin/order-status-email-content';
import { buildB2cOrderDetailEmailUrl } from '@/src/global/b2c/email-urls';

export type StatusEmailPreview = {
  path: string;
  title: string;
  props: OrderStatusUpdateTemplateProps;
};

function createStatusPreview(
  status: AdminOrderStatusEmailStatus,
  overrides: {
    path: string;
    title: string;
    trackingNumber?: string;
    trackingUrl?: string;
  },
): StatusEmailPreview {
  const content = STATUS_EMAIL_CONTENT[status];

  return {
    path: overrides.path,
    title: overrides.title,
    props: {
      customerFirstName: 'Jan',
      orderNumber: 'AF-2026-00007',
      statusLabel: content.label,
      message: content.message,
      trackingNumber: overrides.trackingNumber ?? null,
      trackingUrl: overrides.trackingUrl ?? null,
      loginUrl: buildB2cOrderDetailEmailUrl('AF-2026-00007'),
    },
  };
}

export const statusEmailPreviews: StatusEmailPreview[] = [
  createStatusPreview('processing', {
    path: 'status-realizacja',
    title: 'Status: w realizacji',
  }),
  createStatusPreview('shipped', {
    path: 'status-wyslane',
    title: 'Status: wysłane',
    trackingNumber: 'AF123456789PL',
    trackingUrl:
      'https://www.apaczka.pl/sledz-przesylke/?trackingNumber=AF123456789PL',
  }),
  createStatusPreview('cancelled', {
    path: 'status-anulowane',
    title: 'Status: anulowane',
  }),
  createStatusPreview('returned', {
    path: 'status-zwrocone',
    title: 'Status: zwrócone',
  }),
];
