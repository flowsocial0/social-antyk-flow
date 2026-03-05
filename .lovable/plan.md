
# Naprawa: Instagram publikuje 3 razy (race condition w auto-publish)

## Znaleziony problem

Cron job `auto-publish-books` uruchamia sie co minute. Kiedy publikacja na Instagram trwa dluzej (do 2 minut -- czekanie na przetworzenie obrazu/wideo przez serwery Instagrama), kolejne uruchomienia crona "widza" ten sam post ze statusem `scheduled` i publikuja go ponownie. Stad 3x publikacja (3 uruchomienia crona = 3 publikacje tego samego posta).

## Rozwiazanie

Natychmiast po pobraniu postow do publikacji, zaktualizowac ich status na `publishing` ZANIM rozpocznie sie faktyczna praca. Dzieki temu kolejne uruchomienia crona nie beda ich ponownie przetwarzac.

## Szczegoly techniczne

### Plik: `supabase/functions/auto-publish-books/index.ts`

**Zmiana 1**: Po pobraniu `campaignPostsToPublish` (okolo linii 177), natychmiast zaktualizowac status wszystkich pobranych postow na `publishing`:

```text
// Po: const { data: campaignPostsToPublish, ... }

// RACE CONDITION FIX: Natychmiast oznacz posty jako "publishing"
if (campaignPostsToPublish && campaignPostsToPublish.length > 0) {
  const postIds = campaignPostsToPublish.map(p => p.id);
  await supabase
    .from('campaign_posts')
    .update({ status: 'publishing' })
    .in('id', postIds);
}
```

**Zmiana 2**: To samo dla `contentToPublish` (book_platform_content) -- ustawic `published: true` natychmiast po pobraniu, zanim zaczniemy publikowac:

```text
if (contentToPublish && contentToPublish.length > 0) {
  const contentIds = contentToPublish.map(c => c.id);
  await supabase
    .from('book_platform_content')
    .update({ auto_publish_enabled: false })
    .in('id', contentIds);
}
```

**Zmiana 3**: Zaktualizowac zapytanie pobierajace campaign_posts (linia 176), aby wykluczac status `publishing`:

```text
.or(`status.eq.scheduled,and(status.eq.rate_limited,next_retry_at.lte.${now})`)
```
To juz jest poprawne -- `publishing` nie jest w warunku, wiec posty ze statusem `publishing` nie beda pobierane ponownie.

**Zmiana 4**: W przypadku bledu publikacji, przywrocic status z `publishing` na `failed` (to juz jest obslugiwane w istniejacym kodzie na liniach 649+, ale trzeba upewnic sie ze sciezka bledu tez dziala).

### Dodatkowe zabezpieczenie

Dodac `status != 'publishing'` jako dodatkowy warunek w zapytaniu, zeby miec pewnosc:

```text
.not('status', 'eq', 'publishing')
```

## Wplyw

- Zero zmian w UI
- Zero zmian w bazie danych (status `publishing` to po prostu nowa wartosc tekstowa w istniejacym polu)
- Naprawa dotyczy WSZYSTKICH platform, nie tylko Instagrama
- Posty kampanii nie beda juz publikowane wielokrotnie
