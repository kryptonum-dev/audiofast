import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { OrderInvoiceAvailableTemplate } from '@/src/emails/order-invoice-available-template';
import { OrderStatusUpdateTemplate } from '@/src/emails/order-status-update-template';

import {
  createEmailPreviewMetadata,
  EmailPreviewFrame,
} from '../_preview/email-preview';
import { statusEmailPreviews } from '../_preview/status-preview';

type EmailPreviewRouteProps = {
  params: Promise<{
    preview: string;
  }>;
};

const invoicePreview = {
  path: 'faktura',
  title: 'Faktura dostępna',
  description: 'Wewnętrzny podgląd maila z informacją o fakturze.',
};

const otpPreview = {
  path: 'kod-logowania-supabase',
  title: 'Kod logowania Supabase OTP',
  description:
    'Informacyjny podgląd domeny OTP. Dokładny szablon jest zarządzany w Supabase Auth.',
};

export function generateStaticParams() {
  return [
    { preview: invoicePreview.path },
    { preview: otpPreview.path },
    ...statusEmailPreviews.map((preview) => ({ preview: preview.path })),
  ];
}

export async function generateMetadata({
  params,
}: EmailPreviewRouteProps): Promise<Metadata> {
  const { preview } = await params;
  const statusPreview = statusEmailPreviews.find(
    (item) => item.path === preview,
  );

  if (preview === invoicePreview.path) {
    return createEmailPreviewMetadata({
      title: `Podgląd maila | ${invoicePreview.title}`,
      description: invoicePreview.description,
    });
  }

  if (preview === otpPreview.path) {
    return createEmailPreviewMetadata({
      title: `Podgląd maila | ${otpPreview.title}`,
      description: otpPreview.description,
    });
  }

  if (statusPreview) {
    return createEmailPreviewMetadata({
      title: `Podgląd maila | ${statusPreview.title}`,
      description: 'Wewnętrzny podgląd maila aktualizacji statusu zamówienia.',
    });
  }

  return createEmailPreviewMetadata({
    title: 'Podgląd maila',
    description: 'Wewnętrzny podgląd maila automatycznego.',
  });
}

export default async function EmailPreviewPage({
  params,
}: EmailPreviewRouteProps) {
  const { preview } = await params;
  const statusPreview = statusEmailPreviews.find(
    (item) => item.path === preview,
  );

  if (preview === invoicePreview.path) {
    return (
      <EmailPreviewFrame
        ariaLabel="Podgląd maila z informacją o fakturze"
        email={OrderInvoiceAvailableTemplate({
          orderNumber: 'AF-2026-00007',
        })}
      />
    );
  }

  if (statusPreview) {
    return (
      <EmailPreviewFrame
        ariaLabel={`Podgląd maila aktualizacji statusu: ${statusPreview.title}`}
        email={OrderStatusUpdateTemplate(statusPreview.props)}
      />
    );
  }

  if (preview === otpPreview.path) {
    return <SupabaseOtpPreviewNote />;
  }

  notFound();
}

function SupabaseOtpPreviewNote() {
  return (
    <main style={otpPageStyle}>
      <section style={otpShellStyle}>
        <p style={otpEyebrowStyle}>Supabase Auth</p>
        <h1 style={otpHeadingStyle}>Kod logowania OTP</h1>
        <p style={otpTextStyle}>
          Ten mail nie jest renderowany przez repozytorium Audiofast. Kod
          logowania wysyła Supabase Auth po wywołaniu{' '}
          <code style={codeStyle}>signInWithOtp</code>, a dokładny szablon
          wiadomości jest zarządzany w konfiguracji Supabase.
        </p>
        <div style={otpCardStyle}>
          <p style={otpCardLabelStyle}>Przykładowa treść domeny maila</p>
          <p style={otpCodeStyle}>123456</p>
          <p style={otpTextStyle}>
            Kod jest jednorazowy i według założeń B2C jest ważny przez 15
            minut. To nie jest magic link.
          </p>
        </div>
      </section>
    </main>
  );
}

const otpPageStyle = {
  minHeight: '100vh',
  backgroundColor: '#f4f4f4',
  color: '#141414',
  padding: '48px 20px',
};

const otpShellStyle = {
  width: 'min(720px, 100%)',
  margin: '0 auto',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  backgroundColor: '#fff',
  padding: '32px',
};

const otpEyebrowStyle = {
  margin: '0 0 8px',
  color: '#777',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const otpHeadingStyle = {
  margin: '0 0 16px',
  fontSize: '32px',
  lineHeight: 1.12,
};

const otpTextStyle = {
  margin: '0 0 16px',
  color: '#555',
  fontSize: '15px',
  lineHeight: 1.65,
};

const otpCardStyle = {
  marginTop: '24px',
  border: '1px solid #e5e5e5',
  borderRadius: '8px',
  backgroundColor: '#f8f8f8',
  padding: '24px',
};

const otpCardLabelStyle = {
  margin: '0 0 10px',
  color: '#777',
  fontSize: '13px',
};

const otpCodeStyle = {
  margin: '0 0 12px',
  color: '#111',
  fontSize: '34px',
  fontWeight: 700,
  letterSpacing: '0.12em',
};

const codeStyle = {
  borderRadius: '4px',
  backgroundColor: '#f0f0f0',
  padding: '2px 5px',
};
