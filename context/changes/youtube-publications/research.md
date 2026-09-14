---
date: 2026-09-14T10:15:17+02:00
researcher: Codex
git_commit: b81add7aa39a115a96d0fafac17d7e916a07e1de
branch: main
repository: audiofast
topic: 'Filmy YouTube jako czwarty typ nowości na stronie głównej i w newsletterze'
tags: [research, codebase, sanity, publications, youtube, newsletter]
status: complete
last_updated: 2026-09-14
last_updated_by: Codex
---

# Research: publikacje YouTube

## Pytanie i źródła

Na podstawie przekazanego wątku mailowego: Pan Jarek chce promować filmy z własnego i innych kanałów, wpisując link YouTube oraz opcjonalny opis. Mają pojawiać się na stronie głównej i jako czwarta kategoria newslettera, z miniaturą. Odpowiedź Oliwiera zapowiada powrót z propozycją od 14.09.

Przeprowadzono przekrojowe rozpoznanie monorepo oraz trzy równoległe badania: CMS i klasyfikacja, frontend i cache, newsletter od wyboru treści do HTML/Mailchimp. Główny agent zweryfikował wspólne projekcje, komponenty publikacji i obecny mechanizm miniaturek. Analiza dotyczy lokalnego kodu; nie potwierdza konfiguracji produkcyjnego CMS, aktualnej kompozycji homepage ani stanu kampanii Mailchimp. Nie wykonywano zapisu do usług, wysyłki, testów runtime ani wdrożenia.

Stan wejściowy zawierał cudze/lokalne zmiany w `apps/web/next-env.d.ts`, `apps/web/src/generated/redirects.ts` oraz nieśledzone `.playwright-mcp/`; nie były zmieniane. Poniższe odnośniki wskazują commit bazowy main. Brak `context/foundation/lessons.md`.

## Podsumowanie i rekomendacja

Rekomendowany wariant: osobny dokument Sanity `youtubeVideo`, nazwany dla redaktora „Film YouTube”, włączony jako czwarty typ do istniejącego systemu publikacji. Homepage pokazuje etykietę „YouTube”, miniaturę, tytuł, datę i przycisk „Obejrzyj na YouTube”. Generator mailingu otrzymuje czwartą grupę „Filmy YouTube”. Oba miejsca korzystają z tego samego dokumentu i prowadzą bezpośrednio do filmu.

To rozszerzenie istniejącej funkcji publikacji o umiarkowanym, przekrojowym zakresie: CMS, wspólne dane/karty, newsletter, cache. Sama zmiana nazwy kategorii nie wystarczy. Nie ma potrzeby ingerowania w bazę cen, B2C, płatności, porównywarkę czy strukturę kategorii produktów.

## Jak działają obecne kategorie

| Pojęcie                       | Stan obecny                                                    | Konsekwencja dla YouTube                       |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| Nowości / publikacje homepage | Wspólny strumień `product`, `review`, `blog-article`           | Potrzebny czwarty typ dokumentu i projekcji    |
| Etykieta publikacji           | „Produkt”, „Recenzja”, a dla artykułu nazwa kategorii blogowej | Dla filmu jawna etykieta „YouTube”             |
| Kategorie blogowe             | Osobne dokumenty `blog-category`, przypisywane artykułom       | Dodanie kategorii „YouTube” nadal daje artykuł |
| Sekcje newslettera            | Grupy wyznaczane przez typ dokumentu                           | Nowa kategoria bloga nie tworzy czwartej grupy |
| Kategorie produktów           | Oddzielna taksonomia katalogu i filtrów                        | Poza zakresem zmiany                           |

