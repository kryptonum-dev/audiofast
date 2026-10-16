# Przycisk „Dodaj do koszyka” na kafelku produktu — plan wdrożenia

## Overview

Klient (Jarosław Orszański, mail 15.10.2026) prosi o przycisk dodawania do koszyka bezpośrednio na kafelku produktu, nad „Dowiedz się więcej”. Wersja uzgodniona z Oliwierem:

- jeden przycisk **„Dodaj do koszyka”** na kafelkach produktów sprzedawanych online (`isSellableOnline` + cena > 0);
- produkt z **1 wariantem i 0 grup opcji** → dodanie od razu + okno „Dodano do koszyka”;
- produkt z **wieloma wariantami lub jakąkolwiek grupą opcji** → popup z konfiguratorem z koszyka (`CartLineConfigurator`), po zatwierdzeniu dodanie do koszyka i stan „Dodano” w tym samym popupie;
- „Dowiedz się więcej” zostaje pod spodem jako przycisk drugorzędny.

Plan powstał bez dopytywania Oliwiera (wymóg zadania) — każda decyzja, o którą skill by pytał, jest rozstrzygnięta poniżej z uzasadnieniem.

**Aktualizacja 16.10.2026 (decyzja Oliwiera):** bez nowych testów jednostkowych i e2e — żadnych nowych plików `*.test.ts(x)`, żadnych zmian w `apps/web/e2e/`. Automatycznie sprawdzamy tylko `check-types`, `lint` i build produkcyjny. Jeśli istniejące testy przestaną się kompilować przez zmiany, dostosowujemy je minimalnie, bez dodawania nowych. Cała weryfikacja działania odbywa się na końcu, po wszystkich fazach: przeglądarka, CLI/curl i odczyty GROQ (tylko do odczytu).

## Current State Analysis

- **Kafelek** `apps/web/src/components/ui/ProductCard/index.tsx:94-104` — cały kafelek to `<Link className={styles.link}>`; „Dowiedz się więcej” to `<Button tabIndex={-1}>` wewnątrz linku (`:87-89`, niepoprawny HTML: `<button>` w `<a>`). `AddToComparisonButton` to `'use client'` wyspa w środku linku z `preventDefault/stopPropagation` (`AddToComparisonButton.tsx:51-53`). Ramka, radius, tło i overflow siedzą na `.link` (`styles.module.scss:5-13`), CTA stylowane selektorem elementu `button` (`:200-215`). Plik nie ma media queries; px w `:25-26, :47-48, :60`, zagnieżdżone `@keyframes` (`:250`).
- **ProductCard jest też komponentem klienckim** — renderują go `'use client'` karuzele (`pageBuilder/FeaturedProducts/ProductsCarousel.tsx:40`, `pageBuilder/ProductsCarousel/ProductsCarouselWrapper.tsx:109`). Musi zostać synchroniczny, bez importów server-only.
- **Użycia** (6): listing `/produkty/`, kategorie, `/marki/[slug]/`, blok page-buildera (`ProductsListing/index.tsx:~275`, `productsProjection`); recenzja (`blog/ArticleBody/index.tsx:47`, inline projekcja w `queryReviewBySlug` ~`:1414-1431` — bez `hasMultiplePrices` i `categories`); `ptCtaSection` (`showButton={false}`); `ptFeaturedProducts` (vertical); karuzela featured (`showButton={false}`); karuzela produktów + „Powiązane produkty” na PDP (vertical).
- **Projekcje** w `apps/web/src/global/sanity/query.ts`: `productFragment` (`:369-394`), `productProjection` (`:653-675`, źródło `ProductType` w `global/types.ts:20`), `productsProjection` (`:2187-2204`), inline recenzji. **Żadna nie ma `isSellableOnline`.** `hasMultiplePrices` jest wszędzie poza recenzją.
- **Dodanie do koszyka na PDP** `components/products/ProductHero/PricingSection.tsx:130-180` — `createStandardCartLine` (`global/b2c/cart/standard-cart-line.ts:13-25`) z `productKey = variant.price_key`, `configurationSelection {variantId, selectedOptions}`, `unitPriceCents = configData.totalPrice`, `isReturnable`, snapshot produktu; potem `addLine` → `trackAddToCart` → `AddToCartConfirmationModal`.
- **Konfigurator koszyka** `components/b2c/CartLineConfigurationModal/CartLineConfigurator.tsx` — kontrakt `pricingData`, `initialSelection`, `onSelectionChange` (`:27-34`), sam ustawia domyślne wartości (`settleStandardConfigurationSelection`), emituje zmianę przy montowaniu; `onSelectionChange` musi być stabilny (`useCallback`), bo jest w zależnościach efektu (`:278-282`). Nie pokazuje ceny łącznej.
- **Obudowa modala** `CartLineConfigurationModal/index.tsx` — kontrakt pod edycję istniejącej linii (`line`, `onSave(lineId)`, prompty discard/merge, source notice). Brak focus trapu i powrotu fokusu; **blokada scrolla nie działa** (`:319-324` zapisuje i przywraca `overflow`, nigdy nie ustawia `hidden`) — to samo w `AddToCartConfirmationModal/index.tsx:43`. Style mają gotowy bottom sheet ≤27.4375rem.
- **Ceny** `global/supabase/queries.ts:36-128` `fetchProductPricing(slug)` — `'use cache'`, tagi `product-pricing`, `product-pricing:<slug>`, `cacheLife('weeks')`; zwraca `null` przy błędzie lub braku wierszy. Akcja `app/actions/cart-pricing.ts` zwraca tylko pricing — brak `isSellableOnline`, `isReturnable`, nazwy, marki, zdjęcia.
- **Buyability** `global/b2c/utils/buyability.ts:44-66` — `isSellableOnline` + ≥1 wariant + `lowestPrice > 0`; archiwalność nie blokuje (reguła klienta).
- **Koszyk** — `CartProvider` w `app/layout.tsx:66-84`; `useCart()` rzuca poza providerem; stan hydratowany z localStorage w efekcie (`cart-provider.tsx:101-116`) — dodanie przed hydratacją zostałoby nadpisane.
- **Dane produkcyjne**: sprzedawanych online jest 7 produktów — PlayerPro 8K TV, PlayerOne 8K, PlayerPro 8K, PlayerMini (1 wariant, 0 grup) oraz NAS (4 warianty), Chassis DIY X700 (3), M-100 (2). Reguła `hasMultiplePrices == false ⇔ 1 wariant && 0 grup` zgadza się dla 528/528 produktów z ceną.

