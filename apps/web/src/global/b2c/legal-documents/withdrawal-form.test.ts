import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sanityFetchDynamic } from '@/src/global/sanity/fetch';

import {
  buildB2cWithdrawalFormEmailAttachment,
  canReceiveB2cWithdrawalForm,
  hasB2cWithdrawalFormDocument,
} from './withdrawal-form';

vi.mock('@/src/global/sanity/fetch', () => ({
  sanityFetchDynamic: vi.fn(),
}));

describe('B2C withdrawal form document helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('pdf-content', {
          headers: {
            'content-type': 'application/pdf',
          },
          status: 200,
        }),
      ),
    );
  });

  it('treats non-company invoice recipients as eligible for the form', () => {
    expect(canReceiveB2cWithdrawalForm({ recipientType: 'private' })).toBe(true);
    expect(canReceiveB2cWithdrawalForm({ recipientType: 'unknown' })).toBe(true);
    expect(canReceiveB2cWithdrawalForm({ recipientType: 'company' })).toBe(
      false,
    );
  });

  it('detects when a CMS withdrawal form is configured', async () => {
    vi.mocked(sanityFetchDynamic).mockResolvedValue({
      assetUrl: 'https://cdn.sanity.io/form.pdf',
      mimeType: 'application/pdf',
      originalFilename: 'source.pdf',
    });

    await expect(hasB2cWithdrawalFormDocument()).resolves.toBe(true);
  });

  it('builds a PDF email attachment for B2C invoices', async () => {
    vi.mocked(sanityFetchDynamic).mockResolvedValue({
      assetUrl: 'https://cdn.sanity.io/form.pdf',
      mimeType: 'application/pdf',
      originalFilename: 'formularz-odstapienia.pdf',
    });

    const result = await buildB2cWithdrawalFormEmailAttachment({
      invoice: { recipientType: 'private' },
    });

    expect(result).toEqual({
      contentBytes: Buffer.from('pdf-content').toString('base64'),
      contentType: 'application/pdf',
      name: 'formularz-odstapienia.pdf',
    });
  });

  it('skips company purchases without loading the CMS form', async () => {
    const result = await buildB2cWithdrawalFormEmailAttachment({
      invoice: { recipientType: 'company' },
    });

    expect(result).toBeNull();
    expect(sanityFetchDynamic).not.toHaveBeenCalled();
  });

  it('returns null when the CMS form is missing', async () => {
    vi.mocked(sanityFetchDynamic).mockResolvedValue(null);

    const result = await buildB2cWithdrawalFormEmailAttachment({
      invoice: { recipientType: 'private' },
    });

    expect(result).toBeNull();
  });
});
