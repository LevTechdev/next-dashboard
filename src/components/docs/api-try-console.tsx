"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Check, Copy, KeyRound, Loader2, Play, RotateCcw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiEndpoint } from "@/lib/api-docs-data";

/** Cap the rendered response body so huge list endpoints don't melt the DOM. */
const MAX_DISPLAY_CHARS = 50_000;

/** Sandbox keys are remembered per browser so readers don't re-paste each time. */
const SANDBOX_KEY_STORAGE = "docs.v1.sandbox-key";

const STATUS_STYLES: Record<number, string> = {
  2: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  4: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  5: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
};

function statusStyle(status: number): string {
  return STATUS_STYLES[Math.floor(status / 100)] || STATUS_STYLES[4];
}

/** Skeleton JSON body pre-filled from the documented request fields. */
function defaultBody(endpoint: ApiEndpoint): string {
  if (!endpoint.requestBody) return "";
  const obj: Record<string, string> = {};
  for (const key of Object.keys(endpoint.requestBody)) obj[key] = "...";
  return JSON.stringify(obj, null, 2);
}

interface TryResult {
  status: number;
  ok: boolean;
  latencyMs: number;
  bodyText: string;
  isJson: boolean;
}

/**
 * Try-it console for the public API reference.
 *
 * Executes the request with `fetch` on the current origin — the dashboard's
 * httpOnly session cookie (sameSite=lax) is sent automatically, so a signed-in
 * reader exercises the exact same authenticated surface their apps would hit
 * with an API key. Mutating methods (POST/PUT/PATCH/DELETE) require a second
 * confirming click before anything is sent.
 */
