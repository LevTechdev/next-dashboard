/**
 * merge-coverage.js
 *
 * Merges three separate vitest coverage reports (unit, components, API) into a single
 * unified Istanbul coverage report with HTML + text output.
 *
 * Usage: node scripts/merge-coverage.js
 *
 * Expects coverage-final.json in: coverage/unit, coverage/components, coverage/api
 * Outputs merged report to:   coverage/merged-report/
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCoverageMap } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES = [
  { label: "unit", file: "./coverage/unit/coverage-final.json" },
  { label: "components", file: "./coverage/components/coverage-final.json" },
  { label: "api", file: "./coverage/api/coverage-final.json" },
];

const REPORT_DIR = "./coverage/merged-report";

function main() {
  // Load and merge all coverage maps
  const coverageMap = createCoverageMap();

  for (const { label, file } of SOURCES) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
      const objKeys = Object.keys(raw);
      console.log(`[${label}] Loaded ${objKeys.length} files from ${file}`);
      coverageMap.merge(raw);
    } catch (err) {
      console.error(`[${label}] Failed to load ${file}:`, err.message);
      process.exit(1);
    }
  }

  const fileCount = coverageMap.files().length;
  console.log(`\nMerged coverage map contains ${fileCount} files`);

  // Generate merged-final.json for programmatic use
  const mergedDir = path.dirname(REPORT_DIR);
  const mergedJsonPath = path.join(mergedDir, "merged-coverage-final.json");
  const mergedData = coverageMap.toJSON();
  fs.mkdirSync(mergedDir, { recursive: true });
  fs.writeFileSync(mergedJsonPath, JSON.stringify(mergedData, null, 2));
  console.log(`Wrote merged JSON to ${mergedJsonPath}`);

  // Ensure report directory exists before generating reports
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  // Generate HTML + text reports using istanbul-lib-report
  const context = createContext({
    dir: REPORT_DIR,
    coverageMap,
    defaultSummarizer: "nested",
    watermarks: {
      statements: [50, 80],
      functions: [50, 80],
      branches: [50, 80],
      lines: [50, 80],
    },
  });

  // HTML report
  const htmlReporter = reports.create("html", {
    skipEmpty: false,
    skipFull: false,
    subdir: ".",
  });
  htmlReporter.execute(context);

  // Text summary (to stdout)
  const textReporter = reports.create("text", {});
  textReporter.execute(context);

  // JSON summary for potential CI ingestion
  const jsonSummaryReporter = reports.create("json-summary", {
    file: "coverage-summary.json",
  });
  jsonSummaryReporter.execute(context);

  // Print file sizes
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const summaryPath = path.join(REPORT_DIR, "coverage-summary.json");
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    const totals = summary.total;
    console.log("\n=== Merged Coverage Summary ===");
    console.log(`  Statements: ${totals.statements.pct}%`);
    console.log(`  Branches:   ${totals.branches.pct}%`);
    console.log(`  Functions:  ${totals.functions.pct}%`);
    console.log(`  Lines:      ${totals.lines.pct}%`);
    console.log(`\n  HTML report: ${path.resolve(REPORT_DIR)}/index.html`);
  }

  // Generate coverage badge JSON (shields.io endpoint format)
  const badgePath = path.join(REPORT_DIR, "coverage-badge.json");
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8"));
    const totals = summary.total;

    const color = (pct) => {
      if (pct >= 90) return "brightgreen";
      if (pct >= 80) return "green";
      if (pct >= 70) return "yellowgreen";
      if (pct >= 60) return "yellow";
      if (pct >= 50) return "orange";
      return "red";
    };

    // Per-suite badges for each source
    const suiteResults = [];
    for (const { label, file } of SOURCES) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
        const sourceMap = createCoverageMap();
        sourceMap.merge(raw);
        const ctx = createContext({
          dir: REPORT_DIR,
          coverageMap: sourceMap,
          defaultSummarizer: "nested",
        });
        const summaryReporter = reports.create("json-summary", {
          file: `coverage-${label}-summary.json`,
        });
        summaryReporter.execute(ctx);
        const suiteSummary = JSON.parse(
          fs.readFileSync(path.join(REPORT_DIR, `coverage-${label}-summary.json`), "utf-8")
        );
        suiteResults.push({
          label,
          statements: suiteSummary.total.statements.pct,
          branches: suiteSummary.total.branches.pct,
          functions: suiteSummary.total.functions.pct,
          lines: suiteSummary.total.lines.pct,
        });
      } catch (err) {
        console.warn(`[badge] Skipped ${label} summary: ${err.message}`);
      }
    }

    const overallPct = totals.lines.pct;
    const badge = {
      schemaVersion: 1,
      label: "coverage",
      message: `${overallPct}%`,
      color: color(overallPct),
      cacheSeconds: 3600,
      namedLogo: "vitest",
    };
    fs.writeFileSync(badgePath, JSON.stringify(badge, null, 2));
    console.log(`\n  Badge JSON: ${badgePath}`);
    console.log(`  Badge: ${badge.message} (${badge.color})`);
  }

  console.log("\nDone.");
}

main();
