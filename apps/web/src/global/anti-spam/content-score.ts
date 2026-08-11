/**
 * Heuristic scoring for contact-form content.
 *
 * Unlike the honeypot and the BotID verdict, this looks only at what was typed.
 * That matters: it is the one signal that works regardless of whether the bot
 * fills hidden fields, executes page JS, or drives a real browser — the three
 * assumptions that made every earlier gate on /api/contact ineffective.
 *
 * Design rules learned from the 2026-08 audiofast.pl campaign:
 * - Penalise STRUCTURE, never BREVITY. Real inquiries to a high-end audio
 *   distributor are frequently terse ("Cena?", "Dostepnosc Ayre KX-8?"). Any
 *   rule that treats a short message as suspicious blocks genuine leads.
 * - Polish tolerates long consonant runs ("bezwzgledny", "wszechstronny" both
 *   reach five), so the run threshold sits above what the language produces.
 * - Every submission is scored and logged, including accepted ones, so the
 *   threshold can be tuned from real traffic instead of guessed at again.
 */

/** `y` is a vowel in Polish; the diacritics are the ones that occur in vowels. */
const VOWEL = /[aeiouyąęó]/i;
const LETTER = /\p{L}/u;

export type ContentSignal =
  | 'no-whitespace-long'
  | 'random-case'
  | 'consonant-run'
  | 'name-single-token';

export type ContentScore = {
  score: number;
  signals: ContentSignal[];
};

const WEIGHTS: Record<ContentSignal, number> = {
  /** A long message with no whitespace at all is not a sentence. */
  'no-whitespace-long': 3,
  /** aFhZeUW — case flipping mid-word is a generator artefact. */
  'random-case': 3,
  /** Longer than any Polish cluster. */
  'consonant-run': 2,
  /** Weak on its own: plenty of people type only a surname. */
  'name-single-token': 1,
};

/** Reject at or above this. Tune from the logged scores of accepted traffic. */
export const SPAM_SCORE_THRESHOLD = 5;

const MIN_LENGTH_FOR_WHITESPACE_CHECK = 15;
const MIN_LETTERS_FOR_CASE_CHECK = 8;
const MAX_CASE_TRANSITION_RATIO = 0.4;
const MAX_CONSONANT_RUN = 6;

/**
 * Share of adjacent letter pairs that switch case. Natural text sits near zero
 * (one transition per capitalised word); generated filler sits above 0.5.
 *
 * Returns 0 for inputs too short to judge — two letters cannot establish a
 * pattern, and a false positive here costs a real lead.
 */
function caseTransitionRatio(text: string): number {
  const letters = [...text].filter((char) => LETTER.test(char));
  if (letters.length < MIN_LETTERS_FOR_CASE_CHECK) return 0;

  let transitions = 0;
  for (let index = 1; index < letters.length; index++) {
    const previous = letters[index - 1]!;
    const current = letters[index]!;
    // Characters without case (digits already filtered) compare equal both ways
    const previousIsUpper = previous === previous.toUpperCase();
    const currentIsUpper = current === current.toUpperCase();
    if (previousIsUpper !== currentIsUpper) transitions++;
  }

  return transitions / letters.length;
}

/** Longest unbroken consonant sequence. Non-letters reset the run. */
function longestConsonantRun(text: string): number {
  let longest = 0;
  let current = 0;

  for (const char of text) {
    if (!LETTER.test(char)) {
      current = 0;
      continue;
    }
    current = VOWEL.test(char) ? 0 : current + 1;
    if (current > longest) longest = current;
  }

  return longest;
}

/**
 * Score the human-authored parts of a submission. Higher is more suspicious.
 * Pure and side-effect free so the thresholds stay unit-testable.
 */
export function scoreContent(
  name: string | undefined,
  message: string | undefined,
): ContentScore {
  const trimmedName = (name ?? '').trim();
  const trimmedMessage = (message ?? '').trim();
  const signals: ContentSignal[] = [];

  if (
    trimmedMessage.length >= MIN_LENGTH_FOR_WHITESPACE_CHECK &&
    !/\s/.test(trimmedMessage)
  ) {
    signals.push('no-whitespace-long');
  }

  if (
    caseTransitionRatio(trimmedName) > MAX_CASE_TRANSITION_RATIO ||
    caseTransitionRatio(trimmedMessage) > MAX_CASE_TRANSITION_RATIO
  ) {
    signals.push('random-case');
  }

  if (
    longestConsonantRun(trimmedName) >= MAX_CONSONANT_RUN ||
    longestConsonantRun(trimmedMessage) >= MAX_CONSONANT_RUN
  ) {
    signals.push('consonant-run');
  }

  if (
    trimmedName.length >= MIN_LETTERS_FOR_CASE_CHECK &&
    !/\s/.test(trimmedName)
  ) {
    signals.push('name-single-token');
  }

  const score = signals.reduce((total, signal) => total + WEIGHTS[signal], 0);

  return { score, signals };
}

export function isSpamContent(score: ContentScore): boolean {
  return score.score >= SPAM_SCORE_THRESHOLD;
}
