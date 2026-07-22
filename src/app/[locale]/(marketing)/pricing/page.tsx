"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  Check,
  ArrowRight,
  X,
  Zap,
  Star,
  HelpCircle,
  BarChart3,
  Users,
  Globe,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnimateSection,
  AnimateUp,
  buttonTap,
} from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FaqAccordion, type FaqItem } from "@/components/ui/faq-accordion";

interface PricingTier {
  name: string;
  description: string;
  price: string;
  period: string;
  popular: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
  accent: string;
  gradient: string;
  glowColor: string;
}

const tiers: PricingTier[] = [
  {
    name: "Starter",
    description: "Perfect for small businesses getting started.",
    price: "$29",
    period: "/month",
    popular: false,
    accent: "text-zinc-500 dark:text-zinc-300",
    gradient: "from-zinc-500/10 to-zinc-500/5",
    glowColor: "rgba(113,113,122,0.1)",
    features: [
      { text: "Up to 500 orders/month", included: true },
      { text: "3 team members", included: true },
      { text: "Basic analytics dashboard", included: true },
      { text: "CSV export", included: true },
      { text: "Email support", included: true },
      { text: "Multi-channel orders", included: false },
      { text: "Advanced reports", included: false },
      { text: "Role-based access", included: false },
      { text: "API access", included: false },
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Professional",
    description: "Best for growing businesses with multiple channels.",
    price: "$79",
    period: "/month",
    popular: true,
    accent: "text-indigo-500 dark:text-indigo-400",
    gradient: "from-indigo-500/15 to-indigo-500/5",
    glowColor: "rgba(99,102,241,0.15)",
    features: [
      { text: "Up to 5,000 orders/month", included: true },
      { text: "10 team members", included: true },
      { text: "Advanced analytics & charts", included: true },
      { text: "CSV export", included: true },
      { text: "Priority email & chat support", included: true },
      { text: "Multi-channel orders", included: true },
      { text: "Advanced reports & insights", included: true },
      { text: "Role-based access (Admin/Manager/Staff)", included: true },
      { text: "API access", included: false },
    ],
    cta: "Start Free Trial",
  },
  {
    name: "Enterprise",
    description: "For large organizations with advanced needs.",
    price: "$199",
    period: "/month",
    popular: false,
    accent: "text-purple-500 dark:text-purple-400",
    gradient: "from-purple-500/10 to-purple-500/5",
    glowColor: "rgba(168,85,247,0.1)",
    features: [
      { text: "Unlimited orders", included: true },
      { text: "Unlimited team members", included: true },
      { text: "Real-time analytics dashboard", included: true },
      { text: "CSV export", included: true },
      { text: "24/7 dedicated support", included: true },
      { text: "Multi-channel orders", included: true },
      { text: "Custom reports & insights", included: true },
      { text: "Role-based access (all roles)", included: true },
      { text: "Full API access & webhooks", included: true },
    ],
    cta: "Contact Sales",
  },
];

const faqItems: FaqItem[] = [
  {
    question: "Can I upgrade or downgrade my plan at any time?",
    answer: "Yes, you can change your plan at any time. When upgrading, you'll be billed the prorated difference. When downgrading, the new rate applies at the start of your next billing cycle.",
  },
  {
    question: "Is there a free trial available?",
    answer: "Yes! All plans come with a 14-day free trial. No credit card required. You can explore all features of your chosen plan during the trial period.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit cards, PayPal, and bank transfers for annual plans. All payments are processed securely through Stripe.",
  },
  {
    question: "Can I cancel my subscription?",
    answer: "Yes, you can cancel anytime. Your access will continue until the end of your current billing period.",
  },
];

export default function PricingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { theme } = useTheme();
  const { trackCTA } = useAnalytics();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const ctaHref = `/${locale}/dashboard`;

  return (
    <div className="pt-16 lg:pt-20">
      {/* ════════════════════════
          CINEMATIC HEADER with AnimatedRays + FlipFadeText
          ════════════════════════ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        {/* AnimatedRays Background */}
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

        <div className="absolute inset-0 mesh-gradient-dark dark:mesh-gradient-dark mesh-gradient-light pointer-events-none" />

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
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                Simple Pricing
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 max-w-4xl mx-auto"
            >
              Plans That&nbsp;
              <span className="inline-flex">
                <FlipFadeText
                  words={["scale.", "fit.", "grow.", "deliver."]}
                  interval={3000}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                  staggerDelay={0.06}
                  letterDuration={0.4}
                />
              </span>
            </motion.h1>

            <motion.p
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
            >
              Choose the perfect plan for your business. No hidden fees, no
              surprises. Start with a 14-day free trial.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          PRICING CARDS with MICRO-INTERACTIONS
          ════════════════════════ */}
      <AnimateSection className="-mt-8 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto">
            {tiers.map((tier, idx) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.6,
                  delay: idx * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-0.5 group",
                  tier.popular
                    ? "ring-1 ring-indigo-500/30 dark:ring-indigo-500/40"
                    : ""
                )}
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                  e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                }}
              >
                {/* Popular badge */}
                {tier.popular && (
                  <motion.div
                    className="absolute -top-3 right-4 z-20"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-semibold shadow-lg">
                      <Star className="h-3 w-3 fill-white" />
                      Most Popular
                    </span>
                  </motion.div>
                )}

                {/* Hover glow overlay */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl z-10"
                  style={{
                    background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${tier.glowColor}, transparent 40%)`,
                  }}
                />

                <div className="relative z-20 bg-white dark:bg-zinc-900 rounded-[calc(1.5rem-2px)] p-6 flex flex-col flex-1 transition-colors">
                  {/* Header */}
                  <div className="mb-6">
                    <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
                      {tier.name}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                      {tier.description}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <motion.span
                        className="text-3xl font-bold text-zinc-900 dark:text-white"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{
                          delay: 0.2 + idx * 0.12,
                          duration: 0.4,
                          ease: [0.25, 0.1, 0.25, 1],
                        }}
                      >
                        {tier.price}
                      </motion.span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {tier.period}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1">
                      Billed monthly
                    </p>
                  </div>

                  {/*          CTA */}
                  <Link href={ctaHref} className="mb-6 block">
                    {tier.popular ? (
                      <ShimmerButton
                        className="w-full h-10 text-xs font-medium rounded-xl"
                        shimmerColor="#ffffff"
                        shimmerSize="0.05em"
                        background="rgba(0,0,0,1)"
                        onClick={() => trackCTA(`${tier.name.toLowerCase()}_${tier.cta.toLowerCase().replace(/\s+/g, "_")}`, { href: ctaHref })}
                      >
                        <span className="flex items-center justify-center gap-1.5">
                          {tier.cta}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </ShimmerButton>
                    ) : (
                      <motion.div whileTap={buttonTap} whileHover={{ scale: 1.02 }}>
                        <Button
                          variant="outline"
                          className="w-full h-10 text-xs font-medium rounded-xl border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 press-scale"
                          onClick={() => trackCTA(`${tier.name.toLowerCase()}_${tier.cta.toLowerCase().replace(/\s+/g, "_")}`, { href: ctaHref })}
                        >
                          {tier.cta}
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </Button>
                      </motion.div>
                    )}
                  </Link>

                  {/* Features */}
                  <div className="space-y-3 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
                      Includes
                    </p>
                    {tier.features.map((feature, fIdx) => (
                      <motion.div
                        key={feature.text}
                        className="flex items-start gap-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          delay: 0.3 + fIdx * 0.04 + idx * 0.12,
                          duration: 0.3,
                        }}
                      >
                        {feature.included ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-zinc-300 dark:text-zinc-700 mt-0.5 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-xs",
                            feature.included
                              ? "text-zinc-600 dark:text-zinc-300"
                              : "text-zinc-300 dark:text-zinc-600"
                          )}
                        >
                          {feature.text}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          COMPARISON TABLE
          ════════════════════════ */}
      <AnimateSection className="py-16 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              Compare plans
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Every plan includes a 14-day free trial. No credit card required.
            </p>
          </AnimateUp>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800/60">
                  <th className="text-left py-4 px-5 text-zinc-500 dark:text-zinc-400 font-medium text-xs uppercase tracking-wider">
                    Feature
                  </th>
                  {["Starter", "Professional", "Enterprise"].map((name) => (
                    <th
                      key={name}
                      className="text-center py-4 px-5 text-zinc-800 dark:text-white font-semibold text-xs"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
                {[
                  ["Orders", "500/mo", "5,000/mo", "Unlimited"],
                  ["Team Members", "3", "10", "Unlimited"],
                  ["Analytics", "Basic", "Advanced", "Real-time"],
                  ["Support", "Email", "Priority", "24/7 Dedicated"],
                  ["API Access", "\u2014", "\u2014", "Full"],
                  ["Webhooks", "\u2014", "\u2014", "Full"],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-300 text-xs">
                      {row[0]}
                    </td>
                    {row.slice(1).map((cell, j) => (
                      <td
                        key={j}
                        className={cn(
                          "text-center py-3.5 px-5 text-xs",
                          cell === "\u2014"
                            ? "text-zinc-300 dark:text-zinc-700"
                            : "text-zinc-400 dark:text-zinc-400"
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          FAQ — using VengenceUI FaqAccordion!
          ════════════════════════ */}
      <AnimateSection className="py-20 border-t border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="flex items-center gap-2 justify-center mb-10">
            <HelpCircle className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
              Frequently Asked Questions
            </h2>
          </AnimateUp>

          <FaqAccordion
            items={faqItems}
            title=""
            className="!py-0"
          />
        </div>
      </AnimateSection>

      {/* ════════════════════════
          TRUST METRICS STRIP with Animated Counters
          ════════════════════════ */}
      <AnimateSection className="border-t border-border bg-zinc-50 dark:bg-[#0a0b10]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Businesses Served", end: 2847, icon: BarChart3, format: (v: number) => v.toLocaleString() },
              { label: "Orders Processed", end: 12400000, icon: TrendingUp, format: (v: number) => `${(v/1000000).toFixed(1)}M` },
              { label: "Active Users", end: 8431, icon: Users, format: (v: number) => v.toLocaleString() },
              { label: "Countries", end: 30, icon: Globe, suffix: "+" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] as any }}
                  className="text-center"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/20 mb-3">
                    <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-zinc-900 dark:text-white tabular-nums">
                    <AnimatedCounter end={stat.end} duration={2000} {...(stat.format ? { formatter: stat.format } : { suffix: stat.suffix })} />
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 mt-1 font-medium">
                    {stat.label}
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
      <AnimateSection className="py-20 lg:py-24">
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
                  <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
                    Not Sure Which Plan?
                  </h2>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
                    Start with a 14-day free trial on any plan. No credit card
                    required.
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium press-scale shadow-xl shadow-zinc-900/20 dark:shadow-black/20"
                        onClick={() => trackCTA("go_to_dashboard_pricing", { href: ctaHref })}
                      >
                        Go to Dashboard
                        <ArrowRight className="h-4 w-4" />
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
