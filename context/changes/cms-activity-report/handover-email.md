# Handover email draft — Raport pracy CMS

> Draft only, not sent and not created in Gmail. Before sending: deploy the app, replace `{{DASHBOARD_URL}}` with the Dashboard link printed by `bun run deploy`, and check the report once as dev@kryptonum.eu.
>
> To: jarek@audiofast.pl
> CC: michal@kryptonum.eu
> Subject: Raport pracy CMS — gotowy do użycia

---

Dzień dobry, Panie Jarku,

raport pracy w CMS jest gotowy i działa na Pana koncie Sanity. Poniżej link i krótka instrukcja.

**Gdzie go znaleźć**

Raport pracy CMS:
{{DASHBOARD_URL}}

Aplikacja otwiera się w panelu Sanity, po zalogowaniu kontem jarek@audiofast.pl. Nie ma jej na liście aplikacji na stronie głównej organizacji, więc najwygodniej dodać link do zakładek.

**Kto ma dostęp**

Raport widzi Pan oraz nasze konto serwisowe dev@kryptonum.eu (do wsparcia i sprawdzania zgłoszeń). Pozostałe osoby z dostępem do Sanity, w tym redaktorzy, po wejściu w link zobaczą tylko komunikat „Brak dostępu do raportu”. Jeśli ktoś jeszcze ma go widzieć, proszę dać znać, dopiszemy go.

**Jak korzystać**

1. Wybiera Pan osobę i zakres dat (domyślnie ostatnie 30 dni).
2. Klika „Pobierz raport”. Przy długim zakresie pobieranie trwa kilkanaście, maksymalnie około 30 sekund. Na ekranie widać postęp.
3. U góry jest podsumowanie dzienne: pierwsza i ostatnia aktywność, liczba sesji, przybliżony czas aktywny, liczba dokumentów i publikacji.
4. Niżej jest lista zmian: data i godzina, dokument (link otwiera go w Studio), rodzaj akcji, zmienione pola i numer sesji.

**Jak czytać sesje i czas aktywny**

Sesja to ciąg zmian w CMS, w którym przerwa między kolejnymi zapisami nie przekracza 30 minut. Tę wartość można zmienić w polu „Przerwa między sesjami (min)”. Czas aktywny to suma długości sesji, liczona od pierwszego do ostatniego zapisu, z minimum 5 minut na sesję.

Ważne: to przybliżenie aktywności w CMS, a nie czasu pracy. Sanity zapisuje tylko zmiany. Czytanie treści, przygotowanie tekstu poza CMS czy research nie zostawiają śladu. Kilka szybkich zapisów tego samego dokumentu w ciągu 5 minut łączymy w jeden wiersz (kolumna „Zapisy” pokazuje, ile ich było).

**Eksport do Excela**

Przycisk „Eksportuj CSV” pobiera listę zmian do pliku, który otwiera się w Excelu dwuklikiem, z polskimi znakami. Jeśli chce Pan prowadzić zestawienie miesiąc po miesiącu, rekomendowałbym pobierać plik na początku każdego miesiąca za poprzedni.

**O czym warto pamiętać**

– Raport sięga maksymalnie 90 dni wstecz. Starszej historii nie gwarantujemy, dlatego eksport CSV raz w miesiącu to najbezpieczniejsza forma archiwum.
– Każda osoba powinna pracować na własnym koncie Sanity. Raport przypisuje zmiany do konta, które je zapisało, więc przy wspólnym koncie praca kilku osób zleje się w jedną.

W razie jakichkolwiek pytań jestem do dyspozycji. Można też pisać do Michała ✌️

Miłego dnia!
Oliwier
