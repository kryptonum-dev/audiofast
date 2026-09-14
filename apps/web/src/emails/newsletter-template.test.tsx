// @vitest-environment node
import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';

import NewsletterTemplate, {
  type NewsletterContent,
} from './newsletter-template';

const video = {
  _id: 'video',
  title: 'Film Audiofast',
  image: 'https://cdn.sanity.io/video.jpg',
  slug: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  _createdAt: '2026-09-14',
};
const hero = { imageUrl: 'https://cdn.sanity.io/hero.jpg' };
const empty: NewsletterContent = { articles: [], products: [], reviews: [] };

describe('newsletter video section', () => {
  it('uses the YouTube thumbnail when the published video has no Sanity image', async () => {
    const html = await render(
      <NewsletterTemplate
        content={{ ...empty, videos: [{ ...video, image: undefined }] }}
        hero={hero}
      />,
    );
    expect(html).toContain('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    expect(html).toContain('Obejrzyj na YouTube');
  });
  it('renders a video-only newsletter with clickable image and no description or embedded player', async () => {
    const html = await render(
      <NewsletterTemplate
        content={{ ...empty, videos: [video] }}
        hero={hero}
      />,
    );
    expect(html).toContain('Najnowsze Filmy');
    expect(html).toContain('Obejrzyj na YouTube');
    expect(html).toContain(video.image);
    expect(html).not.toContain('i.ytimg.com');
    expect(
      html.match(
        new RegExp(
          `href="${video.slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
          'g',
        ),
      ),
    ).toHaveLength(3);
    expect(html).not.toContain('audiofast.plhttps');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('undefined');
  });
  it('respects section order and converts optional HTML description', async () => {
    const html = await render(
      <NewsletterTemplate
        hero={hero}
        content={{
          ...empty,
          articles: [
            {
              ...video,
              _id: 'article',
              title: 'Artykuł testowy',
              slug: '/blog/test/',
            },
          ],
          videos: [
            { ...video, descriptionHtml: '<p>Opis <strong>filmu</strong></p>' },
          ],
        }}
        sectionOrder={['videos', 'articles']}
      />,
    );
    expect(html.indexOf('Obejrzyj na YouTube')).toBeLessThan(
      html.indexOf('Artykuł testowy'),
    );
    expect(html).toContain('<strong>filmu</strong>');
  });
  it('keeps old payloads compatible and hides empty video sections', async () => {
    const html = await render(
      <NewsletterTemplate hero={hero} content={empty} />,
    );
    expect(html).not.toContain('Najnowsze Filmy');
    const disabled = await render(
      <NewsletterTemplate
        hero={hero}
        content={{ ...empty, videos: [video] }}
        sectionOrder={['articles']}
      />,
    );
    expect(disabled).not.toContain('Obejrzyj na YouTube');
  });
});
