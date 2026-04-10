import { syncCouponWithCart } from './cart-coupon';
import type {
  CartLine,
  CartLineIssue,
  CartLineIssueCode,
  CartLineRevalidation,
  CartState,
} from './types';

const MANAGED_ISSUE_CODES: CartLineIssueCode[] = [
  'configuration_invalid',
  'cpo_unavailable',
  'not_buyable',
  'price_changed',
];

function createIssue(
  code: CartLineIssueCode,
  blocking: boolean,
  message: string,
): CartLineIssue {
  return {
    code,
    blocking,
    message,
  };
}

function removeManagedIssues(line: CartLine): CartLineIssue[] {
  return line.issues.filter(
    (issue) => !MANAGED_ISSUE_CODES.includes(issue.code),
  );
}

function applyRevalidationToLine(
  line: CartLine,
  result: CartLineRevalidation,
): CartLine {
  const issues = removeManagedIssues(line);

  if (
    typeof result.unitPriceCents === 'number' &&
    result.unitPriceCents > 0 &&
    result.unitPriceCents !== line.unitPriceCents
  ) {
    issues.push(
      createIssue(
        'price_changed',
        false,
        'Cena produktu została zaktualizowana.',
      ),
    );
  }

  if (result.lineType === 'standard' && line.lineType === 'standard') {
    if (!result.isBuyable) {
      issues.push(
        createIssue(
          'not_buyable',
          true,
          'Produkt nie jest już dostępny do zakupu.',
        ),
      );
    }

    if (!result.isConfigurationValid) {
      issues.push(
        createIssue(
          'configuration_invalid',
          true,
          'Wybrana konfiguracja nie jest już dostępna.',
        ),
      );
    }

    return {
      ...line,
      unitPriceCents:
        typeof result.unitPriceCents === 'number' && result.unitPriceCents > 0
          ? result.unitPriceCents
          : line.unitPriceCents,
      issues,
    };
  }

  if (result.lineType === 'cpo' && line.lineType === 'cpo') {
    if (!result.isBuyable || result.availabilityStatus !== 'available') {
      issues.push(
        createIssue(
          'cpo_unavailable',
          true,
          'Ten egzemplarz CPO nie jest już dostępny.',
        ),
      );
    }

    return {
      ...line,
      unitPriceCents:
        typeof result.unitPriceCents === 'number' && result.unitPriceCents > 0
          ? result.unitPriceCents
          : line.unitPriceCents,
      availabilityStatus: result.availabilityStatus,
      issues,
    };
  }

  return line;
}

export function applyCartRevalidation(
  state: CartState,
  results: CartLineRevalidation[],
): CartState {
  const resultMap = new Map(results.map((result) => [result.lineId, result]));

  const lines = state.lines.map((line) => {
    const result = resultMap.get(line.lineId);

    if (!result) {
      return line;
    }

    return applyRevalidationToLine(line, result);
  });

  return syncCouponWithCart({
    ...state,
    lines,
  });
}
