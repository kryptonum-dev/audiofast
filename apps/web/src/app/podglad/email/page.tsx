import type { Metadata } from 'next';
import Link from 'next/link';

import { createEmailPreviewMetadata } from './_preview/email-preview';
import { statusEmailPreviews } from './_preview/status-preview';

export const metadata: Metadata = createEmailPreviewMetadata({
  title: 'Podgląd maili automatycznych',
  description: 'Lista wewnętrznych podglądów maili automatycznych B2C.',
});

const previewLinks = [
  {
    href: '/podglad/email/potwierdzenie-zamowienia/',
    title: 'Potwierdzenie opłaconego zamówienia',
    description: 'Wysyłany po zweryfikowaniu płatności i przejściu do paid.',
  },
  {
    href: '/podglad/email/faktura/',
    title: 'Faktura dostępna',
    description: 'Wysyłany po dodaniu faktury PDF przez admina.',
  },
  {
    href: '/podglad/email/zwrot-potwierdzenie/',
    title: 'Potwierdzenie zgłoszenia zwrotu',
    description: 'Wysyłany od razu po zgłoszeniu zwrotu przez klienta.',
  },
  {
    href: '/podglad/email/zwrot-instrukcja/',
    title: 'Instrukcja zwrotu',
    description: 'Wysyłany po potwierdzeniu zwrotu przez admina.',
  },
  ...statusEmailPreviews.map((preview) => ({
    href: `/podglad/email/${preview.path}/`,
    title: preview.title,
    description: 'Wariant maila aktualizacji statusu zamówienia.',
  })),
  {
    href: '/podglad/email/kod-logowania-supabase/',
    title: 'Kod logowania Supabase OTP',
    description:
      'Informacyjny podgląd domeny OTP. Dokładny szablon jest zarządzany w Supabase Auth.',
  },
];

export default function EmailPreviewIndexPage() {
  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <p style={eyebrowStyle}>Audiofast B2C</p>
        <h1 style={headingStyle}>Podgląd maili automatycznych</h1>
        <p style={leadStyle}>
          Te strony służą do lokalnego sprawdzenia wdrożonych maili
          transakcyjnych. Nie obejmują zapytań produktowych ani newslettera.
        </p>
        <div style={gridStyle}>
          {previewLinks.map((link) => (
            <Link key={link.href} href={link.href} style={cardStyle}>
              <span style={cardTitleStyle}>{link.title}</span>
              <span style={cardDescriptionStyle}>{link.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

const pageStyle = {
  minHeight: '100vh',
  backgroundColor: '#f4f4f4',
  color: '#141414',
  padding: '48px 20px',
};

const shellStyle = {
  width: 'min(960px, 100%)',
  margin: '0 auto',
};

const eyebrowStyle = {
  margin: '0 0 8px',
  color: '#777',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const headingStyle = {
  margin: '0 0 14px',
  fontSize: '36px',
  lineHeight: 1.1,
};

const leadStyle = {
  margin: '0 0 28px',
  maxWidth: '680px',
  color: '#555',
  fontSize: '16px',
  lineHeight: 1.6,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px',
};

const cardStyle = {
  display: 'flex',
  minHeight: '118px',
  flexDirection: 'column' as const,
  justifyContent: 'space-between',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  backgroundColor: '#fff',
  padding: '18px',
  color: 'inherit',
  textDecoration: 'none',
};

const cardTitleStyle = {
  fontSize: '17px',
  fontWeight: 650,
  lineHeight: 1.25,
};

const cardDescriptionStyle = {
  marginTop: '18px',
  color: '#666',
  fontSize: '13px',
  lineHeight: 1.45,
};
