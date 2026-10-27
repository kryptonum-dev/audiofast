import { isValidElement, type ReactElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { draftModeMock, dynamicOptionsMock } = vi.hoisted(() => ({
  draftModeMock: vi.fn(),
  dynamicOptionsMock: vi.fn(),
}));

vi.mock('next/headers', () => ({ draftMode: draftModeMock }));
vi.mock('./live', () => ({
  PUBLISHED: { perspective: 'published', stega: false },
  getDynamicFetchOptions: dynamicOptionsMock,
}));

import { type CachedProps, renderDraftAware } from './draft-aware';

function Cached(props: CachedProps & { slug: string }) {
  return <p>{props.slug}</p>;
}

describe('renderDraftAware', () => {
  beforeEach(() => {
    draftModeMock.mockReset();
    dynamicOptionsMock.mockReset();
  });

  it('renders the cached component with PUBLISHED outside draft mode', async () => {
    draftModeMock.mockResolvedValue({ isEnabled: false });

    const element = (await renderDraftAware(Cached, {
      slug: 'a',
    })) as ReactElement<Record<string, unknown>>;

    expect(element.type).toBe(Cached);
    expect(element.props).toEqual({
      slug: 'a',
      perspective: 'published',
      stega: false,
    });
    expect(dynamicOptionsMock).not.toHaveBeenCalled();
  });

  it('wraps a dynamic draft layer in Suspense in draft mode', async () => {
    draftModeMock.mockResolvedValue({ isEnabled: true });
    dynamicOptionsMock.mockResolvedValue({
      perspective: 'drafts',
      stega: true,
    });

    const element = (await renderDraftAware(Cached, {
      slug: 'a',
    })) as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;

    expect(element.type).toBe(Suspense);
    const layer = element.props.children;
    expect(isValidElement(layer)).toBe(true);

    const DraftLayer = layer.type as (
      props: Record<string, unknown>,
    ) => Promise<ReactElement<Record<string, unknown>>>;
    const rendered = await DraftLayer(layer.props);
    expect(rendered.type).toBe(Cached);
    expect(rendered.props).toEqual({
      slug: 'a',
      perspective: 'drafts',
      stega: true,
      isDraft: true,
    });
  });
});
