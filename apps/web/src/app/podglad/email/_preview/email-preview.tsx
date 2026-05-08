import { render } from '@react-email/render';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';

export function createEmailPreviewMetadata(args: {
  description: string;
  title: string;
}): Metadata {
  return {
    title: args.title,
    description: args.description,
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    },
  };
}

function extractBodyHtml(documentHtml: string): string {
  const match = documentHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match?.[1] ?? documentHtml;
}

export async function EmailPreviewFrame({
  ariaLabel,
  email,
}: {
  ariaLabel: string;
  email: ReactElement;
}) {
  const emailHtml = await render(email);
  const emailBodyHtml = extractBodyHtml(emailHtml);

  return (
    <main
      aria-label={ariaLabel}
      style={pageStyle}
      dangerouslySetInnerHTML={{ __html: emailBodyHtml }}
    />
  );
}

export const pageStyle = {
  position: 'fixed' as const,
  inset: 0,
  zIndex: 2147483647,
  overflowY: 'auto' as const,
  width: '100%',
  minHeight: '100vh',
  backgroundColor: '#f4f4f4',
  padding: '24px 0',
};