## Desired End State

Na każdym kafelku z widocznym „Dowiedz się więcej”, dla produktu z `isSellableOnline === true` i `basePriceCents > 0`, nad „Dowiedz się więcej” jest przycisk „Dodaj do koszyka”:

- PlayerMini: klik → spinner → produkt w koszyku (badge w nagłówku +1) → okno „Dodano do koszyka” z „Kontynuuj zakupy” / „Przejdź do koszyka”.
- NAS: klik → spinner → popup z wyborem modelu i ceną na żywo → „Dodaj do koszyka” → stan „Dodano do koszyka” w popupie.
- Pozycja z kafelka jest identyczna z pozycją dodaną na PDP (ten sam `productKey`, `variantId`, cena, snapshot) i przechodzi rewalidację na `/koszyk/` bez issues.
- Kafelek jest poprawnym HTML (brak elementów interaktywnych w `<a>`), cały nadal klikalny, z czytelną nazwą linku „{marka} {nazwa}”.
- Produkty niesprzedawane online wyglądają jak dziś (poza poprawioną strukturą).

### Key Discoveries:

- `ProductCard` jest renderowany zarówno na serwerze, jak i w `'use client'` karuzelach — przycisk koszyka musi być osobnym plikiem `'use client'` (wzór: `AddToComparisonButton.tsx`).
- Synthetic events Reacta bubblują przez portale po drzewie Reacta — przycisk i modal **nie mogą** być potomkami `<Link>`, inaczej klik w tło modala nawiguje na PDP.
- Do pozycji koszyka potrzebne są dane tylko z Supabase (`price_key`, `variantId`) — kafelek ich nie ma i nie powinien (cache listingów); dociągamy je przy kliknięciu.
- Typy listingów: `QueryProductsListing*Result.products` są generowane jako `Array<never>` (`sanity.types.ts:~37404`), `ProductsListing` rzutuje na `ProductType` — pola dodane do `productsProjection` nie są sprawdzane przez TS; trzeba je dodać spójnie we wszystkich projekcjach.
- Backtick wewnątrz `/* groq */` template literal (nawet w komentarzu GROQ) psuje typegen.
- `e2e/utils.ts:352` i `e2e/cpo-purchase.spec.ts:83,94,97` szukają `getByRole('button', { name: 'Dodaj do koszyka' })` — Playwright dopasowuje podciąg, więc nowe przyciski na kafelkach („Powiązane produkty” na PDP) wywołają strict-mode violation. **Świadomie nie poprawiamy** (decyzja: bez zmian w e2e; e2e i tak jest dziś zablokowane) — zapisane jako znany dług.
- Konsumenci stylują `article a` w kafelku: `ProductsListing/styles.module.scss:97-106` (plus `max-height: 42rem` na `li`), `portableText/FeaturedProducts/styles.module.scss:12-19`, `blog/ArticleBody/styles.module.scss:120-128`.

## Decyzje (podjęte bez pytań — uzasadnienie)

