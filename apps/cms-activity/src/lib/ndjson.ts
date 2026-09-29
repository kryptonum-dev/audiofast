/** Error reported by the History API, either as HTTP error or as an NDJSON line. */
export class HistoryApiError extends Error {
  readonly statusCode?: number;

  constructor(message: string, options?: { statusCode?: number }) {
    super(message);
    this.name = 'HistoryApiError';
    this.statusCode = options?.statusCode;
  }
}

function errorMessage(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.description === 'string') return record.description;
    if (typeof record.message === 'string') return record.message;
  }
  return 'Nieznany błąd History API';
}

/** Throw `HistoryApiError` when `value` is an API error object. */
export function assertNotError(value: unknown): void {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if ('error' in record) {
      throw new HistoryApiError(errorMessage(record.error), {
        statusCode:
          typeof record.statusCode === 'number' ? record.statusCode : undefined,
      });
    }
  }
}

/**
 * Parse an NDJSON response body. `client.request` returns the raw string for
 * `application/x-ndjson`, but a Uint8Array or an already-parsed value
 * (single object or array) is accepted too. Any line with an `error` key
 * throws `HistoryApiError`.
 */
export function parseNdjson<T>(raw: unknown): T[] {
  if (raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    raw.forEach(assertNotError);
    return raw as T[];
  }

  let text: string;
  if (typeof raw === 'string') {
    text = raw;
  } else if (raw instanceof Uint8Array) {
    text = new TextDecoder('utf-8').decode(raw);
  } else if (typeof raw === 'object') {
    assertNotError(raw);
    return [raw as T];
  } else {
    throw new HistoryApiError('Nieoczekiwany format odpowiedzi History API');
  }

  const items: T[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new HistoryApiError(
        'Nie udało się odczytać odpowiedzi History API',
      );
    }
    assertNotError(parsed);
    items.push(parsed as T);
  }
  return items;
}
