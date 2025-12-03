# Instrukcja: Synchronizacja cen z Excel do strony WWW

## Wymagania wstępne

- Microsoft 365 z dostępem do Excel Web (online)
- Arkusz Excel z danymi produktów

---

## Krok 1: Przygotowanie arkusza Excel

### Wymagane arkusze (zakładki):

| Nazwa arkusza | Opis                                  |
| ------------- | ------------------------------------- |
| `Produkty`    | Główne dane produktów z cenami        |
| `Opcje`       | Konfiguracje opcji produktów          |
| `Wartości`    | Reguły numeryczne (np. długość kabla) |
| `Listy`       | Zagnieżdżone listy wyboru             |
| `Ustawienia`  | **NOWY** - hasło dostępu              |

### Arkusz "Ustawienia":

1. Utwórz nowy arkusz o nazwie **Ustawienia**
2. W komórce **B1** wpisz hasło: `[hasło otrzymane od administratora]`

> ⚠️ **Ważne:** Hasło musi mieć minimum 8 znaków. Nie udostępniaj go osobom nieupoważnionym.

---

## Krok 2: Dodanie skryptu do Excel

1. Otwórz arkusz Excel w przeglądarce (Excel Online)
2. Kliknij zakładkę **Automate** (lub **Automatyzacja**)
3. Kliknij **New Script** (lub **Nowy skrypt**)
4. Usuń całą zawartość domyślnego skryptu
5. Wklej kod ze załączonego pliku `SyncPricingToSupabase.txt`
6. Kliknij **Save** (lub **Zapisz**)
7. Nadaj nazwę: `Synchronizacja cen`

---

## Krok 3: Uruchomienie synchronizacji

### Sposób 1: Z edytora skryptów

1. Otwórz zakładkę **Automate**
2. Znajdź skrypt `Synchronizacja cen`
3. Kliknij **Run** (lub **Uruchom**)

### Sposób 2: Przycisk w arkuszu (zalecane)

1. W edytorze skryptu kliknij **⋮** (trzy kropki)
2. Wybierz **Add button** (lub **Dodaj przycisk**)
3. Przycisk pojawi się w arkuszu - kliknij go aby zsynchronizować

---

## Krok 4: Sprawdzenie wyniku

Po uruchomieniu skryptu w panelu **Output** zobaczysz:

```
Rozpoczynam synchronizację...
Produkty: 469
Wysyłam 469 produktów...
=== SYNCHRONIZACJA ZAKOŃCZONA ===
Status: SUKCES ✓
Zaktualizowano: 469 produktów
Ceny w Sanity zostaną zaktualizowane w tle.
```

---

## Rozwiązywanie problemów

### ❌ "BŁĄD: Brak arkusza Ustawienia"

→ Utwórz arkusz o nazwie dokładnie `Ustawienia` (z polskimi znakami)

### ❌ "BŁĄD: Hasło musi mieć min. 8 znaków"

→ Sprawdź czy hasło w komórce B1 jest poprawne

### ❌ "BŁĄD HTTP 401"

→ Nieprawidłowe hasło - skontaktuj się z administratorem

### ❌ "Nie znaleziono produktów"

→ Sprawdź czy arkusz `Produkty` zawiera dane od wiersza 7

---

## Jak działa synchronizacja?

1. **Produkty z URL** → Ceny są aktualizowane w bazie danych i na stronie
2. **Produkty BEZ URL** → Są usuwane z bazy (cena znika ze strony)
3. **Powiązane produkty (P1-P10)** → Wyświetlane w sekcji "Powiązane produkty" (max 10 produktów)

### Kolumny powiązanych produktów w arkuszu "Produkty":

| Kolumna | Nazwa | Opis                 |
| ------- | ----- | -------------------- |
| AA      | P1    | Powiązany produkt 1  |
| AB      | P2    | Powiązany produkt 2  |
| AC      | P3    | Powiązany produkt 3  |
| AD      | P4    | Powiązany produkt 4  |
| AE      | P5    | Powiązany produkt 5  |
| AF      | P6    | Powiązany produkt 6  |
| AG      | P7    | Powiązany produkt 7  |
| AH      | P8    | Powiązany produkt 8  |
| AI      | P9    | Powiązany produkt 9  |
| AJ      | P10   | Powiązany produkt 10 |

> 💡 Puste kolumny są pomijane - możesz używać tylko tyle ile potrzebujesz.

---

## Kontakt w razie problemów

W przypadku problemów technicznych skontaktuj się z:

- [Twój email/telefon]

---

_Ostatnia aktualizacja: Grudzień 2025_
