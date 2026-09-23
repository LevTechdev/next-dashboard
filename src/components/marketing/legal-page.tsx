"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { FileText, ShieldCheck, Cookie, Accessibility } from "lucide-react";

export interface LegalSection {
  title: string;
  body: string;
}

const ICONS = {
  terms: FileText,
  privacy: ShieldCheck,
  cookies: Cookie,
  accessibility: Accessibility,
} as const;

export type LegalPageKind = keyof typeof ICONS;

/**
 * Shared layout for the marketing legal pages (Terms of Service, Privacy
 * Policy, Cookie Settings, Accessibility). Each page resolves its own
 * `legal.*` translation keys and passes plain strings in, so this shell stays
 * locale-agnostic.
 */
export function LegalPage({
  kind,
  title,
  updated,
  intro,
  sections,
}: {
  kind: LegalPageKind;
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  const t = useTranslations("site");
  const Icon = ICONS[kind];

  return (
    <div className="relative min-h-screen overflow-hidden pt-24 pb-20">
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="bg-primary/5 absolute -top-24 left-1/4 h-72 w-72 rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute top-1/3 right-1/4 h-80 w-80 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Icon size={26} className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
          <p className="mt-6 text-muted-foreground leading-relaxed">{intro}</p>
        </motion.div>

        <div className="mt-12 space-y-10">
          {sections.map((section, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * idx, ease: "easeOut" }}
            >
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </motion.section>
          ))}
        </div>

        <p className="mt-16 text-center text-sm text-muted-foreground">
          {t("legalContactPrompt")}{" "}
          <a href={`mailto:legal@dashboard.com`} className="text-primary hover:underline">
            legal@dashboard.com
          </a>
        </p>
      </div>
    </div>
  );
}
