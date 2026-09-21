"use client";

import { use, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, X, ArrowRight, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DiaTextReveal } from "@/components/sora-ui/texts/dia-text-reveal";
import { AnimatedHeading, AnimatedSubtitle } from "@/components/ui/animated-heading";
import { StratusFaq } from "@/components/home/stratus-faq";
import { FxSettlementPanel } from "@/components/billing/fx-settlement-panel";
import { useCurrency } from "@/components/currency-provider";
import { CURRENCIES, type SupportedCurrencyCode } from "@/lib/currency";

/**
 * Which currency a visitor lands on. The list price stays in USD (that is what
 * is charged), but a buyer deciding in Jakarta, Tokyo or Shanghai should not
 * have to do the arithmetic in their head.
 */
const LOCALE_CURRENCY: Record<string, SupportedCurrencyCode> = {
  id: "IDR",
  ja: "JPY",
  zh: "CNY",
};

/** Cheap orderings: most-used first, so the common case is one glance away. */
const CURRENCY_CHOICES: SupportedCurrencyCode[] = ["USD", "IDR", "JPY", "EUR", "SGD", "CNY"];

const PLAN_META = [
  { key: "starter", popular: false, monthly: 29, yearly: 23 },
  { key: "professional", popular: true, monthly: 79, yearly: 63 },
  { key: "enterprise", popular: false, monthly: 199, yearly: 159 },
];

