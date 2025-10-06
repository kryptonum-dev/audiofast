import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontSize: '4rem',
          fontWeight: 'bold',
          marginBottom: '1rem',
        }}
      >
        404
      </h1>
      <h2
        style={{
          fontSize: '1.5rem',
          marginBottom: '1rem',
        }}
      >
        Strona nie została znaleziona
      </h2>
      <p
        style={{
          fontSize: '1rem',
          marginBottom: '2rem',
          maxWidth: '500px',
        }}
      >
        Przepraszamy, ale strona której szukasz nie istnieje lub została
        przeniesiona.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#000',
          color: '#fff',
          textDecoration: 'none',
          borderRadius: '0.25rem',
          fontSize: '1rem',
        }}
      >
        Wróć do strony głównej
      </Link>
    </div>
  );
}
