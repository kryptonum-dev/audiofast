import styles from './styles.module.scss';

type EmptyStateProps = {
  searchTerm?: string;
  category?: string;
};

export default function EmptyState({ searchTerm, category }: EmptyStateProps) {
  const getTitle = () => {
    if (searchTerm && category) return 'Nie znaleziono produktów';
    if (searchTerm) return 'Brak wyników wyszukiwania';
    return 'Brak produktów';
  };

  const getDescription = () => {
    if (searchTerm && category) {
      return (
        <>
          Nie znaleziono produktów dla{' '}
          <strong>&bdquo;{searchTerm}&rdquo;</strong> w tej kategorii
        </>
      );
    }
    if (searchTerm) {
      return (
        <>
          Nie znaleziono produktów dla{' '}
          <strong>&bdquo;{searchTerm}&rdquo;</strong>
        </>
      );
    }
    return 'Ta kategoria nie zawiera jeszcze żadnych produktów';
  };

  const getHint = () => {
    if (searchTerm && category) {
      return 'Spróbuj wyszukać we wszystkich kategoriach lub użyć innych słów kluczowych';
    }
    if (searchTerm) {
      return 'Spróbuj użyć innych słów kluczowych';
    }
    return 'Wróć do wszystkich produktów lub wybierz inną kategorię';
  };

  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>
        <AlertIcon />
      </div>
      <h3 className={styles.emptyTitle}>{getTitle()}</h3>
      <p className={styles.emptyDescription}>{getDescription()}</p>
      <p className={styles.emptyHint}>{getHint()}</p>
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

