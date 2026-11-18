import { describe, it, expect } from "vitest";
import { expandRepeats, youtubeOnlyNeedsBooks, repeatVideos, isYouTubeOnly } from "./campaignScheduling";

describe("campaign scheduling rules", () => {
  it("3 razy dziennie przez 4 dni daje 12 publikacji", () => {
    const slots = expandRepeats("2026-12-01", ["18:00", "08:00", "12:00"], 4);
    expect(slots).toHaveLength(12);
    expect(slots[0].time).toBe("08:00");
    expect(slots[11].day).toBe(4);
    expect(slots[11].date.getDate()).toBe(4);
  });

  it("tylko YouTube bez AI i z filmami nie wymaga książek", () => {
    expect(youtubeOnlyNeedsBooks({ platforms: ["youtube"], useAI: false, useRandomContent: false, videoCount: 2 })).toBe(false);
    expect(youtubeOnlyNeedsBooks({ platforms: ["youtube"], useAI: true, useRandomContent: false, videoCount: 2 })).toBe(true);
    expect(youtubeOnlyNeedsBooks({ platforms: ["youtube", "x"], useAI: false, useRandomContent: false, videoCount: 2 })).toBe(true);
  });

  it("filmy powtórzone 3 razy", () => {
    expect(repeatVideos(["a", "b"], 3)).toEqual(["a", "b", "a", "b", "a", "b"]);
    expect(isYouTubeOnly(["youtube"])).toBe(true);
  });
});