export type PlanMeta = { name: string; desc: string; features: string[] };

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const t = useTranslations("pricingPage");
  const { locale } = use(params);
  const router = useRouter();
  const [isAnnual, setIsAnnual] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // Live mid-market conversion for the "≈ Rp …" line under each list price.
  const { currency, setCurrency, formatMoney, ratesStale, ratesSourceLabel, ratesSource } =
    useCurrency();
  // Follow the visitor's locale until they pick a currency themselves — after
  // that, a locale-based default would fight them on every re-render.
  const pickedCurrency = useRef(false);
  const planMeta = t.raw("plans") as Record<string, PlanMeta>;
  const compareCols = t.raw("compareCols") as string[];
  const compareRows = t.raw("compareRows") as string[][];

  useEffect(() => {
    if (pickedCurrency.current) return;
    const preferred = LOCALE_CURRENCY[locale];
    if (preferred) setCurrency(preferred);
    // Locale changes are a deliberate navigation, so re-default then.
  }, [locale, setCurrency]);

  const chooseCurrency = (code: SupportedCurrencyCode) => {
    pickedCurrency.current = true;
    setCurrency(code);
  };

  const handleSubscribe = async (planKey: string) => {
    if (planKey === "enterprise") {
      router.push(`/${locale}/register`);
      return;
    }
    setLoadingKey(planKey);
    try {
      const plansRes = await fetch("/api/billing/plans");
      const plans = await plansRes.json();
      const plan = plans.find((p: any) => p.name.toLowerCase() === planKey.toLowerCase());

      if (!plan) {
        toast.error(t("toastPlanNotFound"));
        return;
      }

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, locale }),
      });

      if (res.status === 401 || res.status === 403) {
        router.push(`/${locale}/register`);
        return;
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || t("toastCheckoutFailed"));
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden min-h-screen">
      {/* ───────────────────── HERO ───────────────────── */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6 shadow-sm">
            <Star className="h-3.5 w-3.5" />
            {t("heroTag")}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            <AnimatedHeading text={t("heroPrefix")} delay={0.15} />
            <br className="hidden sm:block" />
            <span className="text-primary inline-flex">
              {/* Real hero copy, revealed by the chromatic sweep. */}
              <DiaTextReveal
                text={[t("heroWord1"), t("heroWord2"), t("heroWord3")]}
                repeat
                fixedWidth
                duration={1.1}
                holdDuration={1.9}
                colors={[
                  "hsl(var(--primary))",
                  "color-mix(in oklab, hsl(var(--primary)) 45%, #fff)",
                  "hsl(var(--primary))",
                ]}
                textColor="hsl(var(--primary))"
                className="text-4xl font-bold sm:text-5xl md:text-6xl"
              />
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            <AnimatedSubtitle text={t("heroSubtitle")} delay={0.45} />
          </p>

          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("fxCurrencyLabel")}
            </span>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-sm">
              {CURRENCY_CHOICES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => chooseCurrency(code)}
                  aria-pressed={currency === code}
                  data-testid={`fx-currency-${code}`}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    currency === code
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {CURRENCIES[code].symbol} {code}
                </button>
              ))}
            </div>
            {currency !== "USD" && (
              <span className="text-[11px] text-muted-foreground">
                {ratesStale
                  ? t("fxStale")
                  : t("fxSource", { source: ratesSourceLabel || ratesSource })}
              </span>
            )}
          </div>

          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-background border border-border shadow-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-5 py-2 text-sm font-medium rounded-full transition-colors",
                !isAnnual
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("monthly")}
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-5 py-2 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-1.5",
                isAnnual
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("yearly")}
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                  isAnnual
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {t("yearlyDiscount")}
              </span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ──────── PRICING CARDS ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLAN_META.map((plan, i) => {
            const meta = planMeta[plan.key];
            const price = isAnnual ? plan.yearly : plan.monthly;

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: easeSmooth }}
                className={cn(
                  "rounded-3xl border p-8 flex flex-col relative",
                  plan.popular
                    ? "border-primary shadow-xl bg-foreground text-background"
                    : "border-border bg-background text-foreground",
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-8 -translate-y-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                      {t("mostPopular")}
                    </span>
                  </div>
                )}

                <h3 className="text-xl font-bold mb-2">{meta.name}</h3>
                <p
                  className={cn(
                    "text-sm mb-6",
                    plan.popular ? "opacity-80" : "text-muted-foreground",
                  )}
                >
                  {meta.desc}
                </p>

                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold">${price}</span>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      plan.popular ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {t("perMonth")}
                  </span>
                </div>

                {currency !== "USD" && (
                  <p
                    data-testid={`fx-price-${plan.key}`}
                    data-currency={currency}
                    className={cn(
                      "-mt-6 mb-8 text-sm",
                      plan.popular ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {t("fxEquivalent", { amount: formatMoney(price) })}
                  </p>
                )}

                <button
                  onClick={() => handleSubscribe(plan.key)}
                  disabled={loadingKey === plan.key}
                  className={cn(
                    "w-full py-3 rounded-full text-sm font-semibold text-center transition mb-8 flex justify-center items-center gap-2",
                    plan.popular
                      ? "bg-background text-foreground hover:bg-muted"
                      : "bg-foreground text-background hover:opacity-90",
                    loadingKey === plan.key ? "opacity-70 cursor-not-allowed" : "",
                  )}
                >
                  {loadingKey === plan.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {plan.key === "enterprise" ? t("contactSales") : t("getStarted")}
                </button>

                <div className="flex-1">
                  <p
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider mb-4",
                      plan.popular ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {t("featuresIncluded")}
                  </p>
                  <ul className="space-y-4">
                    {meta.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm">
                        <Check
                          className={cn(
                            "h-4 w-4 flex-shrink-0 mt-0.5",
                            plan.popular ? "text-primary-foreground opacity-80" : "text-primary",
                          )}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ──────── WHAT IT COSTS IN LOCAL MONEY ──────── */}
      {currency === "IDR" && (
        <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
          <FxSettlementPanel
            // The plan most people are deciding between, at the selected period.
            amountUsd={
              isAnnual
                ? (PLAN_META.find((p) => p.popular)?.yearly ?? PLAN_META[1].yearly)
                : (PLAN_META.find((p) => p.popular)?.monthly ?? PLAN_META[1].monthly)
            }
            periodLabel={isAnnual ? t("fxPerYear") : t("perMonth")}
          />
        </section>
      )}

      {/* ──────── COMPARISON TABLE ──────── */}
      <section
        id="comparison"
        className="px-4 sm:px-6 lg:px-12 py-24 max-w-7xl mx-auto border-t border-border"
      >
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4">
            {t("compareTitle")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("compareSubtitle")}</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {compareCols.map((col, i) => (
                  <th
                    key={col}
                    className={cn(
                      i === 0 && "text-left",
                      i !== 0 && "text-center",
                      "py-4 px-6 font-semibold",
                      i === 2 ? "text-primary" : "text-foreground",
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {compareRows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition-colors">
                  <td className="py-4 px-6 font-medium text-foreground">{row[0]}</td>
                  {row.slice(1).map((cell, j) => (
                    <td key={j} className="text-center py-4 px-6 text-muted-foreground">
                      {cell === "Yes" ? (
                        <Check className="h-4 w-4 mx-auto text-primary" />
                      ) : cell === "-" ? (
                        <X className="h-4 w-4 mx-auto text-muted-foreground/30" />
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ──────── FAQ — same Stratus design as the homepage, pricing items ──────── */}
      <div className="border-t border-border">
        <StratusFaq
          t={t}
          defaultOpenIndex={null}
          items={[
            { id: "pricing-faq-1", question: t("faqQ1"), answer: t("faqA1") },
            { id: "pricing-faq-2", question: t("faqQ2"), answer: t("faqA2") },
            { id: "pricing-faq-3", question: t("faqQ3"), answer: t("faqA3") },
            { id: "pricing-faq-4", question: t("faqQ4"), answer: t("faqA4") },
          ]}
          badgeKey="faqBadge"
          titlePart1Key="faqTitlePart1"
          titlePart2Key="faqTitlePart2"
        />
      </div>

      {/* ──────── BOTTOM CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">{t("ctaDesc")}</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                {t("ctaButton")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
