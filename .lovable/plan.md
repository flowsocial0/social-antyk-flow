

# System zgłaszania błędów (Bug Reporter)

## Opis

System pozwalający użytkownikom zgłaszać błędy z dowolnego miejsca w aplikacji. Przycisk "Zgłoś błąd" w prawym dolnym rogu robi automatyczny zrzut ekranu, otwiera formularz zgłoszenia i zapisuje wszystko w bazie. Admini zarządzają zgłoszeniami w panelu administracyjnym z możliwością komentowania i zmiany statusu. Powiadomienia email przez Resend.

## Zakres funkcjonalności

1. **Przycisk globalny** - stały w prawym dolnym rogu na każdej stronie (tylko dla zalogowanych)
2. **Formularz zgłoszenia** - temat, opis, automatyczny screenshot, dodatkowe załączniki
3. **Automatyczne dane** - email użytkownika, URL strony, user agent, rozmiar ekranu, data/czas
4. **Panel admina** - lista zgłoszeń, statusy, komentarze z załącznikami
5. **Powiadomienia email** - przy tworzeniu, zmianie statusu, komentarzach

## Etapy implementacji

### Etap 1: Baza danych

Nowe tabele:

**`bug_reports`** - główna tabela zgłoszeń
- id, user_id, user_email, title, description, status (nowy/w_trakcie/potrzebne_informacje/rozwiazany/anulowane), page_url, user_agent, screen_size, screenshot_url, created_at, updated_at

**`bug_report_attachments`** - załączniki (screenshot + dodatkowe pliki)
- id, bug_report_id, file_url, file_name, file_type, created_at, uploaded_by

**`bug_report_comments`** - komentarze adminów
- id, bug_report_id, user_id, user_email, comment_text, created_at

Nowy bucket storage: **`bug-reports`** (publiczny, na screenshoty i załączniki)

RLS: użytkownicy widzą/tworzą swoje zgłoszenia; admini widzą wszystko i mogą komentować/zmieniać status.

### Etap 2: Komponent globalny - BugReportButton

- Stały przycisk w prawym dolnym rogu (fixed position)
- Po kliknięciu: zrzut ekranu strony za pomocą biblioteki `html2canvas`
- Otwarcie dialogu z formularzem:
  - Temat (wymagany)
  - Opis (wymagany)
  - Podgląd automatycznego screenshota
  - Upload dodatkowych załączników (drag & drop)
  - Automatycznie zebrane: email, URL, przeglądarka, rozdzielczość
- Wysłanie: zapis do bazy + upload plików do Storage + wywołanie edge function na email

### Etap 3: Panel admina - AdminBugReports

Nowa sekcja w panelu administracyjnym:
- Lista zgłoszeń z filtrami po statusie
- Widok szczegółowy zgłoszenia ze screenshotem, danymi technicznymi
- Zmiana statusu (dropdown)
- Sekcja komentarzy z możliwością dodawania załączników
- Licznik nowych zgłoszeń w nagłówku

### Etap 4: Edge function - send-bug-report-email

Funkcja wysyłająca emaile przez Resend:
- Nowe zgłoszenie -> email do wszystkich adminów
- Zmiana statusu -> email do autora zgłoszenia
- Nowy komentarz -> email do autora zgłoszenia

Wymaga dodania sekretu **RESEND_API_KEY**.

### Etap 5: Integracja

- Dodanie `<BugReportButton />` w App.tsx (globalnie)
- Dodanie `<AdminBugReports />` w Admin.tsx
- Nowa trasa nie jest potrzebna - wszystko w istniejącym panelu admina

## Nowa zależność

- `html2canvas` - do robienia zrzutów ekranu strony

## Szczegóły techniczne

### Nowe pliki:
- `src/components/bugs/BugReportButton.tsx` - globalny przycisk + dialog
- `src/components/bugs/BugReportForm.tsx` - formularz zgłoszenia
- `src/components/admin/AdminBugReports.tsx` - panel admina
- `src/components/admin/BugReportDetail.tsx` - widok szczegółowy zgłoszenia
- `supabase/functions/send-bug-report-email/index.ts` - edge function do emaili

### Modyfikowane pliki:
- `src/App.tsx` - dodanie BugReportButton
- `src/pages/Admin.tsx` - dodanie AdminBugReports
- `supabase/config.toml` - rejestracja nowej edge function

### Schema SQL (migracja):

```text
-- Enum statusów
-- Tabela bug_reports z kolumnami: id, user_id, user_email, title, description, 
--   status, page_url, user_agent, screen_size, screenshot_url, created/updated_at
-- Tabela bug_report_attachments z FK do bug_reports
-- Tabela bug_report_comments z FK do bug_reports  
-- Storage bucket "bug-reports" (public)
-- RLS: users INSERT+SELECT own, admins ALL
```

### Sekret do dodania:
- **RESEND_API_KEY** - klucz API z resend.com (darmowe konto = 100 emaili/dzień)

