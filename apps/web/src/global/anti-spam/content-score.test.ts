import { describe, expect, it } from 'vitest';

import {
  isSpamContent,
  scoreContent,
  SPAM_SCORE_THRESHOLD,
} from './content-score';

/**
 * Captured from the submission Jarek forwarded on 2026-08-09. Kept verbatim:
 * the thresholds exist to catch this shape, so a refactor that stops catching
 * it should fail here rather than in the client's inbox.
 */
const REAL_SPAM = {
  name: 'afHZeUWfAEaGHPZuSj',
  message: 'uUeOyBQwSCXYwfgIhXaus',
};

describe('scoreContent', () => {
  it('flags the captured 2026-08-09 spam submission', () => {
    const score = scoreContent(REAL_SPAM.name, REAL_SPAM.message);

    expect(isSpamContent(score)).toBe(true);
    expect(score.signals).toContain('no-whitespace-long');
    expect(score.signals).toContain('random-case');
  });

  describe('legitimate inquiries stay well below the threshold', () => {
    // A false positive here is a lost B2B lead for a high-end audio dealer,
    // which is materially worse than a spam mail reaching the inbox.
    const legitimate: Array<[string, string, string]> = [
      [
        'full Polish inquiry',
        'Jarosław Orszański',
        'Dzień dobry, proszę o informację o dostępności Ayre KX-8. Pozdrawiam',
      ],
      ['terse price question', 'Anna Nowak', 'Cena?'],
      ['short availability question', 'Piotr Kowalski', 'Dostępność?'],
      [
        'surname only',
        'Kowalski',
        'Proszę o kontakt telefoniczny w tej sprawie',
      ],
      [
        'English inquiry',
        'John Smith',
        'What is the price of the Rogue Audio RP-5?',
      ],
      ['German single word', 'Klaus Müller', 'Verfuegbarkeitsanfrage'],
      ['all caps', 'ANNA NOWAK', 'PROSZĘ O KONTAKT W SPRAWIE ZAMÓWIENIA'],
      [
        'Polish consonant clusters',
        'Krzysztof Wszechstronny',
        'Bezwzględnie proszę o wycenę przeszczepu źdźbła w Szczecinie',
      ],
      [
        'model number in message',
        'Marek Zieliński',
        'Ayre KX-8 oraz RP-3 — cena?',
      ],
    ];

    it.each(legitimate)('%s', (_label, name, message) => {
      const score = scoreContent(name, message);
      expect(isSpamContent(score)).toBe(false);
    });
  });

  describe('individual signals', () => {
    it('does not penalise a short single-token message', () => {
      // The rule that would catch "uUeOyBQ..." must not catch "Cena?"
      expect(scoreContent('Anna Nowak', 'Cena?').signals).not.toContain(
        'no-whitespace-long',
      );
    });

    it('flags a long message with no whitespace', () => {
      expect(
        scoreContent('Anna Nowak', 'abcdefghijklmnopqrst').signals,
      ).toContain('no-whitespace-long');
    });

    it('flags case flipping mid-word', () => {
      expect(
        scoreContent('aFhZeUWfAe', 'Normalna wiadomość').signals,
      ).toContain('random-case');
    });

    it('ignores case flips in strings too short to judge', () => {
      expect(scoreContent('aFhZ', 'Normalna wiadomość').signals).not.toContain(
        'random-case',
      );
    });

    it('treats y as a vowel so Polish words do not trip the run check', () => {
      expect(
        scoreContent('Krzysztof', 'Wszechstronny bezwzględny').signals,
      ).not.toContain('consonant-run');
    });

    it('flags consonant runs longer than Polish produces', () => {
      expect(
        scoreContent('Anna Nowak', 'bqwscxzfg wiadomość').signals,
      ).toContain('consonant-run');
    });

    it('treats a single-token name as weak evidence only', () => {
      const score = scoreContent('Kowalski', 'Proszę o kontakt w tej sprawie');
      expect(score.signals).toEqual(['name-single-token']);
      expect(score.score).toBeLessThan(SPAM_SCORE_THRESHOLD);
    });
  });

  describe('missing input', () => {
    it('scores empty submissions as clean', () => {
      expect(scoreContent(undefined, undefined).score).toBe(0);
      expect(scoreContent('', '').score).toBe(0);
    });

    it('handles a product inquiry with no message', () => {
      // ProductInquiryForm can submit without a message body
      expect(isSpamContent(scoreContent('Anna Nowak', undefined))).toBe(false);
    });
  });
});
