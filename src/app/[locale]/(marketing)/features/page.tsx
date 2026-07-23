"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useAnalytics } from "@/hooks/use-analytics";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  Shield,
  Download,
  Zap,
  LayoutDashboard,
  RefreshCw,
  FileText,
  Megaphone,
  Tag,
  UserCheck,
  Clock,
  PieChart,
  CheckCircle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimateSection, AnimateUp, buttonTap } from "@/components/motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { TextAnimate } from "@/components/ui/text-animate";

interface FeatureGroup {
  title: string;
  description: string;
  items: {
    title: string;
    description: string;
    icon: LucideIcon;
    color: string;
    gradient: string;
    testId: string;
  }[];
}

const featureGroups: FeatureGroup[] = [
  {
    title: "Analytics & Insights",
    description: "Make data-driven decisions with powerful analytics and real-time dashboards.",
    items: [
      {
        title: "Live Dashboard",
        description:
          "Real-time overview of your key metrics including revenue, orders, customers, and product performance. Auto-refreshes every 15 seconds.",
        icon: LayoutDashboard,
        color: "text-indigo-500 dark:text-indigo-400",
        gradient: "from-indigo-500/20 to-indigo-500/5",
        testId: "icon-layoutdashboard",
      },
      {
        title: "Revenue Analytics",
        description:
          "Interactive revenue charts with monthly breakdowns, trend analysis, and channel distribution. Hover for detailed tooltips.",
        icon: BarChart3,
        color: "text-blue-500 dark:text-blue-400",
        gradient: "from-blue-500/20 to-blue-500/5",
        testId: "icon-barchart3",
      },
      {
        title: "Sales Reports",
        description:
          "Comprehensive sales reports with channel breakdown, customer summaries, and product performance.",
        icon: FileText,
        color: "text-emerald-500 dark:text-emerald-400",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        testId: "icon-filetext",
      },
      {
        title: "Channel Analytics",
        description:
          "Track performance across 6+ sales channels including Online Store, Facebook, Instagram, TikTok, and Shopify.",
        icon: PieChart,
        color: "text-purple-500 dark:text-purple-400",
        gradient: "from-purple-500/20 to-purple-500/5",
        testId: "icon-piechart",
      },
    ],
  },
  {
    title: "Order & Customer Management",
    description: "Efficiently manage your orders and build stronger customer relationships.",
    items: [
      {
        title: "Multi-Channel Orders",
        description:
          "View and manage orders from all sales channels in one unified interface. Track status, payment, and shipping at a glance.",
        icon: ShoppingCart,
        color: "text-emerald-500 dark:text-emerald-400",
        gradient: "from-emerald-500/20 to-emerald-500/5",
        testId: "icon-shoppingcart",
      },
      {
        title: "Customer Profiles",
        description:
          "Detailed customer profiles with order history, spending totals, and contact information.",
        icon: Users,
        color: "text-purple-500 dark:text-purple-400",
        gradient: "from-purple-500/20 to-purple-500/5",
        testId: "icon-users",
      },
      {
        title: "Inventory Tracking",
        description:
          "Monitor stock levels across your product catalog with real-time inventory updates and low-stock alerts.",
        icon: Package,
        color: "text-amber-500 dark:text-amber-400",
        gradient: "from-amber-500/20 to-amber-500/5",
        testId: "icon-package",
      },
      {
        title: "Order Tracking",
        description:
          "Track order fulfillment from placement to delivery with a visual timeline showing each status change.",
        icon: Clock,
        color: "text-cyan-500 dark:text-cyan-400",
        gradient: "from-cyan-500/20 to-cyan-500/5",
        testId: "icon-clock",
      },
    ],
  },
  {
    title: "Marketing & Growth",
    description: "Drive growth with powerful marketing tools and promotional features.",
    items: [
      {
        title: "Campaign Management",
        description:
          "Create, track, and analyze marketing campaigns across channels. Monitor performance metrics and ROI.",
        icon: Megaphone,
        color: "text-rose-500 dark:text-rose-400",
        gradient: "from-rose-500/20 to-rose-500/5",
        testId: "icon-megaphone",
      },
      {
        title: "Discount Engine",
        description: "Create and manage discount codes, promotional offers, and seasonal pricing.",
        icon: Tag,
        color: "text-amber-500 dark:text-amber-400",
        gradient: "from-amber-500/20 to-amber-500/5",
        testId: "icon-tag",
      },
      {
        title: "Growth Analytics",
        description:
          "Track growth metrics across revenue, customers, orders, and products with percentage changes.",
        icon: TrendingUp,
        color: "text-green-500 dark:text-green-400",
        gradient: "from-green-500/20 to-green-500/5",
        testId: "icon-trendingup",
      },
      {
        title: "Data Export",
        description: "Export orders, customers, and reports to CSV with full UTF-8 support.",
        icon: Download,
        color: "text-sky-500 dark:text-sky-400",
        gradient: "from-sky-500/20 to-sky-500/5",
        testId: "icon-download",
      },
    ],
  },
  {
    title: "Team & Security",
    description: "Collaborate effectively with your team while keeping your data secure.",
    items: [
      {
        title: "Role-Based Access",
        description:
          "Granular permissions with Admin, Manager, and Staff roles. Control access across all sections.",
        icon: Shield,
        color: "text-rose-500 dark:text-rose-400",
        gradient: "from-rose-500/20 to-rose-500/5",
        testId: "icon-shield",
      },
      {
        title: "Team Management",
        description: "Add team members, assign roles, and manage access permissions.",
        icon: UserCheck,
        color: "text-violet-500 dark:text-violet-400",
        gradient: "from-violet-500/20 to-violet-500/5",
        testId: "icon-usercheck",
      },
      {
        title: "Real-Time Updates",
        description: "Server-Sent Events deliver instant updates across all connected clients.",
        icon: RefreshCw,
        color: "text-indigo-500 dark:text-indigo-400",
        gradient: "from-indigo-500/20 to-indigo-500/5",
        testId: "icon-refreshcw",
      },
      {
        title: "Audit Log",
        description: "Complete activity log tracking every action taken in the system.",
        icon: Clock,
        color: "text-zinc-500 dark:text-zinc-400",
        gradient: "from-zinc-500/20 to-zinc-500/5",
        testId: "icon-clock",
      },
    ],
  },
];

