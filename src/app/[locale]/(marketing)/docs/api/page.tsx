"use client";

import { use, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Download, KeyRound } from "lucide-react";
import { API_ENDPOINTS, API_GROUPS, type ApiEndpoint } from "@/lib/api-docs-data";
import { cn } from "@/lib/utils";
import { ApiTryConsole } from "@/components/docs/api-try-console";
import { EndpointCodeSnippets } from "@/components/docs/endpoint-code-snippets";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
  PATCH: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-md text-xs font-bold border shrink-0",
        METHOD_COLORS[method] || "bg-gray-500/15 text-gray-600 border-gray-500/20",
      )}
    >
      {method}
    </span>
  );
}

function EndpointRow({ endpoint, index }: { endpoint: ApiEndpoint; index: number }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("apiDocsPage");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.3), ease: easeSmooth }}
      className="rounded-xl border border-border bg-background overflow-hidden transition-colors hover:border-primary/30"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
        aria-expanded={open}
      >
        <MethodBadge method={endpoint.method} />
        <span className="font-mono text-sm font-semibold truncate text-foreground">
          {endpoint.path}
        </span>
        {endpoint.sandbox && (
          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border border-primary/30 bg-primary/10 text-primary shrink-0">
            <KeyRound className="h-2.5 w-2.5" />
            {t("sandboxBadge")}
          </span>
        )}
        <span className="ml-auto hidden md:block text-sm text-muted-foreground truncate max-w-[40%]">
          {endpoint.description}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
          className="text-muted-foreground text-xs shrink-0"
        >
          ▼
        </motion.span>
      </button>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.3, ease: easeSmooth }}
          className="overflow-hidden border-t border-border bg-muted/20 px-4 py-4 space-y-4"
        >
          <p className="text-sm text-muted-foreground md:hidden">{endpoint.description}</p>

          {endpoint.queryParams && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Query Parameters
              </h4>
              <ul className="space-y-1">
                {Object.entries(endpoint.queryParams).map(([k, d]) => (
                  <li key={k} className="text-sm">
                    <code className="font-mono text-primary">{k}</code>{" "}
                    <span className="text-muted-foreground">— {d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {endpoint.requestBody && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Request Body
              </h4>
              <ul className="space-y-1">
                {Object.entries(endpoint.requestBody).map(([k, d]) => (
                  <li key={k} className="text-sm">
                    <code className="font-mono text-primary">{k}</code>{" "}
                    <span className="text-muted-foreground">— {d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {endpoint.responseExample && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Response
              </h4>
              <pre className="rounded-lg bg-gray-950 dark:bg-black p-3 overflow-x-auto text-xs font-mono text-emerald-400">
                <code>{endpoint.responseExample}</code>
              </pre>
            </div>
          )}

          {/* Copy-paste code snippets — cURL and TypeScript fetch */}
          <EndpointCodeSnippets endpoint={endpoint} />

          {endpoint.sandbox && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{t("sandboxTitle")}</span>{" "}
              {t("sandboxNotice")}
            </div>
          )}

          {/* Live Try-it console — real authenticated request against this origin */}
          <ApiTryConsole endpoint={endpoint} />
        </motion.div>
      )}
    </motion.div>
  );
}

export default function PublicApiDocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("apiDocsPage");
  const [group, setGroup] = useState<string>("All");
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      API_ENDPOINTS.filter((ep) => {
        const q = search.toLowerCase();
        const matchesSearch =
          ep.path.toLowerCase().includes(q) || ep.description.toLowerCase().includes(q);
        const matchesGroup = group === "All" || ep.group === group;
        return matchesSearch && matchesGroup;
      }),
    [search, group],
  );

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden min-h-screen">
      {/* ── HERO ── */}
      <section className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-12 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">{t("subtitle")}</p>
          <div className="mt-6">
            <a
              href="/api/docs/openapi.json"
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
            >
              <Download className="h-4 w-4" />
              {t("openapiDownload")}
            </a>
          </div>
        </motion.div>
      </section>

      {/* ── ENDPOINT EXPLORER ── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeSmooth }}
        >
          {/* Search */}
          <div className="relative mb-5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
          </div>

          {/* Group pills */}
          <div className="flex flex-wrap gap-2 mb-6">
            {["All", ...API_GROUPS].map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 cursor-pointer",
                  group === g
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-primary/40",
                )}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Endpoints */}
          <div className="space-y-2.5">
            {filtered.map((ep, i) => (
              <EndpointRow key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} index={i} />
            ))}
            {filtered.length === 0 && (
              <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                {t("noResults")}
              </div>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
