"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  Clock,
  Check,
  MapPin,
  Phone,
  Send,
  ArrowRight,
  MessageSquare,
  Mail,
  Loader2,
  LayoutDashboard,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FlipFadeText } from "@/components/ui/flip-fade-text";

// ─── Contact Info Cards ──────────────────────────────────────────────────────

interface ContactInfo {
  icon: React.ElementType;
  labelKey: string;
  value?: string;
  valueKey?: string;
  subKey: string;
  color: string;
  bg: string;
}

const contactInfo: ContactInfo[] = [
  {
    icon: Mail,
    labelKey: "infoEmailLabel",
    value: "hello@dashboard.com",
    subKey: "infoEmailSub",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    icon: MapPin,
    labelKey: "infoLocationLabel",
    value: "San Francisco, CA",
    subKey: "infoLocationSub",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Phone,
    labelKey: "infoPhoneLabel",
    value: "+1 (555) 123-4567",
    subKey: "infoPhoneSub",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: Clock,
    labelKey: "infoHoursLabel",
    valueKey: "infoHoursValue",
    subKey: "infoHoursSub",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

const socialLinks = [
  { icon: Github, label: "GitHub", href: "#" },
  { icon: Twitter, label: "Twitter / X", href: "#" },
  { icon: Linkedin, label: "LinkedIn", href: "#" },
];

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const t = useTranslations("contactPage");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) {
      toast.error(t("toastRequired"));
      return;
    }

    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsLoading(false);
    setSubmitted(true);
    toast.success(t("toastSent"));
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-50 dark:bg-[#0b0c11]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-[150px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center px-4"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
            <Check size={32} className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            {t("sentTitle")}
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">{t("sentDesc")}</p>
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background text-sm font-medium hover:opacity-90 transition-all"
          >
            {t("backHome")} <ArrowRight size={16} className="h-4 w-4" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 min-h-screen">
      {/* ═══ HERO ═══ */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-12 flex flex-col items-center text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeSmooth }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6 shadow-sm">
              <MessageSquare size={14} className="h-3.5 w-3.5" />
              {t("badge")}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6, ease: easeSmooth }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4 text-foreground"
          >
            <span>{t("heroPrefix")} </span>
            <span className="text-primary inline-flex">
              <FlipFadeText
                words={[t("word1"), t("word2"), t("word3"), t("word4")]}
                className="!min-h-0 inline-flex"
                textClassName="!text-4xl sm:!text-5xl md:!text-6xl !font-bold text-primary"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6, ease: easeSmooth }}
            className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
          >
            {t("heroSubtitle")}
          </motion.p>
        </div>
      </section>

      {/* ═══ CONTACT SECTION ═══ */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Form - 3 cols */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: easeSmooth }}
            className="lg:col-span-3"
          >
            <div className="rounded-2xl border border-border bg-background p-8 relative overflow-hidden group">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {t("formTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mb-8">{t("formSubtitle")}</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t("labelName")} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("phName")}
                      className="bg-muted/50 border-border"
                      disabled={isLoading}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      {t("labelEmail")} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("phEmail")}
                      className="bg-muted/50 border-border"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("labelSubject")}
                  </label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("phSubject")}
                    className="bg-muted/50 border-border"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {t("labelMessage")} <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("phMessage")}
                    rows={6}
                    className="bg-muted/50 border-border resize-none"
                    disabled={isLoading}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-foreground text-background hover:bg-muted font-medium"
                  disabled={!name || !email || !message || isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t("sending")}
                    </>
                  ) : (
                    <>
                      <Send size={16} className="h-4 w-4 mr-2" /> {t("send")}
                    </>
                  )}
                </Button>
              </form>
            </div>
          </motion.div>

          {/* Info - 2 cols */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: easeSmooth, delay: 0.1 }}
            className="lg:col-span-2 space-y-4"
          >
            {contactInfo.map((info) => {
              const Icon = info.icon;
              return (
                <div
                  key={info.labelKey}
                  className="rounded-2xl border border-border bg-background p-6 flex items-start gap-4 hover:border-primary/50 transition-colors"
                >
                  <div className={cn("p-3 rounded-xl", info.bg)}>
                    <Icon size={20} className={cn("h-5 w-5", info.color)} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      {t(info.labelKey)}
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {info.valueKey ? t(info.valueKey) : info.value}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(info.subKey)}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Social Links */}
            <div className="rounded-2xl border border-border bg-background p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                {t("followUs")}
              </p>
              <div className="flex gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-foreground hover:bg-muted transition-colors text-xs font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon size={14} className="h-3.5 w-3.5" />
                      {social.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </motion.div>
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
            <LayoutDashboard className="h-10 w-10 mx-auto mb-6 opacity-80 text-background" />
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-base sm:text-lg opacity-80 max-w-2xl mx-auto mb-8">
              {t("ctaDesc")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/register`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-background text-foreground text-sm font-semibold hover:opacity-90 transition"
              >
                {t("ctaButton")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