| # | Obszar | Decyzja | Uzasadnienie |
|---|---|---|---|
| D1 | Etykieta | „Dodaj do koszyka” dla obu trybów, nie „Kup teraz” | Uzgodnione w rozmowie; „Kup teraz” sugeruje przejście do kasy, a produkt trafia do koszyka. Jednolita etykieta, bo obie ścieżki kończą się dodaniem. |
| D2 | Gdzie widoczny | Tam, gdzie dziś renderuje się „Dowiedz się więcej” (`showButton && hasLink`) i produkt ma `isSellableOnline === true` oraz `basePriceCents > 0`. Nowy prop `showCartButton` domyślnie `= showButton`. | Nie zmienia charakteru bloków, które świadomie ukrywają CTA (`ptCtaSection`, karuzela featured). |
| D3 | Kto decyduje o trybie | Serwer, z danych Supabase: `variants.length === 1 && variants[0].groups.length === 0` → `direct`, inaczej `configure`. Kafelek używa tylko `isSellableOnline` i ceny do widoczności. | Jedno źródło prawdy, odporne na nieaktualny cache listingu; etykieta i tak jest wspólna, więc kafelek nie potrzebuje `hasMultiplePrices`. |
| D4 | Ładowanie danych | Na kliknięcie: nowa akcja serwerowa `loadProductQuickAdd(slug)` = `fetchProductPricing` (cache) + nowe małe zapytanie Sanity `queryProductQuickAddBySlug` (tagi `product`, `product:<slug>`). Przycisk pokazuje spinner, popup otwiera się z gotowymi danymi. | Brak kosztu na listingach; te same tagi co PDP, więc publikacja produktu unieważnia; popup bez własnego stanu ładowania. |
| D5 | Ostateczna weryfikacja | Akcja zwraca `unavailable` gdy `getStandardProductBuyability` odmawia; koszyk i checkout i tak rewalidują świeżo. | Nieaktualny kafelek nie dorzuci niekupowalnego produktu; płatności chronione istniejącą rewalidacją. |
| D6 | Popup | Nowa cienka obudowa `ProductQuickAddModal` (nie flaga `mode` w modalu edycji), reużywa `CartLineConfigurator`, style `styles.module.scss` i czysty moduł `quick-add.ts`. Bez promptów discard/merge. | Flaga rozgałęziałaby niemal każdy blok modala edycji i jego 7 testów; prompty nie mają sensu przed dodaniem; `addLine` scala identyczne konfiguracje jak PDP. |
| D7 | Potwierdzenie | Tryb `direct`: istniejący `AddToCartConfirmationModal` (jak PDP). Tryb `configure`: stan „Dodano do koszyka” w tym samym popupie (bez drugiego okna). | Spójność z PDP; brak dwóch modali pod rząd (wymóg z rozmowy). |
| D8 | Struktura kafelka | Wzorzec stretched link: `<Link>` na nazwie w nagłówku z `::after { inset: 0 }`, ramka/tło/radius przeniesione na `article`, rząd akcji (`.actions`) z `z-index` nad overlayem. „Dowiedz się więcej” → prawdziwy link `Button href` z `tabIndex={-1}` i `aria-hidden`. Logo i pigułka w `.imgBox` z `pointer-events: none`. | Poprawny HTML, cały kafelek klikalny, nazwa linku = „{marka} {nazwa}”; w repo nie ma gotowego wzorca, więc wprowadzamy go tylko w ProductCard. |
| D9 | Dostępna nazwa przycisku | Widoczny tekst „Dodaj do koszyka” + `aria-label="Dodaj do koszyka: {marka} {nazwa}"`. | Odstępstwo od propozycji z rozmowy („Dodaj {marka} {nazwa} do koszyka”), bo WCAG 2.5.3 (Label in Name) wymaga, by nazwa zawierała widoczny tekst w tej samej kolejności. |
| D10 | Dostępność modali | Nowy hook `useDialogA11y` (fokus początkowy, trap Tab, powrót fokusu na przycisk, Esc, prawdziwa blokada scrolla). Użyty w `ProductQuickAddModal` i podłączony do `AddToCartConfirmationModal`. `aria-labelledby` z `useId()`. | Wymóg z rozmowy; oba okna są używane z kafelka. Back-port do modala edycji poza zakresem. |
| D11 | Hydratacja | Przycisk `disabled` do `isHydrated`; blokada podwójnego kliknięcia przez stan `pending`. | Dodanie przed hydratacją nadpisze reducer; podwójny klik scaliłby się w ilość 2. |
| D12 | Mobile | Popup jako pełnoekranowy panel z przyciskiem przyklejonym na dole (≤35.9375rem); przyciski na kafelku jeden pod drugim na pełną szerokość w układzie `vertical` i ≤35.9375rem. | Wymóg z rozmowy; breakpointy z `scss.mdc`. |
| D13 | Analityka | Reuse `trackAddToCart(line)` bez zmian. `item_list_name` poza zakresem. | Spójne zdarzenia z PDP; rozszerzenie listy to osobna decyzja analityczna. |
| D14 | Testy | **Bez nowych testów jednostkowych i e2e** (decyzja Oliwiera 16.10.2026). Automatycznie: `check-types`, `lint`, build produkcyjny. Istniejące testy dostosowane minimalnie tylko, jeśli zmiany je psują. Weryfikacja działania na końcu: przeglądarka na lokalnym buildzie produkcyjnym, CLI/curl, GROQ tylko do odczytu. | Wybór Oliwiera; e2e jest dziś zablokowane (patrz ryzyka), więc weryfikacja w przeglądarce i tak jest obowiązkowa. |
| D15 | Dane | Wspólna stała GROQ `productCardCommerceFields` (`basePriceCents, hasMultiplePrices, isSellableOnline`) wstawiona do 4 projekcji; recenzja zyskuje też `hasMultiplePrices` (naprawia brak „od”). | Jedno miejsce zmian; poprawka przy okazji, bez kosztu. |

