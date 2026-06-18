---
date: 2026-06-18T09:13:23+0200
researcher: Oliwier Sellig
git_commit: 4b96fd242e0e5356fb5d4926e0656802ed9dc138
branch: main
repository: audiofast
topic: "Porównywarka odrzuca produkt należący do więcej niż jednej kategorii"
tags: [research, codebase, comparison, porownywarka, categories, bug]
status: complete
last_updated: 2026-06-18
last_updated_by: Oliwier Sellig
---

# Research: Porównywarka odrzuca produkt należący do więcej niż jednej kategorii

**Date**: 2026-06-18T09:13:23+0200
**Researcher**: Oliwier Sellig
**Git Commit**: 4b96fd242e0e5356fb5d4926e0656802ed9dc138
**Branch**: main
**Repository**: audiofast

## Research Question

Klient (Jarek) zgłosił: gdy produkt należy do więcej niż jednej kategorii, nie
można dodać go do porównania. Przykład — przy próbie porównania **Rogue Audio
RP-3, RP-5 i Ayre KX-8** aplikacja zwróciła błąd, że KX-8 należy do kategorii
**DAC** (prawda), podczas gdy należy on **również** do kategorii
**przedwzmacniaczy liniowych** — i nie da się go porównać. Należy ustalić
przyczynę (error log) i sposób naprawy.

## Summary (TL;DR)

**To potwierdzony błąd logiki, nie błąd danych.** Model danych i zapytania GROQ
**w pełni obsługują** produkty w wielu kategoriach — każdy produkt niesie pełną
tablicę `categories[]`. Problem leży w warstwie walidacji porównywarki, która
**redukuje produkt do JEDNEJ kategorii** (`categories[0]`, czyli pierwszej z
tablicy) i porównuje ją operatorem ścisłej nierówności `!==` ze slugiem zapisanym
w ciasteczku porównywarki.

Skoro Sanity zwraca tablicę kategorii w kolejności edytorskiej (referencyjnej),
która **nie jest gwarantowana jako identyczna między produktami**, „pierwsza
kategoria" KX-8 (`dac`) może różnić się od kategorii, pod którą porównywarka
została zainicjowana przez RP-3/RP-5 (`przedwzmacniacze-liniowe`). Efekt:

```
"dac" !== "przedwzmacniacze-liniowe"  →  odrzucenie
```

mimo że wszystkie trzy produkty **mają wspólną** kategorię „przedwzmacniacze
liniowe". Walidacja porównuje pojedynczy slug zamiast sprawdzać **część wspólną
(intersection)** zbiorów kategorii.

## Error Log (root cause)

**Klasa błędu:** błędne założenie domenowe „produkt = jedna kategoria" zaszyte w
warstwie porównywarki, podczas gdy reszta systemu traktuje kategorie jako zbiór.

**Punkt zapłonu** — `apps/web/src/global/comparison/cookie-manager.ts:132`
(funkcja `addProductToComparison`, jedyna realnie wywoływana bramka walidacji):

```ts
// Check category match
if (current && current.categorySlug !== categorySlug) {
  // ...
  return {
    success: false,
    error: `${productLabel} jest w kategorii "${incomingLabel}". Porównywarka zawiera już produkty z kategorii "${currentLabel}".`,
  };
}
```

- Ciasteczko (`ComparisonCookie`) przechowuje **jeden** `categorySlug`
  (`apps/web/src/global/comparison/types.ts:8-17`) — brak tablicy.
- Przekazywany do walidacji `categorySlug` jest **deterministycznie** brany z
  `categories[0].slug` (pierwszy element tablicy) w punktach dodawania.
- Bliźniacza funkcja `validateProductAddition`
  (`comparison-helpers.ts:44`, ten sam `!==`) zawiera identyczny błąd, ale jest
  obecnie **martwym kodem** (tylko re-eksport w `index.ts:9`, brak wywołań w
  runtime). Mimo to przy poprawce trzeba ją zsynchronizować, bo jest publicznym
  API modułu.

**Scenariusz odtworzenia (zgłoszenie Jarka):**

1. Dodanie RP-3 (lub RP-5) — jego `categories[0]` to `przedwzmacniacze-liniowe`
   → ciasteczko: `categorySlug = "przedwzmacniacze-liniowe"`.
