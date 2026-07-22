"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  Bug,
  Rocket,
  RefreshCw,
  GitCommit,
  Bell,
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

interface ChangelogEntry {
  version: string;
  date: string;
  tag: string;
  tagColor: string;
  items: {
    type: "feature" | "improvement" | "fix";
    text: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "2.5.0",
    date: "April 14, 2026",
    tag: "Latest Release",
    tagColor: "bg-indigo-500/20 text-indigo-400",
    items: [
      {
        type: "feature",
        text: "Real-time dashboard auto-refresh with Server-Sent Events",
      },
      {
        type: "feature",
        text: "Role-based access control with Admin, Manager, and Staff roles",
      },
      {
        type: "improvement",
        text: "Redesigned analytics charts with interactive tooltips",
      },
      {
        type: "fix",
        text: "Fixed pagination issues on order list exceeding 1000 records",
      },
    ],
  },
  {
    version: "2.4.0",
    date: "March 28, 2026",
    tag: "Feature Release",
    tagColor: "bg-emerald-500/20 text-emerald-400",
    items: [
      {
        type: "feature",
        text: "Multi-channel order management for Facebook, Instagram, and TikTok",
      },
      {
        type: "feature",
        text: "Customer segmentation based on spending patterns",
      },
      {
        type: "improvement",
        text: "Optimized database queries for 40% faster order loading",
      },
      {
        type: "improvement",
        text: "Enhanced CSV export with full UTF-8 support",
      },
    ],
  },
  {
    version: "2.3.0",
    date: "March 10, 2026",
    tag: "Improvement",
    tagColor: "bg-blue-500/20 text-blue-400",
    items: [
      {
        type: "feature",
        text: "Discount engine with code generation and tracking",
      },
      {
        type: "improvement",
        text: "Re-designed notification system with preference controls",
      },
      {
        type: "improvement",
        text: "Updated audit log with detailed action metadata",
      },
      {
        type: "fix",
        text: "Resolved timezone inconsistency in order timestamps",
      },
    ],
  },
  {
    version: "2.2.0",
    date: "February 20, 2026",
    tag: "Feature Release",
    tagColor: "bg-emerald-500/20 text-emerald-400",
    items: [
      {
        type: "feature",
        text: "Bulk order status updates and operations",
      },
      {
        type: "feature",
        text: "Inventory tracking with low-stock alerts",
      },
      {
        type: "improvement",
        text: "Performance improvements on dashboard load times",
      },
      {
        type: "fix",
        text: "Fixed export filename encoding for non-ASCII characters",
      },
    ],
  },
  {
    version: "2.1.0",
    date: "February 5, 2026",
    tag: "Improvement",
    tagColor: "bg-blue-500/20 text-blue-400",
    items: [
      {
        type: "feature",
        text: "Sales channel comparison with side-by-side metrics",
      },
      {
        type: "improvement",
        text: "Responsive design improvements for tablet viewports",
      },
      {
        type: "fix",
        text: "Fixed mobile navigation menu overlap on iOS Safari",
      },
    ],
  },
  {
    version: "2.0.0",
    date: "January 15, 2026",
    tag: "Major Release",
    tagColor: "bg-purple-500/20 text-purple-400",
    items: [
      {
        type: "feature",
        text: "Complete dashboard redesign with real-time analytics",
      },
      {
        type: "feature",
        text: "Team management with role-based permissions",
      },
      {
        type: "feature",
        text: "REST API with webhook support for custom integrations",
      },
      {
        type: "feature",
        text: "Progressive Web App with offline support",
      },
      {
        type: "improvement",
        text: "Migrated to Next.js 16 with improved performance",
      },
    ],
  },
];

