"use client";

import { Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function MarketingFooter() {
  const params = useParams();
  const locale = params?.locale || "en";
  const t = useTranslations("site");

  const footerColumns = [
    {
      titleKey: "footerSolutions",
      links: [
        { labelKey: "footerLinkBusinessAutomation", href: `/${locale}/features` },
        { labelKey: "footerLinkCloudServices", href: `/${locale}/features` },
        { labelKey: "footerLinkAnalytics", href: `/${locale}/features` },
        { labelKey: "navIntegrations", href: `/${locale}/integrations-overview` },
      ],
    },
    {
      titleKey: "footerResources",
      links: [
        { labelKey: "footerLinkDocumentation", href: "#" },
        { labelKey: "navPricing", href: `/${locale}/pricing` },
        { labelKey: "navChangelog", href: `/${locale}/changelog` },
      ],
    },
    {
      titleKey: "footerCompany",
      links: [
        { labelKey: "footerLinkAboutUs", href: `/${locale}/about` },
        { labelKey: "navContact", href: `/${locale}/contact` },
        { labelKey: "footerLinkCareers", href: "#" },
      ],
    },
  ];

  const legalLinks = [
    "footerLegalTerms",
    "footerLegalPrivacy",
    "footerLegalCookies",
    "footerLegalAccessibility",
  ];

  const socialIcons = [
    { icon: <Instagram className="h-5 w-5" />, href: "#" },
    { icon: <Twitter className="h-5 w-5" />, href: "#" },
    { icon: <Linkedin className="h-5 w-5" />, href: "#" },
    { icon: <Youtube className="h-5 w-5" />, href: "#" },
  ];

  return (
    <footer className="bg-background text-foreground relative w-full pt-20 pb-10 overflow-hidden border-t border-border mt-20">
      <div className="pointer-events-none absolute top-0 left-0 z-0 h-full w-full overflow-hidden">
        <div className="bg-primary/5 absolute top-1/3 left-1/4 h-64 w-64 rounded-full blur-3xl" />
        <div className="bg-primary/10 absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-border mb-16 rounded-3xl p-8 md:p-12 shadow-sm">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold md:text-3xl text-zinc-900 dark:text-zinc-100">
                {t("footerCtaTitle")}
              </h3>
              <p className="text-muted-foreground mb-6">{t("footerCtaDesc")}</p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <input
                  type="email"
                  placeholder={t("footerEmailPlaceholder")}
                  className="bg-background border border-border text-foreground focus:ring-primary rounded-xl px-4 py-3 focus:ring-2 focus:outline-none flex-1"
                />
                <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-6 py-3 font-medium transition-colors whitespace-nowrap">
                  {t("footerSubscribe")}
                </button>
              </div>
            </div>
            <div className="hidden justify-end md:flex">
              <div className="relative">
                <div className="bg-[#b3f021]/20 dark:bg-purple-500/20 absolute inset-0 rotate-6 rounded-2xl" />
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=320&h=240"
                  alt={t("footerPreviewAlt")}
                  className="relative w-80 rounded-2xl object-cover shadow-2xl border border-border/50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Brand lockup — centered like the auth pages: animated logo above a
            short tagline, socials beneath. The columns follow below. */}
        <div className="mb-12 flex flex-col items-center text-center">
          <BrandLogo href={`/${locale}`} animated className="mb-5" />
          <p className="text-muted-foreground mb-6 max-w-md leading-relaxed">{t("footerDesc")}</p>
          <div className="flex space-x-4">
            {socialIcons.map((item, i) => (
              <a
                key={i}
                href={item.href}
                className="bg-white dark:bg-zinc-900 border border-border hover:bg-zinc-100 dark:hover:bg-zinc-800 flex h-10 w-10 items-center justify-center rounded-full transition-colors text-zinc-600 dark:text-zinc-400"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="mb-16 grid grid-cols-2 gap-8 md:grid-cols-3">
          {footerColumns.map((col) => (
            <div key={col.titleKey}>
              <h4 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">
                {t(col.titleKey)}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border flex flex-col items-center justify-between border-t pt-8 md:flex-row">
          <p className="text-muted-foreground mb-4 text-sm md:mb-0">
            &copy; {new Date().getFullYear()} {t("footerRights")}
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {legalLinks.map((text) => (
              <a
                key={text}
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {t(text)}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
