"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  Eye,
  Heart,
  Users,
  Globe,
  TrendingUp,
  Shield,
  Lightbulb,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipFadeText } from "@/components/ui/flip-fade-text";
import { AnimatedCounter } from "@/components/ui/animated-counter";

// ─── Company Values ──────────────────────────────────────────────────────────

interface Value {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  bg: string;
}

const values: Value[] = [
  {
    icon: Lightbulb,
    title: "Innovation First",
    description:
      "We push the boundaries of what's possible, constantly iterating and improving our platform to deliver cutting-edge solutions.",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    icon: Shield,
    title: "Trust & Security",
    description:
      "Your data is sacred. We employ enterprise-grade security measures, encryption, and compliance standards to keep your business safe.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Users,
    title: "Customer Obsessed",
    description:
      "Every feature, every decision starts with our users. We listen, learn, and build what businesses actually need to succeed.",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: Globe,
    title: "Global Scale",
    description:
      "Built for businesses of every size, across every timezone. Our platform handles millions of transactions across 50+ countries.",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
  {
    icon: TrendingUp,
    title: "Growth Mindset",
    description:
      "We grow with our customers. Continuous improvement, data-driven decisions, and relentless pursuit of excellence drive everything we do.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/20",
  },
  {
    icon: Heart,
    title: "People First",
    description:
      "Behind every great product is a great team. We invest in our people, foster inclusion, and build a culture where everyone thrives.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/20",
  },
];

// ─── Team Section ────────────────────────────────────────────────────────────

const teamMembers = [
  { name: "Alex Chen", role: "CEO & Co-Founder", initials: "AC" },
  { name: "Sarah Mitchell", role: "CTO & Co-Founder", initials: "SM" },
  { name: "David Park", role: "Head of Design", initials: "DP" },
  { name: "Lisa Ramirez", role: "VP of Engineering", initials: "LR" },
];

// ─── Stats ───────────────────────────────────────────────────────────────────

const stats = [
  { label: "Active Users", endValue: 50000, prefix: "", suffix: "+" },
  { label: "Countries Served", endValue: 50, prefix: "", suffix: "+" },
  { label: "Transactions", endValue: 10, prefix: "", suffix: "M+" },
  { label: "NPS Score", endValue: 92, prefix: "", suffix: "" },
];

// ─── Timeline ────────────────────────────────────────────────────────────────

const milestones = [
  { year: "2020", title: "The Beginning", description: "Founded in a small garage with a big vision to transform business management." },
  { year: "2021", title: "First 1,000 Users", description: "Hit our first major milestone with 1,000 active businesses using the platform." },
  { year: "2022", title: "Series A Funding", description: "Raised $10M to accelerate product development and expand the team." },
  { year: "2023", title: "Global Expansion", description: "Launched in 30+ countries with multi-language and multi-currency support." },
  { year: "2024", title: "AI-Powered Insights", description: "Introduced AI-driven analytics, predictive forecasting, and smart automation." },
  { year: "2025", title: "Enterprise Ready", description: "Achieved SOC 2 compliance, 99.99% uptime, and enterprise-grade security." },
];

// ─── Container Variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as any } },
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AboutPage() {

  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11]">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <AnimatedRays />
          <AnimatedGridPattern
            numSquares={60}
            maxOpacity={0.05}
            duration={4}
            repeatDelay={1}
            className="opacity-50"
          />
        </div>

        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-indigo-500/10 dark:bg-indigo-500/8 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/8 dark:bg-purple-500/6 rounded-full blur-[160px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-6 border border-indigo-200 dark:border-indigo-800/50">
              <Sparkles className="h-3.5 w-3.5" />
              Our Story
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4"
          >
            <span className="text-zinc-800 dark:text-white">Building the future of </span>
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-300 bg-clip-text text-transparent">
              <FlipFadeText
                words={["business.", "management.", "growth.", "impact."]}
                className="!min-h-0"
                textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-300 bg-clip-text text-transparent"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto mb-8"
          >
            We're on a mission to empower every business with the tools, insights, and
            automation they need to thrive in the digital age.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center gap-3"
          >
            <Link
              href="/en/features"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all press-scale"
            >
              Explore Features
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/en/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all press-scale"
            >
              Get in Touch
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <section className="border-y border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <p className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white">
                  {stat.prefix}
                  <AnimatedCounter end={stat.endValue} duration={2000} />
                  {stat.suffix}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ STORY SECTION ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
              <Target className="h-3.5 w-3.5" />
              Our Mission
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-6 leading-tight">
              Empowering businesses to{" "}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                achieve more
              </span>
            </h2>
            <div className="space-y-4 text-zinc-500 dark:text-zinc-400 leading-relaxed">
              <p>
                Dashboard was born from a simple insight: businesses deserve better tools.
                After years of wrestling with fragmented, disconnected software, our founders
                set out to build a unified platform that brings everything together.
              </p>
              <p>
                What started as a side project in 2020 has grown into a platform serving
                thousands of businesses worldwide. We've helped companies increase revenue,
                streamline operations, and make smarter decisions with data they can trust.
              </p>
              <p>
                Today, we're a team of 50+ passionate people across 15 countries, united
                by a shared belief that great software can transform how businesses work.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            {/* Visual timeline compact */}
            <div className="relative pl-8 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-6">
              {milestones.slice(0, 4).map((m, i) => (
                <motion.div
                  key={m.year}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="relative"
                >
                  <div className="absolute -left-[25px] w-4 h-4 rounded-full bg-indigo-500 border-2 border-white dark:border-zinc-900 shadow-sm" />
                  <p className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400 mb-0.5">{m.year}</p>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">{m.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.description}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ VALUES SECTION ═══ */}
      <section className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/10">
        <div className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
              <Heart className="h-3.5 w-3.5" />
              What We Believe
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Our Core Values
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
              The principles that guide every decision we make and every product we build.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <motion.div
                  key={value.title}
                  variants={itemVariants}
                  className="glow-border group relative p-6 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-300"
                >
                  <div className={cn("p-3 w-fit rounded-xl mb-4 transition-transform group-hover:scale-110 duration-300", value.bg)}>
                    <Icon className={cn("h-5 w-5", value.color)} />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {value.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ TEAM PREVIEW ═══ */}
      <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium mb-4 border border-indigo-200 dark:border-indigo-800/50">
            <Users className="h-3.5 w-3.5" />
            Leadership
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
            Meet the Team
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
            The people driving innovation and building the future of business management.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {teamMembers.map((member) => (
            <motion.div
              key={member.name}
              variants={itemVariants}
              className="text-center p-6 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold mb-4 shadow-lg shadow-indigo-500/20">
                {member.initials}
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{member.name}</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{member.role}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            And 40+ more amazing people across 15 countries
          </p>
          <Link
            href="/en/contact"
            className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 transition-colors"
          >
            Join our team <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Ready to transform your business?
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mb-8">
              Join thousands of businesses already using Dashboard to manage, analyze, and grow.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/en/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all press-scale shadow-lg shadow-black/10 dark:shadow-white/10"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/en/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all press-scale"
              >
                View Pricing
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
