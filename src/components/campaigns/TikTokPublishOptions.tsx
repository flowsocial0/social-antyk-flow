import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music, ShieldAlert, ExternalLink, Video, Tag, Info, RefreshCw } from "lucide-react";
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

type AccountInfo = { accountId: string; info: CreatorInfo };

const PRIVACY_LABELS: Record<string, { label: string; helper: string }> = {
  PUBLIC_TO_EVERYONE: { label: "Everyone · Publiczne", helper: "Wszyscy w TikToku zobaczą ten film" },
  MUTUAL_FOLLOW_FRIENDS: { label: "Friends · Znajomi", helper: "Tylko osoby, które wzajemnie się obserwujecie" },
  FOLLOWER_OF_CREATOR: { label: "Followers · Obserwujący", helper: "Tylko Twoi obserwujący" },
  SELF_ONLY: { label: "Only me · Tylko ja", helper: "Film prywatny, widoczny tylko dla Ciebie" },
};

/** Dokładne komunikaty z TikTok Content Sharing Guidelines (nie zmieniać brzmienia). */
export const TIKTOK_TEXT = {
  selfOnlyBlocked: "Branded content visibility cannot be set to private.",
  disclosureMissing: "You need to indicate if your content promotes yourself, a third party, or both.",
  labelPromotional: "Your video will be labeled as 'Promotional content'",
  labelPaid: "Your video will be labeled as 'Paid partnership'",
  processingNotice:
    "After you finish publishing, it may take a few minutes for the content to process and be visible on your profile.",
};

/** Etykieta wg wytycznych TikTok: obie opcje → „Paid partnership”. */
export const getTikTokLabelSentence = (v: Pick<TikTokPublishOptionsValue, "discloseContent" | "brandOrganic" | "brandedContent">) => {
  if (!v.discloseContent) return null;
  if (v.brandedContent) return TIKTOK_TEXT.labelPaid;
  if (v.brandOrganic) return TIKTOK_TEXT.labelPromotional;
  return null;
};

interface Props {
  value: TikTokPublishOptionsValue;
  onChange: (v: TikTokPublishOptionsValue) => void;
  selectedAccountId?: string;
  selectedAccountIds?: string[];
  /** Zgłasza rodzicowi, czy formularz spełnia wymogi TikToka; hint = tekst do pokazania po najechaniu na zablokowany przycisk. */
  onValidChange?: (isValid: boolean, hint?: string) => void;
}

type InteractionKey = "comment" | "duet" | "stitch";

