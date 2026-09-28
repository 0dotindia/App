import { describe, expect, it } from "vitest";
import { isYouTubeId, issueNumber, toHeadline, validSocials, validVideos } from "@/lib/landing-content";

describe("landing-content", () => {
  it("accepts only 11-character YouTube ids", () => {
    expect(isYouTubeId("dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe(false);
    expect(isYouTubeId("short")).toBe(false);
    expect(validVideos([{ id: "dQw4w9WgXcQ", title: "ok" }, { id: "bad id", title: "no" }])).toHaveLength(1);
  });

  it("drops socials without a valid https url", () => {
    const socials = validSocials([
      { platform: "x", url: "https://x.com/0dot" },
      { platform: "github", url: "" },
      { platform: "instagram", url: "javascript:alert(1)" },
      { platform: "youtube", url: "http://youtube.com/@0dot" },
    ]);
    expect(socials.map((s) => s.platform)).toEqual(["x"]);
  });

  it("numbers issues by IST calendar day, starting at 1", () => {
    expect(issueNumber(new Date("2026-09-23T00:00:00+05:30"), "2026-09-23")).toBe(1);
    // 23:30 UTC on the 23rd is already the 24th in India.
    expect(issueNumber(new Date("2026-09-23T23:30:00Z"), "2026-09-23")).toBe(2);
    expect(issueNumber(new Date("2026-09-28T12:00:00+05:30"), "2026-09-23")).toBe(6);
    expect(issueNumber(new Date("2026-01-01T12:00:00+05:30"), "2026-09-23")).toBe(1);
  });

  it("turns a post body into a headline and standfirst", () => {
    expect(toHeadline("Voice rooms are live. Jump in from any community.")).toEqual({
      headline: "Voice rooms are live.",
      rest: "Jump in from any community.",
    });
    expect(toHeadline("First line only\nsecond line")).toEqual({ headline: "First line only", rest: "second line" });
    const long = toHeadline("word ".repeat(40), 20);
    expect(long.headline.length).toBeLessThanOrEqual(21);
    expect(long.headline.endsWith("…")).toBe(true);
  });
});
