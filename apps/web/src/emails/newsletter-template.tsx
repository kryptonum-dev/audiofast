import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface NewsletterContent {
  articles: Array<{
    _id: string;
    title: string;
    description?: string;
    image?: string;
    slug: string;
    _createdAt: string;
  }>;
  reviews: Array<{
    _id: string;
    title: string;
    name: string;
    description?: string;
    image?: string;
    slug: string;
    destinationType?: 'page' | 'pdf' | 'external';
    openInNewTab?: boolean;
    _createdAt: string;
    authorName?: string;
  }>;
  products: Array<{
    _id: string;
    name: string;
    subtitle?: string;
    shortDescription?: string;
    image?: string;
    slug: string;
    _createdAt: string;
    brandName?: string;
  }>;
}

export interface HeroConfig {
  imageUrl: string;
  text?: string;
}

interface NewsletterTemplateProps {
  content: NewsletterContent;
  hero: HeroConfig;
}

export const NewsletterTemplate = ({
  content,
  hero,
}: NewsletterTemplateProps) => {
  const baseUrl = 'https://audiofast.pl';
  const { articles = [], reviews = [], products = [] } = content;
  const hasContent =
    articles.length > 0 || reviews.length > 0 || products.length > 0;

  return (
    <Html>
      <Head>
        {/* Using system fonts for better Polish character support */}
      </Head>
      <Preview>
        {hasContent
          ? `Nowości w Audiofast: ${[
              reviews.length > 0 ? 'Recenzje' : '',
              articles.length > 0 ? 'Artykuły' : '',
              products.length > 0 ? 'Produkty' : '',
            ]
              .filter(Boolean)
              .join(', ')}`
          : 'Newsletter Audiofast'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Hero Section */}
          <Section style={heroSection}>
            <Img
              src={hero.imageUrl}
              width="600"
              height="auto"
              alt="Audiofast Newsletter"
              style={heroImage}
            />
            {hero.text && (
              <Section style={heroTextSection}>
                <Text style={heroText}>{hero.text}</Text>
              </Section>
            )}
          </Section>

          {/* Reviews - First */}
          {reviews.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>Najnowsze Recenzje</Heading>
              {reviews.map((item) => {
                // Determine the full URL based on review type
                const reviewUrl =
                  item.destinationType === 'external'
                    ? item.slug // External URL is already full URL
                    : `${baseUrl}${item.slug}`; // Internal page or PDF

                return (
                  <Section key={item._id} style={itemContainer}>
                    {item.image && (
                      <Img
                        src={item.image}
                        alt={item.title}
                        style={itemImage}
                        width="600"
                        height="auto"
                      />
                    )}
                    <Text style={metaText}>
                      {item.authorName
                        ? `Autor: ${item.authorName}`
                        : 'Recenzja'}
                      {item.destinationType === 'pdf' && ' • PDF'}
                      {item.destinationType === 'external' &&
                        ' • Link zewnętrzny'}
                    </Text>
                    <Heading style={h3}>
                      <Link href={reviewUrl} style={linkTitle}>
                        {item.title}
                      </Link>
                    </Heading>
                    {item.description && (
                      <Text style={itemDescription}>{item.description}</Text>
                    )}
                    <Button href={reviewUrl} style={button}>
                      Zobacz recenzję
                    </Button>
                  </Section>
                );
              })}
            </Section>
          )}

          {/* Articles - Second */}
          {articles.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>Nowe Artykuły</Heading>
              {articles.map((item) => (
                <Section key={item._id} style={itemContainer}>
                  {item.image && (
                    <Img
                      src={item.image}
                      alt={item.title}
                      style={itemImage}
                      width="600"
                      height="auto"
                    />
                  )}
                  <Heading style={h3}>
                    <Link href={`${baseUrl}${item.slug}`} style={linkTitle}>
                      {item.title}
                    </Link>
                  </Heading>
                  {item.description && (
                    <Text style={itemDescription}>{item.description}</Text>
                  )}
                  <Button href={`${baseUrl}${item.slug}`} style={button}>
                    Czytaj więcej
                  </Button>
                </Section>
              ))}
            </Section>
          )}

          {/* Products - Third */}
          {products.length > 0 && (
            <Section style={section}>
              <Heading style={h2}>Nowości Produktowe</Heading>
              {products.map((item) => (
                <Section key={item._id} style={itemContainer}>
                  {item.image && (
                    <Img
                      src={item.image}
                      alt={item.name}
                      style={itemImage}
                      width="600"
                      height="auto"
                    />
                  )}
                  <Text style={metaText}>{item.brandName || 'Audiofast'}</Text>
                  <Heading style={h3}>
                    <Link href={`${baseUrl}${item.slug}`} style={linkTitle}>
                      {item.name}
                    </Link>
                  </Heading>
                  {item.subtitle && (
                    <Text style={subtitleText}>{item.subtitle}</Text>
                  )}
                  {item.shortDescription && (
                    <Text style={itemDescription}>{item.shortDescription}</Text>
                  )}
                  <Button href={`${baseUrl}${item.slug}`} style={button}>
                    Zobacz produkt
                  </Button>
                </Section>
              ))}
            </Section>
          )}

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
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
};