export const TikTokPublishOptions = ({ value, onChange, selectedAccountId, selectedAccountIds, onValidChange }: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const idsKey = (selectedAccountIds && selectedAccountIds.length > 0
    ? selectedAccountIds
    : [selectedAccountId || value.accountId].filter(Boolean) as string[]
  ).join(",");

  // Zawsze pobieramy aktualne creator_info przy wyświetleniu (wymóg TikTok pkt 1)
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

        const results: AccountInfo[] = [];
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
        if (unique.length === 0 && errors.length > 0) setError(errors[0]);
        else if (errors.length > 0) setError(`Niektóre konta nie zostały załadowane: ${errors.join("; ")}`);

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
  }, [idsKey, refreshKey]);

  const update = (patch: Partial<TikTokPublishOptionsValue>) => onChange({ ...value, ...patch });

  const setBrandedContent = (checked: boolean) => {
    if (checked) {
      const clearSelfOnly = value.privacyLevel === "SELF_ONLY";
      onChange({ ...value, brandedContent: true, privacyLevel: clearSelfOnly ? "" : value.privacyLevel });
      toast.info(TIKTOK_TEXT.selfOnlyBlocked, {
        description: clearSelfOnly
          ? "Wybór „Only me” został wyczyszczony — wybierz Everyone lub Friends."
          : "Opcja „Only me” jest teraz zablokowana.",
      });
    } else {
      onChange({ ...value, brandedContent: false });
    }
  };

  // Poziomy prywatności = przecięcie opcji ze wszystkich wybranych kont
  const privacyOptions = accounts.length > 0
    ? accounts
        .map((a) => a.info.privacy_level_options || [])
        .reduce((acc: string[] | null, opts) => (acc === null ? [...opts] : acc.filter((o) => opts.includes(o))), null) || []
    : [];

  // Interakcje: per konto. Opcja jest wyszarzona tylko, gdy KAŻDE wybrane konto ma ją wyłączoną w TikToku.
  const interaction = (key: InteractionKey) => {
    const field = `${key}_disabled` as const;
    const blockedOn = accounts.filter((a) => !!a.info[field]);
    const allBlocked = accounts.length > 0 && blockedOn.length === accounts.length;
    return { blockedOn, allBlocked };
  };
  const comment = interaction("comment");
  const duet = interaction("duet");
  const stitch = interaction("stitch");

  const selfOnlyBlocked = value.brandedContent;
  const disclosureMissing = value.discloseContent && !value.brandOrganic && !value.brandedContent;

  const errors: string[] = [];
  if (!value.privacyLevel) errors.push("Wybierz poziom prywatności filmu (Who can view this video).");
  if (disclosureMissing) errors.push(TIKTOK_TEXT.disclosureMissing);
  if (value.brandedContent && value.privacyLevel === "SELF_ONLY") errors.push(TIKTOK_TEXT.selfOnlyBlocked);
  const isValid = errors.length === 0;
  const hint = errors[0];

  useEffect(() => {
    onValidChange?.(isValid, hint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isValid, hint]);

  const labelSentence = useMemo(
    () => getTikTokLabelSentence(value),
    [value.discloseContent, value.brandOrganic, value.brandedContent] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handle = (a: AccountInfo) => `@${a.info.creator_username || a.info.creator_nickname || "konto"}`;

  const renderInteraction = (
    key: InteractionKey,
    title: string,
    description: string,
    state: { blockedOn: AccountInfo[]; allBlocked: boolean },
    checked: boolean,
    onToggle: (c: boolean) => void
  ) => {
    const id = `tiktok-allow-${key}`;
    const effective = !state.allBlocked && checked;
    return (
      <div
        className={`rounded-md border p-3 space-y-2 ${state.allBlocked ? "opacity-50 bg-muted/40 cursor-not-allowed" : "bg-background"}`}
        title={state.allBlocked ? "This interaction is turned off in the creator's TikTok app settings." : undefined}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            id={id}
            checked={effective}
            disabled={state.allBlocked}
            onCheckedChange={(c) => onToggle(c === true)}
            className="mt-0.5"
          />
          <label htmlFor={id} className={state.allBlocked ? "cursor-not-allowed" : "cursor-pointer"}>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </label>
        </div>
        {state.blockedOn.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {state.allBlocked ? "Niedostępne: " : "Zostanie wyłączone na koncie: "}
            {state.blockedOn.map(handle).join(", ")} — ta funkcja jest wyłączona w ustawieniach tego konta w aplikacji
            TikTok albo konto jest prywatne.
          </p>
        )}
      </div>
    );
  };

  const anyInteractionBlocked = duet.blockedOn.length > 0 || stitch.blockedOn.length > 0 || comment.blockedOn.length > 0;

  return (
    <Card className="p-6 space-y-5 border-pink-500/30 bg-pink-500/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Video className="h-5 w-5 text-pink-500" />
            Opcje publikacji TikTok
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Wymagane przez TikTok — wybierz prywatność, interakcje i ujawnij rodzaj treści przed publikacją.
            {accounts.length > 1 && " Ustawienia zostaną zastosowane do wszystkich wybranych kont."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={loading}
            className="gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Odśwież dane konta
          </Button>
          <Badge variant="outline" className="border-pink-500/40 text-pink-600 dark:text-pink-400">
            TikTok{accounts.length > 1 ? ` · ${accounts.length} kont` : ""}
          </Badge>
        </div>
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

      {!loading && accounts.length > 0 && (
        <>
          {/* Konto docelowe — nickname z creator_info */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {accounts.length > 1 ? `Posting to (${accounts.length}) · Konta docelowe` : "Posting to · Konto docelowe"}
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <div key={a.accountId} className="rounded-md border bg-background p-3 flex items-center gap-2">
                  {a.info.creator_avatar_url ? (
                    <img src={a.info.creator_avatar_url} alt="avatar" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-600 text-xs font-bold">
                      {(a.info.creator_nickname || a.info.creator_username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.info.creator_nickname || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">@{a.info.creator_username || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prywatność — lista rozwijana bez wartości domyślnej */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Who can view this video · Kto może oglądać <span className="text-destructive">*</span>
            </Label>
            <Select
              value={value.privacyLevel || undefined}
              onValueChange={(v) => update({ privacyLevel: v })}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select privacy level · Wybierz poziom prywatności" />
              </SelectTrigger>
              <SelectContent>
                {privacyOptions.map((opt) => {
                  const meta = PRIVACY_LABELS[opt] || { label: opt, helper: "" };
                  const disabled = opt === "SELF_ONLY" && selfOnlyBlocked;
                  return (
                    <SelectItem
                      key={opt}
                      value={opt}
                      disabled={disabled}
                      title={disabled ? TIKTOK_TEXT.selfOnlyBlocked : undefined}
                      className={disabled ? "data-[disabled]:pointer-events-auto cursor-not-allowed" : undefined}
                    >
                      <div>
                        <p className="text-sm">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {disabled ? TIKTOK_TEXT.selfOnlyBlocked : meta.helper}
                        </p>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {!value.privacyLevel && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Nic nie jest wybrane domyślnie — TikTok wymaga, żebyś sam wybrał, kto zobaczy film.
              </p>
            )}
            {selfOnlyBlocked && (
              <p className="text-xs text-destructive">
                „Only me” jest zablokowane: {TIKTOK_TEXT.selfOnlyBlocked}
              </p>
            )}
          </div>

          {/* Interakcje — żadna nie jest zaznaczona domyślnie */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Allow users to · Pozwól innym na</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Domyślnie nic nie jest zaznaczone. Zaznacz to, na co chcesz pozwolić.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {renderInteraction("comment", "Comment · Komentarze", "Inni mogą komentować Twój film", comment, value.allowComment, (c) => update({ allowComment: c }))}
              {renderInteraction("duet", "Duet", "Inni mogą nagrać reakcję obok Twojego filmu", duet, value.allowDuet, (c) => update({ allowDuet: c }))}
              {renderInteraction("stitch", "Stitch", "Inni mogą dodać fragment Twojego filmu do swojego", stitch, value.allowStitch, (c) => update({ allowStitch: c }))}
            </div>
            {anyInteractionBlocked && (
              <p className="text-xs text-muted-foreground">
                Wyszarzone pole oznacza, że TikTok zgłosił tę funkcję jako wyłączoną na danym koncie. Aby ją włączyć,
                w aplikacji TikTok ustaw konto jako publiczne i w „Ustawienia i prywatność → Prywatność” zezwól na
                Duet/Stitch, a potem kliknij „Odśwież dane konta”.
              </p>
            )}
          </div>

          {/* Content Disclosure Setting */}
          <div className="space-y-3 rounded-md border p-4 bg-background">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Label htmlFor="tiktok-disclose" className="text-sm font-medium">
                  Disclose video content · Ujawnij treść wideo
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Turn on to disclose that this video promotes goods or services in exchange for something of value.
                  Your video could promote yourself, a third party, or both.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Włącz, jeśli film promuje Ciebie, Twoją firmę lub inną markę. Domyślnie wyłączone.
                </p>
              </div>
              <Switch
                id="tiktok-disclose"
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
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id="tiktok-brand-organic"
                    checked={value.brandOrganic}
                    onCheckedChange={(c) => update({ brandOrganic: c === true })}
                    className="mt-0.5"
                  />
                  <label htmlFor="tiktok-brand-organic" className="cursor-pointer">
                    <p className="text-sm font-medium">Your brand · Twoja marka</p>
                    <p className="text-xs text-muted-foreground">
                      You are promoting yourself or your own business. This content will be classified as Brand Organic.
                    </p>
                  </label>
                </div>

                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id="tiktok-branded-content"
                    checked={value.brandedContent}
                    onCheckedChange={(c) => setBrandedContent(c === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="tiktok-branded-content" className="cursor-pointer">
                    <p className="text-sm font-medium">Branded content · Treść markowa</p>
                    <p className="text-xs text-muted-foreground">
                      You are promoting another brand or a third party. This content will be classified as Branded Content.
                    </p>
                  </label>
                </div>

                {disclosureMissing && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {TIKTOK_TEXT.disclosureMissing}
                  </p>
                )}

                {labelSentence && (
                  <Alert className="border-pink-500/40 bg-pink-500/10">
                    <Tag className="h-4 w-4 text-pink-500" />
                    <AlertDescription className="text-sm font-semibold">{labelSentence}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Deklaracja zgody — zawsze widoczna przed przyciskiem publikacji */}
          <div className="text-xs text-muted-foreground border rounded-md p-3 bg-secondary/30">
            <p className="flex items-start gap-1 flex-wrap">
              <Music className="h-3 w-3 mt-0.5" />
              <span>
                By posting, you agree to TikTok's{" "}
                {value.brandedContent && (
                  <>
                    <a
                      href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
                    >
                      Branded Content Policy
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    and{" "}
                  </>
                )}
                <a
                  href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
                >
                  Music Usage Confirmation
                  <ExternalLink className="h-3 w-3" />
                </a>
                .
              </span>
            </p>
          </div>

          {/* Podsumowanie tuż przed publikacją */}
          <div className="rounded-md border p-4 bg-background space-y-1 text-sm">
            <p className="font-medium mb-1">Podsumowanie publikacji TikTok</p>
            <p className="text-muted-foreground">
              Konta: <span className="text-foreground">{accounts.map(handle).join(", ")}</span>
            </p>
            <p className="text-muted-foreground">
              Prywatność:{" "}
              <span className="text-foreground">
                {value.privacyLevel ? PRIVACY_LABELS[value.privacyLevel]?.label || value.privacyLevel : "nie wybrano"}
              </span>
            </p>
            <p className="text-muted-foreground">
              Interakcje:{" "}
              <span className="text-foreground">
                {[
                  `Komentarze: ${!comment.allBlocked && value.allowComment ? "tak" : "nie"}`,
                  `Duet: ${!duet.allBlocked && value.allowDuet ? "tak" : "nie"}`,
                  `Stitch: ${!stitch.allBlocked && value.allowStitch ? "tak" : "nie"}`,
                ].join(" · ")}
              </span>
            </p>
            <p className="text-muted-foreground">
              Ujawnienie treści:{" "}
              <span className="text-foreground">
                {value.discloseContent
                  ? [value.brandOrganic ? "Your brand" : null, value.brandedContent ? "Branded content" : null]
                      .filter(Boolean)
                      .join(" + ") || "wymaga wyboru"
                  : "wyłączone"}
              </span>
            </p>
            {labelSentence && (
              <p className="text-muted-foreground">
                Etykieta: <span className="text-foreground">{labelSentence}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground pt-2">{TIKTOK_TEXT.processingNotice}</p>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1">
                  {errors.map((e) => <li key={e}>{e}</li>)}
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
  // Nic nie jest wybrane domyślnie — wymóg TikTok Content Sharing Guidelines pkt 2b i 2c.
  privacyLevel: "",
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  discloseContent: false,
  brandOrganic: false,
  brandedContent: false,
});