## What We're NOT Doing

- Kafelek CPO (`CpoProductCard`) i `PublicationCard` — ta sama niepoprawna struktura, osobny etap.
- Unifikacja `PricingConfigurator` (PDP) i `CartLineConfigurator` (koszyk/popup).
- Back-port `useDialogA11y` i naprawy blokady scrolla do `CartLineConfigurationModal` (edycja w koszyku).
- `item_list_name` / `select_item` w analityce; martwy `CategoryViewTracker`.
- Zmiana `basePriceCents` na najtańszy wariant (dziś = pierwszy wariant; dotyczy np. NAS).
- Unieważnianie cache stron recenzji przy zmianie produktu (luka istnieje już dziś; patrz ryzyka).
- Wybór ilości w popupie (zawsze 1, jak na PDP).

## Implementation Approach

Od dołu do góry: najpierw dane i logika (czysty moduł + akcja serwerowa), potem przebudowa kafelka z działającym trybem `direct`, potem popup dla trybu `configure`, na końcu dokumentacja i pełna weryfikacja w przeglądarce (finalny review). Do czasu fazy 3 tryb `configure` na kafelku przenosi na PDP (`router.push(slug)`), więc po fazie 2 nic nie jest zepsute.

## Critical Implementation Details

- **Kolejność zdarzeń przy dodaniu:** `createQuickAddCartLine` → `addLine` → `trackAddToCart` → dopiero potem zmiana UI (okno/stan „Dodano”). Tak samo jak `PricingSection.tsx:154-180`.
- **Portal a link:** przycisk i oba modale renderowane jako rodzeństwo linku (w `.actions`), nigdy wewnątrz `<Link>`.
- **Stabilny callback:** `onSelectionChange` przekazywany do `CartLineConfigurator` musi być `useCallback` z pustymi zależnościami, inaczej pętla efektów.
- **Walidacja przed dodaniem:** `validateStandardConfigurationSelection` musi przejść; wymagana grupa bez wartości → komunikat błędu zamiast dodania.

---

## Phase 1: Dane i logika szybkiego dodawania

### Overview

Kafelki dostają `isSellableOnline`; powstaje czysty moduł decydujący o trybie i budujący pozycję koszyka oraz akcja serwerowa ładująca dane przy kliknięciu.

### Changes Required:

#### 1. Projekcje kafelków

**File**: `apps/web/src/global/sanity/query.ts`

**Design**: none — zapytania GROQ, bez UI.

**Intent**: Dodać `isSellableOnline` do wszystkich projekcji zasilających ProductCard i uzupełnić `hasMultiplePrices` w projekcji recenzji, przez jedną wspólną stałą.

**Contract**: Nowa stała `productCardCommerceFields` (nad `productFragment`, `:369`) zawierająca `basePriceCents, hasMultiplePrices, isSellableOnline`, interpolowana w `productFragment`, `productProjection`, `productsProjection` i inline `"product"` w `queryReviewBySlug` (zastępuje tam pojedyncze pola). Bez backticków w treści GROQ.

#### 2. Zapytanie dla szybkiego dodawania

**File**: `apps/web/src/global/sanity/query.ts`

**Design**: none — zapytanie GROQ.

**Intent**: Lekkie zapytanie zwracające tylko dane potrzebne do snapshotu pozycji koszyka i decyzji o kupowalności.

**Contract**: `queryProductQuickAddBySlug` (`defineQuery`, param `$slug` w formie `/produkty/<slug>/`, jak `queryProductBySlug`), zwraca `_id, name, isSellableOnline, isReturnable, isArchived, brand->{name, logo (imageFragment)}, previewImage (imageFragment)` — te same fragmenty co `queryProductBySlug` (`~:2400-2417`), żeby snapshot był identyczny z PDP. Następnie `bun run typegen`.

#### 3. Czysty moduł szybkiego dodawania

**File**: `apps/web/src/global/b2c/cart/quick-add.ts`

**Design**: none — logika domenowa.

**Intent**: Jedno miejsce, które z danych Sanity + Supabase wylicza: niedostępny / tryb `direct` / tryb `configure`, oraz buduje pozycję koszyka identyczną z PDP.

**Contract**:
- `resolveQuickAddMode(pricingData): 'direct' | 'configure'` — `direct` wtedy i tylko wtedy, gdy 1 wariant i 0 grup.
- `resolveQuickAdd({ productSlug, product, pricingData })` → `{ status: 'ready', mode, product: QuickAddProductSnapshot, pricingData } | { status: 'unavailable', reason: BuyabilityReason | 'not_found', message }`; buyability przez `getStandardProductBuyability`.
- `createQuickAddCartLine({ product, pricingData, selection? })` → `{ ok: true, line, configData } | { ok: false, reason: 'invalid_configuration' | 'variant_missing' }`; składa `createStandardConfigurationSelectionState` → `validateStandardConfigurationSelection` → `findStandardConfigurationVariant` → `buildStandardConfigurationData` → `createStandardCartLine` z `productKey = variant.price_key`, `unitPriceCents = configData.totalPrice`, snapshot `{id, name, brandName, kind: 'standard', brandLogo, image, basePrice, configurationOptions, totalPrice}` jak `PricingSection.tsx:130-171`.
- Polskie komunikaty dla `unavailable` (np. „Ten produkt nie jest obecnie dostępny w sprzedaży online.”).

