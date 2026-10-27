'use client';

import { createContext, type ReactNode, useContext } from 'react';

/**
 * Whether the current request renders in draft mode (a Presentation session
 * or a shared preview link), for client islands that must behave differently
 * there: buying is disabled in draft mode (P10), so no stega-encoded product
 * string can reach the cart, checkout or a payment.
 *
 * The root layout provides it from `draftMode()`. During a prerender that
 * resolves to `false`, so the static shell is the published branch. Kept free
 * of `next-sanity/hooks` on purpose: those pull the visual-editing bundle into
 * every chunk that imports them.
 */
const DraftModeContext = createContext(false);

export function DraftModeProvider({
  isDraft,
  children,
}: {
  isDraft: boolean;
  children: ReactNode;
}) {
  return (
    <DraftModeContext.Provider value={isDraft}>
      {children}
    </DraftModeContext.Provider>
  );
}

export function useIsDraftMode(): boolean {
  return useContext(DraftModeContext);
}
