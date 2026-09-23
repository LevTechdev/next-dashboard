/**
 * Clean AI assistant output for chat UI rendering.
 *
 * LLM replies frequently arrive with markdown symbols (#, *, `, …) that look
 * like noise inside a chat bubble. This strips them while protecting:
 * - inline code and code blocks (fenced with ```) — untouched,
 * - bare URLs — untouched,
 * - list bullets (*, -, •) — converted to a real bullet "•" instead of removed,
 * - emphasis asterisks/underscores and heading/quote/blockquote markers — removed.
 *
 * Deliberately tiny and deterministic (no markdown parser dependency): the
 * copilot contract is plain sentences + the structured ActionProposalCard,
 * so a full renderer would be overkill here.
 */
export function cleanAiText(raw: string): string {
  if (!raw) return "";

  // Protect fenced code blocks from every transformation below.
  const fences: string[] = [];
  let text = raw.replace(/```[\s\S]*?```/g, (m) => `\u0000${fences.push(m) - 1}\u0000`);

  // Protect inline code spans.
  const codes: string[] = [];
  text = text.replace(/`[^`]+`/g, (m) => `\u0001${codes.push(m) - 1}\u0001`);

  // Protect bare URLs (http/https) so "://*" etc. is never mangled.
  const urls: string[] = [];
  text = text.replace(/\bhttps?:\/\/\S+/g, (m) => `\u0002${urls.push(m) - 1}\u0002`);

  text = text
    // Bold/italic emphasis markers (not adjacent to a bullet we want to keep).
    .replace(/(\*\*\*|\*\*|\*|__|_)(?=\S)(.+?)(?<=\S)\1/g, "$2")
    // Headings, blockquotes at line start → drop the marker, keep text.
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    // Horizontal rules made of --- or *** → drop the line entirely.
    .replace(/^(\s*[-*_]\s*){3,}$/gm, "")
    // List bullets (markdown -, *) and stray bullet glyphs → real bullet.
    .replace(/^(\s*)[*-]\s+/gm, "$1• ")
    // Images ![alt](src) → alt text; links [text](url) → text.
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Collapse >2 consecutive blank lines left behind by removals.
    .replace(/\n{3,}/g, "\n\n");

  // Restore protected segments (fences → code, codes/urls verbatim).
  text = text
    .replace(/\u0002(\d+)\u0002/g, (_, i) => urls[Number(i)])
    .replace(/\u0001(\d+)\u0001/g, (_, i) => codes[Number(i)])
    .replace(/\u0000(\d+)\u0000/g, (_, i) => fences[Number(i)]);

  return text.trim();
}
