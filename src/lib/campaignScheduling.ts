/** Wspólne reguły harmonogramu kampanii (tylko YouTube, powtarzanie postów). */

export const isYouTubeOnly = (platforms?: string[] | null) =>
  !!platforms && platforms.length === 1 && platforms[0] === "youtube";

/** Tylko YouTube + wyłączone generowanie: książki nie są wymagane, wystarczą filmy. */
export const youtubeOnlyNeedsBooks = (opts: {
  platforms: string[];
  useAI: boolean;
  useRandomContent: boolean;
  videoCount: number;
}) => {
  if (!isYouTubeOnly(opts.platforms)) return true;
  if (opts.useAI || opts.useRandomContent) return true;
  return opts.videoCount === 0;
};

const sortTimes = (times: string[]) =>
  [...times].sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return ah * 60 + am - (bh * 60 + bm);
  });

export type Slot = { day: number; time: string; date: Date };

/** Kolejne terminy: dzień po dniu, w każdym dniu wszystkie godziny. */
export const buildSlots = (startDate: string, times: string[], count: number): Slot[] => {
  const sorted = sortTimes(times.length ? times : ["10:00"]);
  const [y, m, d] = startDate.split("-").map(Number);
  const slots: Slot[] = [];
  for (let i = 0; i < count; i++) {
    const dayIndex = Math.floor(i / sorted.length);
    const time = sorted[i % sorted.length];
    const [hh, mm] = time.split(":").map(Number);
    const date = new Date(y, m - 1, d + dayIndex, hh, mm, 0, 0);
    slots.push({ day: dayIndex + 1, time, date });
  }
  return slots;
};

/** Powtarzanie posta: X godzin dziennie przez Y dni = X*Y terminów. */
export const expandRepeats = (startDate: string, times: string[], days: number): Slot[] => {
  const uniq = Array.from(new Set(times.filter(Boolean)));
  return buildSlots(startDate, uniq, uniq.length * Math.max(1, days));
};

/** Lista filmów powtórzona `repeat` razy, w kolejności A,B,A,B... */
export const repeatVideos = <T,>(videos: T[], repeat: number): T[] => {
  const out: T[] = [];
  for (let r = 0; r < Math.max(1, repeat); r++) out.push(...videos);
  return out;
};
