import { describe, expect, it } from 'vitest';

import { isRscFlightScript } from './isRscFlightScript';

function script(text: string, src?: string): HTMLScriptElement {
  const element = document.createElement('script');
  element.textContent = text;
  if (src) element.setAttribute('src', src);
  return element;
}

describe('isRscFlightScript', () => {
  it('matches the inline RSC flight payload scripts', () => {
    expect(isRscFlightScript(script('self.__next_f.push([1,"x"])'))).toBe(true);
    expect(isRscFlightScript(script('  self.__next_f=self.__next_f||[]'))).toBe(
      true,
    );
  });

  it('keeps every other element in the audit', () => {
    expect(isRscFlightScript(script('window.dataLayer = []'))).toBe(false);
    expect(
      isRscFlightScript(script('self.__next_f.push(1)', '/_next/x.js')),
    ).toBe(false);
    const ldJson = script('{"@type":"Organization"}');
    ldJson.type = 'application/ld+json';
    expect(isRscFlightScript(ldJson)).toBe(false);
    expect(isRscFlightScript(document.createElement('div'))).toBe(false);
    expect(isRscFlightScript(undefined)).toBe(false);
  });
});
