

## Naprawa publikacji Pinterest - auto-tworzenie boarda + poprawka tokena

### Diagnoza (z logow)

1. Token w bazie ma `is_sandbox = false` i inny prefix niz token sandbox ktory podales. Twoj UPDATE SQL prawdopodobnie nie zadzialal lub OAuth nadpisal token.
2. Wczesniejsze proby z sandbox=true (account `a14998bc`) tez koncza sie bledem "No Pinterest boards found" - sandbox to oddzielne srodowisko BEZ boardow z produkcji.

### Rozwiazanie

#### Krok 1: Naprawic token w bazie
Najpierw usunac stary token i wstawic nowy z poprawnym sandbox tokenem i `is_sandbox = true`.

#### Krok 2: Auto-tworzenie boarda w Edge Function
Zmienic `publish-to-pinterest` zeby gdy nie znajdzie zadnego boarda, automatycznie utworzyl nowy board o nazwie "FlowSocial Books" przez `POST /v5/boards`, a nastepnie uzywal go do publikacji pina.

### Szczegoly techniczne

**Plik: `supabase/functions/publish-to-pinterest/index.ts`**

Po linii 157 (po sprawdzeniu ze nie ma boardow), zamiast zwracac blad, dodac:

```text
// If no boards found, create one automatically
if (!boardId) {
  console.log('No boards found, creating default board...');
  const createBoardResponse = await fetch(`${apiBase}/v5/boards`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'FlowSocial Books',
      description: 'Automatycznie utworzony board do publikacji ksiazek',
      privacy: 'PUBLIC',
    }),
  });

  if (createBoardResponse.ok) {
    const newBoard = await createBoardResponse.json();
    boardId = newBoard.id;
    console.log(`Created new board: ${newBoard.name} (${boardId})`);
  } else {
    const errorText = await createBoardResponse.text();
    console.error('Failed to create board:', errorText);
    results.push({ accountId: token.id, success: false, error: `Cannot create board: ${errorText}` });
    continue;
  }
}
```

Dodatkowo dodac logowanie bledu gdy `boardsResponse` nie jest OK (linia 151):

```text
if (boardsResponse.ok) {
  // ... existing code
} else {
  const boardsError = await boardsResponse.text();
  console.error(`Failed to fetch boards: ${boardsResponse.status} - ${boardsError}`);
}
```

**Redeploy:** Edge Function `publish-to-pinterest`

**SQL do wykonania recznie (lub przez migration):**

```text
-- Usun stary token i wstaw poprawny sandbox
DELETE FROM pinterest_oauth_tokens WHERE user_id = '644dcc40-a8ec-4125-b340-0b3a6e068683';

INSERT INTO pinterest_oauth_tokens (user_id, access_token, is_sandbox, username, account_name)
VALUES (
  '644dcc40-a8ec-4125-b340-0b3a6e068683',
  'pina_AMATTFQXACFOUBIAGDAJMDZEJCWWNHABACGSPSDI3JWH7NNZGC3LS6BQWANFVK3VZ6T72UYZSCC2SFXUYJNND3LKHTYXR2QA',
  true,
  'flowsocial0',
  'flowsocial0'
);
```

### Podsumowanie zmian
1. Edge Function: auto-tworzenie boarda + lepsze logowanie bledow
2. Baza: poprawny sandbox token z `is_sandbox = true`
3. Redeploy `publish-to-pinterest`
