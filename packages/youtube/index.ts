/** Accept individual YouTube videos only; never fetch a user-supplied host. */
export function parseYouTubeUrl(
  input: string,
): { id: string; url: string } | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let id: string | null = null;
    if (host === 'youtu.be' && parts.length === 1) {
      id = parts[0] ?? null;
    } else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      else if (
        parts.length === 2 &&
        ['shorts', 'live', 'embed'].includes(parts[0] ?? '')
      )
        id = parts[1] ?? null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
      ? { id, url: `https://www.youtube.com/watch?v=${id}` }
      : null;
  } catch {
    return null;
  }
}
