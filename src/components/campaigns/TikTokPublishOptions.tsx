import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music, ShieldAlert, ExternalLink, Video, Tag, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TikTokPublishOptionsValue = {
  accountId?: string;
  privacyLevel: string; // pusty string = użytkownik jeszcze nie wybrał (wymagane przez TikTok UX)
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  discloseContent: boolean;
  brandOrganic: boolean;
  brandedContent: boolean;
};

type CreatorInfo = {
  creator_username?: string;
  creator_nickname?: string;
  creator_avatar_url?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

const PRIVACY_LABELS: Record<string, { label: string; helper: string }> = {
  PUBLIC_TO_EVERYONE: { label: "Publiczne", helper: "Wszyscy w TikToku zobaczą ten film" },
  MUTUAL_FOLLOW_FRIENDS: { label: "Znajomi", helper: "Tylko osoby, które się wzajemnie obserwujecie" },
  FOLLOWER_OF_CREATOR: { label: "Obserwujący", helper: "Tylko Twoi obserwujący zobaczą film" },
  SELF_ONLY: { label: "Tylko ja", helper: "Film będzie prywatny, widoczny tylko dla Ciebie" },
};

interface Props {
  value: TikTokPublishOptionsValue;
  onChange: (v: TikTokPublishOptionsValue) => void;
  selectedAccountId?: string;
  selectedAccountIds?: string[];
  /** Zgłasza rodzicowi, czy formularz TikTok spełnia wszystkie wymogi UX TikToka (pkt 3–4). */
  onValidChange?: (isValid: boolean) => void;
}

export const TikTokPublishOptions = ({ value, onChange, selectedAccountId, selectedAccountIds, onValidChange }: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ accountId: string; info: CreatorInfo }>>([]);

  const idsKey = (selectedAccountIds && selectedAccountIds.length > 0
    ? selectedAccountIds
    : [selectedAccountId || value.accountId].filter(Boolean) as string[]
  ).join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setAccounts([]);
      const ids = idsKey ? idsKey.split(",") : [undefined as any];
      try {
        const settled = await Promise.allSettled(
          ids.map(async (id) => {
            const { data, error } = await supabase.functions.invoke("tiktok-creator-info", {
              body: { accountId: id },
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Nie udało się pobrać danych konta TikTok.");
            return { accountId: data.accountId as string, info: (data.data || {}) as CreatorInfo };
          })
        );
        if (cancelled) return;

        const results: Array<{ accountId: string; info: CreatorInfo }> = [];
        const errors: string[] = [];
        settled.forEach((s) => {
          if (s.status === "fulfilled") results.push(s.value);
          else errors.push(s.reason?.message || String(s.reason));
        });

        const seen = new Set<string>();
        const unique = results.filter((r) => {
          if (seen.has(r.accountId)) return false;
          seen.add(r.accountId);
          return true;
        });

        setAccounts(unique);
        if (unique.length === 0 && errors.length > 0) {
          setError(errors[0]);
        } else if (errors.length > 0) {
          setError(`Niektóre konta nie zostały załadowane: ${errors.join("; ")}`);
        }

        // WAŻNE: nie ustawiamy automatycznie privacy_level — TikTok wymaga świadomego wyboru użytkownika.
        // Ustawiamy tylko accountId (pierwsze konto z listy).
        if (unique[0] && value.accountId !== unique[0].accountId) {
          onChange({ ...value, accountId: unique[0].accountId });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const update = (patch: Partial<TikTokPublishOptionsValue>) => {
    onChange({ ...value, ...patch });
  };

  /**
   * Branded content nie może być prywatny (wymóg TikTok UX pkt 4).
   * Blokujemy opcję „Tylko ja", czyścimy wybór i pokazujemy widoczną informację zwrotną.
   */
  const setBrandedContent = (checked: boolean) => {
    if (checked) {
      const clearSelfOnly = value.privacyLevel === "SELF_ONLY";
      onChange({
        ...value,
        brandedContent: true,
        privacyLevel: clearSelfOnly ? "" : value.privacyLevel,
      });
      toast.info("Branded content visibility cannot be set to private", {
        description: "Treści markowej nie można opublikować jako „Tylko ja” — wybierz inny poziom prywatności.",
      });
    } else {
      onChange({ ...value, brandedContent: false });
    }
  };

  // Dostępne poziomy prywatności = przecięcie opcji ze wszystkich wybranych kont
  const privacyOptions = accounts.length > 0
    ? accounts
        .map((a) => a.info.privacy_level_options || [])
        .reduce((acc: string[] | null, opts) => {
          if (acc === null) return [...opts];
          return acc.filter((o) => opts.includes(o));
        }, null) || []
    : ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"];

  const creatorInfo: CreatorInfo = {
    comment_disabled: accounts.some((a) => a.info.comment_disabled),
    duet_disabled: accounts.some((a) => a.info.duet_disabled),
    stitch_disabled: accounts.some((a) => a.info.stitch_disabled),
  };

  // ===== WALIDACJA UX WYMAGANA PRZEZ TIKTOK (pkt 3–4 Content Sharing Guidelines) =====
  const errors: string[] = [];
  if (!value.privacyLevel) {
    errors.push("Wybierz poziom prywatności filmu.");
  }
  if (value.discloseContent && !value.brandOrganic && !value.brandedContent) {
    errors.push('Zaznacz co najmniej jedną opcję ujawnienia: „Twoja marka" lub „Treść markowa".');
  }
  if (value.brandedContent && value.privacyLevel === "SELF_ONLY") {
    errors.push('Treści markowych (branded content) nie można publikować jako „Tylko ja".');
  }
  const isValid = errors.length === 0;

  useEffect(() => {
    onValidChange?.(isValid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid]);

  // Etykiety zgodności, które TikTok pokaże na filmie
  const complianceLabels = useMemo(() => {
    if (!value.discloseContent) return [];
    const labels: string[] = [];
    if (value.brandOrganic) labels.push("Promotional content");
    if (value.brandedContent) labels.push("Paid partnership");
    return labels;
  }, [value.discloseContent, value.brandOrganic, value.brandedContent]);

  // Dokładne brzmienie etykiety wymagane przez TikTok UX Guidelines
  const complianceSentence = useMemo(() => {
    if (!value.discloseContent) return null;
    if (value.brandOrganic && value.brandedContent)
      return "Your video will be labeled 'Paid partnership' and 'Promotional content'.";
    if (value.brandedContent) return "Your video will be labeled 'Paid partnership'.";
    if (value.brandOrganic) return "Your video will be labeled 'Promotional content'.";
    return null;
  }, [value.discloseContent, value.brandOrganic, value.brandedContent]);

  const selfOnlyBlocked = value.brandedContent;

  return (
    <Card className="p-6 space-y-5 border-pink-500/30 bg-pink-500/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-pink-500" />
            Opcje publikacji TikTok
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Wymagane przez TikTok Content Posting API — wybierz prywatność i ujawnij rodzaj treści przed publikacją.
            {accounts.length > 1 && " Ustawienia zostaną zastosowane do wszystkich wybranych kont."}
          </p>
        </div>
        <Badge variant="outline" className="border-pink-500/40 text-pink-600 dark:text-pink-400">
          TikTok{accounts.length > 1 ? ` · ${accounts.length} kont` : ""}
        </Badge>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Pobieram dane konta TikTok…
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && (
        <>
          {/* Accounts */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {accounts.length > 1 ? `Konta docelowe TikTok (${accounts.length})` : "Konto docelowe TikTok"}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <div key={a.accountId} className="rounded-md border bg-background p-3 flex items-center gap-2">
                  {a.info.creator_avatar_url ? (
                    <img
                      src={a.info.creator_avatar_url}
                      alt="avatar"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-600 text-xs font-bold">
                      {(a.info.creator_nickname || a.info.creator_username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.info.creator_nickname || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{a.info.creator_username || "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy level — bez domyślnie zaznaczonego */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Poziom prywatności <span className="text-destructive">*</span>
            </Label>
            {!value.privacyLevel && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Wybierz kto zobaczy Twój film — TikTok wymaga świadomego wyboru.
              </p>
            )}
            <RadioGroup
              value={value.privacyLevel}
              onValueChange={(v) => update({ privacyLevel: v })}
              className="space-y-2"
            >
              {privacyOptions.map((opt) => {
                const meta = PRIVACY_LABELS[opt] || { label: opt, helper: "" };
                return (
                  <label
                    key={opt}
                    className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary/40"
                  >
                    <RadioGroupItem value={opt} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.helper}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Interaction toggles */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Interakcje</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span className="text-sm">Komentarze</span>
                <Switch
                  checked={!creatorInfo?.comment_disabled && value.allowComment}
                  disabled={!!creatorInfo?.comment_disabled}
                  onCheckedChange={(c) => update({ allowComment: c })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm">Duet</p>
                  <p className="text-xs text-muted-foreground">Inni mogą nagrać reakcję obok Twojego filmu</p>
                </div>
                <Switch
                  checked={!creatorInfo?.duet_disabled && value.allowDuet}
                  disabled={!!creatorInfo?.duet_disabled}
                  onCheckedChange={(c) => update({ allowDuet: c })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-3">
                <div>
                  <p className="text-sm">Stitch</p>
                  <p className="text-xs text-muted-foreground">Inni mogą dodać fragment Twojego filmu do swojego</p>
                </div>
                <Switch
                  checked={!creatorInfo?.stitch_disabled && value.allowStitch}
                  disabled={!!creatorInfo?.stitch_disabled}
                  onCheckedChange={(c) => update({ allowStitch: c })}
                />
              </label>
            </div>
          </div>

          {/* Content Disclosure Setting — kluczowa sekcja pkt 3–4 */}
          <div className="space-y-3 rounded-md border p-4 bg-background">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label className="text-sm font-medium">Ujawnij treść wideo</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Włącz, jeśli ten film promuje markę, produkt lub usługę. Wymagane przez TikTok dla treści komercyjnych.
                </p>
              </div>
              <Switch
                checked={value.discloseContent}
                onCheckedChange={(c) =>
                  update({
                    discloseContent: c,
                    brandOrganic: c ? value.brandOrganic : false,
                    brandedContent: c ? value.brandedContent : false,
                  })
                }
              />
            </div>

            {value.discloseContent && (
              <div className="space-y-3 pl-1">
                <p className="text-xs font-medium text-foreground">
                  Zaznacz co najmniej jedną opcję: <span className="text-destructive">*</span>
                </p>

                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary/40">
                  <Switch
                    checked={value.brandOrganic}
                    onCheckedChange={(c) => update({ brandOrganic: c })}
                  />
                  <div>
                    <p className="text-sm font-medium">Twoja marka</p>
                    <p className="text-xs text-muted-foreground">
                      Promujesz własną markę, produkt lub usługę. Film zostanie oznaczony jako <strong>„Promotional content"</strong>.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary/40">
                  <Switch
                    checked={value.brandedContent}
                    onCheckedChange={(c) => update({ brandedContent: c })}
                  />
                  <div>
                    <p className="text-sm font-medium">Treść markowa (Branded content)</p>
                    <p className="text-xs text-muted-foreground">
                      Płatne partnerstwo z marką trzecią. Film zostanie oznaczony jako <strong>„Paid partnership"</strong>. Nie można ustawić „Tylko ja".
                    </p>
                  </div>
                </label>

                {/* Compliance label preview — dokładnie to zobaczy widz na filmie */}
                {complianceLabels.length > 0 && (
                  <Alert className="border-pink-500/40 bg-pink-500/10">
                    <Tag className="h-4 w-4 text-pink-500" />
                    <AlertDescription className="text-sm">
                      <strong>Twój film zostanie oznaczony jako:</strong>{" "}
                      {complianceLabels.map((l, i) => (
                        <span key={l}>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-700 dark:text-pink-300 font-mono text-xs">
                            {l}
                          </span>
                          {i < complianceLabels.length - 1 ? " oraz " : ""}
                        </span>
                      ))}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Consent statement — warunkowy, dokładnie w miejscu Disclosure */}
                {(value.brandOrganic || value.brandedContent) && (
                  <div className="text-xs text-muted-foreground border rounded-md p-3 bg-secondary/30">
                    <p className="mb-2 flex items-center gap-1">
                      <Music className="h-3 w-3" />
                      Publikując ten film akceptujesz:
                    </p>
                    <ul className="space-y-1 pl-4 list-disc">
                      <li>
                        TikTok{" "}
                        <a
                          href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
                        >
                          Music Usage Confirmation
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                      {value.brandedContent && (
                        <li>
                          TikTok{" "}
                          <a
                            href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
                          >
                            Branded Content Policy
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Zbiorczy blok błędów walidacji — blokuje przycisk „Publikuj/Zaplanuj" u rodzica */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </Card>
  );
};

export const defaultTikTokOptions = (): TikTokPublishOptionsValue => ({
  // Pusty poziom prywatności = użytkownik musi świadomie wybrać (wymóg TikTok UX pkt 4).
  privacyLevel: "",
  allowComment: true,
  allowDuet: true,
  allowStitch: true,
  discloseContent: false,
  brandOrganic: false,
  brandedContent: false,
});