#### 4. Akcja serwerowa

**File**: `apps/web/src/app/actions/product-quick-add.ts`

**Design**: none — akcja serwerowa.

**Intent**: Publiczny endpoint wołany z kafelka; ładuje dane równolegle z cache i zwraca wynik `resolveQuickAdd`.

**Contract**: `'use server'`; `loadProductQuickAdd(productSlug: string): Promise<QuickAddResolution | { status: 'error', message }>`. Normalizacja przez `extractCartProductSlug` / `buildCartProductRouteSlug(…, 'standard')`, walidacja sluga `^[a-z0-9-]+$` z limitem długości (akcje to publiczne endpointy). Równolegle `fetchProductPricing(slug)` i `sanityFetch({ query: queryProductQuickAddBySlug, tags: ['product', \`product:${slug}\`] })`. `try/catch` → `error`.

### Success Criteria:

#### Automated Verification:

- Typegen przechodzi i generuje typ `QueryProductQuickAddBySlugResult`: `bun run typegen`
- Typy: `bun run check-types`
- Lint: `bun run lint`

#### Manual Verification (wykonywana na końcu, w finalnym review):

- Read-only GROQ dla 7 produktów zwraca `isSellableOnline: true` w każdej z 4 projekcji.
- Akcja (wywołana przez kliknięcie na kafelku w przeglądarce) dla `playermini` daje tryb `direct`, dla `nas` `configure`, dla produktu niesprzedawanego przycisku nie ma.

---

## Phase 2: Przebudowa kafelka i dodawanie jednym kliknięciem

### Overview

Kafelek przechodzi na poprawną strukturę (stretched link), dostaje rząd akcji z przyciskiem koszyka; tryb `direct` działa w pełni, tryb `configure` tymczasowo przenosi na PDP.

### Changes Required:

#### 1. Struktura i style kafelka

**File**: `apps/web/src/components/ui/ProductCard/index.tsx`, `styles.module.scss`

**Design**: undrawn — wygląd przycisków wg istniejącego `Button` (primary/secondary) i obecnego kafelka; rozmieszczenie wg zgłoszenia klienta (koszyk nad „Dowiedz się więcej”).

**Intent**: Usunąć elementy interaktywne z linku, zachować klikalność całego kafelka, dodać rząd akcji.

**Contract**:
- `article.productCard` (`position: relative`) przejmuje ramkę, radius, tło, overflow i flex z `.link`.
- `<Link className={styles.link}>` obejmuje tylko „{marka} {nazwa}” w nagłówku; `.link::after { content: ''; position: absolute; inset: 0; z-index: 1 }`. Bez sluga: nagłówek bez linku, brak przycisków.
- `.actions` (`position: relative; z-index: 2`) w `.priceContainer`: `<ProductCardAddToCart>` (gdy D2 spełnione) nad `<Button href={slug} text="Dowiedz się więcej" variant={cart ? 'secondary' : 'primary'} tabIndex={-1} aria-hidden="true">`.
- Fokus i hover przeniesione: `.productCard:has(.link:focus-visible)` (ramka) zamiast `.link:focus-visible`; ścieżki hover bez segmentu `.link`. Logo i `.imgBox::before` z `pointer-events: none`.
- Selektory elementu `button` → klasy. Układ `vertical` i ≤35.9375rem: akcje w kolumnie, pełna szerokość. px → rem; `@keyframes` wyciągnięte na najwyższy poziom (`scss.mdc`).
- Lokalny `formatPrice` (`:45-54`) zastąpiony `formatPrice` z `@/src/global/utils`, jeśli format jest identyczny.
- Nowy prop `showCartButton?: boolean` (domyślnie `showButton`).

#### 2. Style konsumentów

**File**: `apps/web/src/components/products/ProductsListing/styles.module.scss`, `apps/web/src/components/portableText/FeaturedProducts/styles.module.scss`, `apps/web/src/components/blog/ArticleBody/styles.module.scss`

**Design**: none — dopasowanie istniejących reguł do nowej struktury.

**Intent**: Reguły `article a { width: 100% }` przestają trafiać w nowy link w nagłówku i link „Dowiedz się więcej”.

**Contract**: Zawęzić do nowej struktury (np. sam `article`) lub usunąć, jeśli ramka siedzi już na `article`; sprawdzić `max-height: 42rem` na `li` listingu z dwoma przyciskami (podnieść lub usunąć).

#### 3. Przycisk koszyka na kafelku

**File**: `apps/web/src/components/ui/ProductCard/ProductCardAddToCart.tsx`

