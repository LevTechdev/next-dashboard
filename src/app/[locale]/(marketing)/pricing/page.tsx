"use client";

import { use, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ArrowRight,
  Star,
  Percent,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_META = [
  {
    key: "starter",
    name: "Starter",
    desc: "Perfect for small businesses getting started.",
    popular: false,
    monthly: 29,
    yearly: 23,
    features: [
      "Up to 100 orders/month",
      "Up to 3 team members",
      "Basic analytics",
      "Standard exports",
      "Email support",
    ]
  },
  {
    key: "professional",
    name: "Professional",
    desc: "For growing teams who need full power.",
    popular: true,
    monthly: 79,
    yearly: 63,
    features: [
      "Up to 1,000 orders/month",
      "Up to 10 team members",
      "Advanced real-time analytics",
      "Priority support",
      "Multi-channel integrations",
      "Custom reports",
      "Role-Based Access Control",
      "API & Webhooks",
    ]
  },
  {
    key: "enterprise",
    name: "Enterprise",
    desc: "Custom solutions for high-volume businesses.",
    popular: false,
    monthly: 199,
    yearly: 159,
    features: [
      "Unlimited orders",
      "Unlimited team members",
      "Advanced real-time analytics",
      "24/7 Dedicated support",
      "Multi-channel integrations",
      "Custom reports",
      "Role-Based Access Control",
      "API & Webhooks",
      "Custom data exports",
    ]
  },
];

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const [isAnnual, setIsAnnual] = useState(false);

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
            Pricing
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            Simple, Transparent Pricing
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-10">
            Start free, scale when you need to. Choose the plan that fits your business needs.
          </p>

          <div className="inline-flex items-center gap-2 p-1.5 rounded-full bg-background border border-border shadow-sm">
            <button
              onClick={() => setIsAnnual(false)}
              className={cn(
                "px-5 py-2 text-sm font-medium rounded-full transition-colors",
                !isAnnual ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={cn(
                "px-5 py-2 text-sm font-medium rounded-full transition-colors inline-flex items-center gap-1.5",
                isAnnual ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Yearly
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                isAnnual ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}>
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>
      </section>

      {/* ──────── PRICING CARDS ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {PLAN_META.map((plan, i) => {
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
                    : "border-border bg-background text-foreground"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-8 -translate-y-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <p className={cn("text-sm mb-6", plan.popular ? "opacity-80" : "text-muted-foreground")}>
                  {plan.desc}
                </p>
                
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold">${price}</span>
                  <span className={cn("text-sm font-medium", plan.popular ? "opacity-80" : "text-muted-foreground")}>
                    /month
                  </span>
                </div>

                <Link
                  href={`/${locale}/register`}
                  className={cn(
                    "w-full py-3 rounded-full text-sm font-semibold text-center transition mb-8",
                    plan.popular 
                      ? "bg-background text-foreground hover:bg-muted" 
                      : "bg-foreground text-background hover:opacity-90"
                  )}
                >
                  {plan.key === "enterprise" ? "Contact Sales" : "Get Started"}
                </Link>

                <div className="flex-1">
                  <p className={cn("text-xs font-semibold uppercase tracking-wider mb-4", plan.popular ? "opacity-80" : "text-muted-foreground")}>
                    Includes
                  </p>
                  <ul className="space-y-4">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm">
                        <Check className={cn("h-4 w-4 flex-shrink-0 mt-0.5", plan.popular ? "text-primary-foreground opacity-80" : "text-primary")} />
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

      {/* ──────── COMPARISON TABLE ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 py-24 max-w-7xl mx-auto border-t border-border">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mb-4">Compare Plans</h2>
          <p className="text-muted-foreground text-sm">Find the perfect set of features for your business scale.</p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border bg-background">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left py-4 px-6 font-semibold text-foreground">Features</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Starter</th>
                <th className="text-center py-4 px-6 font-semibold text-primary">Professional</th>
                <th className="text-center py-4 px-6 font-semibold text-foreground">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                ["Monthly Orders", "100", "1,000", "Unlimited"],
                ["Team Members", "3", "10", "Unlimited"],
                ["Analytics", "Basic", "Advanced", "Advanced"],
                ["Support", "Email", "Priority", "24/7 Dedicated"],
                ["API Access", "-", "Full", "Full"],
                ["Custom Exports", "-", "-", "Yes"],
                ["RBAC", "-", "Yes", "Yes"],
              ].map((row, i) => (
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
      
      {/* ──────── BOTTOM CTA ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="rounded-3xl bg-foreground text-background p-12 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start managing your business better</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">
              Join thousands of businesses that trust our platform. Try it free for 14 days.
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
