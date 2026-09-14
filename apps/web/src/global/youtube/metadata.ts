import { parseYouTubeUrl } from '@workspace/youtube';

export async function fetchYouTubeMetadata(input: string) {
  const video = parseYouTubeUrl(input);
  if (!video)
    throw new Error('Podaj poprawny link HTTPS do pojedynczego filmu YouTube.');
  const signal = AbortSignal.timeout(12000);
  const options = {
    signal,
    redirect: 'error' as const,
    cache: 'no-store' as const,
  };
  let title: string | undefined;
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(video.url)}&format=json`,
      options,
    );
    if (response.ok) {
      const data = await response.json();
      if (typeof data.title === 'string')
        title = data.title.trim().slice(0, 250);
    }
  } catch {
    /* A manually entered title remains available. */
  }

  let thumbnail: { base64: string; contentType: string } | undefined;
  for (const resolution of [
    'maxresdefault',
    'sddefault',
    'hqdefault',
    'mqdefault',
  ]) {
    if (signal.aborted) break;
    try {
      const response = await fetch(
        `https://img.youtube.com/vi/${video.id}/${resolution}.jpg`,
        options,
      );
      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('image/')
      )
        continue;
      // Bound the response before buffering: remote assets must stay small.
      const reader = response.body?.getReader();
      if (!reader) continue;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 3 * 1024 * 1024) {
          await reader.cancel();
          throw new Error('Miniatura jest zbyt duża.');
        }
        chunks.push(value);
      }
      if (size === 0) continue;
      thumbnail = {
        base64: Buffer.concat(chunks).toString('base64'),
        contentType: response.headers.get('content-type')!,
      };
      break;
    } catch {
      /* Try the next size within the total timeout. */
    }
  }
  return { ...video, title, thumbnail };
}
