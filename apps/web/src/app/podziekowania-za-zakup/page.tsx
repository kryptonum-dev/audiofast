import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Dziękujemy za zakup | Audiofast',
  description: 'Status płatności i zamówienia w Audiofast.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function ThankYouPage() {
  redirect('/konto-klienta/');
}