**Design**: undrawn — `Button` `variant="primary"`, `iconUsed="addToCart"`, `isLoading`.

**Intent**: Wyspa kliencka: klik → akcja → dodanie (direct) albo przejście dalej (configure).

**Contract**: Props `{ slug, productName, brandName }`. `type="button"`, `aria-label="Dodaj do koszyka: {marka} {nazwa}"`, `disabled` gdy `!isHydrated || pending`, `isLoading` (daje `aria-busy`). Wynik akcji: `direct` → `createQuickAddCartLine` → `addLine` → `trackAddToCart` → `AddToCartConfirmationModal`; `configure` → w tej fazie `router.push(slug)`; `unavailable`/`error` → `toast.error(message)`. Wynik akcji zapamiętany w stanie komponentu (kolejny klik bez ponownego żądania).

### Success Criteria:

#### Automated Verification:

- Typy: `bun run check-types`
- Lint: `bun run lint`

#### Manual Verification (wykonywana na końcu, w finalnym review):

- `/marki/r-volution/` w przeglądarce: PlayerMini → „Dodaj do koszyka” dodaje produkt, badge w nagłówku rośnie, okno „Dodano do koszyka”; `/koszyk/` pokazuje pozycję bez ostrzeżeń.
- NAS na kafelku przenosi na PDP (zachowanie tymczasowe).
- Kafelki produktów niesprzedawanych: tylko „Dowiedz się więcej”, kafelek klikalny w każdym miejscu poza przyciskami.
- Klawiatura: Tab trafia na link w nazwie, przycisk koszyka, przycisk porównania; brak zbędnego tab-stopu na „Dowiedz się więcej”.
- Wszystkie miejsca z tabeli użyć (listing, kategoria, marka, recenzja, ptFeaturedProducts, karuzele, powiązane na PDP) bez rozjechanego układu na desktopie i 375 px.

---

## Phase 3: Popup konfiguratora i dostępność modali

### Overview

Tryb `configure` otwiera popup z konfiguratorem; po zatwierdzeniu pozycja trafia do koszyka, a popup pokazuje stan „Dodano”. Oba okna używane z kafelka dostają poprawną obsługę fokusu i scrolla.

### Changes Required:

#### 1. Hook dostępności dialogu

**File**: `apps/web/src/global/hooks/useDialogA11y.ts` (lokalizacja wg istniejących hooków)

**Design**: none — zachowanie.

**Intent**: Wspólna obsługa: fokus początkowy, trap Tab, Esc, powrót fokusu do elementu wywołującego, prawdziwa blokada scrolla.

**Contract**: `useDialogA11y({ isOpen, containerRef, initialFocusRef?, onEscape })`; ustawia `document.body.style.overflow = 'hidden'` i przywraca poprzednią wartość w cleanup; zwraca fokus do `document.activeElement` sprzed otwarcia.

#### 2. Popup szybkiego dodawania

**File**: `apps/web/src/components/b2c/CartLineConfigurationModal/ProductQuickAddModal.tsx`

**Design**: undrawn — wizualnie jak `CartLineConfigurationModal` (te same klasy z `styles.module.scss`); mobile ≤35.9375rem: pełnoekranowy panel, przyciski przyklejone na dole.

**Intent**: Konfiguracja nowej pozycji i dodanie jej do koszyka bez opuszczania listy.

**Contract**:
- Props `{ isOpen, product: QuickAddProductSnapshot, pricingData, onClose }`; portal do `document.body`; `role="dialog"`, `aria-modal`, `aria-labelledby` z `useId()`.
- Widok konfiguracji: tytuł „Wybierz konfigurację”, karta produktu (zdjęcie, marka, nazwa, cena łączna na żywo z `configData.totalPrice`), `<CartLineConfigurator pricingData initialSelection={null} onSelectionChange={stableCallback}>`, akcje „Anuluj” i „Dodaj do koszyka” (`iconUsed="addToCart"`, nieaktywny do pierwszego `onSelectionChange`).
- Zatwierdzenie: `createQuickAddCartLine(…, selection)` → `addLine` → `trackAddToCart` → widok „Dodano”; `ok: false` → komunikat w popupie.
- Widok „Dodano”: nagłówek `role="status"` „Dodano do koszyka”, podsumowanie konfiguracji, „Kontynuuj zakupy” (zamyka) i „Przejdź do koszyka” (`/koszyk/`); fokus na nagłówek.
- Esc i klik w tło zamykają (bez promptu, nic nie jest jeszcze zapisane).

#### 3. Podłączenie do kafelka i okna potwierdzenia

**File**: `apps/web/src/components/ui/ProductCard/ProductCardAddToCart.tsx`, `apps/web/src/components/ui/AddToCartConfirmationModal/index.tsx`

**Design**: none — podłączenie istniejących komponentów.

**Intent**: Zastąpić tymczasowe przejście na PDP popupem; naprawić fokus i blokadę scrolla w oknie potwierdzenia.

