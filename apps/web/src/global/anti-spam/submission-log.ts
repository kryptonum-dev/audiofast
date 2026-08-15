import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/global/supabase/admin';

import type { ContentSignal } from './content-score';

/**
 * Durable record of one contact-form submission and its verdict, mirroring the
 * `contact_submissions` table (supabase/migrations/20260811160000).
 *
 * The console `[BOTLOG]` line is gone from Vercel within ~24h on the current
 * plan; this table is the version that survives. Rejected rows keep the
 * submitted name/message so a wrongly blocked human inquiry can be spotted and
 * recovered after the fact — the review loop that makes strict gates (BotID
 * veto, score threshold) safe to run.
 */
export type PersistedSubmission = {
  verdict: 'accepted' | 'rejected';
  reason: string;
  contentScore: number;
  contentSignals: ContentSignal[];
  honeypotTripped: boolean;
  honeypotValue: string | null;
  elapsedMs: number | null;
  botidIsBot: boolean | null;
  botidIsHuman: boolean | null;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  referer: string | null;
  name: string | null;
  message: string | null;
};

const MAX_NAME_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

/**
 * Append the submission to `contact_submissions`. Best-effort by design: a
 * missing table (migration not yet applied), absent service-role env, or a
 * database outage must never change the HTTP verdict, so every failure path
 * logs and returns.
 */
export async function persistSubmission(
  entry: PersistedSubmission,
): Promise<void> {
  try {
    // Untyped: `contact_submissions` is not in the generated Database types
    // until the migration is applied and `database.types.ts` regenerated.
    const supabase: SupabaseClient = createAdminClient();

    const { error } = await supabase.from('contact_submissions').insert({
      verdict: entry.verdict,
      reason: entry.reason,
      content_score: entry.contentScore,
      content_signals: entry.contentSignals,
      honeypot_tripped: entry.honeypotTripped,
      honeypot_value: entry.honeypotValue,
      elapsed_ms: entry.elapsedMs,
      botid_is_bot: entry.botidIsBot,
      botid_is_human: entry.botidIsHuman,
      email: entry.email,
      ip: entry.ip,
      user_agent: entry.userAgent,
      referer: entry.referer,
      name: entry.name ? entry.name.slice(0, MAX_NAME_LENGTH) : null,
      message: entry.message
        ? entry.message.slice(0, MAX_MESSAGE_LENGTH)
        : null,
    });

    if (error) {
      console.error('[Contact API] Failed to persist submission', error);
    }
  } catch (error) {
    console.error('[Contact API] Failed to persist submission', error);
  }
}
