import { render } from '@react-email/render';

import NewsletterTemplate, {
  type NewsletterContent,
} from '@/src/emails/newsletter-template';
import { client } from '@/src/global/sanity/client';

/** Review the current video section without creating a campaign. Preview only. */
export async function GET(request: Request) {
  if (process.env.VERCEL_ENV === 'production')
    return new Response(null, { status: 404 });
  const download = new URL(request.url).searchParams.has('download');
  const videos = await client
    .withConfig({ perspective: 'published', useCdn: false })
    .fetch<NonNullable<NewsletterContent['videos']>>(
      `*[_type == "youtubeVideo" && !(_id in path("drafts.**")) && defined(image.asset) && defined(videoUrl)] | order(publishedDate desc)[0...10]{
      _id, _createdAt, "title": name, "slug": videoUrl, "description": pt::text(description), "image": image.asset->url
    }`,
      {},
      { cache: 'no-store' },
    );
  const image = videos[0]?.image;
  if (!image)
    return new Response(
      'Dodaj i opublikuj film w lokalnym Studio, aby zobaczyć podgląd.',
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  const heroImage = await client
    .withConfig({ perspective: 'published', useCdn: false })
    .fetch<string | null>(
      '*[_type == "homePage" && !(_id in path("drafts.**"))][0].pageBuilder[_type == "heroCarousel"][0].slides[0].image.asset->url',
      {},
      { cache: 'no-store' },
    );
  const html = await render(
    NewsletterTemplate({
      hero: {
        imageUrl: heroImage || image,
        text: '<p>Nowe filmy polecane przez Audiofast</p>',
      },
      content: { articles: [], products: [], reviews: [], videos },
    }),
  );
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...(download
        ? {
            'Content-Disposition':
              'attachment; filename="audiofast-youtube-preview.html"',
          }
        : {}),
    },
  });
}
