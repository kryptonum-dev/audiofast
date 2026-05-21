'use client';

import { useState } from 'react';

import Button from '@/src/components/ui/Button';

type InvoiceDownloadButtonProps = {
  href: string;
  className?: string;
  isWithdrawalForm?: boolean;
  label?: string;
  loadingLabel?: string;
};

export default function InvoiceDownloadButton({
  className,
  href,
  label = 'Pobierz fakturę',
  loadingLabel = 'Przygotowujemy fakturę',
  isWithdrawalForm = false,
}: InvoiceDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function downloadInvoice() {
    setIsLoading(true);

    try {
      const response = await fetch(href, {
        cache: 'no-store',
      });

      if (!response.ok) {
        window.location.href = href;
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = getInvoiceFilename(response, href);
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      variant={isWithdrawalForm ? 'secondary' : 'primary'}
      iconUsed="arrowRight"
      className={className}
      isLoading={isLoading}
      onClick={downloadInvoice}
      type="button"
    >
      {isLoading ? loadingLabel : label}
    </Button>
  );
}

function getInvoiceFilename(response: Response, href: string) {
  const disposition = response.headers.get('content-disposition');
  const filenameMatch = disposition?.match(
    /filename\*?=(?:UTF-8''|")?([^";]+)/i,
  );

  if (filenameMatch?.[1]) {
    return decodeURIComponent(filenameMatch[1].replaceAll('"', ''));
  }

  const orderNumber = href.split('/').filter(Boolean).at(-2);
  return `faktura-${orderNumber ?? 'zamowienie'}.pdf`;
}
