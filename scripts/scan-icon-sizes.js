/* Scan for lucide-animated icon usages missing a numeric size prop. */
const fs = require("fs");
const path = require("path");

const ROOT = "d:/Project/next-dashboard/src";
const results = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      walk(p);
    } else if (/\.tsx?$/.test(entry.name)) {
      scan(p);
    }
  }
}

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  const importMatch = src.match(/import\s*\{([^}]+)\}\s*from\s*"lucide-animated"/);
  if (!importMatch) return;
  const icons = importMatch[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (icons.length === 0) return;

  for (const icon of icons) {
    // find JSX usages: <IconName ... > possibly multi-line; capture the opening tag
    const tagRe = new RegExp("<" + icon + "(\\s[^>]*)?/?>", "g");
    let m;
    while ((m = tagRe.exec(src)) !== null) {
      const attrs = m[1] || "";
      if (!/\bsize=/.test(attrs)) {
        const line = src.slice(0, m.index).split("\n").length;
        const cls = (attrs.match(/className="([^"]*)"/) || [])[1] || "";
        results.push({ file: file.replace(/\\/g, "/").replace(ROOT + "/", ""), line, icon, cls });
      }
    }
  }
}

walk(ROOT);
// group by file
const byFile = {};
for (const r of results) {
  (byFile[r.file] ??= []).push(r);
}
for (const [f, list] of Object.entries(byFile)) {
  console.log("\n### " + f + " (" + list.length + ")");
  list.forEach((r) => console.log("  L" + r.line, r.icon, "cls=[" + r.cls + "]"));
}
console.log("\nTOTAL missing size:", results.length);
