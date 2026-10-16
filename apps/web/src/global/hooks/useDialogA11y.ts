'use client';

import { type RefObject, useEffect, useEffectEvent } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

type UseDialogA11yOptions = {
  isOpen: boolean;
  /** The dialog panel; focus is kept inside it while the dialog is open. */
  containerRef: RefObject<HTMLElement | null>;
  /**
   * Element focused when the dialog opens. Falls back to the first focusable
   * element in the container, then the container itself (give it
   * `tabIndex={-1}`).
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
};

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.closest('[inert]') &&
      element.getClientRects().length > 0,
  );
}

/**
 * Shared modal dialog behaviour:
 * - moves focus into the dialog when it opens,
 * - keeps Tab / Shift+Tab inside the dialog,
 * - calls `onEscape` on Escape,
 * - locks page scroll (root `html` overflow) and restores the previous value,
 * - returns focus to the element that was focused before the dialog opened.
 *
 * `onEscape` does not need to be stable.
 */
export function useDialogA11y({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
}: UseDialogA11yOptions) {
  const handleEscape = useEffectEvent(() => {
    onEscape?.();
  });

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    // The page scrolls on <html>: global styles set `overflow-x: clip` on
    // html and body, so body overflow is not propagated to the viewport and
    // `body { overflow: hidden }` alone would not stop the page from
    // scrolling. Lock the root scroller and keep the scrollbar gutter so the
    // layout does not shift while the dialog is open.
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousRootScrollbarGutter = root.style.scrollbarGutter;
    const hasScrollbar = window.innerWidth > root.clientWidth;
    root.style.overflow = 'hidden';
    if (hasScrollbar) {
      root.style.scrollbarGutter = 'stable';
    }

    const container = containerRef.current;

    if (container && !container.contains(document.activeElement)) {
      const initialTarget =
        initialFocusRef?.current ??
        getTabbableElements(container)[0] ??
        container;

      initialTarget.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        handleEscape();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const currentContainer = containerRef.current;

      if (!currentContainer) {
        return;
      }

      const tabbable = getTabbableElements(currentContainer);
      const firstElement = tabbable[0];
      const lastElement = tabbable[tabbable.length - 1];

      if (!firstElement || !lastElement) {
        event.preventDefault();
        currentContainer.focus({ preventScroll: true });
        return;
      }

      const activeIndex = tabbable.indexOf(
        document.activeElement as HTMLElement,
      );

      // Focus on the container itself, on a non-tabbable element or outside
      // the dialog: wrap into the dialog in the direction of travel.
      if (activeIndex === -1) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
      }

      if (event.shiftKey && activeIndex === 0) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && activeIndex === tabbable.length - 1) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      root.style.overflow = previousRootOverflow;
      root.style.scrollbarGutter = previousRootScrollbarGutter;

      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [containerRef, initialFocusRef, isOpen]);
}
