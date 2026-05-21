import 'server-only';

import type { EmailAttachment } from '@/src/global/microsoft-graph/client';
import { sanityFetchDynamic } from '@/src/global/sanity/fetch';
import { queryB2cWithdrawalForm } from '@/src/global/sanity/query';

import type { ParsedOrderInvoiceData } from '../utils/orders';

export type WithdrawalFormDocument = {
  body: Blob;
  contentType: string;
  filename: string;
};

type WithdrawalFormSettings = {
  assetUrl?: string | null;
  originalFilename?: string | null;
  mimeType?: string | null;
} | null;

const DEFAULT_WITHDRAWAL_FORM_FILENAME = 'formularz-odstapienia-od-umowy.pdf';

function normalizePdfFilename(value: string | null | undefined): string {
  const filename = value?.trim();

  if (!filename) {
    return DEFAULT_WITHDRAWAL_FORM_FILENAME;
  }

  return filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
}

export function canReceiveB2cWithdrawalForm(
  invoice: Pick<ParsedOrderInvoiceData, 'recipientType'>,
): boolean {
  return invoice.recipientType !== 'company';
}

async function loadWithdrawalFormSettings(): Promise<WithdrawalFormSettings> {
  return sanityFetchDynamic<WithdrawalFormSettings>({
    query: queryB2cWithdrawalForm,
  });
}

function mapWithdrawalFormSettings(
  settings: WithdrawalFormSettings,
): { assetUrl: string; filename: string; contentType: string } | null {
  if (!settings?.assetUrl) {
    return null;
  }

  return {
    assetUrl: settings.assetUrl,
    contentType: settings.mimeType || 'application/pdf',
    filename: normalizePdfFilename(settings.originalFilename),
  };
}

export async function loadB2cWithdrawalFormDocument(): Promise<WithdrawalFormDocument | null> {
  const settings = mapWithdrawalFormSettings(
    await loadWithdrawalFormSettings(),
  );

  if (!settings) {
    return null;
  }

  const response = await fetch(settings.assetUrl, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('B2C withdrawal form asset could not be downloaded.');
  }

  return {
    body: await response.blob(),
    contentType: response.headers.get('content-type') || settings.contentType,
    filename: settings.filename,
  };
}

export async function hasB2cWithdrawalFormDocument(): Promise<boolean> {
  return mapWithdrawalFormSettings(await loadWithdrawalFormSettings()) !== null;
}

export async function buildB2cWithdrawalFormEmailAttachment(args: {
  invoice: Pick<ParsedOrderInvoiceData, 'recipientType'>;
}): Promise<EmailAttachment | null> {
  if (!canReceiveB2cWithdrawalForm(args.invoice)) {
    return null;
  }

  let settings: WithdrawalFormSettings;
  let document: WithdrawalFormDocument | null;

  try {
    settings = await loadWithdrawalFormSettings();
  } catch (error) {
    console.error(
      '[B2C Documents] Failed to load withdrawal form settings.',
      error,
    );

    return null;
  }

  const mappedSettings = mapWithdrawalFormSettings(settings);

  if (!mappedSettings) {
    return null;
  }

  try {
    const response = await fetch(mappedSettings.assetUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('B2C withdrawal form asset could not be downloaded.');
    }

    document = {
      body: await response.blob(),
      contentType:
        response.headers.get('content-type') || mappedSettings.contentType,
      filename: mappedSettings.filename,
    };
  } catch (error) {
    console.error('[B2C Documents] Failed to load withdrawal form.', error);

    return null;
  }

  if (!document) {
    return null;
  }

  const buffer = Buffer.from(await document.body.arrayBuffer());

  return {
    contentBytes: buffer.toString('base64'),
    contentType: document.contentType || 'application/pdf',
    name: document.filename,
  };
}
