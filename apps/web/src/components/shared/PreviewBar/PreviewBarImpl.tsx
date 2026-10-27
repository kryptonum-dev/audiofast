'use client';

import { useRouter } from 'next/navigation';
import { useIsPresentationTool } from 'next-sanity/hooks';
import { useTransition } from 'react';

import { disableDraftMode } from '@/src/app/actions/draft-mode';

import styles from './styles.module.scss';

/**
 * The visible exit affordance for a draft session: rendered only for
 * draft-cookie holders (the root layout mounts it in draft mode), and only
 * OUTSIDE the Presentation iframe.
 *
 * Inside Presentation the Studio frames the preview and owns the perspective
 * switch; exiting draft mode under its feet would break the session. An editor
 * who opens a draft URL in a normal tab (share access) still gets a way out.
 */
export default function PreviewBarImpl() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // `null` while detecting, `true` inside Presentation, `false` in a plain tab.
  const isPresentationTool = useIsPresentationTool();

  const exitPreview = () => {
    startTransition(async () => {
      await disableDraftMode();
      router.refresh();
    });
  };

  if (isPresentationTool !== false) return null;

  return (
    <div className={styles.previewBar} role="status">
      <p className={styles.label}>Podgląd wersji roboczej</p>
      <button
        type="button"
        className={styles.button}
        onClick={exitPreview}
        disabled={isPending}
        aria-busy={isPending || undefined}
      >
        {isPending ? 'Wychodzę…' : 'Wyjdź z podglądu'}
      </button>
    </div>
  );
}
