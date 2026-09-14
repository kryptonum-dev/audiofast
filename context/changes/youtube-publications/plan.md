# Plan: Filmy YouTube — lokalne Studio i Vercel Preview

## Overview

Realizacja zatwierdzonego wariantu z research.md. Użytkownik zatwierdził cały proces do działającego podglądu, na osobnym branchu, tym samym datasecie i bez logowania do Vercel Preview. Bez wdrażania Studio i bez merge do main.

## Decisions

- Branch `codex/youtube-publications`; pomijamy zastane zmiany next-env.d.ts, redirects.ts i .playwright-mcp.
- Dataset `production` projektu fsw3likv; tworzymy wyłącznie własny dokument youtubeVideo i jego miniaturę. Nie modyfikujemy homepage ani istniejących publikacji.
- Film kieruje bezpośrednio do YouTube. Formularz: URL, nazwa, opcjonalny opis, miniatura, data promowania. Metadane pobierane na żądanie, zapis obrazu przez uwierzytelniony klient Studio.
- Nowy typ we wspólnym feedzie i sekcji videos newslettera. Bez lokalnej podstrony filmu.
- Lokalny generator korzysta z localhost:3000. W localhost/preview blokujemy tworzenie kampanii; HTML działa z istniejącą autoryzacją operatora.
- Publiczny preview używa opublikowanych danych (nie ujawnia draftów innych treści).
- Przygotowujemy HTML do natychmiastowego obejrzenia oraz działające lokalne serwery. Preview odświeża nowości w krótkim czasie bez zmiany webhooków produkcji.

## Phase 1: Implementacja i gotowy podgląd

**Design**: none — istniejące karty i szablon newslettera, standardowe kontrolki Sanity.

### Changes Required

- Wspólny parser URL YouTube dla schema/API, z testami poprawnych i niepoprawnych hostów i formatów.
- Dokument youtubeVideo, rejestracja, nawigacja, referencje PageBuilder; pobieranie tytułu i miniatury z timeout/fallback, brak nadpisywania ręcznych zmian przy ponownym pobraniu, obsługa zmiany URL.
- Rozszerzenie GROQ, tytułów/CTA kart i głównego wyróżnienia oraz rewalidacji; regeneracja schematu i typów.
- Sekcja videos od zapytania Studio przez zaznaczanie/kolejność i payload do rzeczywistego HTML. Starszy payload pozostaje poprawny.
- Lokalny podgląd HTML z opcją pobrania; API Mailchimp zablokowane poza produkcyjnym deploymentem.
- Przykładowy film, lokalny Studio/web, commit i push brancha, deployment Vercel Preview oraz sprawdzenie dostępności bez logowania.

### Automated Verification

- Parser, metadane i prawdziwy renderer newslettera: przypadki poprawne, awarie, pusty opis, kolejność, kompatybilność; istniejące testy endpointu przechodzą.
- Typecheck web/Studio, lint zmienionych plików i build przechodzą.
- Lokalny Studio/web i Vercel Preview odpowiadają; film widoczny z poprawną miniaturą i URL, przykładowy HTML wygenerowany.

### Manual Verification

- Użytkownik ogląda film w lokalnym Studio i na preview oraz HTML newslettera.

## Testing Strategy

Celowane testy Vitest dla parsera, metadanych, komponentów publikacji i rzeczywistego renderowania HTML. Weryfikacja linków i braku iframe w mailu. Sprawdzenie istniejących testów auth generatora. Przegląd przeglądarkowy oraz HTTP deploymentu. Bez wywołania Mailchimp.

## Migration and release

Brak migracji istniejących treści. Testowy dokument zapisujemy pod jawnym ID wskazanym w handoff. Późniejsze usunięcie tylko tych testowych dokumentów po sprawdzeniu referencji; żadnego resetu datasetu. Produkcyjne wdrożenie poza obecnym zakresem. Vercel API/web przed ewentualnym przyszłym Studio.

## Progress

### Phase 1: Implementacja i gotowy podgląd

- [ ] 1.1 Parser, metadane i renderer newslettera zweryfikowane testami
- [ ] 1.2 Typecheck, lint i build przechodzą
- [ ] 1.3 Lokalne serwery, przykład HTML i publiczny Vercel Preview gotowe
