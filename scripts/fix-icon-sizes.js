/**
 * Codemod: add explicit `size={N}` to lucide-animated icons (and dynamic
 * <Icon> and <x.icon> renders) that only have Tailwind h-N and w-N classes.
 * lucide-animated renders a wrapper div with an inner svg width/height of
 * `size` (default 28), so without an
 * explicit size the SVG overflows its wrapper and misaligns.
 *
 * Usage: node scripts/fix-icon-sizes.js [--dry]
 */
const fs = require("fs");
const path = require("path");

const DRY = process.argv.includes("--dry");
const ROOT = path.join(__dirname, "..", "src");

// Tailwind h-N -> px (N * 4)
const H_TO_PX = {
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  4.5: 18,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
};

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

// Scan a JSX opening tag starting at `start` (index of '<'); returns end index
// of the closing '>' at brace-depth 0, or -1.
function findTagEnd(src, start) {
  let depth = 0;
  let inStr = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (c === inStr && src[i - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i;
  }
  return -1;
}

function processFile(file) {
  const src = fs.readFileSync(file, "utf8");

  // Icons imported from lucide-animated in this file
  const animImport = src.match(/import\s*\{([^}]+)\}\s*from\s*["']lucide-animated["']/);
  const animatedNames = animImport
    ? animImport[1]
        .split(",")
        .map((s) =>
          s
            .trim()
            .split(/\s+as\s+/)
            .pop(),
        )
        .filter(Boolean)
    : [];
  if (animatedNames.length === 0) return null;

  // Tag names to consider: animated imports + dynamic renders
  const namePattern = [
    ...animatedNames.map((n) => n.replace(/[$]/g, "\\$")),
    "Icon",
    "[a-zA-Z_$][\\w$]*\\.icon",
  ].join("|");
  const tagRe = new RegExp(`<(${namePattern})(?=[\\s/>])`, "g");

  let out = "";
  let last = 0;
  const changes = [];
  let m;
  while ((m = tagRe.exec(src)) !== null) {
    const tagStart = m.index;
    const end = findTagEnd(src, tagStart);
    if (end === -1) continue;
    const tag = src.slice(tagStart, end + 1);
    tagRe.lastIndex = end + 1;

    if (/\bsize\s*=/.test(tag)) {
      continue;
    } // already sized

    // find h-N (or w-N) inside className strings within the tag
    const hm = tag.match(/\bh-(\d+(?:\.\d+)?)\b/) || tag.match(/\bw-(\d+(?:\.\d+)?)\b/);
    if (!hm) continue;
    const px = H_TO_PX[hm[1]];
    if (!px) continue;

    const nameLen = 1 + m[1].length; // '<' + name
    const newTag = tag.slice(0, nameLen) + ` size={${px}}` + tag.slice(nameLen);
    out += src.slice(last, tagStart) + newTag;
    last = end + 1;

    const line = src.slice(0, tagStart).split("\n").length;
    changes.push(`  L${line}: <${m[1]}> h-${hm[1]} -> size={${px}}`);
  }
  if (changes.length === 0) return null;
  out += src.slice(last);
  if (!DRY) fs.writeFileSync(file, out, "utf8");
  return { file: path.relative(path.join(__dirname, ".."), file), changes };
}

const files = walk(ROOT, []);
let total = 0;
for (const f of files) {
  const res = processFile(f);
  if (res) {
    console.log(`${DRY ? "[dry] " : ""}${res.file} (${res.changes.length})`);
    for (const c of res.changes) console.log(c);
    total += res.changes.length;
  }
}
console.log(`\nTotal: ${total} icon(s) ${DRY ? "would be" : ""} fixed`);
