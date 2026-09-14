// @vitest-environment node
import { parseYouTubeUrl } from '@workspace/youtube';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchYouTubeMetadata } from './metadata';

const id = 'dQw4w9WgXcQ';
describe('YouTube video URLs', () => {
  it.each([
    `https://www.youtube.com/watch?v=${id}&list=abc`,
    `https://youtu.be/${id}?si=tracking`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
  ])('normalizes %s to a video URL', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
  });
  it.each([
    'javascript:alert(1)',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/playlist?list=abc',
    'https://youtube.com/@audiofast',
    'https://youtu.be/short',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com:444/watch?v=dQw4w9WgXcQ',
  ])('rejects %s', (url) => {
    expect(parseYouTubeUrl(url)).toBeNull();
  });
});

describe('YouTube metadata', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('falls back to an available thumbnail and retrieves the title', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ title: 'Film Audiofast' }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { 'content-type': 'image/jpeg' },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    const data = await fetchYouTubeMetadata(`https://youtu.be/${id}`);
    expect(data.title).toBe('Film Audiofast');
    expect(data.thumbnail?.base64).toBe('AQID');
    expect(fetcher.mock.calls[2]?.[0]).toContain('/sddefault.jpg');
  });
  it('returns partial data when the source is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchYouTubeMetadata(`https://youtu.be/${id}`)).toEqual({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
    });
  });
  it('does not fetch invalid URLs', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      fetchYouTubeMetadata('https://localhost/test'),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
