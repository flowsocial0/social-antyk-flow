import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <Helmet>
        <title>Polityka Prywatności - Social Auto Flow</title>
        <meta
          name="description"
          content="Polityka prywatności Social Auto Flow - dowiedz się jak chronimy Twoje dane osobowe"
        />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Polityka Prywatności</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
            </p>
          </CardHeader>

          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-foreground">1. Informacje ogólne</h2>
              <p className="text-muted-foreground">
                Niniejsza Polityka Prywatności określa zasady przetwarzania i ochrony danych osobowych przekazanych
                przez Użytkowników w związku z korzystaniem z usług serwisu Social Auto Flow, dostępnego pod adresem socialautoflow.pl.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">2. Administrator danych osobowych</h2>
              <p className="text-muted-foreground">
                Administratorem danych osobowych zbieranych za pośrednictwem serwisu Social Auto Flow jest Księgarnia Antyk.
              </p>
              <p className="text-muted-foreground">
                Kontakt z Administratorem możliwy jest poprzez adres e-mail: flowsocial0@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">3. Zakres zbieranych danych</h2>
              <p className="text-muted-foreground">Serwis Social Auto Flow zbiera następujące dane:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Dane autoryzacyjne (adres e-mail, hasło w formie zaszyfrowanej)</li>
                <li>Tokeny dostępu do połączonych platform społecznościowych (Facebook, X/Twitter, TikTok, Instagram, LinkedIn)</li>
                <li>Dane dotyczące publikowanych treści (teksty postów, obrazy, wideo)</li>
                <li>Dane techniczne (adresy IP, informacje o przeglądarce, logi systemowe)</li>
                <li>Dane księgarni (informacje o książkach, cenach, linkach do produktów)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">4. Cel i podstawa prawna przetwarzania danych</h2>
              <p className="text-muted-foreground">Dane osobowe są przetwarzane w celu:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Świadczenia usług</strong> - umożliwienie korzystania z funkcjonalności aplikacji (podstawa:
                  wykonanie umowy - art. 6 ust. 1 lit. b RODO)
                </li>
                <li>
                  <strong>Autoryzacji i autentykacji</strong> - zarządzanie kontami użytkowników (podstawa: wykonanie
                  umowy - art. 6 ust. 1 lit. b RODO)
                </li>
                <li>
                  <strong>Integracji z mediami społecznościowymi</strong> - publikacja treści na platformach
                  społecznościowych (podstawa: zgoda - art. 6 ust. 1 lit. a RODO)
                </li>
                <li>
                  <strong>Bezpieczeństwa systemu</strong> - ochrona przed nadużyciami i zapewnienie bezpieczeństwa
                  danych (podstawa: prawnie uzasadniony interes - art. 6 ust. 1 lit. f RODO)
                </li>
                <li>
                  <strong>Komunikacji z użytkownikami</strong> - odpowiedzi na zapytania i wsparcie techniczne
                  (podstawa: prawnie uzasadniony interes - art. 6 ust. 1 lit. f RODO)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">5. Udostępnianie danych</h2>
              <p className="text-muted-foreground">Dane osobowe mogą być udostępniane:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Platformom społecznościowym</strong> - Facebook, X/Twitter, TikTok, Instagram, LinkedIn - w zakresie niezbędnym
                  do publikacji treści
                </li>
                <li>
                  <strong>Dostawcom usług IT</strong> - Supabase (hosting bazy danych), dostawcom usług chmurowych
                </li>
                <li>
                  <strong>Podmiotom uprawnionym</strong> - na podstawie przepisów prawa (np. organom państwowym)
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Wszystkie podmioty trzecie przetwarzające dane działają na podstawie umów powierzenia przetwarzania
                danych i zapewniają odpowiedni poziom ochrony.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">6. Przekazywanie danych poza EOG</h2>
              <p className="text-muted-foreground">
                Niektóre dane mogą być przekazywane do państw spoza Europejskiego Obszaru Gospodarczego (np. w związku z
                usługami świadczonymi przez X/Twitter). W takich przypadkach stosujemy odpowiednie zabezpieczenia, takie
                jak standardowe klauzule umowne zatwierdzone przez Komisję Europejską.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">7. Okres przechowywania danych</h2>
              <p className="text-muted-foreground">Dane osobowe przechowujemy przez okres:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Trwania umowy o świadczenie usług</li>
                <li>Wymaganego przepisami prawa (np. przepisami podatkowymi)</li>
                <li>Do momentu wycofania zgody (w przypadku przetwarzania na podstawie zgody)</li>
                <li>
                  Do momentu zgłoszenia sprzeciwu (w przypadku przetwarzania na podstawie prawnie uzasadnionego
                  interesu)
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">8. Prawa użytkowników</h2>
              <p className="text-muted-foreground">Zgodnie z RODO, użytkownik ma prawo do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>
                  <strong>Dostępu do danych</strong> - uzyskania informacji o przetwarzanych danych
                </li>
                <li>
                  <strong>Sprostowania danych</strong> - poprawiania nieprawidłowych danych
                </li>
                <li>
                  <strong>Usunięcia danych</strong> - "prawa do bycia zapomnianym"
                </li>
                <li>
                  <strong>Ograniczenia przetwarzania</strong> - w określonych sytuacjach
                </li>
                <li>
                  <strong>Przenoszenia danych</strong> - otrzymania danych w formacie umożliwiającym ich przeniesienie
                </li>
                <li>
                  <strong>Sprzeciwu</strong> - wobec przetwarzania danych na podstawie prawnie uzasadnionego interesu
                </li>
                <li>
                  <strong>Wycofania zgody</strong> - w dowolnym momencie, bez wpływu na zgodność z prawem przetwarzania
                  dokonanego przed wycofaniem zgody
                </li>
                <li>
                  <strong>Wniesienia skargi</strong> - do organu nadzorczego (Prezes Urzędu Ochrony Danych Osobowych)
                </li>
              </ul>
              <p className="text-muted-foreground mt-4">
                W celu realizacji powyższych praw prosimy o kontakt na adres: flowsocial0@gmail.com
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">9. Bezpieczeństwo danych</h2>
              <p className="text-muted-foreground">
                Stosujemy odpowiednie środki techniczne i organizacyjne zapewniające bezpieczeństwo danych osobowych, w
                tym:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Szyfrowanie danych w transporcie (SSL/TLS)</li>
                <li>Szyfrowanie haseł (bcrypt)</li>
                <li>Regularne kopie zapasowe</li>
                <li>Kontrolę dostępu do systemów</li>
                <li>Monitoring bezpieczeństwa</li>
                <li>Regularne aktualizacje oprogramowania</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">10. Pliki cookies</h2>
              <p className="text-muted-foreground">Aplikacja wykorzystuje pliki cookies (ciasteczka) w celu:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Utrzymania sesji użytkownika</li>
                <li>Zapamiętywania preferencji</li>
                <li>Zapewnienia bezpieczeństwa</li>
                <li>Analizy sposobu korzystania z aplikacji</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Użytkownik może w każdej chwili zmienić ustawienia cookies w swojej przeglądarce.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">
                11. Automatyczne podejmowanie decyzji i profilowanie
              </h2>
              <p className="text-muted-foreground">
                Aplikacja nie wykorzystuje zautomatyzowanego podejmowania decyzji ani profilowania w rozumieniu art. 22
                RODO, które wywołują skutki prawne lub w podobny sposób istotnie wpływają na użytkownika.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">12. Zmiany w polityce prywatności</h2>
              <p className="text-muted-foreground">
                Administrator zastrzega sobie prawo do wprowadzania zmian w niniejszej Polityce Prywatności. O wszelkich
                zmianach użytkownicy zostaną poinformowani poprzez komunikat w aplikacji lub wiadomość e-mail. Zmiany
                wchodzą w życie w terminie wskazanym w powiadomieniu, nie wcześniej jednak niż po upływie 14 dni od jego
                opublikowania.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">13. Postanowienia końcowe</h2>
              <p className="text-muted-foreground">
                W sprawach nieuregulowanych niniejszą Polityką Prywatności mają zastosowanie przepisy Rozporządzenia
                Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w sprawie ochrony osób
                fizycznych w związku z przetwarzaniem danych osobowych i w sprawie swobodnego przepływu takich danych
                (RODO) oraz przepisy prawa polskiego.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">14. Kontakt</h2>
              <p className="text-muted-foreground">
                W przypadku pytań dotyczących ochrony danych osobowych lub chęci skorzystania z przysługujących praw,
                prosimy o kontakt:
              </p>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="text-foreground">
                  <strong>Księgarnia Antyk</strong>
                </p>
                <p className="text-muted-foreground">Email: flowsocial0@gmail.com</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
