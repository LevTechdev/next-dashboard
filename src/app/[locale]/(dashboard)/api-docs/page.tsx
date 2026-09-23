"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { API_ENDPOINTS, API_GROUPS, ApiEndpoint } from "@/lib/api-docs-data";
import { cn } from "@/lib/utils";
import {
  Search,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  Play,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MethodBadge = ({ method }: { method: string }) => {
  const colors: Record<string, string> = {
    GET: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    POST: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    PUT: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    DELETE: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
    PATCH: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };

  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-md text-xs font-bold border",
        colors[method] || "bg-gray-500/15 text-gray-600 border-gray-500/20",
      )}
    >
      {method}
    </span>
  );
};

/**
 * Localized endpoint copy: the data file ships English source strings keyed by
 * a stable slug; locale files under `apiDocs.endpoints.<slug>` override them.
 * Falls back to the source copy when a locale lacks an entry (or a new
 * endpoint lands before translations catch up).
 */
function useEndpointCopy(endpoint: ApiEndpoint, t: ReturnType<typeof useTranslations>) {
  return useMemo(() => {
    // t.raw() reads the string without ICU parsing — locale copy like
    // "Array { productId, quantity, price }" would otherwise be treated as an
    // ICU argument and throw INVALID_ARGUMENT_TYPE. Non-strings fall back.
    const raw = (fullKey: string, fallback: string) => {
      if (!t.has(fullKey)) return fallback;
      const value = t.raw(fullKey);
      return typeof value === "string" && value.length > 0 ? value : fallback;
    };
    const description = raw(`endpoints.${endpoint.slug}.description`, endpoint.description);
    const entry = (kind: "params" | "fields", key: string, fallback: string) =>
      raw(`endpoints.${endpoint.slug}.${kind}.${key}`, fallback);
    return {
      description,
      param: (k: string, fb: string) => entry("params", k, fb),
      field: (k: string, fb: string) => entry("fields", k, fb),
    };
  }, [endpoint, t]);
}

/** Localized sidebar group label. */
function groupLabel(group: string, t: ReturnType<typeof useTranslations>): string {
  if (!t.has(`groups.${group}`)) return group;
  const value = t.raw(`groups.${group}`);
  return typeof value === "string" && value.length > 0 ? value : group;
}

const EndpointCard = ({ endpoint, t }: { endpoint: ApiEndpoint; t: any }) => {
  const copy = useEndpointCopy(endpoint, t);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tryIt, setTryIt] = useState(false);

  const curlCommand = `curl -X ${endpoint.method} \\
  http://localhost:3000${endpoint.path} \\
  -H 'Content-Type: application/json'${
    endpoint.requiresAuth ? " \\\n  -H 'Authorization: Bearer YOUR_TOKEN'" : ""
  }${
    endpoint.requestBody
      ? " \\\n  -d '{\n" +
        Object.keys(endpoint.requestBody)
          .map((k) => `    "${k}": "..."`)
          .join(",\n") +
        "\n  }'"
      : ""
  }`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm transition-all hover:shadow-md mb-4">
      <div
        className="p-4 cursor-pointer flex items-center justify-between gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <MethodBadge method={endpoint.method} />
          <span className="font-mono text-sm md:text-base font-semibold truncate">
            {endpoint.path}
          </span>
          {endpoint.requiresAuth ? (
            <Lock className="h-4 w-4 text-amber-500" />
          ) : (
            <Unlock className="h-4 w-4 text-emerald-500" />
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-muted-foreground hidden md:block truncate max-w-xs">
            {copy.description}
          </span>
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-muted/20"
          >
            <div className="p-4 space-y-6">
              <p className="text-sm md:hidden text-foreground">{copy.description}</p>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard();
                  }}
                  className="h-8"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                  ) : (
                    <Terminal className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {copied ? t("copied") : t("copyCurl")}
                </Button>
                <Button
                  variant={tryIt ? "default" : "secondary"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTryIt(!tryIt);
                  }}
                  className="h-8"
                >
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  {t("tryIt")}
                </Button>
              </div>

              {tryIt && (
                <div className="p-4 rounded-lg bg-background border border-border space-y-4">
                  <h4 className="text-sm font-semibold">{t("send")}</h4>
                  <p className="text-xs text-muted-foreground">{t("tryItHint")}</p>
                  <Button size="sm" className="w-full sm:w-auto">
                    {t("send")}
                  </Button>
                </div>
              )}

              {endpoint.queryParams && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("queryParams")}</h4>
                  <div className="rounded-md border border-border bg-background overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-4 py-2 font-medium">{t("param")}</th>
                          <th className="px-4 py-2 font-medium">{t("description")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(endpoint.queryParams).map(([key, desc], i) => (
                          <tr key={key} className={i !== 0 ? "border-t border-border" : ""}>
                            <td className="px-4 py-2 font-mono text-xs">{key}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {copy.param(key, desc)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {endpoint.requestBody && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("requestBody")}</h4>
                  <div className="rounded-md border border-border bg-background overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-4 py-2 font-medium">{t("field")}</th>
                          <th className="px-4 py-2 font-medium">{t("description")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(endpoint.requestBody).map(([key, desc], i) => (
                          <tr key={key} className={i !== 0 ? "border-t border-border" : ""}>
                            <td className="px-4 py-2 font-mono text-xs">{key}</td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {copy.field(key, desc)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function ApiDocsPage() {
  const t = useTranslations("apiDocs");
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("All");

  const filteredEndpoints = useMemo(() => {
    const q = search.toLowerCase();
    return API_ENDPOINTS.filter((ep) => {
      // Search across path, English source description, and the active locale's
      // description so users can find endpoints in their own language.
      const localized = t.has(`endpoints.${ep.slug}.description`)
        ? t(`endpoints.${ep.slug}.description`)
        : "";
      const matchesSearch =
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        localized.toLowerCase().includes(q);
      const matchesGroup = activeGroup === "All" || ep.group === activeGroup;
      return matchesSearch && matchesGroup;
    });
  }, [search, activeGroup, t]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-muted/10 p-4 shrink-0 overflow-x-auto md:overflow-y-auto">
          <nav className="flex md:flex-col gap-1 min-w-max md:min-w-0">
            <button
              onClick={() => setActiveGroup("All")}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-md transition-colors text-left",
                activeGroup === "All"
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {t("allGroups")}
            </button>
            {API_GROUPS.map((group) => (
              <button
                key={group}
                onClick={() => setActiveGroup(group)}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors text-left",
                  activeGroup === group
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {groupLabel(group, t)}
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground font-medium mb-4">
                {filteredEndpoints.length} {t("endpointCount")}
              </p>

              {filteredEndpoints.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-border rounded-xl">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium">{t("noEndpoints")}</h3>
                  <p className="text-muted-foreground">{t("noEndpointsDesc")}</p>
                </div>
              ) : (
                filteredEndpoints.map((ep, i) => (
                  <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} t={t} />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
