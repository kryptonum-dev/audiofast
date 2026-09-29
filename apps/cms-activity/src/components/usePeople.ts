import { useClient, useProject } from '@sanity/sdk-react';
import { useEffect, useMemo, useState } from 'react';

import { appConfig } from '../config.js';
import { resolveUserProfiles, selectHumanMembers } from '../lib/members.js';
import type { UserProfile } from '../lib/types.js';

export type Person = {
  id: string;
  label: string;
  email: string | null;
};

export type PeopleState = {
  people: Person[];
  /** True while display names are still being resolved. */
  loadingProfiles: boolean;
  profileError: boolean;
};

/**
 * Human project members with display names. Suspends until the project
 * membership list is available (wrap callers in `Suspense`).
 */
export function usePeople(): PeopleState {
  const project = useProject({
    projectId: appConfig.projectId,
    includeMembers: true,
    includeFeatures: false,
  });
  const client = useClient({ apiVersion: appConfig.apiVersion });

  const humans = useMemo(
    () => selectHumanMembers(project.members ?? []),
    [project.members],
  );
  const idsKey = humans.map((member) => member.id).join(',');

  /** Profiles keyed by the member id list they were resolved for. */
  const [resolved, setResolved] = useState<{
    key: string;
    profiles: Map<string, UserProfile>;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    const ids = idsKey === '' ? [] : idsKey.split(',');
    const controller = new AbortController();
    resolveUserProfiles(client, ids, { signal: controller.signal })
      .then((profiles) => {
        if (!controller.signal.aborted) {
          setResolved({ key: idsKey, profiles, error: false });
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setResolved({ key: idsKey, profiles: new Map(), error: true });
      });
    return () => controller.abort();
  }, [client, idsKey]);

  const current = resolved?.key === idsKey ? resolved : null;
  const profiles = current?.profiles ?? null;

  const people = useMemo(() => {
    const list = humans.map((member): Person => {
      const profile = profiles?.get(member.id);
      return {
        id: member.id,
        label: profile?.displayName ?? member.id,
        email: profile?.email ?? null,
      };
    });
    return list.sort((a, b) => a.label.localeCompare(b.label, 'pl'));
  }, [humans, profiles]);

  return {
    people,
    loadingProfiles: current === null,
    profileError: current?.error ?? false,
  };
}
