"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BarChart3,
  ShoppingCart,
  Package,
  Shield,
  LayoutDashboard,
  Megaphone,
  Tag,
  PieChart,
  CheckCircle,
  RefreshCw,
  Zap,
  Globe,
  Users,
  Bell,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

function BentoCard({
  className,
  children,
  gradient = false,
}: {
  className?: string;
  children: React.ReactNode;
  gradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background p-5 overflow-hidden relative group transition-colors",
        gradient && "bg-gradient-to-br from-primary/5 to-primary/0",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);

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
            <Sparkles className="h-3.5 w-3.5" />
            Platform Features
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            Everything you need,<br />
            <span className="text-primary">built right in.</span>
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A comprehensive suite of tools designed to help you manage orders, analyze revenue, and scale your business effortlessly.
          </p>
        </motion.div>
      </section>

      {/* ──────── CORE FEATURES ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.1, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
                <LayoutDashboard className="h-5 w-5 text-blue-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Unified Dashboard</h3>
              <p className="text-sm text-muted-foreground">Get a bird&apos;s-eye view of your entire business. Monitor sales, track inventory, and manage customers from a single, intuitive interface.</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.15, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                <ShoppingCart className="h-5 w-5 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Order Management</h3>
              <p className="text-sm text-muted-foreground">Process orders faster with automated workflows. Track shipments, handle returns, and keep customers updated in real-time.</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.2, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Advanced Analytics</h3>
              <p className="text-sm text-muted-foreground">Make data-driven decisions with detailed reports. Analyze revenue trends, customer behavior, and product performance.</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.25, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4">
                <Package className="h-5 w-5 text-amber-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Inventory Control</h3>
              <p className="text-sm text-muted-foreground">Never run out of stock. Set low-stock alerts, manage variants, and sync inventory across all your sales channels automatically.</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.3, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                <Shield className="h-5 w-5 text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Enterprise Security</h3>
              <p className="text-sm text-muted-foreground">Keep your data safe with bank-grade encryption, Role-Based Access Control (RBAC), Two-Factor Authentication (2FA), and SSO.</p>
            </BentoCard>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: 0.35, ease: easeSmooth }}
          >
            <BentoCard className="h-full">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
                <Globe className="h-5 w-5 text-cyan-500" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Global Commerce</h3>
              <p className="text-sm text-muted-foreground">Sell anywhere in the world. Support for multiple currencies, local payment gateways, and international shipping integrations.</p>
            </BentoCard>
          </motion.div>

        </div>
      </section>

      {/* ──────── PERFORMANCE HIGHLIGHTS ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-16 max-w-7xl mx-auto border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4">Built for Performance</h2>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">Lightning fast, incredibly reliable, and designed to scale with your business.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: Zap, title: "Sub-200ms API", desc: "Experience incredibly fast load times and instant data updates.", color: "text-amber-500" },
            { icon: CheckCircle, title: "99.9% Uptime", desc: "Enterprise-grade reliability ensures your business never stops running.", color: "text-emerald-500" },
            { icon: RefreshCw, title: "Real-time Sync", desc: "Data syncs instantly across all devices and connected integrations.", color: "text-indigo-500" }
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: easeSmooth }}
              className="flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-background"
            >
              <item.icon className={cn("h-8 w-8 mb-4", item.color)} />
              <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ──────── BOTTOM CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to upgrade your workflow?</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">
              Join thousands of businesses that trust our platform to power their daily operations.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
