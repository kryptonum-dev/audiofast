import 'server-only';

import { sanityFetchDynamic } from '@/src/global/sanity/fetch';
import { queryB2cReturnInstructionsEmail } from '@/src/global/sanity/query';
import type { QueryB2cReturnInstructionsEmailResult } from '@/src/global/sanity/sanity.types';
import type { PortableTextProps } from '@/src/global/types';
import {
  portableTextToHtml,
  portableTextToPlainString,
} from '@/src/global/utils';

export type B2cReturnInstructionsEmail = {
  html: string;
  plainText: string;
};

export async function loadB2cReturnInstructionsEmail(): Promise<B2cReturnInstructionsEmail | null> {
  const settings =
    await sanityFetchDynamic<QueryB2cReturnInstructionsEmailResult>({
      query: queryB2cReturnInstructionsEmail,
    });
  const content = settings?.b2cReturnInstructionsEmail;

  if (!content || content.length === 0) {
    return null;
  }

  const portableText = content as PortableTextProps;
  const plainText = portableTextToPlainString(portableText).trim();

  if (!plainText) {
    return null;
  }

  return {
    html: portableTextToHtml(portableText),
    plainText,
  };
}
