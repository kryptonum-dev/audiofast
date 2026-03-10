import { toHTML } from '@portabletext/to-html';
import { render } from '@react-email/render';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type {
  HeroConfig,
  NewsletterContent,
  SectionKey,
} from '@/src/emails/newsletter-template';
import NewsletterTemplate from '@/src/emails/newsletter-template';
import { mailchimpClient } from '@/src/global/mailchimp/client';
import { client } from '@/src/global/sanity/client';
import { queryMailchimpSettings } from '@/src/global/sanity/query';

const SITE_BASE_URL = 'https://audiofast.pl';

// Portable Text block (loose type for runtime conversion)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawBlocks = any[] | undefined;

// Extended content types that carry raw PT blocks from the studio
interface IncomingArticle {
  _id: string;
  title: string;
  description?: string;
  descriptionBlocks?: RawBlocks;
  image?: string;
  slug: string;
  _createdAt: string;
}

interface IncomingReview {
  _id: string;
  title: string;
  name: string;
  description?: string;
  descriptionBlocks?: RawBlocks;
  image?: string;
  slug: string;
  destinationType?: 'page' | 'pdf' | 'external';
  openInNewTab?: boolean;
  _createdAt: string;
  authorName?: string;
}

interface IncomingProduct {
  _id: string;
  name: string;
  subtitle?: string;
  shortDescription?: string;
  shortDescriptionBlocks?: RawBlocks;
  image?: string;
  slug: string;
  _createdAt: string;
  brandName?: string;
}

interface IncomingNewsletterContent {
  articles: IncomingArticle[];
  reviews: IncomingReview[];
  products: IncomingProduct[];
}

// Define the expected payload structure
interface GeneratePayload {
  action: 'download-html' | 'create-mailchimp-draft';
  startDate?: string;
  endDate?: string;
  content: IncomingNewsletterContent;
  hero: HeroConfig;
  sectionOrder?: SectionKey[];
  subject?: string; // Optional custom subject line
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

// Lightweight sanitizer for newsletter HTML fragments.
// We keep basic formatting/layout tags but strip obvious unsafe vectors.
function sanitizeNewsletterHtml(input: string): string {
  return input
    .replace(
      /<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      '',
    )
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
}

function normalizeNewsletterHtml(input?: string): string | undefined {
  if (!input) return undefined;
  const decoded = decodeHtmlEntities(input);
  return sanitizeNewsletterHtml(decoded);
}

type InternalLinkDoc = {
  _id: string;
  _type: string;
  slug?: string;
};

type CustomLinkData = {
  type?: 'internal' | 'external';
  href?: string;
  external?: string;
  openInNewTab?: boolean;
  internal?: { _ref?: string };
};

function normalizePathHref(href?: string): string | undefined {
  if (!href) return undefined;
  const trimmed = href.trim();
  if (!trimmed || trimmed === '#') return undefined;

  // Keep absolute and special protocols untouched
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^mailto:/i.test(trimmed) ||
    /^tel:/i.test(trimmed) ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }

