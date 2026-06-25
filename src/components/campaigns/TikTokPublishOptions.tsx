import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Music, ShieldAlert, ExternalLink, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type TikTokPublishOptionsValue = {
  accountId?: string;
  privacyLevel: string;
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
}

export const TikTokPublishOptions = ({ value, onChange, selectedAccountId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);

  const effectiveAccountId = selectedAccountId || value.accountId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setCreatorInfo(null);
      try {
        const { data, error } = await supabase.functions.invoke("tiktok-creator-info", {
          body: { accountId: effectiveAccountId },
        });
        if (cancelled) return;
        if (error) throw error;
        if (!data?.success) {
          setError(data?.error || "Nie udało się pobrać danych konta TikTok.");
          return;
        }
        setCreatorInfo(data.data || null);

        const options: string[] = data.data?.privacy_level_options || [];
        const currentAllowed = options.includes(value.privacyLevel);
        const patch: Partial<TikTokPublishOptionsValue> = {};
        if (value.accountId !== data.accountId) patch.accountId = data.accountId;
        if (!currentAllowed) {
          patch.privacyLevel = options.includes("SELF_ONLY")
            ? "SELF_ONLY"
            : options[0] || "SELF_ONLY";
        }
        if (Object.keys(patch).length > 0) {
          onChange({ ...value, ...patch });
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveAccountId]);

  const update = (patch: Partial<TikTokPublishOptionsValue>) => {
    onChange({ ...value, ...patch });
  };

  // Validation: branded content cannot be SELF_ONLY
  const brandedSelfOnlyError =
    value.brandedContent && value.privacyLevel === "SELF_ONLY";

  const privacyOptions = creatorInfo?.privacy_level_options || [
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "SELF_ONLY",
  ];

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
          </p>
        </div>
        <Badge variant="outline" className="border-pink-500/40 text-pink-600 dark:text-pink-400">
          TikTok
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
          {/* Account */}
          <div className="rounded-md border bg-background p-3">
            <Label className="text-xs text-muted-foreground">Konto docelowe TikTok</Label>
            <div className="flex items-center gap-2 mt-1">
              {creatorInfo?.creator_avatar_url && (
                <img
                  src={creatorInfo.creator_avatar_url}
                  alt="avatar"
                  className="h-8 w-8 rounded-full object-cover"
                />
              )}
              <div>
                <p className="text-sm font-medium">
                  {creatorInfo?.creator_nickname || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  @{creatorInfo?.creator_username || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Privacy level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Poziom prywatności *</Label>
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
                <span className="text-sm">Duet</span>
                <Switch
                  checked={!creatorInfo?.duet_disabled && value.allowDuet}
                  disabled={!!creatorInfo?.duet_disabled}
                  onCheckedChange={(c) => update({ allowDuet: c })}
                />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span className="text-sm">Stitch</span>
                <Switch
                  checked={!creatorInfo?.stitch_disabled && value.allowStitch}
                  disabled={!!creatorInfo?.stitch_disabled}
                  onCheckedChange={(c) => update({ allowStitch: c })}
                />
              </label>
            </div>
          </div>

          {/* Disclosure */}
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
                    // Reset sub-flags when turning off
                    brandOrganic: c ? value.brandOrganic : false,
                    brandedContent: c ? value.brandedContent : false,
                  })
                }
              />
            </div>

            {value.discloseContent && (
              <div className="space-y-2 pl-1">
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-secondary/40">
                  <Switch
                    checked={value.brandOrganic}
                    onCheckedChange={(c) => update({ brandOrganic: c })}
                  />
                  <div>
                    <p className="text-sm font-medium">Twoja marka</p>
                    <p className="text-xs text-muted-foreground">
                      Promujesz własną markę, produkt lub usługę.
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
                      Płatne partnerstwo z marką trzecią. TikTok nie zezwala na ustawienie „Tylko ja" dla tej opcji.
                    </p>
                  </div>
                </label>

                {brandedSelfOnlyError && (
                  <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertDescription>
                      Treści markowych (branded content) nie można publikować jako „Tylko ja". Zmień prywatność na „Publiczne" lub „Znajomi".
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          {/* Policy links — mandatory UX */}
          <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
            <p className="flex items-center gap-1">
              <Music className="h-3 w-3" />
              Publikując akceptujesz politykę TikToka:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
              >
                Music Usage Confirmation
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 hover:underline"
              >
                Branded Content Policy
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </>
      )}
    </Card>
  );
};

export const defaultTikTokOptions = (): TikTokPublishOptionsValue => ({
  privacyLevel: "SELF_ONLY",
  allowComment: true,
  allowDuet: true,
  allowStitch: true,
  discloseContent: false,
  brandOrganic: false,
  brandedContent: false,
});