export const typeConfig = {
  feature: {
    icon: Sparkles,
    label: "New Feature",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  improvement: {
    icon: Rocket,
    label: "Improvement",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  fix: {
    icon: Bug,
    label: "Bug Fix",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
};

export default function ChangelogPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const ctaHref = `/${locale}/dashboard`;

  return (
    <div className="pt-16 lg:pt-20">
      {/* ════════════════════════
          CINEMATIC HEADER with AnimatedRays + FlipFadeText
          ════════════════════════ */}
      <section className="relative overflow-hidden py-24 lg:py-28">
        <div className="absolute inset-0 h-[130%] opacity-25 dark:opacity-40">
          <AnimatedRays className="w-full h-full" />
        </div>

        <div className="absolute inset-0 mesh-gradient-dark pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-purple-500/6 rounded-full blur-[100px] pointer-events-none" />

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
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700/50 bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest">
                Release Notes
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4 max-w-4xl mx-auto"
            >
              What&apos;s&nbsp;
              <span className="inline-flex">
                <FlipFadeText
                  words={["new.", "shipping.", "improved.", "next."]}
                  interval={2800}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-400 !via-purple-400 !to-pink-400 !font-bold !tracking-tight"
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
              className="text-base lg:text-lg text-zinc-400 max-w-2xl mx-auto"
            >
              Stay up to date with the latest features, improvements, and bug
              fixes. We ship regularly based on your feedback.
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          RELEASE VERSION BADGE
          ════════════════════════ */}
      <AnimateSection className="-mt-8 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-zinc-300">
              Latest version:{" "}
              <span className="text-white font-semibold">2.5.0</span>
            </span>
            <span className="text-[10px] text-zinc-500">—</span>
            <span className="text-[10px] text-zinc-500">
              Released April 14, 2026
            </span>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          CHANGELOG TIMELINE
          ════════════════════════ */}
      <AnimateSection className="pb-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-500/40 via-purple-500/20 to-transparent" />

            <div className="space-y-10 lg:space-y-12">
              {changelog.map((entry, idx) => (
                <motion.div
                  key={entry.version}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{
                    duration: 0.6,
                    delay: idx * 0.1,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="relative pl-12 md:pl-20"
                >
                  {/* Timeline dot */}
                  <div className="absolute left-[11px] md:left-[27px] top-2 w-3 h-3 rounded-full bg-indigo-500 border-2 border-[#0b0c11] ring-2 ring-indigo-500/20" />

                  <div className="double-bezel">
                    <div className="double-bezel-inner">
                      {/* Version header */}
                      <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <h3 className="text-base font-bold text-white font-mono">
                          v{entry.version}
                        </h3>
                        <span
                          className={cn(
                            "text-[9px] font-semibold uppercase tracking-widest px-2 py-1 rounded-full",
                            entry.tagColor
                          )}
                        >
                          {entry.tag}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {entry.date}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="space-y-3">
                        {entry.items.map((item, itemIdx) => {
                          const config = typeConfig[item.type];
                          const Icon = config.icon;
                          return (
                            <motion.div
                              key={itemIdx}
                              initial={{ opacity: 0, y: 8 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true }}
                              transition={{
                                delay: 0.1 + itemIdx * 0.05,
                                duration: 0.4,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                              className="flex items-start gap-3"
                            >
                              <div
                                className={cn(
                                  "flex-shrink-0 mt-0.5 inline-flex p-1 rounded-md",
                                  config.bg
                                )}
                              >
                                <Icon
                                  className={cn("h-3 w-3", config.color)}
                                />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs text-zinc-300 leading-relaxed">
                                  {item.text}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          RELEASE STATS with Animated Counters
          ════════════════════════ */}
      <AnimateSection className="py-14 border-t border-zinc-800/60 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Total Releases", end: 24, icon: GitCommit, suffix: "+" },
              { label: "New Features", end: 42, icon: Sparkles, suffix: "+" },
              { label: "Improvements", end: 128, icon: Rocket, suffix: "+" },
              { label: "Bug Fixes", end: 56, icon: Bug, suffix: "+" },
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
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/10 mb-3">
                    <Icon className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl lg:text-3xl font-bold text-white tabular-nums">
                    <AnimatedCounter end={stat.end} duration={2000} suffix={stat.suffix} />
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 font-medium">
                    {stat.label}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          SUBSCRIBE SECTION
          ════════════════════════ */}
      <AnimateSection className="py-16 border-t border-zinc-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <AnimateUp>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700/50 bg-zinc-800/30 backdrop-blur-sm mb-4">
              <Bell className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-widest">
                Stay Updated
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Never Miss a Release
            </h2>
            <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
              Get notified about new releases, features, and updates directly
              to your inbox.
            </p>
            <div className="flex items-center justify-center gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 h-10 px-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
              <Button className="h-10 px-5 text-xs gap-1.5 bg-white text-[#0b0c11] hover:bg-zinc-200 rounded-xl font-medium shrink-0 press-scale">
                Subscribe
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </AnimateUp>
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
              <div className="absolute inset-0 mesh-gradient-dark opacity-50" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              <div className="relative text-center">
                <AnimateUp>
                  <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                    Ready to Get Started?
                  </h2>
                  <p className="text-base text-zinc-400 max-w-xl mx-auto mb-8">
                    Join thousands of businesses already using Dashboard.
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-white text-[#0b0c11] hover:bg-zinc-200 rounded-xl font-medium shadow-xl shadow-black/20 press-scale"
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
