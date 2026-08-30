"use client";

import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CreditCard,
  ShoppingCart,
  Mail,
  MessageSquare,
  Database,
  Cloud,
  BarChart3,
  Zap,
  Share2,
  ArrowRight,
  Layers,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

const INTEGRATIONS = [
  {
    name: "Stripe",
    description: "Process payments, manage subscriptions, and handle invoicing seamlessly.",
    icon: CreditCard,
    category: "Payments",
    popular: true,
    color: "bg-indigo-500/10 text-indigo-500",
  },
  {
    name: "Shopify",
    description: "Sync orders, products, and inventory from your Shopify store in real time.",
    icon: ShoppingCart,
    category: "E-commerce",
    popular: true,
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    name: "SendGrid",
    description: "Send transactional emails, notifications, and marketing campaigns at scale.",
    icon: Mail,
    category: "Email",
    popular: false,
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    name: "Slack",
    description: "Get real-time alerts, order updates, and team notifications in your channels.",
    icon: MessageSquare,
    category: "Communication",
    popular: true,
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    name: "PostgreSQL",
    description: "Connect your existing database for custom analytics and reporting.",
    icon: Database,
    category: "Data",
    popular: false,
    color: "bg-cyan-500/10 text-cyan-500",
  },
  {
    name: "AWS",
    description: "Deploy and scale your infrastructure with AWS cloud services.",
    icon: Cloud,
    category: "Infrastructure",
    popular: false,
    color: "bg-orange-500/10 text-orange-500",
  },
  {
    name: "Google Analytics",
    description: "Track traffic, user behavior, and conversion metrics alongside your data.",
    icon: BarChart3,
    category: "Analytics",
    popular: false,
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
  },
  {
    name: "Zapier",
    description: "Connect 3,000+ apps and automate workflows without writing code.",
    icon: Zap,
    category: "Automation",
    popular: true,
    color: "bg-purple-500/10 text-purple-500",
  },
  {
    name: "Instagram & Facebook",
    description: "Manage orders and ads from your social commerce channels in one place.",
    icon: Share2,
    category: "Social",
    popular: false,
    color: "bg-pink-500/10 text-pink-500",
  },
];

const categories = [
  { name: "E-commerce & POS", description: "Connect your storefront and manage orders across channels.", count: "12 integrations" },
  { name: "Payments & Billing", description: "Process payments, manage subscriptions, and handle invoicing.", count: "8 integrations" },
  { name: "Communication", description: "Send emails, notifications, and team alerts.", count: "6 integrations" },
  { name: "Data & Infrastructure", description: "Connect databases, cloud services, and analytics.", count: "14 integrations" },
  { name: "Marketing & Analytics", description: "Track performance and automate marketing workflows.", count: "10 integrations" },
  { name: "Automation & Workflows", description: "Connect 3,000+ apps and automate repetitive tasks.", count: "20+ integrations" },
];

export { INTEGRATIONS as integrations, categories };

function BentoCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background p-6 overflow-hidden relative group transition-colors hover:border-primary/50",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function IntegrationsPage({ params }: { params: Promise<{ locale: string }> }) {
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
            <Plug className="h-3.5 w-3.5" />
            Integrations
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto text-foreground">
            Connect your favorite tools
          </h1>

          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Sync data, automate workflows, and bring all your business tools together in one unified platform.
          </p>
        </motion.div>
      </section>

      {/* ──────── INTEGRATIONS GRID ──────── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {INTEGRATIONS.map((integration, i) => (
            <motion.div
              key={integration.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: easeSmooth }}
            >
              <BentoCard className="h-full flex flex-col">
                <div className="flex flex-col flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", integration.color)}>
                      <integration.icon className="h-6 w-6" />
                    </div>
                    {integration.popular && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary">
                        Popular
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-lg font-bold text-foreground mb-2">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">
                    {integration.description}
                  </p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {integration.category}
                    </span>
                    <Link
                      href={`/${locale}/register`}
                      className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      Connect <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </BentoCard>
            </motion.div>
          ))}
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
            <Layers className="h-10 w-10 mx-auto mb-6 opacity-80" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Don't see your tool?</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">
              We're constantly adding new integrations. You can also use our API and Webhooks to build custom connections.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                View API Docs
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
