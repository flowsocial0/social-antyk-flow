

## Plan: Wszystkie routy prowadzą do 404

Zmodyfikować `src/App.tsx` — zastąpić wszystkie `<Routes>` jednym catch-all routem renderującym `<NotFound />`. Ukryć też `BugReportButton` i `FeatureRequestButton`.

### Kroki:
1. W `App.tsx` zamienić całą sekcję `<Routes>...</Routes>` na:
   ```tsx
   <Routes>
     <Route path="*" element={<NotFound />} />
   </Routes>
   ```
2. Usunąć (zakomentować) `<BugReportButton />` i `<FeatureRequestButton />` żeby nic poza 404 nie było widoczne.

Wszystkie importy i reszta kodu pozostają nienaruszone — łatwy powrót do normalności przez odkomentowanie.