2. Dodanie Ayre KX-8 — jego `categories[0]` to `dac` (KX-8 należy do obu:
   `dac` **i** `przedwzmacniacze-liniowe`).
3. `cookie-manager.ts:132`: `"przedwzmacniacze-liniowe" !== "dac"` → **odrzucenie**
   z komunikatem „…jest w kategorii DAC. Porównywarka zawiera już produkty z
   kategorii przedwzmacniacze liniowe."

> Uwaga: kierunek zależy od tego, który produkt dodano pierwszy i jaka jest
> kolejność w tablicy `categories[]` każdego z nich — dlatego błąd bywa
> „kapryśny" i zależny od konfiguracji w Studio.

## Detailed Findings

### 1. Model danych — kategorie to TABLICA (wiele kategorii jest wspierane)

`apps/studio/schemaTypes/documents/collections/product.ts:44-74`:

```ts
defineField({
  name: "categories",                          // :45
  title: "Kategorie",                          // :46
  type: "array",                               // :47  ← TABLICA, nie pojedyncza referencja
  description:
    "Wybierz kategorie, do których należy ten produkt. Produkt może należeć do wielu kategorii.", // :48-49
  of: [{ type: "reference", to: [{ type: "productCategorySub" }] }],
  validation: (Rule) =>
    Rule.required().error("Produkt musi należeć do co najmniej jednej kategorii"), // :71
})
```

Produkt trzyma **tablicę referencji** do `productCategorySub`; opis i walidacja
wprost dopuszczają wiele kategorii. Ayre KX-8 w `dac` + `przedwzmacniacze-liniowe`
jest poprawny z punktu widzenia modelu.

Pola zdenormalizowane potwierdzają „mnogość":
- `denormCategorySlugs` (`product.ts:485-494`) — `array of string`, „Array of all
  category slugs this product belongs to".
- Liczone w `apps/studio/utils/denormalize-product.ts:34-116`
  (`categorySlugs = categories.map(c => c.slug)`, `:87`) — **wszystkie** slugi,
  nie tylko pierwszy. (Porównywarka tych pól nie używa.)

### 2. Zapytania GROQ — projekcja zwraca pełną tablicę kategorii

`apps/web/src/global/sanity/query.ts`:

- `queryComparisonProductsMinimal` (`:2449-2468`) projektuje
  `"categories": categories[]->{ "slug": slug.current, name }` (`:2463-2466`).
- `queryComparisonPageData` (`:2474-2512`) filtruje produkty po **jednym**
  parametrze `$categorySlug`, ale przez **przynależność do tablicy**:

```groq
"products": *[_type == "product"
    && !(_id in path("drafts.**"))
    && isArchived != true
    && $categorySlug in categories[]->slug.current]   // :2475  ← jeden slug ∈ tablica slugów
  | order(name asc) {
    ...
    "categories": categories[]->{ "slug": slug.current, name }, // :2503-2505
  },
"enabledParameters": *[_type == "comparatorConfig"][0]
    .categoryConfigs[category->slug.current == $categorySlug][0]  // :2508
    .enabledParameters[] { name, displayName }
```

Czyli zapytanie **już dziś** używa testu „slug należy do tablicy kategorii
produktu" — dane do sprawdzenia części wspólnej są dostępne w runtime. Tylko
warstwa walidacji/inicjalizacji redukuje to do jednego sluga.

### 3. Trzy miejsca, w których produkt jest redukowany do jednej kategorii

Wszystkie wywołania `addProductToComparison(...)` przekazują slug z `categories[0]`:

1. **Karta produktu (listingi/siatki)** —
   `apps/web/src/components/ui/ProductCard/index.tsx:67-73`:
   ```tsx
   categorySlug={categories?.[0]?.slug ?? ''}
   categoryName={categories?.[0]?.name ?? categories?.[0]?.slug ?? ''}
   ```
   → wywołanie `addProductToComparison(...)` w
   `components/ui/ProductCard/AddToComparisonButton.tsx:70`.

