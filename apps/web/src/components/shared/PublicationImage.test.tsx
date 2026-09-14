// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./Image', () => ({
  default: ({ image }: { image?: { id?: string } | null }) =>
    image?.id ? <span>{image.id}</span> : null,
}));

import PublicationImage from './PublicationImage';

describe('publication thumbnail fallback', () => {
  it.each([null, { id: null }])(
    'renders a YouTube thumbnail for missing image %j',
    (image) => {
      const html = renderToStaticMarkup(
        <PublicationImage
          publicationType="youtubeVideo"
          videoUrl="https://youtu.be/W2TbD6R7_ug"
          image={image}
          sizes="400px"
          alt="Bricasti"
        />,
      );
      expect(html).toContain(
        'https://i.ytimg.com/vi/W2TbD6R7_ug/hqdefault.jpg',
      );
      expect(html).toContain('alt="Bricasti"');
    },
  );

  it('preserves the Sanity image', () => {
    const html = renderToStaticMarkup(
      <PublicationImage
        publicationType="youtubeVideo"
        videoUrl="https://youtu.be/W2TbD6R7_ug"
        image={{ id: 'custom-image' }}
        sizes="400px"
      />,
    );
    expect(html).toContain('custom-image');
    expect(html).not.toContain('i.ytimg.com');
  });

  it.each([
    ['review', 'https://youtu.be/W2TbD6R7_ug'],
    ['youtubeVideo', 'https://example.com/watch?v=W2TbD6R7_ug'],
  ])(
    'does not create a thumbnail for %s with %s',
    (publicationType, videoUrl) => {
      expect(
        renderToStaticMarkup(
          <PublicationImage
            publicationType={publicationType}
            videoUrl={videoUrl}
            sizes="400px"
          />,
        ),
      ).toBe('');
    },
  );
});
