"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Globe,
  Heart,
  Laptop,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { DiaTextReveal } from "@/components/sora-ui/texts/dia-text-reveal";
import { cn } from "@/lib/utils";

/**
 * Careers — the hiring page behind the footer's "Careers" link.
 *
 * Content model: roles are declared once in ROLES (id + department + location +
 * employment type keys) and every visible string is localized through the
 * `careersPage` namespace, so adding a role is a data change plus four short
 * translation entries — never a layout change.
 *
 * Roles carry no external URL: the CTA opens the same in-product contact flow
 * the rest of the marketing site uses, which keeps the page honest about where
 * applications actually go.
 */

interface Role {
  id: string;
  departmentKey: string;
  locationKey: string;
  typeKey: string;
  icon: React.ElementType;
  accent: string;
}

// `id` is the locale key prefix (`${id}Title`), so it must match the
// careersPage keys shipped in every locale: role1…role4.
const ROLES: Role[] = [
  {
    id: "role1",
    departmentKey: "role1Dept",
    locationKey: "role1Location",
    typeKey: "role1Type",
    icon: BarChart3,
    accent: "#38bdf8",
  },
  {
    id: "role2",
    departmentKey: "role2Dept",
    locationKey: "role2Location",
    typeKey: "role2Type",
    icon: Users,
    accent: "#10b981",
  },
  {
    id: "role3",
    departmentKey: "role3Dept",
    locationKey: "role3Location",
    typeKey: "role3Type",
    icon: Globe,
    accent: "#f59e0b",
  },
  {
    id: "role4",
    departmentKey: "role4Dept",
    locationKey: "role4Location",
    typeKey: "role4Type",
    icon: Building2,
    accent: "#a78bfa",
  },
];

const PERKS = [
  { key: "perk1", icon: Laptop },
  { key: "perk2", icon: Heart },
  { key: "perk3", icon: Globe },
  { key: "perk4", icon: Sparkles },
] as const;

export default function CareersPage() {
  const t = useTranslations("careersPage");
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  return (
    <div className="relative">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden px-4 pt-28 pb-16 text-center sm:px-6 lg:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 h-72 opacity-50 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, hsl(var(--primary) / 0.25), transparent 70%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="relative mx-auto max-w-3xl"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("heroTag")}
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {t("heroPrefix")}{" "}
            <DiaTextReveal
              text={[t("heroWord1"), t("heroWord2"), t("heroWord3")]}
              repeat
              fixedWidth
              duration={1.1}
              holdDuration={1.9}
              colors={[
                "hsl(var(--primary))",
                "color-mix(in oklab, hsl(var(--primary)) 45%, #fff)",
                "hsl(var(--primary))",
              ]}
              textColor="hsl(var(--primary))"
              className="font-bold"
            />
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("heroSubtitle")}
          </p>
        </motion.div>
      </section>

      {/* ─── Perks ─── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-12">
        <h2 className="mb-8 text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("perksTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map(({ key, icon: Icon }) => (
            <div
              key={key}
              className="rounded-2xl border border-border/70 bg-background/70 p-5 shadow-sm backdrop-blur"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">{t(`${key}Title`)}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Open roles ─── */}
      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-12">
        <div className="mb-8 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("rolesTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("rolesSubtitle")}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {t("rolesCount", { count: ROLES.length })}
          </span>
        </div>

        <ul className="space-y-3">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <li key={role.id}>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
                  className={cn(
                    "group flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/80 p-5 backdrop-blur transition-colors",
                    "hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between",
                  )}
                >
                  <div className="flex items-start gap-4 sm:items-center">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: `${role.accent}1f`, color: role.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-foreground">
                        {t(`${role.id}Title`)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{t(role.departmentKey)}</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {t(role.locationKey)}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 font-medium">
                          {t(role.typeKey)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/${locale}/contact?topic=careers`}
                    className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 group-hover:gap-2.5 sm:self-auto"
                    aria-label={t("applyAria", { role: t(`${role.id}Title`) })}
                  >
                    {t("applyCta")}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </motion.div>
              </li>
            );
          })}
        </ul>

        {/* ─── Closing CTA ─── */}
        <div className="mt-12 rounded-3xl border border-border/70 bg-background/70 p-8 text-center backdrop-blur">
          <h3 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {t("ctaTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t("ctaDesc")}</p>
          <Link
            href={`/${locale}/contact?topic=careers`}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:scale-105 active:scale-95 dark:bg-white dark:text-zinc-950"
          >
            {t("ctaButton")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
