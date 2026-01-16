import { FileDown } from 'lucide-react';

import type { QueryProductBySlugResult } from '@/src/global/sanity/sanity.types';

import styles from './styles.module.scss';

type DownloadablePdf = NonNullable<
  NonNullable<QueryProductBySlugResult>['downloadablePdfs']
>[number];

interface DownloadSectionProps {
  data: DownloadablePdf[];
  productSlug: string;
  customId?: string;
}

/**
 * Constructs the PDF URL under our domain
 * Example: /produkty/a10/pliki/pdf-90-11718
 */
function getPdfUrl(productSlug: string, pdfKey: string): string {
  // Extract the slug segment from full slug (e.g., "/produkty/a10/" -> "a10")
  const slugSegment = productSlug
    .replace(/^\/produkty\//, '')
    .replace(/\/$/, '');
  return `/produkty/${slugSegment}/pliki/${pdfKey}`;
}

export default function DownloadSection({
  data,
  productSlug,
  customId,
}: DownloadSectionProps) {
  if (!data || data.length === 0) return null;

  return (
    <section
      className={`${styles.downloadSection} max-width-block`}
      id={customId}
    >
      <h2 className={styles.heading}>Do pobrania</h2>
      <ul className={styles.list}>
        {data.map((pdf) => (
          <li key={pdf._key} className={styles.item}>
            <a
              href={pdf._key ? getPdfUrl(productSlug, pdf._key) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <span className={styles.iconWrapper}>
                <FileDown className={styles.icon} />
              </span>
              <span className={styles.textContent}>
                <span className={styles.title}>{pdf.title}</span>
                {pdf.description && (
                  <span className={styles.description}>{pdf.description}</span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
