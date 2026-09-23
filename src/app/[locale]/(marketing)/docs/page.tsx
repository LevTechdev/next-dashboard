"use client";

import { use } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  CreditCard,
  FileCode2,
  Globe,
  KeyRound,
  Rocket,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

const TOPICS = [
  {
    key: "quickstart",
    href: "/docs/api",
    icon: Rocket,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    key: "authentication",
    href: "/docs/api",
    icon: KeyRound,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    key: "restApi",
    href: "/docs/api",
    icon: FileCode2,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    key: "webhooks",
    href: "/docs/api",
    icon: Webhook,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    key: "payments",
    href: "/docs/api",
    icon: CreditCard,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    key: "multiCurrency",
    href: "/docs/api",
    icon: Globe,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  { key: "sdks", href: "/docs/api", icon: Boxes, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  {
    key: "security",
    href: "/docs/api",
    icon: ShieldCheck,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
  },
];

function MicroCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(4px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: easeSmooth }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function DocsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("docsPage");

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden min-h-screen">
      {/* ── HERO ── */}
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
            <BookOpen className="h-3.5 w-3.5" />
            {t("heroTag")}
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            {t("heroTitle")}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("heroSubtitle")}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/docs/api`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition"
            >
              <Terminal className="h-4 w-4" />
              {t("openApiDocs")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── QUICKSTART SNIPPET ── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-16 max-w-5xl mx-auto">
        <MicroCard className="rounded-2xl border border-border bg-background overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            <span className="ml-2 text-[11px] font-mono text-muted-foreground">quickstart.sh</span>
          </div>
          <pre className="p-4 sm:p-5 overflow-x-auto text-[13px] leading-relaxed font-mono text-muted-foreground">
            <code>{t("quickstartCurl")}</code>
          </pre>
        </MicroCard>
      </section>

      {/* ── TOPIC CARDS ── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <MicroCard className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t("topicsTitle")}
          </h2>
          <p className="mt-3 text-muted-foreground text-sm">{t("topicsSubtitle")}</p>
        </MicroCard>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOPICS.map((topic, i) => {
            const Icon = topic.icon;
            return (
              <MicroCard key={topic.key} delay={i * 0.05}>
                <Link
                  href={`/${locale}${topic.href}`}
                  className={cn(
                    "group flex h-full flex-col gap-3 rounded-2xl border border-border bg-background p-5",
                    "transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10",
                  )}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110",
                      topic.bg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", topic.color)} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      {t(`topics.${topic.key}.title`)}
                      <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
                    </h3>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                      {t(`topics.${topic.key}.desc`)}
                    </p>
                  </div>
                </Link>
              </MicroCard>
            );
          })}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
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
            <Link
              href={`/${locale}/register`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
            >
              {t("ctaButton")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