  // Normalize relative/internal paths to /path/
  const base = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  // Preserve query/hash while ensuring trailing slash on pathname
  const splitIndex = base.search(/[?#]/);
  const pathnameWithMaybeTrailing =
    splitIndex === -1 ? base : base.slice(0, splitIndex);
  const rest = splitIndex === -1 ? '' : base.slice(splitIndex);
  const collapsedPathname = pathnameWithMaybeTrailing.replace(/\/{2,}/g, '/');
  const normalizedPath =
    collapsedPathname.endsWith('/') || collapsedPathname === '/'
      ? collapsedPathname
      : `${collapsedPathname}/`;

  return `${normalizedPath}${rest}`;
}

function buildTypedPath(prefix: string, slug: string): string {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const cleanSlug = slug.replace(/^\/+|\/+$/g, '');

  // If slug already contains the route prefix, do not prepend it again.
  if (cleanSlug === cleanPrefix || cleanSlug.startsWith(`${cleanPrefix}/`)) {
    return normalizePathHref(`/${cleanSlug}`) ?? '#';
  }

  return normalizePathHref(`/${cleanPrefix}/${cleanSlug}`) ?? '#';
}

function internalDocToHref(doc: InternalLinkDoc): string {
  // Known singleton routes (no slug fields)
  switch (doc._type) {
    case 'homePage':
      return '/';
    case 'blog':
      return '/blog/';
    case 'products':
      return '/produkty/';
    case 'brands':
      return '/marki/';
    case 'termsAndConditions':
      return '/regulamin/';
    case 'privacyPolicy':
      return '/polityka-prywatnosci/';
    case 'cpoPage':
      return '/certyfikowany-sprzet-uzywany/';
    default:
      break;
  }

  const slug = doc.slug?.trim();
  if (!slug) return '#';

  // Collection-specific routes with slug
  switch (doc._type) {
    case 'blog-article':
      return buildTypedPath('blog', slug);
    case 'review':
      return buildTypedPath('recenzje', slug);
    case 'product':
      return buildTypedPath('produkty', slug);
    case 'brand':
      return buildTypedPath('marki', slug);
    case 'blog-category':
      return buildTypedPath('blog/kategoria', slug);
    case 'productCategorySub':
      return buildTypedPath('produkty/kategoria', slug);
    case 'page':
      return normalizePathHref(`/${slug}`) ?? '#';
    default:
      return normalizePathHref(`/${slug}`) ?? '#';
  }
}

function collectInternalLinkRefsFromBlocks(blocks: RawBlocks): string[] {
  if (!Array.isArray(blocks)) return [];
  const refs = new Set<string>();

  for (const block of blocks) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const markDefs = (block as any)?.markDefs;
    if (!Array.isArray(markDefs)) continue;

    for (const def of markDefs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customLink = (def as any)?.customLink as CustomLinkData | undefined;
      const ref = customLink?.internal?._ref;
      if (customLink?.type === 'internal' && ref) refs.add(ref);
    }
  }

  return Array.from(refs);
}

async function fetchInternalLinkHrefMap(
  refs: string[],
): Promise<Map<string, string>> {
  const hrefMap = new Map<string, string>();
  if (refs.length === 0) return hrefMap;

  const docs = await client.fetch<InternalLinkDoc[]>(
    `*[_id in $ids]{
      _id,
      _type,
      "slug": slug.current
    }`,
    { ids: refs },
  );

  for (const doc of docs) {
    hrefMap.set(doc._id, internalDocToHref(doc));
  }

  return hrefMap;
}

function resolveCustomLinkHref(
  linkData: CustomLinkData,
  internalHrefMap: Map<string, string>,
): string {
  if (linkData.type === 'internal') {
    const ref = linkData.internal?._ref;
    if (ref && internalHrefMap.has(ref)) {
      return internalHrefMap.get(ref) ?? '#';
    }
    const existingHref = normalizePathHref(linkData.href);
    return existingHref ?? '#';
  }

  if (linkData.type === 'external') {
    const externalHref = normalizePathHref(linkData.external);
    if (externalHref) return externalHref;
    const existingHref = normalizePathHref(linkData.href);
    return existingHref ?? '#';
  }

  // Fallback for mixed/legacy data where "type" is missing.
  const existingHref = normalizePathHref(linkData.href);
  if (existingHref) return existingHref;
  const externalHref = normalizePathHref(linkData.external);
  if (externalHref) return externalHref;

  const ref = linkData.internal?._ref;
  if (ref && internalHrefMap.has(ref)) {
    return internalHrefMap.get(ref) ?? '#';
  }

  return '#';
}

function enrichBlocksWithResolvedLinks(
  blocks: RawBlocks,
  internalHrefMap: Map<string, string>,
): RawBlocks {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const typedBlock = block as any;
    if (!Array.isArray(typedBlock?.markDefs)) return typedBlock;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedMarkDefs = typedBlock.markDefs.map((def: any) => {
      if (def?._type !== 'customLink') return def;

      const linkData = (def.customLink ?? {}) as CustomLinkData;
      const resolvedHref = resolveCustomLinkHref(linkData, internalHrefMap);

      return {
        ...def,
        customLink: {
          ...linkData,
          href: resolvedHref,
        },
      };
    });

    return {
      ...typedBlock,
      markDefs: updatedMarkDefs,
    };
  });
}

