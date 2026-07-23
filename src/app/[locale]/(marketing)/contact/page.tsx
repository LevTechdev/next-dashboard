"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  MapPin,
  Clock,
  Phone,
  Send,
  Loader2,
  Sparkles,
  ArrowRight,
  Check,
  LayoutDashboard,
  MessageSquare,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AnimatedRays } from "@/components/ui/animated-rays";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { FlipFadeText } from "@/components/ui/flip-fade-text";

// ─── Contact Info Cards ──────────────────────────────────────────────────────

interface ContactInfo {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}

const contactInfo: ContactInfo[] = [
  {
    icon: Mail,
    label: "Email",
    value: "hello@dashboard.com",
    sub: "We reply within 24 hours",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  {
    icon: MapPin,
    label: "Location",
    value: "San Francisco, CA",
    sub: "HQ in SoMa district",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+1 (555) 123-4567",
    sub: "Mon-Fri 9AM-6PM PST",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/20",
  },
  {
    icon: Clock,
    label: "Hours",
    value: "24/7 Support",
    sub: "Live chat for all plans",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-900/20",
  },
];

// ─── Social Links ────────────────────────────────────────────────────────────

const socialLinks = [
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Twitter, label: "Twitter / X", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsLoading(true);
    // Simulate form submission
    await new Promise((r) => setTimeout(r, 1500));
    setIsLoading(false);
    setSubmitted(true);
    toast.success("Message sent successfully! We'll get back to you soon.");
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-[#0b0c11]">
        <div className="absolute inset-0">
          <AnimatedRays />
          <AnimatedGridPattern
            numSquares={40}
            maxOpacity={0.04}
            duration={4}
            repeatDelay={1}
            className="opacity-40"
          />
        </div>
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center px-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6">
            <Check className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-3">
            Message Sent! 🎉
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
            Thanks for reaching out! Our team will review your message and get back to you within 24
            hours.
          </p>
          <Link
            href="/en"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all"
          >
            Back to Home
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11]">
      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
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

        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/8 rounded-full blur-[160px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-teal-500/8 dark:bg-teal-500/6 rounded-full blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 text-center pt-24 pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-medium mb-6 border border-emerald-200 dark:border-emerald-800/50">
              <MessageSquare className="h-3.5 w-3.5" />
              Get in Touch
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4"
          >
            <span className="text-zinc-800 dark:text-white">Let's </span>
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-300 bg-clip-text text-transparent">
              <FlipFadeText
                words={["talk.", "connect.", "partner.", "create."]}
                className="!min-h-0"
                textClassName="!text-4xl sm:!text-5xl lg:!text-6xl !font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-300 bg-clip-text text-transparent"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto"
          >
            Have a question, idea, or just want to say hi? We'd love to hear from you.
          </motion.p>
        </div>
      </section>

      {/* ═══ CONTACT SECTION ═══ */}
      <section className="max-w-6xl mx-auto px-4 pb-20 lg:pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Form - 3 cols */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-3"
          >
            <div className="glow-border p-8 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                Send us a message
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Fill out the form and our team will get back to you within 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 dark:focus:border-emerald-500"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Email <span className="text-red-400">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 dark:focus:border-emerald-500"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Subject
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="What's this about?"
                    className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 dark:focus:border-emerald-500"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Message <span className="text-red-400">*</span>
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={5}
                    className="bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 focus:border-emerald-400 dark:focus:border-emerald-500 resize-none"
                    disabled={isLoading}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 gap-2"
                  disabled={!name || !email || !message || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Info - 2 cols */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            className="lg:col-span-2 space-y-5"
          >
            {contactInfo.map((info) => {
              const Icon = info.icon;
              return (
                <div
                  key={info.label}
                  className="glow-border flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:shadow-md transition-all duration-300 group"
                >
                  <div
                    className={cn(
                      "p-3 rounded-xl transition-transform group-hover:scale-110 duration-300",
                      info.bg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", info.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      {info.label}
                    </p>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white mt-0.5">
                      {info.value}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{info.sub}</p>
                  </div>
                </div>
              );
            })}

            {/* Social Links */}
            <div className="p-5 rounded-2xl bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                Follow Us
              </p>
              <div className="flex gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:shadow-sm border border-zinc-200 dark:border-zinc-700 transition-all text-xs font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {social.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
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
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-6">
              <LayoutDashboard className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Prefer a live demo?
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mb-8">
              See Dashboard in action with a personalized walkthrough from our team. We'll show you
              exactly how it fits your business.
            </p>
            <Link
              href="/en/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 transition-all press-scale shadow-lg shadow-black/10 dark:shadow-white/10"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