**Contract**: `configure` → `ProductQuickAddModal` z danymi z akcji (renderowany jako rodzeństwo przycisku w `.actions`). `AddToCartConfirmationModal` używa `useDialogA11y` (usuwa martwy kod `overflow` z `:43`); zachowuje istniejące props i zachowanie (w tym zamykanie przy bfcache na PDP).

### Success Criteria:

#### Automated Verification:

- Typy: `bun run check-types`
- Lint: `bun run lint`

#### Manual Verification (wykonywana na końcu, w finalnym review):

- NAS, Chassis DIY X700, M-100: popup, zmiana modelu zmienia cenę, „Dodaj do koszyka” → stan „Dodano”; w `/koszyk/` pozycja z wybranym modelem i poprawną ceną, bez ostrzeżeń rewalidacji.
- Ta sama konfiguracja dodana dwa razy → jedna pozycja z ilością 2 (jak na PDP).
- Klawiatura: fokus w popupie, Tab nie wychodzi poza popup, Esc zamyka, fokus wraca na przycisk kafelka; tło się nie przewija.
- 375 px: popup na pełnym ekranie, przyciski na dole widoczne bez przewijania.
- Klik w tło popupu nie przenosi na PDP.

---

## Phase 4: Dokumentacja i pełna weryfikacja

### Overview

Aktualizacja dokumentacji B2C i weryfikacja całości w przeglądarce na produkcyjnych danych (lokalny build produkcyjny).

### Changes Required:

#### 1. Dokumentacja B2C

**File**: `.ai/b2c/architecture/cart-and-checkout-model.md`, `.ai/b2c/business/product-buyability-rules.md`

**Design**: none — dokumentacja.

**Intent**: Zapisać, że kafelek jest nowym wejściem do koszyka.

**Contract**: W `cart-and-checkout-model.md` §1 (przepływ, `:27-35`) dopisać ścieżkę „kafelek → koszyk / popup konfiguratora → koszyk”; w §4 (`:86-107`) zaktualizować wzorzec potwierdzenia (minimalne okno, zgodnie z `phases/phase-05-buyable-pdp-and-cart.md:44-48`) i doprecyzować, że zakaz quick-add dotyczy sugestii w oknie potwierdzenia, nie kafelków. W `product-buyability-rules.md` „CTA Visibility Rules” (`:65-78`) dodać regułę dla kafelków (D2, D3).

#### 2. Aktualizacja CODEBASE_OVERVIEW

**File**: `CODEBASE_OVERVIEW.md`

**Design**: none — dokumentacja.

**Intent**: Opisać nową strukturę ProductCard i ścieżkę quick-add w sekcji o komponentach/B2C, jeśli taka istnieje.

**Contract**: Krótka notka z odnośnikami do `quick-add.ts`, `product-quick-add.ts`, `ProductQuickAddModal.tsx`.

### Success Criteria:

#### Automated Verification:

- Typy: `bun run check-types`
- Lint: `bun run lint`
- Build produkcyjny: `cd apps/web && bun run next build`

#### Manual Verification (finalny review, po wszystkich fazach):

Lokalny build produkcyjny (`next build` + `next start` przez skrypty aplikacji, w tle, port 3300), przeglądarka w osobnej karcie:

- Wszystkie 7 produktów: PlayerMini, PlayerOne 8K, PlayerPro 8K, PlayerPro 8K TV (od razu + okno „Dodano do koszyka”); NAS, Chassis DIY X700, M-100 (popup, zmiana wariantu zmienia cenę, stan „Dodano”).
- `/koszyk/`: wszystkie pozycje z kafelka przechodzą rewalidację bez ostrzeżeń; ta sama konfiguracja dodana dwa razy → ilość 2.
- Jeden pełny checkout z mock P24 dla produktu dodanego z kafelka.
- Klawiatura: Tab, Esc, trap fokusu w popupie, powrót fokusu na przycisk kafelka; tło się nie przewija; klik w tło popupu nie przenosi na PDP.
- 375 px: kafelki i popup.
- Wszystkie miejsca z kafelkiem: `/produkty/`, kategoria, `/marki/[slug]/`, recenzja, `ptFeaturedProducts`, karuzele, „Powiązane produkty” na PDP; produkty niesprzedawane bez przycisku, cały kafelek klikalny.
- Zdarzenia `add_to_cart` (GA4) i `AddToCart` (Meta) wysyłane tak samo jak z PDP (dataLayer / konsola).
- Brak błędów w konsoli przeglądarki na listingach i PDP.
- Read-only GROQ: `isSellableOnline` w 4 projekcjach dla 7 produktów.

---

## Testing Strategy

### Unit / e2e Tests:

- Brak nowych testów (decyzja Oliwiera 16.10.2026). Brak zmian w `apps/web/e2e/`.
- Istniejące testy, które przestaną się kompilować lub przechodzić przez zmiany (np. testy `ProductCard`, `AddToCartConfirmationModal`, `PricingSection`), dostosowujemy minimalnie — bez dopisywania nowych przypadków.
- Znany dług: selektory e2e `getByRole('button', { name: 'Dodaj do koszyka' })` (`e2e/utils.ts:352`, `e2e/cpo-purchase.spec.ts:83,94,97`) złapią przyciski na kafelkach „Powiązane produkty” po odblokowaniu środowiska e2e.

