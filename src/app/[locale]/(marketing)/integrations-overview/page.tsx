"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  CheckIcon,
  ArrowRightIcon,
  ZapIcon,
  EarthIcon,
  CreditCardIcon,
  MessageSquareIcon,
  DatabaseIcon,
  LayersIcon,
  SparklesIcon,
  PlugZapIcon,
} from "lucide-animated";
import { ShoppingCart, Mail, Cloud, BarChart3, Share2, Plug, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimateSection, AnimateUp, buttonTap } from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { FlipRevealText } from "@/components/ui/flip-reveal-text";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";

interface Integration {
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
  popular: boolean;
  color: string;
}

export const integrations: Integration[] = [
  {
    name: "Stripe",
    description: "Process payments, manage subscriptions, and handle invoicing seamlessly.",
    icon: CreditCardIcon as LucideIcon,
    category: "Payments",
    popular: true,
    color: "from-purple-500/20 to-blue-500/20",
  },
  {
    name: "Shopify",
    description: "Sync orders, products, and inventory from your Shopify store in real time.",
    icon: ShoppingCart,
    category: "E-commerce",
    popular: true,
    color: "from-emerald-500/20 to-teal-500/20",
  },
  {
    name: "SendGrid",
    description: "Send transactional emails, notifications, and marketing campaigns at scale.",
    icon: Mail,
    category: "Email",
    popular: false,
    color: "from-blue-500/20 to-indigo-500/20",
  },
  {
    name: "Slack",
    description: "Get real-time alerts, order updates, and team notifications in your channels.",
    icon: MessageSquareIcon as LucideIcon,
    category: "Communication",
    popular: true,
    color: "from-amber-500/20 to-orange-500/20",
  },
  {
    name: "PostgreSQL",
    description: "Connect your existing database for custom analytics and reporting.",
    icon: DatabaseIcon as LucideIcon,
    category: "Data",
    popular: false,
    color: "from-cyan-500/20 to-blue-500/20",
  },
  {
    name: "AWS",
    description: "Deploy and scale your infrastructure with AWS cloud services.",
    icon: Cloud,
    category: "Infrastructure",
    popular: false,
    color: "from-orange-500/20 to-yellow-500/20",
  },
  {
    name: "Google Analytics",
    description: "Track traffic, user behavior, and conversion metrics alongside your data.",
    icon: BarChart3,
    category: "Analytics",
    popular: false,
    color: "from-yellow-500/20 to-amber-500/20",
  },
  {
    name: "Zapier",
    description: "Connect 3,000+ apps and automate workflows without writing code.",
    icon: ZapIcon as LucideIcon,
    category: "Automation",
    popular: true,
    color: "from-indigo-500/20 to-purple-500/20",
  },
  {
    name: "Facebook & Instagram",
    description: "Manage orders and ads from your social commerce channels in one place.",
    icon: Share2,
    category: "Social",
    popular: false,
    color: "from-blue-500/20 to-sky-500/20",
  },
];

export const categories = [
  {
    name: "E-commerce & POS",
    description:
      "Connect your online store and point-of-sale systems for unified order management.",
    icon: ShoppingCart,
    count: "12 integrations",
  },
  {
    name: "Payments & Billing",
    description: "Process payments, manage subscriptions, and automate invoicing workflows.",
    icon: CreditCardIcon,
    count: "8 integrations",
  },
  {
    name: "Communication",
    description: "Keep your team and customers informed with real-time messaging and alerts.",
    icon: MessageSquareIcon,
    count: "6 integrations",
  },
  {
    name: "Data & Infrastructure",
    description: "Sync, store, and analyze your data across cloud services and databases.",
    icon: DatabaseIcon,
    count: "14 integrations",
  },
  {
    name: "Marketing & Analytics",
    description: "Track performance, understand your audience, and optimize campaigns.",
    icon: BarChart3,
    count: "10 integrations",
  },
  {
    name: "Automation & Workflows",
    description: "Connect thousands of apps and automate repetitive tasks effortlessly.",
    icon: ZapIcon,
    count: "20+ integrations",
  },
];

const easeSmooth = [0.16, 1, 0.3, 1] as const;
const springGentle = { type: "spring" as const, stiffness: 100, damping: 20 };

