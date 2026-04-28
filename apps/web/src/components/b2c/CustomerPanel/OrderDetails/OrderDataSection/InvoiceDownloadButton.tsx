'use client';

import { useState } from 'react';

import Button from '@/src/components/ui/Button';

type InvoiceDownloadButtonProps = {
  href: string;
  className?: string;
};

export default function InvoiceDownloadButton({
  className,
  href,
}: InvoiceDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Button
      href={href}
      variant="primary"
      iconUsed="arrowRight"
      className={className}
      isLoading={isLoading}
      onClick={() => setIsLoading(true)}
    >
      {isLoading ? 'Przygotowujemy fakturę' : 'Pobierz fakturę'}
    </Button>
  );
}