2. **Strona produktu (ProductHero)** — slug pochodzi z kontekstu trasy,
   `apps/web/src/app/produkty/[slug]/page.tsx:128-131`:
   ```ts
   const primaryCategory = product.categories?.[0];
   const primaryCategorySlug = primaryCategory?.slug ?? '';
   ```
   przekazany jako `categorySlug={primaryCategorySlug}` (`:211`) →
   `components/products/ProductHero/AddToComparison.tsx:67`. (Strona liczy też
   pełną tablicę `categorySlugs` na `:126-127`, ale używa jej tylko do analytics
   `ProductViewTracker`, nie do porównywarki.)

3. **Selektor na stronie /porownaj** —
   `apps/web/src/components/comparison/ComparisonTable/index.tsx:69-76` bierze slug
   z **już obecnego** pierwszego produktu (`currentProducts[0]?.categories[0]?.slug`),
   wywołanie na `:135`. To miejsce częściowo omija błąd (używa kategorii istniejącego
   produktu), ale niespójnie — wciąż tylko `[0]`.

`FloatingComparisonBox/index.tsx` i `ProductSelector/index.tsx` nie wywołują
`addProductToComparison` (czytają tylko ciasteczko / delegują wybór).

### 4. Strona /porownaj startuje od jednego sluga z ciasteczka

`apps/web/src/app/porownaj/page.tsx:68-72`:

```ts
const categorySlug = comparisonCookie.categorySlug;        // :68
const { products, enabledParameters } = categorySlug
  ? await fetchComparisonPageData(categorySlug)            // :72
```

Lista „kandydatów do dorzucenia" i wybór `enabledParameters` (konfiguracja
parametrów porównania) są kluczowane tym jednym slugiem.

## Proponowana naprawa