// Styles - Colors matching global.scss
// --neutral-white: #ffffff
// --neutral-black: #000000
// --neutral-200: #f8f8f8
// --neutral-300: #f7f3f3
// --neutral-400: #e7e7e7
// --neutral-500: #c5c5c5
// --neutral-600: #5b5a5a
// --neutral-700: #303030
// --neutral-800: #141414
// --primary-red: #fe0140

const main = {
  backgroundColor: '#f8f8f8', // --neutral-200
  fontFamily: 'Arial, Helvetica, sans-serif',
  color: '#5b5a5a', // --neutral-600
};

const container = {
  margin: '0 auto',
  padding: '0 0 48px',
  maxWidth: '600px',
  backgroundColor: '#ffffff', // --neutral-white
};

const heroSection = {
  margin: '0',
  marginBottom: '24px',
  padding: '0',
};

const heroImage = {
  width: '100%',
  height: 'auto',
  display: 'block' as const,
};

const heroTextSection = {
  padding: '24px 20px',
  borderBottom: '1px solid #e7e7e7', // --neutral-400
  marginBottom: '24px',
  textAlign: 'center' as const,
};

const heroText = {
  fontSize: '16px',
  lineHeight: '1.6',
  color: '#5b5a5a', // --neutral-600
  margin: '0',
};

const hr = {
  borderColor: '#e7e7e7', // --neutral-400
  margin: '20px 0',
};

const section = {
  padding: '0 20px',
  marginBottom: '32px',
};

const h2 = {
  color: '#303030', // --neutral-700
  fontSize: '20px',
  fontWeight: '500',
  margin: '0 0 24px',
  paddingBottom: '12px',
  borderBottom: '2px solid #fe0140', // --primary-red
  display: 'inline-block',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const itemContainer = {
  marginBottom: '32px',
  paddingBottom: '32px',
};

const itemImage = {
  width: '100%',
  borderRadius: '4px',
  marginBottom: '16px',
  objectFit: 'cover' as const,
};

const h3 = {
  margin: '0 0 12px',
  fontSize: '18px',
  fontWeight: '500',
  lineHeight: '1.4',
  fontFamily: 'Arial, Helvetica, sans-serif',
};

const linkTitle = {
  color: '#303030', // --neutral-700
  textDecoration: 'none',
};

const itemDescription = {
  fontSize: '15px',
  lineHeight: '1.6',
  color: '#5b5a5a', // --neutral-600
  margin: '0 0 20px',
};

const metaText = {
  fontSize: '12px',
  color: '#fe0140', // --primary-red
  textTransform: 'uppercase' as const,
  fontWeight: '500',
  marginBottom: '8px',
  letterSpacing: '0.05em',
};

const subtitleText = {
  fontSize: '14px',
  color: '#c5c5c5', // --neutral-500
  marginBottom: '12px',
};

const button = {
  backgroundColor: '#fe0140', // --primary-red
  borderRadius: '0px',
  color: '#ffffff', // --neutral-white
  fontSize: '14px',
  fontWeight: '500',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
};

const footer = {
  padding: '0 8px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#c5c5c5', // --neutral-500
  lineHeight: '1.5',
  margin: '0 0 12px',
};

const footerLink = {
  color: '#5b5a5a', // --neutral-600
  textDecoration: 'underline',
};

export default NewsletterTemplate;