export function ApiTryConsole({ endpoint }: { endpoint: ApiEndpoint }) {
  const t = useTranslations("apiDocsPage");
  const locale = useLocale();

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [armed, setArmed] = useState(false);
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState(() => defaultBody(endpoint));
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [result, setResult] = useState<TryResult | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sandbox (/v1) endpoints authenticate with an API key instead of the
  // dashboard session cookie.
  const isKeyAuth = !!endpoint.sandbox;
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(SANDBOX_KEY_STORAGE) ?? "";
    } catch {
      return "";
    }
  });
  const [curlCopied, setCurlCopied] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const isMutation = endpoint.method !== "GET";

  const url = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryValues)) {
      if (value.trim() !== "") params.set(key, value.trim());
    }
    const qs = params.toString();
    return endpoint.path + (qs ? `?${qs}` : "");
  }, [endpoint.path, queryValues]);

  /** Copy-pasteable cURL with the real key kept out — placeholder instead. */
  const curlSnippet = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const parts = [`curl -X ${endpoint.method} "${origin}${url}"`];
    if (isKeyAuth) parts.push(`  -H "Authorization: Bearer dash_your_api_key"`);
    if (endpoint.requestBody) {
      parts.push(`  -H "Content-Type: application/json"`);
      parts.push(`  -d '${bodyText.replace(/\n\s*/g, "")}'`);
    }
    return parts.join(" \\\n");
  }, [endpoint.method, endpoint.requestBody, url, bodyText, isKeyAuth]);

  const reset = () => {
    setResult(null);
    setRequestError(null);
    setBodyError(null);
    setArmed(false);
  };

  const send = async () => {
    // Mutations arm first, fire on the second click — no silent writes.
    if (isMutation && !armed) {
      setArmed(true);
      return;
    }
    setArmed(false);

    // Sandbox endpoints authenticate with the key the reader typed in.
    const headers: Record<string, string> = {};
    if (isKeyAuth) {
      if (!apiKey.trim()) {
        setKeyError(t("try.keyRequired"));
        return;
      }
      try {
        window.localStorage.setItem(SANDBOX_KEY_STORAGE, apiKey.trim());
      } catch {
        // Storage may be unavailable (private mode) — sending still works.
      }
      headers.Authorization = `Bearer ${apiKey.trim()}`;
    }

    let body: string | undefined;
    if (endpoint.requestBody) {
      try {
        JSON.parse(bodyText);
        setBodyError(null);
        body = bodyText;
      } catch {
        setBodyError(t("try.invalidJson"));
        return;
      }
    }
    if (body) headers["Content-Type"] = "application/json";

    setSending(true);
    setRequestError(null);
    try {
      const started = performance.now();
      const res = await fetch(url, {
        method: endpoint.method,
        credentials: "same-origin",
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(body ? { body } : {}),
      });
      const latencyMs = Math.round(performance.now() - started);
      const text = await res.text();
      let isJson = false;
      try {
        JSON.parse(text);
        isJson = true;
      } catch {
        // Not JSON (plain text / empty) — render as-is.
      }
      setResult({
        status: res.status,
        ok: res.ok,
        latencyMs,
        bodyText: text.length > MAX_DISPLAY_CHARS ? `${text.slice(0, MAX_DISPLAY_CHARS)}…` : text,
        isJson,
      });
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const copyResponse = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.bodyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(curlSnippet);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Console header / trigger */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <Play className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold text-foreground">{t("try.title")}</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
        <span
          className={cn(
            "text-muted-foreground text-xs shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("try.hint")}
            {!endpoint.requiresAuth && (
              <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">
                {t("try.noAuth")}
              </span>
            )}
          </p>

          {/* Sandbox key input — API-key-authenticated endpoints */}
          {isKeyAuth && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("try.apiKeyLabel")}
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="password"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setKeyError(null);
                      reset();
                    }}
                    placeholder="dash_…"
                    className={cn(
                      "w-full h-8 pl-8 pr-2.5 rounded-lg bg-background border text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40",
                      keyError ? "border-red-500/50" : "border-border",
                    )}
                  />
                </div>
              </div>
              {keyError ? (
                <p className="text-xs text-red-600 dark:text-red-400">{keyError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("try.apiKeyHint")}{" "}
                  <code className="font-mono text-primary">Authorization: Bearer dash_…</code>
                </p>
              )}
            </div>
          )}

          {/* Query parameter inputs */}
          {endpoint.queryParams && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("try.queryParams")}
              </h4>
              {Object.entries(endpoint.queryParams).map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <label
                    className="w-28 shrink-0 font-mono text-xs text-primary truncate"
                    title={desc}
                  >
                    {key}
                  </label>
                  <input
                    type="text"
                    value={queryValues[key] ?? ""}
                    onChange={(e) => {
                      setQueryValues((prev) => ({ ...prev, [key]: e.target.value }));
                      reset();
                    }}
                    placeholder={desc}
                    className="flex-1 h-8 px-2.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground placeholder:text-muted-foreground placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Request body editor */}
          {endpoint.requestBody && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("try.requestBody")}
                </h4>
                <button
                  onClick={() => {
                    setBodyText(defaultBody(endpoint));
                    reset();
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t("try.reset")}
                </button>
              </div>
              <textarea
                value={bodyText}
                onChange={(e) => {
                  setBodyText(e.target.value);
                  reset();
                }}
                rows={Math.min(10, bodyText.split("\n").length + 1)}
                spellCheck={false}
                className={cn(
                  "w-full rounded-lg bg-gray-950 dark:bg-black border p-3 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y",
                  bodyError ? "border-red-500/50" : "border-border",
                )}
              />
              {bodyError && <p className="text-xs text-red-600 dark:text-red-400">{bodyError}</p>}
            </div>
          )}

          {/* Send row */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={send}
              disabled={sending}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed",
                isMutation && armed
                  ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
              )}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isMutation && armed ? (
                <TriangleAlert className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {sending
                ? t("try.sending")
                : isMutation && armed
                  ? t("try.confirmSend")
                  : t("try.send")}
            </button>

            {isMutation && !armed && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <TriangleAlert className="h-3 w-3 text-amber-500" />
                {t("try.mutatingHint", { method: endpoint.method })}
              </span>
            )}
          </div>

          {/* Error (network) */}
          {requestError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {requestError}
            </div>
          )}

          {/* 401 hint — session cookie missing, or the sandbox key is wrong */}
          {result?.status === 401 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 flex-wrap">
              {isKeyAuth ? (
                <span>{t("try.keyInvalid")}</span>
              ) : (
                <>
                  <span>{t("try.notAuthenticated")}</span>
                  <Link
                    href={`/${locale}/login`}
                    className="font-semibold underline underline-offset-2 hover:text-foreground"
                  >
                    {t("try.signIn")}
                  </Link>
                </>
              )}
            </div>
          )}

          {/* Response viewer */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border",
                    statusStyle(result.status),
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      result.ok ? "bg-emerald-500" : "bg-amber-500",
                    )}
                  />
                  {result.status}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {result.latencyMs} {t("try.ms")}
                </span>
                <button
                  onClick={copyResponse}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? t("try.copied") : t("try.copy")}
                </button>
              </div>
              <pre className="rounded-lg bg-gray-950 dark:bg-black p-3 overflow-x-auto text-xs font-mono text-emerald-400 max-h-80 overflow-y-auto">
                <code>
                  {result.isJson && result.bodyText
                    ? JSON.stringify(JSON.parse(result.bodyText), null, 2)
                    : result.bodyText || t("try.emptyBody")}
                </code>
              </pre>
            </div>
          )}

          {/* cURL equivalent — key placeholder, never the real secret */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("try.curlTitle")}
              </h4>
              <button
                onClick={copyCurl}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                {curlCopied ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {curlCopied ? t("try.copied") : t("try.copy")}
              </button>
            </div>
            <pre className="rounded-lg bg-gray-950 dark:bg-black p-3 overflow-x-auto text-xs font-mono text-emerald-400">
              <code>{curlSnippet}</code>
            </pre>
            {isKeyAuth && (
              <p className="text-[11px] text-muted-foreground">{t("try.curlKeyPlaceholder")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