**Zasada:** produkt można dodać, jeżeli zbiór jego kategorii **ma część wspólną**
ze zbiorem kategorii wspólnych dla produktów już będących w porównaniu (logika
„intersection", nie równość pojedynczego sluga).

### Wariant A (rekomendowany) — przejście na zbiór slugów w ciasteczku

1. **Ciasteczko** (`types.ts`): zamiast `categorySlug: string` trzymać
   `categorySlugs: string[]` = część wspólna kategorii wszystkich dodanych
   produktów (na starcie = wszystkie kategorie pierwszego produktu). Dodać
   wsteczną kompatybilność przy odczycie starych ciasteczek (jeśli jest
   `categorySlug`, potraktować jako `[categorySlug]`).
2. **Dodawanie** (`cookie-manager.ts addProductToComparison`): zamiast przekazywać
   pojedynczy slug, przekazywać **całą tablicę** `product.categories[].slug`.
   Walidacja:
   ```ts
   const incoming = new Set(incomingSlugs);
   const intersection = current.categorySlugs.filter((s) => incoming.has(s));
   if (current && intersection.length === 0) { /* odrzuć */ }
   ```
   Po dodaniu: `categorySlugs = intersection` (zawężanie wspólnego mianownika).
3. **Punkty wywołania** (ProductCard `:67-73`, page.tsx `:128-131`,
   ComparisonTable `:69-76`): przekazywać `categories.map(c => c.slug)` zamiast
   `categories[0].slug`. Dane (pełna tablica) są już dostępne w każdym z tych
   miejsc.
4. **Strona /porownaj** (`page.tsx:68-72` + `fetchComparisonPageData`): pobierać
   kandydatów po **dowolnym** slugu z `categorySlugs` (GROQ:
   `count(categories[]->slug.current[@ in $categorySlugs]) > 0`) oraz wybierać
   reprezentatywny slug dla `enabledParameters` (np. pierwszy wspólny). Zaktualizować
   `queryComparisonPageData` (`query.ts:2475`, `:2508`), by przyjmowało
   `$categorySlugs` (tablicę).
5. Zsynchronizować martwy `validateProductAddition`
   (`comparison-helpers.ts:19-63`) z nową logiką (albo go usunąć, jeśli niewołany).

### Wariant B (mniejszy zasięg) — szybka łatka bez zmiany kształtu ciasteczka

Zostawić `categorySlug: string` w ciasteczku, ale przy dodawaniu przekazywać
tablicę kategorii kandydata i akceptować, gdy **slug ciasteczka należy do tablicy
kategorii produktu** (`incomingSlugs.includes(current.categorySlug)`). Rozwiązuje
zgłoszenie Jarka przy minimalnej zmianie, ale nie obsługuje przypadków, gdy część
wspólna „zawęża się" przy trzecim produkcie — może wpuścić zestaw bez jednej
wspólnej kategorii dla całej trójki. Akceptowalne jako hotfix, niżej oceniane
długoterminowo niż Wariant A.

### Uwaga o `enabledParameters`

Konfiguracja parametrów porównania (`comparatorConfig`) jest kluczowana jedną
kategorią (`query.ts:2508`). Po zmianie trzeba zdecydować, która z **wspólnych**
kategorii dostarcza zestaw parametrów (np. pierwsza wspólna w kolejności edytorskiej)
— inaczej tabela mogłaby pokazać inne wiersze niż przy obecnej, jednokategoryjnej
ścieżce.

## Code References

- `apps/web/src/global/comparison/cookie-manager.ts:132` — bramka `!==` (główny bug)
- `apps/web/src/global/comparison/cookie-manager.ts:149-154` — zapis ciasteczka z jednym slugiem
- `apps/web/src/global/comparison/comparison-helpers.ts:44` — bliźniaczy `!==` (martwy kod / publiczne API)
- `apps/web/src/global/comparison/types.ts:8-17` — `ComparisonCookie` (jeden `categorySlug`)
- `apps/web/src/global/comparison/types.ts:73-76` — `ComparisonProduct.categories` (pełna tablica)
- `apps/web/src/components/ui/ProductCard/index.tsx:67-73` — przekazanie `categories[0].slug`
- `apps/web/src/components/ui/ProductCard/AddToComparisonButton.tsx:70` — wywołanie add
- `apps/web/src/components/products/ProductHero/AddToComparison.tsx:67` — wywołanie add
- `apps/web/src/app/produkty/[slug]/page.tsx:128-131,211` — wybór „primary category"
- `apps/web/src/components/comparison/ComparisonTable/index.tsx:69-76,135` — slug z istniejącego produktu
- `apps/web/src/app/porownaj/page.tsx:68-72` — start od jednego sluga z ciasteczka
- `apps/web/src/global/sanity/query.ts:2474-2512` — `queryComparisonPageData` (filtr `$categorySlug`)
- `apps/web/src/global/sanity/query.ts:2449-2468` — `queryComparisonProductsMinimal`
- `apps/studio/schemaTypes/documents/collections/product.ts:44-74` — pole `categories` (array)
- `apps/studio/schemaTypes/documents/collections/product.ts:485-494` — `denormCategorySlugs`
- `apps/studio/utils/denormalize-product.ts:34-116` — obliczanie wszystkich slugów kategorii

## Architecture Insights

- **System traktuje kategorie jako zbiór wszędzie poza porównywarką** — schema
  (`array`), denormalizacja (`denormCategorySlugs: string[]`), nawet zapytanie
  porównywarki (`$slug in categories[]->slug.current`). Jedynym miejscem z
  założeniem „jedna kategoria" jest walidacja/ciasteczko porównywarki. To wzorzec
  „pojedynczy punkt niezgodności z modelem domeny".
- **Pojęcie „primary category"** (`categories[0]`) istnieje tylko niejawnie — nigdzie
  nie jest oznaczone w Studio jako kategoria główna; to po prostu pierwszy element
  tablicy w kolejności edytorskiej. Opieranie logiki biznesowej na kolejności
  tablicy referencji jest kruche.
- **Naprawa jest po stronie `apps/web` (logika + ewentualnie GROQ)** — żadnych
  zmian w modelu Sanity ani w danych nie potrzeba; dane już są poprawne.

## Open Questions

1. Czy chcemy semantyki „część wspólna zawężana przy każdym dodaniu" (Wariant A),
   czy luźniejszej „każdy nowy produkt musi dzielić kategorię z którymkolwiek już
   dodanym" (Wariant B)? Wpływa to na to, czy cała trójka ma gwarantowaną jedną
   wspólną kategorię.
2. Którą z wielu wspólnych kategorii wybrać dla `enabledParameters`
   (`comparatorConfig`), gdy produkty dzielą więcej niż jedną?
3. Czy warto wprowadzić jawne pole „kategoria główna" w schemacie produktu, by
   ustabilizować wybór reprezentatywnej kategorii (zamiast `categories[0]`)?

## Related Research

- (brak wcześniejszych dokumentów badawczych w `context/` — to pierwszy)
