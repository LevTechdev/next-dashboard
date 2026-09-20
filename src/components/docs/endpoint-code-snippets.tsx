"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiEndpoint } from "@/lib/api-docs-data";

export type SnippetLang = "curl" | "typescript";

/**
 * Build the example snippet set for an endpoint. Framework-free and exported
 * so tests can assert on the output without rendering React.
 */
export function buildSnippets(
  endpoint: Pick<ApiEndpoint, "method" | "path" | "requestBody" | "queryParams" | "sandbox">,
  origin: string,
): Record<SnippetLang, string> {
  const origin0 = origin.replace(/\/$/, "");

  // Sample the first two documented query params so snippets stay short.
  const queryEntries = Object.entries(endpoint.queryParams ?? {}).slice(0, 2);
  const qs = queryEntries.length ? "?" + queryEntries.map(([k]) => `${k}=...`).join("&") : "";

  const hasBody = !!endpoint.requestBody;
  const bodyObj: Record<string, unknown> = {};
  if (endpoint.requestBody) {
    for (const [k, desc] of Object.entries(endpoint.requestBody)) {
      bodyObj[k] = sampleValue(desc);
    }
  }

  const method = endpoint.method;

  const curlParts = [`curl -X ${method} "${origin0}${endpoint.path}${qs}"`];
  if (endpoint.sandbox) {
    // Placeholder only — never a real key.
    curlParts.push(`  -H "Authorization: Bearer dash_your_api_key"`);
  }
  if (hasBody) {
    curlParts.push(`  -H "Content-Type: application/json"`);
    curlParts.push(`  -d '${JSON.stringify(bodyObj)}'`);
  }
  const curl = curlParts.join(" \\\n");

  const tsLines: string[] = [
    `const res = await fetch("${origin0}${endpoint.path}${qs}", {`,
    `  method: "${method}",`,
  ];
  if (endpoint.sandbox) {
    tsLines.push(`  headers: { Authorization: "Bearer dash_your_api_key" },`);
  } else {
    tsLines.push(`  // Runs from the dashboard origin — the session cookie is sent automatically.`);
    tsLines.push(`  credentials: "same-origin",`);
    if (hasBody) tsLines.push(`  headers: { "Content-Type": "application/json" },`);
  }
  if (hasBody) {
    tsLines.push(`  body: JSON.stringify(${JSON.stringify(bodyObj, null, 2)}),`);
  }
  tsLines.push(`});`);
  tsLines.push(`if (!res.ok) throw new Error(\`Request failed: \${res.status}\`);`);
  tsLines.push(`const data = await res.json();`);
  const typescript = tsLines.join("\n");

  return { curl, typescript };
}

/** Turn a field description like "Order ID" into a believable sample value. */
function sampleValue(desc: string): unknown {
  const d = desc.toLowerCase();
  if (d.includes("email")) return "jane@example.com";
  if (d.includes("array") || d.startsWith("[")) return [];
  if (d.includes("price") || d.includes("amount") || d.includes("budget")) return 100;
  if (d.includes("quantity") || d.includes("stock")) return 1;
  if (d.includes("status")) return "PENDING";
  if (d.includes("name")) return "Jane Doe";
  if (d.includes("id")) return "id_from_previous_step";
  return desc.split(/[ ,(]/)[0].toLowerCase() || "value";
}

const TABS: { lang: SnippetLang; labelKey: string }[] = [
  { lang: "curl", labelKey: "snippets.curl" },
  { lang: "typescript", labelKey: "snippets.typescript" },
];

/**
 * Tabbed cURL / TypeScript fetch snippets for an endpoint card, each with a
 * one-click copy button.
 */
export function EndpointCodeSnippets({
  endpoint,
  className,
}: {
  endpoint: ApiEndpoint;
  className?: string;
}) {
  const t = useTranslations("apiDocsPage");
  const [lang, setLang] = useState<SnippetLang>("curl");
  const [copied, setCopied] = useState(false);

  const snippets = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return buildSnippets(endpoint, origin);
  }, [endpoint]);

  const copy = () => {
    navigator.clipboard.writeText(snippets[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <div
          role="tablist"
          aria-label={t("snippets.title")}
          className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
        >
          {TABS.map(({ lang: l, labelKey }) => (
            <button
              key={l}
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer",
                lang === l
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <button
          onClick={copy}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? t("snippets.copied") : t("snippets.copy")}
        </button>
      </div>

      <pre className="rounded-lg bg-gray-950 dark:bg-black p-3 overflow-x-auto text-xs font-mono text-emerald-400 max-h-72 overflow-y-auto">
        <code>{snippets[lang]}</code>
      </pre>

      {endpoint.sandbox && (
        <p className="text-[11px] text-muted-foreground">{t("snippets.keyPlaceholder")}</p>
      )}
    </div>
  );
}
