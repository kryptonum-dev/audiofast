import type { AllowedUser } from './access/is-allowed.js';

/**
 * Every project-specific value lives here, so redeploying the app for another
 * Sanity project is a config change only. Pure modules in `src/lib` must not
 * import project ids from anywhere else.
 */
export const appConfig = {
  organizationId: 'o5BEPFjvf',
  projectId: 'fsw3likv',
  dataset: 'production',
  apiVersion: '2025-02-19',
  studioUrl:
    'https://www.sanity.io/@o5BEPFjvf/studio/dlwt2zhgkk7rjx6dj8rdyjfz/default',
  allowedUsers: [
    { id: 'p54InZnMK', email: 'jarek@audiofast.pl' },
    { id: 'p3oltYQ6U', email: 'dev@kryptonum.eu' },
  ] satisfies AllowedUser[],
  /** Shown to signed-in users outside `allowedUsers` as who to ask for access. */
  accessContact: { name: 'Jarek Orszański', email: 'jarek@audiofast.pl' },
  limits: {
    maxRangeDays: 90,
    defaultRangeDays: 30,
    defaultSessionGapMinutes: 30,
    minSessionMinutes: 5,
    mergeWindowMinutes: 5,
    pageSize: 1000,
    snapshotBatchSize: 50,
  },
  timeZone: 'Europe/Warsaw',
} as const;

export type AppConfig = typeof appConfig;
