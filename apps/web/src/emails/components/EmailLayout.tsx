import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';
import * as React from 'react';

type EmailLayoutProps = {
  previewText: string;
  headerTitle?: string;
  headerSubtitle?: string;
  footerNote?: ReactNode;
  showHeaderLogo?: boolean;
  showFooterLogo?: boolean;
  children: ReactNode;
};

export function EmailLayout({
  previewText,
  headerTitle = 'AUDIOFAST',
  headerSubtitle,
  footerNote,
  showHeaderLogo = true,
  showFooterLogo = true,
  children,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={shell}>
          <Section style={headerSection}>
            {showHeaderLogo ? (
              <Section style={headerLogoWrap}>
                <AudiofastMark width={28} height={28} />
              </Section>
            ) : null}
            <Text style={headerBrand}>{headerTitle}</Text>
            {headerSubtitle ? (
              <Text style={headerSubtitleStyle}>{headerSubtitle}</Text>
            ) : null}
          </Section>

          <Section style={contentCard}>{children}</Section>

          <Section style={footer}>
            {showFooterLogo ? (
              <Section style={footerLogoWrap}>
                <AudiofastMark width={24} height={24} />
              </Section>
            ) : null}
            <Text style={footerBrand}>Audiofast</Text>
            <Text style={footerLinkGroup}>
              <Link href="https://audiofast.pl/produkty/" style={footerNavLink}>
                Produkty
              </Link>
              <Link href="https://audiofast.pl/serwis/" style={footerNavLink}>
                Serwis
              </Link>
              <Link href="https://audiofast.pl/kontakt/" style={footerNavLink}>
                Kontakt
              </Link>
            </Text>
            <Hr style={hr} />
            {footerNote ? <Text style={footerText}>{footerNote}</Text> : null}
            <Text style={footerText}>
              Audiofast - Dystrybutor sprzętu High-End
              <br />
              ul. Romankowska 55E, 91-174 Łódź
            </Text>
            <Text style={footerText}>
              <Link href="https://audiofast.pl" style={footerLink}>
                www.audiofast.pl
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function AudiofastMark({ width, height }: { width: number; height: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      fill="none"
      viewBox="0 0 433 436"
      aria-hidden="true"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <path
        fill="#F7F3F3"
        fillRule="evenodd"
        d="M216.425 0C96.887 0 0 97.586 0 217.896c0 120.31 96.887 217.988 216.425 217.988 119.539 0 216.335-97.586 216.335-217.988S335.873 0 216.425 0Zm137.734 355.799c-35.207 35.553-83.968 57.452-137.734 57.452-53.765 0-102.526-21.899-137.824-57.452-35.207-35.552-57.04-84.574-57.04-138.819 0-54.245 21.833-103.176 57.04-138.728C113.899 42.7 162.569 20.8 216.425 20.8c53.857 0 102.527 21.9 137.734 57.452 35.298 35.552 57.131 84.574 57.131 138.728 0 54.153-21.833 103.267-57.131 138.819Z"
        clipRule="evenodd"
      />
      <path
        fill="#F7F3F3"
        fillRule="evenodd"
        d="M396.917 203.602c-2.547-11.546-4.731-13.836-15.284-14.111-20.56-.733-39.755-.458-47.306 1.466-10.553 2.657-17.921 29.046-21.651 40.958h-13.737c3.73-11.637 19.923-55.894 33.478-78.16 2.547-4.123 7.005-8.797 13.464-8.98 12.19-.366 8.279.55 20.469.183 11.372-.366 12.645-5.406 11.372-10.629-8.552-17.226-19.924-32.803-33.297-46.273-32.75-32.986-78.055-53.42-127.999-53.42-49.944 0-95.34 20.433-128.09 53.42S35.297 166.675 35.297 216.98c0 34.453 9.461 66.615 25.837 94.012.181.275.272.458.363.55 1.365 1.741 2.639 3.39 3.912 4.856 22.38 26.115 27.565-5.498 33.115-24.282 2.911 2.657 5.64 6.414 7.914 9.621-1.546 4.765-2.729 9.347-4.548 14.295-3.73 10.079-8.552 22.999-14.738 28.68.364.458.728.824 1.182 1.283 32.751 32.986 78.056 53.42 128.091 53.42 50.035 0 95.249-20.434 127.999-53.42 32.751-32.987 53.038-78.619 53.038-129.015 0-4.49-.182-8.98-.546-13.378ZM161.114 338.115c-14.919 1.374-32.477-17.41-44.941-32.804-20.56-25.29-29.111-38.76-62.225-23.732-.273.183-.546.091-.728-.183 0-.184 0-.459.09-.642 4.186-4.123 7.733-7.422 10.918-10.079 19.65-16.035 43.667 7.513 60.224 19.15 5.913 4.215 11.645 8.247 16.375 11.271 19.195 12.462 24.472 11.27 42.394-6.139 5.003-4.948 6.823-7.147 13.373-14.02 1.819 4.857 4.185 11.179 5.822 15.669-13.191 20.25-26.473 40.226-41.302 41.509Zm114.99 6.963c-8.005 21.808-15.647 33.629-22.379 33.72-6.732 0-14.101-3.665-27.747-36.285-13.646-32.621-31.386-86.499-48.034-128.924-9.825-25.198-16.557-40.683-21.379-40.683-4.912.183-10.552 10.812-18.922 34.727-8.369 23.916-13.464 43.341-21.743 68.998-2.911-2.016-6.459-4.124-9.461-6.048 9.916-35.461 21.106-83.75 30.749-117.195 9.643-33.536 14.738-41.783 19.559-41.966 4.913-.092 11.554 10.996 22.562 43.433 15.829 46.822 28.929 95.111 46.123 141.385 7.915 21.258 20.469 40.958 26.746 40.408 13.828-1.282 32.933-60.109 38.755-74.128 3.002.824 7.642 2.016 12.827 3.757-6.914 22.357-19.65 57.085-27.656 78.801Zm68.412-73.12s-77.418-26.848-104.528-18.143c-9.097 2.932-12.736 8.43-17.649 16.31-1.273-3.482-2.729-7.972-4.003-11.545 10.28-10.263 18.832-18.418 28.748-19.609 19.104-2.474 94.885-.55 114.626-1.558 0 6.689-5.003 20.983-17.194 34.545Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

const main = {
  backgroundColor: '#f7f3f3',
  fontFamily: '"Poppins", Arial, Helvetica, sans-serif',
  color: '#5b5a5a',
  margin: '0',
  padding: '24px 0',
  fontWeight: '400',
};

const shell = {
  margin: '0 auto',
  maxWidth: '640px',
};

const headerSection = {
  padding: '22px 28px',
  textAlign: 'center' as const,
  backgroundColor: '#141414',
  borderRadius: '16px 16px 0 0',
};

const headerLogoWrap = {
  margin: '0 0 10px',
};

const headerBrand = {
  color: '#f7f3f3',
  fontSize: '18px',
  lineHeight: '1.2',
  fontWeight: '600',
  letterSpacing: '-0.03em',
  margin: '0',
  fontFamily: '"Switzer", "Poppins", Arial, Helvetica, sans-serif',
};

const headerSubtitleStyle = {
  fontSize: '12px',
  color: 'rgba(247, 243, 243, 0.6)',
  letterSpacing: '0.08em',
  margin: '8px 0 0',
};

const contentCard = {
  backgroundColor: '#ffffff',
  borderLeft: '1px solid #e7e7e7',
  borderRight: '1px solid #e7e7e7',
  borderBottom: '1px solid #e7e7e7',
  padding: '0',
};

const footer = {
  padding: '24px 28px 28px',
  backgroundColor: '#141414',
  borderRadius: '0 0 16px 16px',
};

const footerLogoWrap = {
  margin: '0 0 10px',
};

const footerBrand = {
  fontSize: '18px',
  lineHeight: '1.2',
  fontWeight: '600',
  color: '#f7f3f3',
  letterSpacing: '-0.03em',
  margin: '0 0 16px',
  fontFamily: '"Switzer", "Poppins", Arial, Helvetica, sans-serif',
};

const footerLinkGroup = {
  margin: '0 0 16px',
};

const footerNavLink = {
  color: '#e7e7e7',
  textDecoration: 'none',
  marginRight: '16px',
  fontSize: '13px',
  lineHeight: '1.5',
};

const footerText = {
  fontSize: '12px',
  color: '#c5c5c5',
  lineHeight: '1.5',
  margin: '0 0 12px',
};

const footerLink = {
  color: '#f7f3f3',
  textDecoration: 'underline',
};

const hr = {
  borderColor: 'rgba(255, 255, 255, 0.12)',
  margin: '0 0 16px',
};
