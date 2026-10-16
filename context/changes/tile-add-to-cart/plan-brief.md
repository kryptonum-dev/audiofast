# Przycisk „Dodaj do koszyka” na kafelku — Plan Brief

> Full plan: `context/changes/tile-add-to-cart/plan.md`

## What & Why

Na kafelku produktu pojawia się przycisk „Dodaj do koszyka” nad „Dowiedz się więcej”. Produkty z jedną wersją trafiają do koszyka od razu, produkty z kilkoma wersjami lub opcjami otwierają popup z konfiguratorem. Prośba klienta Audiofast (Jarosław Orszański, 15.10.2026): dziś trzeba wejść na stronę produktu, żeby kupić, co jest mało intuicyjne.

## Starting Point

Cały kafelek to jeden link, a „Dowiedz się więcej” to atrapa przycisku w środku linku (niepoprawny HTML). Dodawanie do koszyka istnieje tylko na stronie produktu (`PricingSection`). W koszyku jest gotowy konfigurator (`CartLineConfigurator`), ale jego okno jest napisane pod edycję istniejącej pozycji. Kafelki nie wiedzą, czy produkt jest sprzedawany online.

## Desired End State

Na kafelkach 7 produktów sprzedawanych dziś online (i każdego kolejnego) widać „Dodaj do koszyka”. PlayerMini dodaje się jednym kliknięciem i pokazuje okno „Dodano do koszyka”. NAS otwiera popup z wyborem modelu i ceną na żywo, a po zatwierdzeniu popup pokazuje „Dodano”. Pozycje z kafelka są identyczne z tymi z PDP i przechodzą rewalidację koszyka. Kafelek jest poprawnym HTML i dalej klikalny w całości.

## Key Decisions Made

| Decyzja | Wybór | Dlaczego |
|---|---|---|
| Etykieta | „Dodaj do koszyka” dla obu trybów | „Kup teraz” sugeruje kasę; obie ścieżki kończą się dodaniem |
| Widoczność | Gdzie dziś jest „Dowiedz się więcej” + `isSellableOnline` + cena > 0 | Bloki, które świadomie ukrywają CTA, zostają bez zmian |
| Tryb (od razu / popup) | Decyduje serwer z danych Supabase (1 wariant i 0 grup → od razu) | Jedno źródło prawdy, odporne na nieaktualny cache listingu |
| Dane | Ładowane przy kliknięciu: nowa akcja `loadProductQuickAdd` (cache’owane ceny + małe zapytanie Sanity) | Zero kosztu na listingach |
| Popup | Nowa cienka obudowa `ProductQuickAddModal` z `CartLineConfigurator` | Flaga trybu rozgałęziłaby cały modal edycji i jego testy |
| Potwierdzenie | Od razu: istniejące okno z PDP; popup: stan „Dodano” w tym samym oknie | Spójność z PDP, bez dwóch okien pod rząd |
| Struktura kafelka | Stretched link (link na nazwie + `::after`), przyciski poza linkiem | Poprawny HTML, cały kafelek klikalny |
| Nazwa przycisku | `aria-label="Dodaj do koszyka: {marka} {nazwa}"` | WCAG 2.5.3 — nazwa musi zawierać widoczny tekst w tej kolejności |
| Dostępność | Hook `useDialogA11y` (fokus, trap, Esc, blokada scrolla) w popupie i oknie potwierdzenia | Dzisiejsze modale nie blokują scrolla i nie zarządzają fokusem |
| Testy | Bez nowych testów jednostkowych i e2e; `check-types`, `lint`, build + weryfikacja w przeglądarce na końcu | Decyzja Oliwiera (16.10); e2e jest dziś zablokowane |

## Scope

**In scope:** pole `isSellableOnline` w projekcjach kafelków; moduł `quick-add.ts`; akcja `product-quick-add.ts`; przebudowa `ProductCard` + style konsumentów; przycisk `ProductCardAddToCart`; `ProductQuickAddModal`; `useDialogA11y` w nowym popupie i `AddToCartConfirmationModal`; dokumentacja `.ai/b2c`.

**Out of scope:** nowe testy jednostkowe i e2e, zmiany w `e2e/`; kafelek CPO i `PublicationCard`; unifikacja konfiguratorów PDP/koszyka; poprawki modala edycji w koszyku; analityka list (`item_list_name`); cena „od” z najtańszego wariantu; cache stron recenzji; wybór ilości w popupie.

## Architecture / Approach

Kafelek (serwer lub klient) renderuje wyspę `'use client'` `ProductCardAddToCart` obok linku. Klik → akcja serwerowa `loadProductQuickAdd(slug)` → `fetchProductPricing` + `queryProductQuickAddBySlug` → `resolveQuickAdd` (buyability + tryb). Tryb `direct`: `createQuickAddCartLine` → `addLine` → `trackAddToCart` → okno potwierdzenia. Tryb `configure`: `ProductQuickAddModal` z `CartLineConfigurator` → `createQuickAddCartLine(selection)` → `addLine` → `trackAddToCart` → stan „Dodano”. Koszyk i checkout rewalidują jak dziś.

## Phases at a Glance

| Faza | Co daje | Główne ryzyko |
|---|---|---|
| 1. Dane i logika | `isSellableOnline` na kafelkach, moduł `quick-add.ts`, akcja serwerowa | Pułapki typegen (backticki, `Array<never>` w listingach) |
| 2. Kafelek + dodanie jednym kliknięciem | Poprawny HTML kafelka, działający tryb `direct`; `configure` tymczasowo → PDP | Regresja wizualna w 6 miejscach użycia kafelka |
| 3. Popup + dostępność | Popup konfiguratora, stan „Dodano”, fokus i blokada scrolla | Pętla efektów przy niestabilnym callbacku; zdarzenia przez portal |
| 4. Dokumentacja + weryfikacja | Zaktualizowane `.ai/b2c`, build, finalny review i przejście 7 produktów w przeglądarce | Weryfikacja działania dopiero na końcu, po wszystkich fazach |

**Prerequisites:** brak zmian w danych; lokalne env `apps/web/.env*.local` do builda i testów w przeglądarce.
**Estimated effort:** ok. 11–14 h (1,5–2 dni robocze), 4 fazy, złożoność średnia.

## Open Risks & Assumptions

- Dziś przycisk zobaczy tylko 7 produktów — wartość rośnie z każdym włączonym do sprzedaży online.
- Bez testów automatycznych działania — weryfikacja tylko w przeglądarce na końcu. E2E i tak zablokowane (host Supabase e2e NXDOMAIN; `prestige` niesprzedawany); selektory e2e złapią nowe przyciski po odblokowaniu (znany dług).
- Strony recenzji nie odświeżają się po zmianie produktu — przycisk może chwilowo być nieaktualny (serwer i tak blokuje złe dodanie).
- `fetchProductPricing` cache’uje `null` przy błędzie Supabase (problem istniejący).

## Success Criteria (Summary)

- Klient dodaje PlayerMini do koszyka z listy jednym kliknięciem, a NAS przez popup, nie opuszczając listy.
- Pozycje z kafelka przechodzą rewalidację koszyka i checkout bez ostrzeżeń.
- Kafelek jest dostępny z klawiatury i czytnika ekranu, bez regresji wizualnych na listingach, stronach marek, recenzjach i karuzelach.
