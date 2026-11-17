import { describe, it, expect } from "vitest";
import { defaultTikTokOptions, getTikTokLabelSentence } from "./TikTokPublishOptions";

describe("TikTok UX rules", () => {
  it("nothing is preselected: no privacy level and no interaction checked", () => {
    const d = defaultTikTokOptions();
    expect(d.privacyLevel).toBe("");
    expect([d.allowComment, d.allowDuet, d.allowStitch]).toEqual([false, false, false]);
    expect(d.discloseContent).toBe(false);
  });

  it("Your brand only -> Promotional content label", () => {
    expect(getTikTokLabelSentence({ discloseContent: true, brandOrganic: true, brandedContent: false }))
      .toBe("Your video will be labeled as 'Promotional content'");
  });

  it("Branded content only -> Paid partnership label", () => {
    expect(getTikTokLabelSentence({ discloseContent: true, brandOrganic: false, brandedContent: true }))
      .toBe("Your video will be labeled as 'Paid partnership'");
  });

  it("both options -> Paid partnership label (per TikTok guidelines)", () => {
    expect(getTikTokLabelSentence({ discloseContent: true, brandOrganic: true, brandedContent: true }))
      .toBe("Your video will be labeled as 'Paid partnership'");
  });

  it("disclosure off -> no label", () => {
    expect(getTikTokLabelSentence({ discloseContent: false, brandOrganic: true, brandedContent: true })).toBeNull();
  });
});