export default function IntegrationsOverviewPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { theme } = useTheme();
  const { trackCTA } = useAnalytics();
  const t = useTranslations("integrationsPage");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const ctaHref = `/${locale}/dashboard`;
  const isDark = mounted && theme === "dark";

  return (
    <div className="pt-16 lg:pt-20">
      {/* ════════════════════════
          CINEMATIC HEADER with AnimatedRays + FlipFadeText + AnimatedGridPattern
          ════════════════════════ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        {/* VengenceUI AnimatedRays Background */}
        <div className="absolute inset-0 h-[130%] opacity-30 dark:opacity-50">
          <AnimatedRays className="w-full h-full" />
        </div>

        {/* Magic UI AnimatedGridPattern overlay */}
        <AnimatedGridPattern
          className="absolute inset-0 h-full w-full fill-gray-400/[0.02] stroke-gray-400/[0.03] dark:fill-white/[0.02] dark:stroke-white/[0.03]"
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          repeatDelay={1}
        />

        {/* Ambient background */}
        <div className="absolute inset-0 mesh-gradient-dark dark:mesh-gradient-dark mesh-gradient-light pointer-events-none" />
        {mounted && isDark && (
          <>
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-indigo-500/8 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-purple-500/6 rounded-full blur-[120px] pointer-events-none" />
          </>
        )}

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: easeSmooth as any },
                },
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <PlugZapIcon size={14} className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                {t("badge")}
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: easeSmooth as any },
                },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 max-w-4xl mx-auto"
            >
              {t("heroPrefix")}&nbsp;
              <span className="inline-flex">
                <FlipRevealText
                  words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                  interval={2800}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                />
              </span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.5, ease: easeSmooth as any },
                },
              }}
              className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
            >
              {t("heroSubtitle")}
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          INTEGRATION GRID with hover micro-interactions
          ════════════════════════ */}
      <AnimateSection className="-mt-8 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {integrations.map((integration, idx) => {
              const Icon = integration.icon;
              return (
                <motion.div
                  key={integration.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.5,
                    delay: idx * 0.05,
                    ease: easeSmooth as any,
                  }}
                  className="feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-0.5 group"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                  }}
                >
                  {/* Hover glow overlay */}
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl z-10"
                    style={{
                      background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(99,102,241,0.08), transparent 40%)`,
                    }}
                  />

                  <div className="relative z-20 bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-2px)] p-5 flex flex-col h-full transition-colors">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br",
                          integration.color,
                        )}
                      >
                        <Icon size={20} className="h-5 w-5 text-zinc-700 dark:text-zinc-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                            {integration.name}
                          </h3>
                          {integration.popular && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                              {t("popular")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                          {integration.description}
                        </p>
                      </div>
                    </div>

                    {/* Perpetual floating indicator on popular items */}
                    {integration.popular && (
                      <motion.div
                        className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-indigo-500"
                        animate={{
                          scale: [1, 1.5, 1],
                          opacity: [0.4, 0.8, 0.4],
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      />
                    )}

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        {integration.category}
                      </span>
                      <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors flex items-center gap-1">
                        {t("connect")}
                        <motion.span
                          className="inline-flex"
                          animate={{ x: 0 }}
                          whileHover={{ x: 3 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ArrowRightIcon size={12} className="h-3 w-3" />
                        </motion.span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          CATEGORIES BENTO
          ════════════════════════ */}
      <AnimateSection className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-4">
                <LayersIcon
                  size={14}
                  className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400"
                />
                <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                  {t("catBadge")}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
                {t("catTitle")}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
                {t("catSubtitle")}
              </p>
            </div>
          </AnimateUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category, idx) => {
              const Icon = category.icon;
              return (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.5,
                    delay: idx * 0.06,
                    ease: easeSmooth as any,
                  }}
                  className="feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-0.5 group"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                  }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl z-10"
                    style={{
                      background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(99,102,241,0.08), transparent 40%)`,
                    }}
                  />

                  <div className="relative z-20 bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-2px)] p-5 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-zinc-800/80 flex items-center justify-center">
                        <Icon size={16} className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {category.name}
                        </h3>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {category.count}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {category.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          FEATURES HIGHLIGHTS
          ════════════════════════ */}
      <AnimateSection className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="double-bezel">
            <div className="double-bezel-inner">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                <AnimateUp>
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-4">
                      <SparklesIcon
                        size={12}
                        className="h-3 w-3 text-indigo-500 dark:text-indigo-400"
                      />
                      <span className="text-[10px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                        {t("featBadge")}
                      </span>
                    </div>
                    <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
                      {t("featTitle")}
                    </h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed mb-6">
                      {t("featDesc")}
                    </p>
                    <div className="space-y-3">
                      {[t("feat1"), t("feat2"), t("feat3"), t("feat4"), t("feat5"), t("feat6")].map(
                        (feature) => (
                          <div key={feature} className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                              <CheckIcon
                                size={12}
                                className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                              />
                            </div>
                            <span className="text-xs text-zinc-600 dark:text-zinc-300">
                              {feature}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </AnimateUp>

                <AnimateUp delay={0.1}>
                  <div className="relative">
                    <div className="double-bezel">
                      <div className="double-bezel-inner !space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 dark:border-zinc-800/60">
                          <div className="flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                          </div>
                          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 ml-2">
                            integration-status
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {[
                            {
                              name: "Stripe",
                              status: t("statusConnected"),
                              color: "text-emerald-600 dark:text-emerald-400",
                            },
                            {
                              name: "Shopify",
                              status: t("statusConnected"),
                              color: "text-emerald-600 dark:text-emerald-400",
                            },
                            {
                              name: "Slack",
                              status: t("statusConnected"),
                              color: "text-emerald-600 dark:text-emerald-400",
                            },
                            {
                              name: "SendGrid",
                              status: t("statusSyncing"),
                              color: "text-amber-600 dark:text-amber-400",
                            },
                            {
                              name: "Zapier",
                              status: t("statusDisconnected"),
                              color: "text-zinc-300 dark:text-zinc-500",
                            },
                          ].map((item) => (
                            <div key={item.name} className="flex items-center justify-between">
                              <span className="text-xs text-zinc-600 dark:text-zinc-300">
                                {item.name}
                              </span>
                              <span className={cn("text-[10px] font-medium", item.color)}>
                                {item.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="absolute -top-3 -right-3 w-20 h-20 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
                  </div>
                </AnimateUp>
              </div>
            </div>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          API SECTION
          ════════════════════════ */}
      <AnimateSection className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <AnimateUp>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-100 dark:bg-zinc-800/80 mb-4">
                <EarthIcon size={20} className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
                {t("apiTitle")}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">{t("apiDesc")}</p>
              <Link href={ctaHref}>
                <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                  <Button className="h-10 px-6 text-xs gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium shadow-xl shadow-zinc-900/20 dark:shadow-black/20 press-scale">
                    {t("apiButton")}
                    <ArrowRightIcon size={14} className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              </Link>
            </AnimateUp>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          INTEGRATION STATS with Animated Counters
          ════════════════════════ */}
      <AnimateSection className="py-14 border-t border-border bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { labelKey: "statTotal", end: 70, icon: Plug, suffix: "+" },
              {
                labelKey: "statConnections",
                end: 12400,
                icon: BarChart3,
                format: (v: number) => `${(v / 1000).toFixed(1)}K`,
              },
              {
                labelKey: "statRequests",
                end: 2500000,
                icon: ZapIcon,
                format: (v: number) => `${(v / 1000000).toFixed(1)}M`,
              },
              { labelKey: "statPlatforms", end: 6, icon: EarthIcon, suffix: "+" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.labelKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: easeSmooth as any }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 mb-3">
                    <Icon size={16} className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    <AnimatedCounter
                      end={stat.end}
                      duration={2000}
                      {...(stat.format ? { formatter: stat.format } : { suffix: stat.suffix })}
                    />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-medium">
                    {t(stat.labelKey)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          BOTTOM CTA
          ════════════════════════ */}
      <AnimateSection className="pb-20 lg:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="double-bezel !rounded-[2rem]"
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.3 }}
          >
            <div className="double-bezel-inner !rounded-[calc(2rem-0.375rem)] !py-16 relative overflow-hidden">
              <div className="absolute inset-0 mesh-gradient-dark dark:opacity-50 mesh-gradient-light pointer-events-none" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative text-center">
                <AnimateUp>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4">
                    {t("ctaTitle")}
                  </h2>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
                    {t("ctaDesc")}
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium press-scale shadow-xl shadow-zinc-900/20 dark:shadow-black/20"
                        onClick={() => trackCTA("start_connecting", { href: ctaHref })}
                      >
                        {t("ctaButton")}
                        <ArrowRightIcon size={16} className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  </Link>
                </AnimateUp>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimateSection>
    </div>
  );
}