function renderEmailLink(
  children: string,
  hrefValue: string | undefined,
): string {
  let href = hrefValue ?? '#';
  const normalizedHref = normalizePathHref(href) ?? href;
  href = normalizedHref;

  const isAlreadyAbsolute =
    href.startsWith('http') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#');

  // Make internal links absolute so downloaded file:// HTML still opens real URLs.
  if (!isAlreadyAbsolute) {
    if (href.startsWith('/')) {
      href = `${SITE_BASE_URL}${href}`;
    } else {
      href = `${SITE_BASE_URL}/${href.replace(/^\/+/, '')}`;
    }
  }

  const escapedHref = href.replace(/"/g, '&quot;');

  // Newsletter rule: always open links in a new tab/window.
  return `<a href="${escapedHref}" target="_blank" rel="noopener noreferrer" style="color:#fe0140;text-decoration:underline;">${children}</a>`;
}

// Convert Portable Text blocks to email-safe HTML
function blocksToHtml(blocks: RawBlocks): string | undefined {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0)
    return undefined;
  try {
    const html = toHTML(blocks, {
      components: {
        marks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          strong: ({ children }: any) => `<strong>${children}</strong>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          em: ({ children }: any) => `<em>${children}</em>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          underline: ({ children }: any) => `<u>${children}</u>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          'strike-through': ({ children }: any) => `<s>${children}</s>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: ({ children }: any) =>
            `<code style="font-family:monospace;background:#f5f5f5;padding:1px 3px;border-radius:2px;">${children}</code>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customLink: ({ children, value }: any) => {
            // Sanity annotation shape: value.customLink.{href, openInNewTab, ...}
            const linkData = value?.customLink ?? {};
            return renderEmailLink(
              children,
              linkData?.href ?? linkData?.external ?? value?.href,
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          link: ({ children, value }: any) => {
            return renderEmailLink(children, value?.href);
          },
        },
        block: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          normal: ({ children }: any) =>
            `<p style="font-size:15px;line-height:1.6;color:#5b5a5a;margin:0 0 10px;">${children}</p>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          h2: ({ children }: any) =>
            `<h2 style="font-size:18px;font-weight:500;color:#303030;margin:0 0 10px;">${children}</h2>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          h3: ({ children }: any) =>
            `<h3 style="font-size:16px;font-weight:500;color:#303030;margin:0 0 10px;">${children}</h3>`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blockquote: ({ children }: any) =>
            `<blockquote style="border-left:3px solid #fe0140;padding-left:16px;color:#5b5a5a;margin:0 0 10px;">${children}</blockquote>`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        list: ({ children, value }: any) => {
          if (value?.listItem === 'number') {
            return `<ol style="margin:0 0 12px 20px;padding:0;color:#5b5a5a;">${children}</ol>`;
          }
          return `<ul style="margin:0 0 12px 20px;padding:0;color:#5b5a5a;">${children}</ul>`;
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        listItem: ({ children }: any) =>
          `<li style="margin:0 0 6px 0;line-height:1.6;">${children}</li>`,

        hardBreak: () => '<br />',
      },
      onMissingComponent: false,
    });
    return normalizeNewsletterHtml(html);
  } catch {
    return undefined;
  }
}

// Convert incoming content (with raw PT blocks) to the template's NewsletterContent
function processContent(
  incoming: IncomingNewsletterContent,
  internalHrefMap: Map<string, string>,
): NewsletterContent {
  return {
    articles: incoming.articles.map((item) => ({
      ...item,
      descriptionHtml: blocksToHtml(
        enrichBlocksWithResolvedLinks(item.descriptionBlocks, internalHrefMap),
      ),
    })),
    reviews: incoming.reviews.map((item) => ({
      ...item,
      descriptionHtml: blocksToHtml(
        enrichBlocksWithResolvedLinks(item.descriptionBlocks, internalHrefMap),
      ),
    })),
    products: incoming.products.map((item) => ({
      ...item,
      shortDescriptionHtml: blocksToHtml(
        enrichBlocksWithResolvedLinks(
          item.shortDescriptionBlocks,
          internalHrefMap,
        ),
      ),
    })),
  };
}

// Helper type for Mailchimp campaign response since the types are loose
interface MailchimpCampaignResponse {
  id: string;
  web_id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// CORS headers for Sanity Studio
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GeneratePayload;
    const { action, content, hero, sectionOrder, subject } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Missing content data' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!hero?.imageUrl) {
      return NextResponse.json(
        { error: 'Hero image is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Resolve internal customLink references to concrete href values
    const allInternalRefs = Array.from(
      new Set([
        ...content.articles.flatMap((item) =>
          collectInternalLinkRefsFromBlocks(item.descriptionBlocks),
        ),
        ...content.reviews.flatMap((item) =>
          collectInternalLinkRefsFromBlocks(item.descriptionBlocks),
        ),
        ...content.products.flatMap((item) =>
          collectInternalLinkRefsFromBlocks(item.shortDescriptionBlocks),
        ),
      ]),
    );

    const internalHrefMap = await fetchInternalLinkHrefMap(allInternalRefs);

    // Convert raw Portable Text blocks to HTML in descriptions
    const processedContent = processContent(content, internalHrefMap);

    const processedHero: HeroConfig = {
      ...hero,
      text: normalizeNewsletterHtml(hero.text),
    };

    // Generate the HTML email
    const emailHtml = await render(
      NewsletterTemplate({
        content: processedContent,
        hero: processedHero,
        sectionOrder,
      }),
    );

    // -------------------------------------------------------------------------
    // ACTION: Download HTML File
    // -------------------------------------------------------------------------
    if (action === 'download-html') {
      // Return the HTML file as a downloadable attachment
      const filename = `newsletter-audiofast-${new Date().toISOString().split('T')[0]}.html`;

      return new NextResponse(emailHtml, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // -------------------------------------------------------------------------
    // ACTION: Create Mailchimp Draft
    // -------------------------------------------------------------------------
    if (action === 'create-mailchimp-draft') {
      if (!process.env.MAILCHIMP_API_KEY) {
        return NextResponse.json(
          { error: 'Mailchimp API key not configured' },
          { status: 500, headers: corsHeaders },
        );
      }

      // Fetch Audience ID from Sanity Settings
      const mailchimpAudienceId = await client.fetch(queryMailchimpSettings);

      if (!mailchimpAudienceId) {
        return NextResponse.json(
          {
            error:
              'Mailchimp Audience ID not found in Sanity Settings. Please configure it in global settings.',
          },
          { status: 400, headers: corsHeaders },
        );
      }

      // 1. Determine Campaign Defaults
      const campaignSubject =
        subject ||
        `Nowości Audiofast: ${new Date().toLocaleDateString('pl-PL')}`;
      const fromName = 'Audiofast';
      const replyTo = 'info@audiofast.pl'; // Should be configured in env or passed in

      // 2. Create the Campaign
      // Note: 'type: regular' is a standard email campaign
      const campaign = (await mailchimpClient.campaigns.create({
        type: 'regular',
        recipients: {
          list_id: mailchimpAudienceId,
        },
        settings: {
          subject_line: campaignSubject,
          from_name: fromName,
          reply_to: replyTo,
          title: `Audiofast Digest ${new Date().toISOString().split('T')[0]}`, // Internal title
        },
      })) as unknown as MailchimpCampaignResponse;

      if (!campaign.id) {
        throw new Error('Failed to create Mailchimp campaign');
      }

      // 3. Set the Campaign Content (HTML)
      await mailchimpClient.campaigns.setContent(campaign.id, {
        html: emailHtml,
      });

      return NextResponse.json(
        {
          success: true,
          campaignId: campaign.id,
          webUrl: campaign.web_id,
          message: 'Draft campaign created successfully',
        },
        { headers: corsHeaders },
      );
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400, headers: corsHeaders },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('[Newsletter API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal Server Error',
        details: error.response?.body || undefined,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
