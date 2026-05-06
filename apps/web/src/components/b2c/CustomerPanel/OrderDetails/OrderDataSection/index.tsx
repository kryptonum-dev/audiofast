import Button from '@/src/components/ui/Button';
import { formatCustomerOrderDate } from '@/src/global/b2c/customer-auth/orders-formatting';
import type {
  CustomerOrderAddressBlock,
  CustomerOrderDetail,
  CustomerOrderShipmentSnapshot,
} from '@/src/global/b2c/customer-auth/server/order-detail';

import InvoiceDownloadButton from './InvoiceDownloadButton';
import styles from './styles.module.scss';

type OrderDataSectionProps = {
  order: CustomerOrderDetail;
};

function renderOptionalValue(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : 'Brak danych';
}

function getShipmentTrackingHref(
  shipment: CustomerOrderShipmentSnapshot,
): string {
  return (
    shipment.trackingUrl ??
    `https://www.apaczka.pl/sledz-przesylke/?trackingNumber=${encodeURIComponent(
      shipment.trackingNumber ?? '',
    )}`
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{renderOptionalValue(value)}</dd>
    </div>
  );
}

function InvoiceBuyerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 21v-2a4 4 0 0 1 4-4h2M22 16c0 4-2.5 6-3.5 6S15 20 15 16c1 0 2.5-.5 3.5-1.5 1 1 2.5 1.5 3.5 1.5M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function InvoiceDocumentIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 3v4a1 1 0 0 0 1 1h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path
        d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2M9 7h1M9 13h6M13 17h2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function ShippingAddressDetails({
  address,
}: {
  address: CustomerOrderAddressBlock;
}) {
  const visibleLines = address.lines.filter((line) => line !== 'PL');

  return (
    <dl className={styles.shippingAddressGrid}>
      <DetailRow label="Ulica i numer" value={visibleLines[0]} />
      <DetailRow label="Kod i miasto" value={visibleLines[1]} />
      <DetailRow label="Odbiorca" value={address.recipientName} />
      <DetailRow label="Telefon" value={address.phone} />
    </dl>
  );
}

function InvoiceAddressDetails({
  address,
}: {
  address: CustomerOrderAddressBlock;
}) {
  const visibleLines = address.lines.filter((line) => line !== 'PL');

  return (
    <dl className={styles.shippingAddressGrid}>
      <DetailRow label="Ulica i numer" value={visibleLines[0]} />
      <DetailRow label="Kod i miasto" value={visibleLines[1]} />
    </dl>
  );
}

function InvoiceDetails({ order }: { order: CustomerOrderDetail }) {
  const invoice = order.invoice;
  const isCompany = invoice.recipientType === 'company';
  const documentCopy = invoice.hasDocument
    ? 'Faktura została dołączona do zamówienia.'
    : 'Faktura nie została jeszcze dołączona do zamówienia.';

  if (isCompany) {
    return (
      <div className={`${styles.invoiceGrid} ${styles.invoiceGridSingle}`}>
        <div
          className={`${styles.invoiceColumn} ${styles.invoiceColumnCompany}`}
        >
          <div className={styles.invoiceColumnHeader}>
            <span className={styles.invoiceIcon}>
              <InvoiceBuyerIcon />
            </span>
            <h3>Dane firmowe</h3>
          </div>
          <dl className={styles.inlineDetails}>
            <DetailRow label="Firma" value={invoice.companyName} />
            <DetailRow label="NIP" value={invoice.taxId} />
          </dl>
          {invoice.address ? (
            <InvoiceAddressDetails address={invoice.address} />
          ) : (
            <p className={styles.mutedText}>
              Brak oddzielnego adresu firmowego.
            </p>
          )}

          <div className={styles.invoiceDocumentInline}>
            <div className={styles.invoiceColumnHeader}>
              <span className={styles.invoiceIcon}>
                <InvoiceDocumentIcon />
              </span>
              <div>
                <h3>Faktura</h3>
                <p>{documentCopy}</p>
              </div>
            </div>
            <div className={styles.invoiceDocumentAction}>
              {invoice.attachedAt ? (
                <span>
                  Dodano {formatCustomerOrderDate(invoice.attachedAt)}
                </span>
              ) : null}
              {invoice.downloadHref ? (
                <InvoiceDownloadButton
                  href={invoice.downloadHref}
                  className={styles.documentButton}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.invoiceGrid} ${styles.invoiceGridSingle}`}>
      <div className={`${styles.invoiceColumn} ${styles.invoiceDocumentCard}`}>
        <div className={styles.invoiceDocumentInline}>
          <div className={styles.invoiceColumnHeader}>
            <span className={styles.invoiceIcon}>
              <InvoiceDocumentIcon />
            </span>
            <div>
              <h3>Faktura</h3>
              <p>{documentCopy}</p>
            </div>
          </div>
          <div className={styles.invoiceDocumentAction}>
            {invoice.attachedAt ? (
              <span>Dodano {formatCustomerOrderDate(invoice.attachedAt)}</span>
            ) : null}
            {invoice.downloadHref ? (
              <InvoiceDownloadButton
                href={invoice.downloadHref}
                className={styles.documentButton}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderDataSection({ order }: OrderDataSectionProps) {
  const shipment = order.shipment;
  const hasShipmentDetails = Boolean(shipment?.trackingNumber);

  return (
    <section className={`${styles.section} ${styles.orderDataSection}`}>
      <h2>Dane zamówienia</h2>
      <div
        className={styles.orderDetailsColumns}
        data-has-shipment={hasShipmentDetails ? 'true' : 'false'}
      >
        <div className={styles.orderDetailsColumn}>
          <h3>Dane kontaktowe</h3>
          <dl className={`${styles.inlineDetails} ${styles.contactDetails}`}>
            <DetailRow
              label="Imię i nazwisko"
              value={order.customer.fullName}
            />
            <DetailRow label="E-mail" value={order.customer.email} />
            <DetailRow label="Telefon" value={order.customer.phone} />
          </dl>
        </div>

        <div
          className={`${styles.orderDetailsColumn} ${styles.shippingDetailsColumn}`}
        >
          <h3>Dane dostawy</h3>
          <ShippingAddressDetails address={order.shippingAddress} />
        </div>

        {shipment && hasShipmentDetails ? (
          <div className={styles.orderDetailsColumn}>
            <h3>Przesyłka</h3>
            <div className={styles.shipmentDetails}>
              <dl className={styles.inlineDetails}>
                {shipment.carrier ? (
                  <DetailRow label="Kurier" value={shipment.carrier} />
                ) : null}
                <DetailRow
                  label="Numer listu przewozowego"
                  value={shipment.trackingNumber}
                />
              </dl>
              <Button
                href={getShipmentTrackingHref(shipment)}
                openInNewTab
                variant="primary"
                iconUsed="arrowRight"
                className={styles.trackingButton}
              >
                Sprawdź status przesyłki
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <InvoiceDetails order={order} />
    </section>
  );
}
