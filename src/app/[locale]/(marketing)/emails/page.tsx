import type { Metadata } from "next";
import Link from "next/link";

/**
 * Email template gallery — design-review surface rendering every
 * transactional email with representative sample data.
 *
 * Sample data only (static strings, fake OTP) — nothing user-specific is
 * ever rendered here, so the route stays public. The raw HTML lives in
 * src/app/api/emails/[template]/route.ts so it is also reachable directly
 * for tooling; this page embeds each template in a sandboxed iframe.
 * Locale switching is server-rendered via ?locale= searchParams.
 */

export const metadata: Metadata = {
  title: "Email Templates — Design Review",
  description: "Preview every transactional email with sample data.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TEMPLATES: Array<{ slug: string; name: string; desc: string }> = [
  {
    slug: "verify-email",
    name: "Verify your email",
    desc: "10-minute OTP code sent at signup and on demand.",
  },
  {
    slug: "reset-password",
    name: "Reset password",
    desc: "1-hour reset link from the forgot-password flow.",
  },
  {
    slug: "new-sign-in",
    name: "New sign-in alert",
    desc: "Fires on unrecognized device/IP — WIB·WITA·WIT time, location, device.",
  },
  {
    slug: "welcome",
    name: "Welcome",
    desc: "Post-verification onboarding nudge with dashboard CTA.",
  },
  {
    slug: "invoice",
    name: "Invoice receipt",
    desc: "Payment confirmation with plan and amount summary.",
  },
];

const LOCALES = ["en", "id", "ja", "zh"] as const;
type GalleryLocale = (typeof LOCALES)[number];

export default async function EmailGalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ locale?: string }>;
}) {
  const { locale: rawLocale } = await searchParams;
  const locale: GalleryLocale = LOCALES.includes(rawLocale as GalleryLocale)
    ? (rawLocale as GalleryLocale)
    : "en";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-10 px-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-300 dark:border-lime-800 bg-lime-50 dark:bg-lime-950/40 px-3 py-1 text-xs font-semibold text-lime-700 dark:text-lime-300">
            Design review · sample data only
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Transactional email templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Every transactional email rendered with representative sample data through
            @react-email/components. Raw HTML for each template is available at{" "}
            <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 text-xs">
              /api/emails/[template]?locale={locale}
            </code>{" "}
            for snapshot tooling.
          </p>
        </header>

        <nav aria-label="Preview language" className="flex flex-wrap items-center gap-1.5 mb-8">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400 mr-1">
            Language
          </span>
          {LOCALES.map((loc) => (
            <Link
              key={loc}
              href={`/emails?locale=${loc}`}
              aria-current={loc === locale ? "true" : undefined}
              className={
                loc === locale
                  ? "rounded-md border border-lime-500 bg-lime-500/10 px-2.5 py-1 text-xs font-semibold text-lime-700 dark:text-lime-400"
                  : "rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:border-lime-400 hover:text-lime-700 dark:hover:text-lime-400 transition-colors"
              }
            >
              {loc.toUpperCase()}
            </Link>
          ))}
        </nav>

        <div className="space-y-10">
          {TEMPLATES.map((tpl) => (
            <section key={tpl.slug} aria-labelledby={`tpl-${tpl.slug}`}>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                <div>
                  <h2
                    id={`tpl-${tpl.slug}`}
                    className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
                  >
                    {tpl.name}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{tpl.desc}</p>
                </div>
                <a
                  href={`/api/emails/${tpl.slug}?locale=${locale}`}
                  className="text-xs font-medium text-lime-700 dark:text-lime-400 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open raw HTML ↗
                </a>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4 shadow-sm overflow-hidden">
                <iframe
                  title={`${tpl.name} preview (${locale})`}
                  src={`/api/emails/${tpl.slug}?locale=${locale}`}
                  className="w-full h-[560px] rounded-xl border-0 bg-white"
                  sandbox="allow-same-origin"
                  loading="lazy"
                />
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 text-xs text-zinc-400 dark:text-zinc-600">
          Sample data is static — no real users, OTPs, or PII. Templates live in{" "}
          <code className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5">src/emails/</code> and
          render through the shared EmailLayout.
        </footer>
      </div>
    </div>
  );
}
