import Button from '@/src/components/ui/Button';

import styles from './styles.module.scss';

type EmptyStateProps = {
  searchTerm?: string;
  category?: string;
  year?: string;
  type: 'blog' | 'products' | 'comparator-noCookies' | 'comparator-noProduct';
  button?: {
    name: string;
    href: string;
  };
};

type EmptyStateConfig = {
  title: string;
  description: string | React.ReactNode;
  hint?: string | null;
};

export default function EmptyState({
  searchTerm,
  category,
  year,
  type,
  button,
}: EmptyStateProps) {
  const contentType = type === 'blog' ? 'artykułów' : 'produktów';
  const contentTypeSingular = type === 'blog' ? 'publikacji' : 'produktów';

  // Configuration object for each type
  const getConfig = (): EmptyStateConfig => {
    // Comparator variants
    if (type === 'comparator-noCookies') {
      return {
        title: 'Brak produktów do porównania',
        description:
          'Dodaj produkty do porównania, aby zobaczyć ich specyfikacje obok siebie',
        hint: null,
      };
    }

    if (type === 'comparator-noProduct') {
      return {
        title: 'Nie znaleziono produktów do porównania',
        description:
          'Niektóre produkty mogły zostać usunięte. Dodaj nowe produkty do porównania.',
        hint: null,
      };
    }

    // Filter parts builder
    const filterParts: React.ReactNode[] = [];

    if (searchTerm) {
      filterParts.push(
        <span key="search">
          dla <strong>&bdquo;{searchTerm}&rdquo;</strong>
        </span>,
      );
    }

    if (year) {
      filterParts.push(
        <span key="year">
          z roku <strong>{year}</strong>
        </span>,
      );
    }

    if (category) {
      filterParts.push(<span key="category">w tej kategorii</span>);
    }

    // Blog/Products variants with search/category/year logic
    if (filterParts.length > 0) {
      return {
        title: `Nie znaleziono ${contentType}`,
        description: (
          <>
            Nie znaleziono {contentType}
            {filterParts.map((part, index) => (
              <span key={index}> {part}</span>
            ))}
          </>
        ),
        hint: 'Spróbuj zmienić filtry lub użyć innych słów kluczowych',
      };
    }

    return {
      title: `Brak ${contentType}`,
      description: `Ta kategoria nie zawiera jeszcze żadnych ${contentTypeSingular}`,
      hint: `Wróć do wszystkich ${contentTypeSingular} lub wybierz inną kategorię`,
    };
  };

  const config = getConfig();

  return (
    <div className={styles.emptyState} data-empty-state>
      <div className={styles.emptyIcon}>
        <AlertIcon />
      </div>
      <h3 className={styles.emptyTitle}>{config.title}</h3>
      <p className={styles.emptyDescription}>{config.description}</p>
      {config.hint && <p className={styles.emptyHint}>{config.hint}</p>}
      {button && (
        <div className={styles.emptyButton}>
          <Button href={button.href} text={button.name} />
        </div>
      )}
    </div>
  );
}

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
    <g
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      clipPath="url(#a)"
    >
      <path d="M9.996 20.777a8.94 8.94 0 0 1-2.48-.97M14 3.223a9.003 9.003 0 0 1 0 17.554M4.579 17.093a8.963 8.963 0 0 1-1.227-2.592M3.125 10.5c.16-.95.468-1.85.9-2.675l.169-.305M6.906 4.579A8.954 8.954 0 0 1 10 3.223M12 8v4M12 16v.01" />
    </g>
    <defs>
      <clipPath id="a">
        <path fill="#fff" d="M0 0h24v24H0z" />
      </clipPath>
    </defs>
  </svg>
);
