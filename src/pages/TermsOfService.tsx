import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <Helmet>
        <title>Regulamin - Social Auto Flow</title>
        <meta
          name="description"
          content="Regulamin korzystania z serwisu Social Auto Flow - automatyzacja publikacji w mediach społecznościowych"
        />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Regulamin Serwisu</CardTitle>
            <p className="text-center text-muted-foreground mt-2">
              Ostatnia aktualizacja: {new Date().toLocaleDateString("pl-PL")}
            </p>
          </CardHeader>

          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-2xl font-semibold text-foreground">1. Postanowienia ogólne</h2>
              <p className="text-muted-foreground">
                Niniejszy Regulamin określa zasady korzystania z serwisu Social Auto Flow (dalej: "Serwis"), 
                dostępnego pod adresem socialautoflow.pl, który umożliwia automatyzację publikacji treści 
                w mediach społecznościowych.
              </p>
              <p className="text-muted-foreground">
                Właścicielem i operatorem Serwisu jest Księgarnia Antyk (dalej: "Operator").
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">2. Definicje</h2>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Serwis</strong> - platforma Social Auto Flow dostępna pod adresem socialautoflow.pl</li>
                <li><strong>Użytkownik</strong> - osoba fizyczna, prawna lub jednostka organizacyjna korzystająca z Serwisu</li>
                <li><strong>Konto</strong> - indywidualne konto Użytkownika w Serwisie</li>
                <li><strong>Platforma społecznościowa</strong> - zewnętrzny serwis (Facebook, X/Twitter, TikTok, Instagram, LinkedIn itp.)</li>
                <li><strong>Treść</strong> - materiały tekstowe, graficzne lub multimedialne publikowane za pośrednictwem Serwisu</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">3. Warunki korzystania z Serwisu</h2>
              <p className="text-muted-foreground">
                Korzystanie z Serwisu wymaga:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Ukończenia 18 lat lub posiadania zgody opiekuna prawnego</li>
                <li>Założenia Konta w Serwisie</li>
                <li>Akceptacji niniejszego Regulaminu oraz Polityki Prywatności</li>
                <li>Posiadania aktywnego konta na co najmniej jednej platformie społecznościowej</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">4. Rejestracja i Konto</h2>
              <p className="text-muted-foreground">
                Użytkownik zobowiązuje się do:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Podania prawdziwych i aktualnych danych podczas rejestracji</li>
                <li>Zachowania poufności danych logowania do Konta</li>
                <li>Niezwłocznego powiadomienia Operatora o nieautoryzowanym dostępie do Konta</li>
                <li>Nieudostępniania Konta osobom trzecim</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">5. Funkcjonalności Serwisu</h2>
              <p className="text-muted-foreground">Serwis umożliwia:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Łączenie kont z platformami społecznościowymi (Facebook, X/Twitter, TikTok, Instagram, LinkedIn)</li>
                <li>Tworzenie i planowanie publikacji treści</li>
                <li>Automatyczną publikację postów według harmonogramu</li>
                <li>Zarządzanie kampaniami promocyjnymi</li>
                <li>Generowanie treści z wykorzystaniem sztucznej inteligencji</li>
                <li>Monitorowanie opublikowanych treści</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">6. Integracja z platformami społecznościowymi</h2>
              <p className="text-muted-foreground">
                Użytkownik korzystający z integracji z platformami społecznościowymi:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Upoważnia Serwis do publikowania treści w jego imieniu</li>
                <li>Akceptuje regulaminy i zasady tych platform</li>
                <li>Ponosi odpowiedzialność za zgodność publikowanych treści z regulaminami platform</li>
                <li>Może w każdej chwili odłączyć konto platformy społecznościowej od Serwisu</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                <strong>Ważne:</strong> Serwis korzysta z oficjalnych API platform społecznościowych. 
                Użytkownik akceptuje warunki korzystania z tych API, w szczególności:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li><strong>Facebook/Instagram:</strong> Meta Platform Terms</li>
                <li><strong>X/Twitter:</strong> Twitter Developer Agreement</li>
                <li><strong>TikTok:</strong> TikTok for Developers Terms of Service</li>
                <li><strong>LinkedIn:</strong> LinkedIn API Terms of Use</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">7. Obowiązki Użytkownika</h2>
              <p className="text-muted-foreground">Użytkownik zobowiązuje się do:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Korzystania z Serwisu zgodnie z prawem i niniejszym Regulaminem</li>
                <li>Niepublikowania treści naruszających prawa osób trzecich</li>
                <li>Niepublikowania treści niezgodnych z prawem, obraźliwych lub szkodliwych</li>
                <li>Nienaruszania zasad platform społecznościowych</li>
                <li>Niepodejmowania działań mogących zakłócić działanie Serwisu</li>
                <li>Nieużywania Serwisu do spamu lub nieuczciwych praktyk marketingowych</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">8. Treści publikowane przez Użytkownika</h2>
              <p className="text-muted-foreground">
                Użytkownik oświadcza, że:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Posiada prawa do wszystkich publikowanych treści</li>
                <li>Treści nie naruszają praw autorskich, znaków towarowych ani innych praw własności intelektualnej</li>
                <li>Treści nie zawierają informacji nieprawdziwych, wprowadzających w błąd lub szkodliwych</li>
                <li>Ponosi pełną odpowiedzialność za publikowane treści</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">9. Odpowiedzialność Operatora</h2>
              <p className="text-muted-foreground">
                Operator:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Dokłada starań, aby Serwis działał nieprzerwanie i prawidłowo</li>
                <li>Nie ponosi odpowiedzialności za treści publikowane przez Użytkowników</li>
                <li>Nie ponosi odpowiedzialności za działania platform społecznościowych</li>
                <li>Nie gwarantuje dostępności Serwisu 24/7</li>
                <li>Zastrzega prawo do czasowych przerw technicznych</li>
                <li>Nie ponosi odpowiedzialności za szkody wynikające z działań Użytkownika niezgodnych z Regulaminem</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">10. Ochrona danych osobowych</h2>
              <p className="text-muted-foreground">
                Zasady przetwarzania danych osobowych określa <a href="/privacy" className="text-primary hover:underline">Polityka Prywatności</a>.
              </p>
              <p className="text-muted-foreground">
                Użytkownik ma prawo do:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Dostępu do swoich danych</li>
                <li>Sprostowania danych</li>
                <li>Usunięcia danych</li>
                <li>Ograniczenia przetwarzania</li>
                <li>Przenoszenia danych</li>
                <li>Sprzeciwu wobec przetwarzania</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">11. Usunięcie konta</h2>
              <p className="text-muted-foreground">
                Użytkownik może w każdej chwili usunąć swoje Konto, kontaktując się z Operatorem.
                Po usunięciu Konta:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2">
                <li>Wszystkie dane Użytkownika zostaną trwale usunięte</li>
                <li>Tokeny dostępu do platform społecznościowych zostaną usunięte</li>
                <li>Zaplanowane publikacje zostaną anulowane</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">12. Zmiany Regulaminu</h2>
              <p className="text-muted-foreground">
                Operator zastrzega sobie prawo do wprowadzania zmian w Regulaminie. 
                O zmianach Użytkownicy zostaną powiadomieni z co najmniej 14-dniowym wyprzedzeniem.
                Dalsze korzystanie z Serwisu po wejściu zmian w życie oznacza akceptację nowego Regulaminu.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">13. Rozwiązywanie sporów</h2>
              <p className="text-muted-foreground">
                Wszelkie spory wynikające z korzystania z Serwisu będą rozstrzygane polubownie.
                W przypadku braku porozumienia, spory rozstrzygać będzie sąd właściwy dla siedziby Operatora.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">14. Postanowienia końcowe</h2>
              <p className="text-muted-foreground">
                W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa polskiego,
                w szczególności Kodeks cywilny, Ustawa o świadczeniu usług drogą elektroniczną oraz RODO.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground">15. Kontakt</h2>
              <p className="text-muted-foreground">
                W przypadku pytań dotyczących Regulaminu, prosimy o kontakt:
              </p>
              <div className="bg-muted p-4 rounded-lg mt-4">
                <p className="text-foreground">
                  <strong>Księgarnia Antyk</strong>
                </p>
                <p className="text-muted-foreground">Email: flowsocial0@gmail.com</p>
                <p className="text-muted-foreground">Strona: socialautoflow.pl</p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;