### Automated checks:

- `bun run typegen`, `bun run check-types`, `bun run lint`, `cd apps/web && bun run next build`.

### Manual Testing Steps:

1. `/marki/r-volution/` → PlayerMini „Dodaj do koszyka” → okno „Dodano” → „Przejdź do koszyka” → pozycja bez ostrzeżeń.
2. `/marki/r-volution/` → NAS „Dodaj do koszyka” → popup → zmiana modelu → cena się zmienia → dodanie → stan „Dodano” → koszyk zawiera wybrany model.
3. PDP produktu z „Powiązanymi produktami” (np. powiązanego z M-100) → przycisk na kafelku powiązanym działa, przycisk w hero działa niezależnie.
4. Kafelek produktu niesprzedawanego → brak przycisku koszyka, klik w dowolne miejsce przenosi na PDP.
5. Klawiatura i czytnik ekranu (VoiceOver): nazwa linku „{marka} {nazwa}”, nazwa przycisku „Dodaj do koszyka: {marka} {nazwa}”, fokus w popupie.
6. 375 px: układ kafelka i popupu.

## Performance Considerations

- Brak zmian w kosztach listingów: dochodzi jedno pole boolean w projekcjach, bez nowych zapytań przy renderze.
- Kliknięcie: jedna akcja serwerowa z dwoma odczytami z cache (`fetchProductPricing`, `sanityFetch` z tagami produktu) — typowo bez trafienia do Supabase/Sanity.

## Migration Notes

- Brak zmian schematu i danych. Wdrożenie przez zwykły deploy web; nowe pole w projekcjach pojawi się po odświeżeniu cache listingów (tag `products`) — do tego czasu przycisk się nie pokazuje (bezpieczny fallback).

## Open Risks & Assumptions

- **Skala:** dziś przycisk zobaczy 7 produktów; wartość rośnie dopiero, gdy Audiofast włączy sprzedaż online kolejnych.
- **E2E zablokowane:** host Supabase dla e2e zwraca NXDOMAIN, a `prestige` (używany we wszystkich specach) nie jest sprzedawany online w produkcyjnym Sanity — weryfikacja end-to-end opiera się na przeglądarce.
- **Cache stron recenzji:** zmiana `isSellableOnline` produktu nie unieważnia `review:<slug>` — kafelek na recenzji może chwilowo pokazywać/ukrywać przycisk nieaktualnie; serwer i tak blokuje dodanie niekupowalnego produktu.
- **Przebudowa kafelka dotyka 6 miejsc** — ryzyko regresji wizualnej; faza 2 wymaga przejścia po wszystkich.
- **`fetchProductPricing` cache’uje `null`** przy przejściowym błędzie Supabase — kafelek pokaże „niedostępny” do odświeżenia tagu (problem istniejący, dotyczy też PDP).
- **Dwa konfiguratory:** popup (konfigurator koszyka) może wizualnie różnić się od PDP (`PricingConfigurator`) — świadomie poza zakresem.

## Estimated Effort

Ok. 11–14 h (1,5–2 dni robocze), złożoność średnia: faza 1 ~2,5–3 h, faza 2 ~3–4 h, faza 3 ~4–5 h, faza 4 ~1,5–2 h.

## References

- Zgłoszenie klienta: mail „Ulepszenie wyszukiwania i ulepszenie sklepu”, 15.10.2026 (punkt 2 „Sklep”).
- Wzorzec dodania do koszyka: `apps/web/src/components/products/ProductHero/PricingSection.tsx:130-180`
- Konfigurator: `apps/web/src/components/b2c/CartLineConfigurationModal/CartLineConfigurator.tsx:27-34`
- Pozycja koszyka: `apps/web/src/global/b2c/cart/standard-cart-line.ts:13-25`
- Buyability: `apps/web/src/global/b2c/utils/buyability.ts:44-66`
- Ceny: `apps/web/src/global/supabase/queries.ts:36-128`, `apps/web/src/app/actions/cart-pricing.ts`
- Rewalidacja koszyka: `apps/web/src/global/b2c/cart/server/revalidation.ts`
- Design source: brak makiety w Figmie — UI wg istniejących komponentów (`Button`, `ProductCard`, `CartLineConfigurationModal`).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Dane i logika szybkiego dodawania

- [x] 1.1 Typegen przechodzi i generuje typ `QueryProductQuickAddBySlugResult`
- [x] 1.2 Typy
- [x] 1.3 Lint

### Phase 2: Przebudowa kafelka i dodawanie jednym kliknięciem

- [x] 2.1 Typy
- [x] 2.2 Lint

### Phase 3: Popup konfiguratora i dostępność modali

- [x] 3.1 Typy
- [x] 3.2 Lint

### Phase 4: Dokumentacja i pełna weryfikacja

- [x] 4.1 Typy
- [x] 4.2 Lint
- [x] 4.3 Build produkcyjny
- [x] 4.4 Weryfikacja w przeglądarce (finalny review)