Wspólna projekcja publikacji znajduje się w [query.ts:273](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/global/sanity/query.ts#L273). Obsługuje tytuł, obraz, opis, datę, etykietę i miejsce docelowe. Recenzje mają już tryby strona/PDF/link zewnętrzny, więc zewnętrzny cel jest zgodny z istniejącą architekturą.

Kategorie bloga i listing liczą/pobierają wyłącznie artykuły: [query.ts:1507](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/global/sanity/query.ts#L1507), [query.ts:1592](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/global/sanity/query.ts#L1592). Etykieta „Wszystkie publikacje” w panelu bloga nie oznacza uniwersalnego archiwum produktów, recenzji i filmów.

## CMS i praca redaktora

Obecny [ptYoutubeVideo](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/studio/schemaTypes/portableText/youtube-video.ts#L4) jest obiektem wewnątrz treści, nie samodzielną publikacją. Przyjmuje ID filmu, opcjonalny tytuł i miniaturę. Nie trafia sam do feedu lub generatora newslettera.

Proponowany formularz:

1. Link do pojedynczego filmu; normalizacja do ID i kanonicznego URL, obsługa `watch`, `youtu.be`, `shorts` i `live`, walidacja hosta i identyfikatora.
2. Tytuł uzupełniany z metadanych, z możliwością ręcznej korekty; wymagany przed publikacją.
3. Opcjonalny krótki opis; dla spójności można wykorzystać ograniczony Portable Text i istniejącą konwersję do maila.
4. Automatyczna miniatura z możliwością ręcznego zastąpienia.
5. Data promowania na Audiofast; jej wartość domyślna powinna być ustalana jawnie. Obecny wzorzec to `coalesce(publishedDate, _createdAt)`, czyli niekoniecznie rzeczywisty moment pierwszego opublikowania dokumentu.

Własne i obce kanały mogą używać tego samego modelu. Przy błędzie pobrania metadanych redaktor dostaje możliwość ręcznego wpisania tytułu i dodania obrazu. Zmiana URL musi odświeżać dane właściwego filmu, bez przypadkowego nadpisywania świadomych korekt redaktora.

Integracja obejmuje rejestrację w `apps/studio/schemaTypes/documents/index.ts`, pozycję w `apps/studio/structure.ts` i rozszerzenie referencji w [latest-publication.ts:46](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/studio/schemaTypes/blocks/latest-publication.ts#L46) oraz [featured-publications.ts:60](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/studio/schemaTypes/blocks/featured-publications.ts#L60). Trzeba też uzupełnić opisy i podglądy typu publikacji.

## Homepage i wspólne komponenty

- [Najnowsza publikacja, query.ts:495](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/global/sanity/query.ts#L495): wybór ręczny albo najnowszy dokument według daty; lista typów na linii 509.
- [Wyróżnione publikacje, query.ts:590](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/global/sanity/query.ts#L590): wybór ręczny, 20 najnowszych albo pominięcie pierwszej i pokazanie kolejnych 20. Listy typów na liniach 602 i 622.
- Produkty kwalifikują się do automatycznych sekcji po uzupełnieniu obrazu publikacji i krótkiego opisu, jeśli nie są archiwalne. Nie przenosić wymogu opisu na filmy.
- [PublicationCard:46](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/components/ui/PublicationCard/index.tsx#L46) rozróżnia obecnie tytuł produktu od Portable Text pozostałych dokumentów, a CTA odróżnia tylko produkt od artykułu. Wymaga jawnej obsługi filmu.
- [LatestPublication:36](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/components/pageBuilder/LatestPublication/index.tsx#L36) dla nieznanego typu użyłby CTA recenzji. Opis jest już warunkowy.
- Karuzela odrzuca elementy bez `_id` lub `slug`. Pole `slug` już przechowuje też URL zewnętrznych recenzji; dla filmu należy wypełnić je URL-em w projekcji albo świadomie zmienić wspólny kontrakt na `href`.
- `PublicationType` w `apps/web/src/global/types.ts:16` wynika z wygenerowanych typów zapytania homepage: regeneracja schematu i typów jest częścią wdrożenia.

Karty są współdzielone z recenzjami produktów i marek, więc zmiany muszą zachować zachowanie dotychczasowych publikacji. Nowy film uczestniczyłby w obecnym sortowaniu i mógłby zająć główne wyróżnienie w trybie automatycznym. Osobny blok „YouTube” na homepage jest wariantem dodatkowym, nie wynika bezpośrednio z prośby.

## Miniatura i metadane

Repo już zawiera [pobieranie tytułu przez oEmbed i wybór miniatury](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/components/portableText/YouTubeVideo/index.tsx#L18). Sprawdzanych jest pięć rozdzielczości, a redaktor może wskazać własny obraz. To istniejąca logika do wydzielenia, nie gotowa integracja generatora mailingu.

Rekomendacja: pobierać metadane podczas przygotowania wpisu, a miniaturę zapisywać jako asset Sanity. Pasuje to do [wspólnego Image.tsx:95](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/components/shared/Image.tsx#L95), który wymaga ID assetu i dla samego zewnętrznego URL nic nie renderuje. Unika też dodatkowych zapytań do YouTube podczas wyświetlania homepage. Alternatywa to zapis zewnętrznego URL i rozszerzenie renderowania obrazów; pozostawia zależność obrazu w mailu od zewnętrznego hosta.

Nie zakładać dostępności największej miniatury: [dokumentacja YouTube](https://developers.google.com/youtube/v3/docs/thumbnails) potwierdza, że rozmiary zależą od filmu, a `standard`/`maxres` występują tylko dla części materiałów. Pobieranie powinno mieć limit czasu i fallback; przypadki prywatnego/usuniętego filmu oraz niedostępnych metadanych wymagają czytelnej obsługi. Po imporcie miniatura jest kopią — ewentualne odświeżenie po zmianie na YouTube powinno być osobną akcją redaktora.

## Newsletter od CMS do Mailchimp

[Narzędzie Studio](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/studio/tools/newsletter/index.tsx#L624) pobiera opublikowane dokumenty w zakresie dat, grupuje je według typu (linia 678), umożliwia zaznaczanie pozycji, wyłączanie grup oraz zmianę kolejności sekcji. Miniatury pobiera z Sanity (linia 633).

Do rozszerzenia o `videos`: typy i etykiety (linie 54–84), stany grup i wyboru (576–606), zapytanie (624), projekcja danych (633–658), grupowanie (678), payload i walidacja wyboru (850–899) oraz kontrolki sekcji. Użytkownik zachowuje obecny sposób budowania kampanii.

[API generatora](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/app/api/newsletter/generate/route.ts#L60) otrzymuje dane ze Studio, konwertuje opisy Portable Text i renderuje React Email. Nowa grupa musi wejść do wejściowego modelu, przetwarzania opisów (414), rozwiązywania linków (651) i przekazania do renderera (676).

[Szablon maila](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/emails/newsletter-template.tsx#L58) ma trzy stałe sekcje. Potrzebuje czwartej w typach, kolejności domyślnej, preheaderze i rendererach. Film: klikalna miniatura, tytuł, opcjonalny opis i przycisk „Obejrzyj na YouTube”. URL absolutny; nie doklejać domeny Audiofast jak przy artykułach i produktach. Przykład zewnętrznego celu istnieje przy recenzjach (179).

Mailchimp otrzymuje gotowy HTML, więc nie uruchomi sam funkcji pobierania miniatury z linku. Obraz trzeba już umieścić w generowanym HTML. Miniatura z odnośnikiem jest zgodna z [wzorcem zalecanym przez Mailchimp](https://mailchimp.com/help/use-video-content-blocks/); większość klientów poczty nie obsługuje osadzonego odtwarzacza.

Obecne akcje to pobranie HTML lub utworzenie draftu kampanii: [route.ts:688](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/app/api/newsletter/generate/route.ts#L688). `campaigns.create` i `setContent` przygotowują kampanię; generator jej nie wysyła.

## Cache i kolejność wdrożenia

Nowy typ musi odświeżać `homePage` w [TYPE_DEPENDENCY_MAP:366](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/app/api/revalidate/route.ts#L366) i wejść do [REVERSE_LOOKUP_TYPES:81](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/web/src/app/api/revalidate/route.ts#L81) dla ręcznych referencji. Przed wdrożeniem sprawdzić, czy rzeczywisty webhook Sanity obejmuje nowy typ. Nie da się tego potwierdzić z obecnych plików.

Studio wskazuje produkcyjne API generatora ([index.tsx:108](https://github.com/kryptonum-dev/audiofast/blob/b81add7aa39a115a96d0fafac17d7e916a07e1de/apps/studio/tools/newsletter/index.tsx#L108)). Stary szablon wywołuje renderer bez sprawdzenia klucza sekcji (linia 259). Wdrażać najpierw web/API zgodne ze starym payloadem, z `videos` domyślnie pustym, następnie Studio. Nowy Studio wysyłający `videos` do starego API może zepsuć generowanie maila.

## Warianty i zakres

| Wariant                         | Efekt                                                | Ocena                                                 |
| ------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Osobny film, klik do YouTube    | Prosty formularz, homepage, czwarta grupa mailingu   | Rekomendowany, najbliższy mailowi klienta             |
| Osobny film ze stroną Audiofast | Odtwarzacz, lokalny URL i ewentualne archiwum filmów | Rozszerzony zakres przy potrzebie biblioteki wideo    |
| Artykuł z kategorią YouTube     | Pełna strona blogowa z osadzonym filmem              | Wymaga pól artykułu i nadal trafia do grupy artykułów |

Bezpośredni link nie wymaga lokalnej podstrony, sluga dokumentu ani wpisu filmu w sitemapie Audiofast. Własna podstrona oznacza dodatkowo routing, SEO, podgląd, odtwarzacz i ewentualny listing. Włączanie filmów do archiwum bloga rozszerza zakres o liczniki, filtry, wyszukiwanie i kategorie. Automatyczne śledzenie/import kanałów nie wynika z maila i nie jest potrzebne w pierwszym wariancie.

## Potencjalna kolejność prac

1. Ustalić docelowe zachowanie kliknięcia i formularz, w tym datę promowania oraz pobieranie metadanych.
2. Dodać model filmu i pobieranie tytułu/miniatury z ręcznym zastąpieniem oraz walidacją URL.
3. Rozszerzyć publikacje homepage: projekcje, wybór ręczny/automatyczny, karty, typy, cache.
4. Rozszerzyć cały przepływ newslettera o czwartą grupę i kompatybilny payload.
5. Sprawdzić scenariusze poniżej i wdrożyć web/API przed Studio.

## Weryfikacja do planu implementacji

- Link zwykły, skrócony, Shorts/live, obcy kanał; błędny host, URL kanału/playlisty; zmiana filmu po pobraniu metadanych.
- Brak opisu; własny tytuł/obraz; brak `maxres`; błąd metadanych i niedostępny film.
- Film najnowszy w hero/karuzeli, wybór ręczny, brak draftów, właściwa data; sprawdzenie reguły pomijania pierwszej publikacji.
- Newsletter z samymi filmami, mieszany, pusta/wyłączona grupa, zmiana kolejności; linki i miniatura w prawdziwym HTML.
- Dotychczasowy payload oraz produkty/recenzje/artykuły nadal działają.
- Publikacja/edycja/usunięcie odświeża odpowiednie strony przez webhook.
- Istniejące testy `apps/web/src/app/api/newsletter/generate/route.test.ts:16` mockują renderer i szablon, więc nie dowodzą poprawnego HTML. Potrzebny test rzeczywistego renderowania nowej sekcji oraz podgląd maila. Badanie nie uruchamiało testów, bo nie zmieniało kodu.

## Kontekst historyczny i kwestie otwarte

W śledzonym `context/` znaleziono jedynie badanie porównywarki, niezwiązane z tą zmianą. Wcześniejsza część maila dotyczy napraw linków, cen, archiwalnych produktów i wydajności marek; nie jest wymaganiem rozszerzenia YouTube. Aktualny kod ma już Next 16.3.2 i Cache Components, dlatego plan cache należy oprzeć na obecnym repo, nie na sierpniowym opisie planowanego upgrade'u.

Do ustalenia przed implementacją: bezpośredni klik do YouTube czy lokalny odtwarzacz/strona; zatwierdzenie prostego formularza z automatycznym tytułem i obrazem; czy film może zajmować główne automatyczne wyróżnienie. Rekomendacje w tym dokumencie zakładają bezpośredni link i udział w istniejącym wspólnym strumieniu. Osobne archiwum, kategorie filmów i automatyczny import pozostają opcjami późniejszymi.