const performanceHighlights = [
  {
    title: "Sub-second Response Times",
    desc: "Database queries optimized under 50ms. Pages render in under 100ms.",
    icon: Zap,
    color: "text-amber-500 dark:text-amber-400",
    glowColor: "rgba(245,158,11,0.12)",
  },
  {
    title: "99.9% Uptime Guarantee",
    desc: "Distributed infrastructure with automatic failover. Zero planned downtime.",
    icon: CheckCircle,
    color: "text-emerald-500 dark:text-emerald-400",
    glowColor: "rgba(16,185,129,0.12)",
  },
  {
    title: "Real-Time Data Sync",
    desc: "Server-Sent Events push updates across all connected clients instantly.",
    icon: RefreshCw,
    color: "text-indigo-500 dark:text-indigo-400",
    glowColor: "rgba(99,102,241,0.12)",
  },
];

export default function FeaturesPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const { theme } = useTheme();
  const { trackCTA } = useAnalytics();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const ctaHref = `/${locale}/dashboard`;
  const isDark = mounted && theme === "dark";

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
        {mounted && isDark && (
          <>
            <div className="absolute top-0 left-1/3 w-72 h-72 bg-indigo-500/8 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-56 h-56 bg-purple-500/6 rounded-full blur-[100px] pointer-events-none" />
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
                  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
              <span className="text-[11px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                Powerful Capabilities
              </span>
            </motion.div>

            <motion.h1
              variants={{
                hidden: { opacity: 0, y: 30 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                },
              }}
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white mb-4 max-w-4xl mx-auto"
            >
              Everything You Need to&nbsp;
              <span className="inline-flex">
                <FlipFadeText
                  words={["grow.", "scale.", "thrive.", "succeed."]}
                  interval={3000}
                  textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !text-transparent !bg-clip-text !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 dark:!from-indigo-400 dark:!via-purple-400 dark:!to-pink-400 !font-bold !tracking-tight"
                  className="!min-h-0 inline-flex"
                  staggerDelay={0.06}
                  letterDuration={0.4}
                />
              </span>
            </motion.h1>

            <TextAnimate
              animation="blurInUp"
              by="text"
              className="text-base lg:text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto"
              once
            >
              From real-time analytics to team collaboration — explore all the tools that make
              Dashboard the ultimate business management platform.
            </TextAnimate>
          </motion.div>
        </div>
      </section>

      {/* ════════════════════════
          FEATURE GROUPS with MICRO-INTERACTIONS
          ════════════════════════ */}
      {featureGroups.map((group, groupIndex) => (
        <AnimateSection
          key={group.title}
          className={cn(
            "py-20 lg:py-24",
            groupIndex % 2 === 1 && "bg-zinc-100 dark:bg-zinc-900/30 border-t border-border",
          )}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <AnimateUp className="text-center max-w-2xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-200 dark:border-zinc-700/50 bg-indigo-50/50 dark:bg-zinc-800/30 backdrop-blur-sm mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                <span className="text-[10px] font-medium text-indigo-600 dark:text-zinc-400 uppercase tracking-widest">
                  {groupIndex === 0
                    ? "Core Features"
                    : groupIndex === 1
                      ? "Management"
                      : groupIndex === 2
                        ? "Growth"
                        : "Security"}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
                {group.title}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{group.description}</p>
            </AnimateUp>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6 max-w-5xl mx-auto">
              {group.items.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{
                      duration: 0.5,
                      delay: idx * 0.08,
                      ease: [0.16, 1, 0.3, 1] as any,
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
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                      style={{
                        background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(99,102,241,0.08) 0%, transparent 40%)`,
                      }}
                    />
                    <div className="relative z-10 bg-gradient-to-br from-white via-zinc-50/80 to-white dark:from-zinc-900 dark:via-zinc-900/95 dark:to-zinc-900 rounded-[calc(1.5rem-2px)] p-5 flex gap-4 h-full transition-colors">
                      <div
                        className={cn(
                          "feature-icon-wrap flex-shrink-0 inline-flex p-3 rounded-xl bg-gradient-to-br h-fit",
                          feature.gradient,
                          "border border-black/5 dark:border-white/5",
                        )}
                      >
                        <Icon
                          data-testid={feature.testId}
                          className={cn("h-5 w-5", feature.color)}
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1.5">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </AnimateSection>
      ))}

      {/* ════════════════════════
          FEATURE HIGHLIGHTS
          ════════════════════════ */}
      <AnimateSection className="py-20 lg:py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateUp className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white mb-3">
              Built for performance
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Every feature is designed to be fast, reliable, and intuitive.
            </p>
          </AnimateUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[220px]">
            {performanceHighlights.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.1,
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1] as any,
                  }}
                  className="feature-card glow-border relative rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-7 flex flex-col justify-between group overflow-hidden"
                  onPointerMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                    e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                  }}
                >
                  <motion.div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                    style={{
                      background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), ${item.glowColor}, transparent 40%)`,
                    }}
                  />
                  <div className="relative z-10">
                    <Icon
                      data-testid={
                        item.icon === CheckCircle
                          ? "icon-checkcircle"
                          : item.icon === Zap
                            ? "icon-zap"
                            : "icon-refreshcw"
                      }
                      className={cn("h-6 w-6 mb-3", item.color)}
                    />
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">
                      {item.title}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimateSection>

      {/* ════════════════════════
          FEATURE STATS BAR with Animated Counters
          ════════════════════════ */}
      <AnimateSection className="border-t border-border bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { label: "Total Features", end: 48, suffix: "+", icon: LayoutDashboard },
              { label: "Integrations", end: 70, suffix: "+", icon: Zap },
              {
                label: "Active Users",
                end: 2847,
                format: (v: number) => v.toLocaleString(),
                icon: Users,
              },
              { label: "Countries", end: 30, suffix: "+", icon: CheckCircle },
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
                    <AnimatedCounter
                      end={stat.end}
                      duration={2000}
                      {...(stat.format ? { formatter: stat.format } : { suffix: stat.suffix })}
                    />
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
                    Ready to Get Started?
                  </h2>
                  <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto mb-8">
                    Start your 14-day free trial. No credit card required.
                  </p>
                  <Link href={ctaHref}>
                    <motion.div whileTap={buttonTap} whileHover={{ scale: 1.03 }}>
                      <Button
                        className="h-11 px-8 text-sm gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-xl font-medium press-scale shadow-xl shadow-zinc-900/20 dark:shadow-black/20"
                        onClick={() => trackCTA("go_to_dashboard_features", { href: ctaHref })}
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
