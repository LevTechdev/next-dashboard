import { describe, expect, it } from "vitest";

import { cleanAiText } from "./clean-text";

/**
 * cleanAiText is the copilot chat bubble's sanitizer: markdown noise out,
 * plain sentences in, while fencing code blocks and leaving URLs alone.
 */
describe("cleanAiText", () => {
  it("returns empty string for empty input", () => {
    expect(cleanAiText("")).toBe("");
  });

  it("strips heading and blockquote markers while keeping the text", () => {
    expect(cleanAiText("### Summary\n> quoted note")).toBe("Summary\nquoted note");
  });

  it("removes emphasis markers but keeps the emphasized words", () => {
    expect(cleanAiText("**bold** and *italic* and __under__")).toBe("bold and italic and under");
  });

  it("converts markdown list bullets to real bullets", () => {
    expect(cleanAiText("- first\n* second")).toBe("• first\n• second");
  });

  it("drops horizontal rules entirely", () => {
    expect(cleanAiText("above\n\n---\n\nbelow")).toBe("above\n\nbelow");
  });

  it("renders relative links as their text and images as their alt", () => {
    expect(cleanAiText("see [docs](/pricing) and ![logo](/l.png)")).toBe("see docs and logo");
  });

  it("leaves markdown links with bare http(s) URLs intact", () => {
    // The URL protector claims the trailing ')' into its verbatim span, so the
    // link-shape regex no longer matches — by design, mangling a pasted URL is
    // worse than leaving markdown brackets around it.
    const line = "see [docs](https://x.test/a)";
    expect(cleanAiText(line)).toBe(line);
  });

  it("protects inline code and fenced blocks from stripping", () => {
    expect(cleanAiText("run `npm run build` now")).toBe("run `npm run build` now");
    expect(cleanAiText("```\n**not emphasis**\n```")).toContain("**not emphasis**");
  });

  it("leaves bare URLs untouched even when they contain asterisks", () => {
    const url = "https://x.test/a*b?c=1#d";
    expect(cleanAiText(`check ${url}`)).toBe(`check ${url}`);
  });

  it("collapses runs of blank lines left by removals and trims the ends", () => {
    expect(cleanAiText("# H\n\n\n\n\nbody\n")).toBe("H\n\nbody");
  });
});
