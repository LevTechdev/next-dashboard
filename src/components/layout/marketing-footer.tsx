"use client";

import { Instagram, Linkedin, Twitter, Youtube, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

export function MarketingFooter() {
  const params = useParams();
  const locale = (params?.locale) || "en";
  const t = useTranslations("site");

  const footerColumns = [
    {
      title: "Solutions",
      links: [
        { label: "Business Automation", href: `/${locale}/features` },
        { label: "Cloud Services", href: `/${locale}/features` },
        { label: "Analytics", href: `/${locale}/features` },
        { label: "Integrations", href: `/${locale}/integrations-overview` },
      ],
    },
    {
      title: "Resources",
      links: [
        { label: "Documentation", href: "#" },
        { label: "Pricing", href: `/${locale}/pricing` },
        { label: "Changelog", href: `/${locale}/changelog` },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "About Us", href: `/${locale}/about` },
        { label: "Contact", href: `/${locale}/contact` },
        { label: "Careers", href: "#" },
      ],
    },
  ];

  const legalLinks = [
    "Terms of Service",
    "Privacy Policy",
    "Cookie Settings",
    "Accessibility",
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
        <div className="bg-[#b3f021] absolute top-1/3 left-1/4 h-64 w-64 rounded-full opacity-5 dark:opacity-10 blur-3xl" />
        <div className="bg-purple-500 absolute right-1/4 bottom-1/4 h-80 w-80 rounded-full opacity-5 dark:opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-border mb-16 rounded-3xl p-8 md:p-12 shadow-sm">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h3 className="mb-4 text-2xl font-bold md:text-3xl text-zinc-900 dark:text-zinc-100">
                Stay ahead with Next Dashboard
              </h3>
              <p className="text-muted-foreground mb-6">
                Join thousands of professionals who trust Next Dashboard for innovative business solutions.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="bg-background border border-border text-foreground focus:ring-[#b3f021] dark:focus:ring-purple-500 rounded-xl px-4 py-3 focus:ring-2 focus:outline-none flex-1"
                />
                <button className="bg-[#b3f021] dark:bg-purple-600 text-white dark:text-white hover:bg-[#9cd11b] dark:hover:bg-purple-700 rounded-xl px-6 py-3 font-medium transition-colors whitespace-nowrap">
                  Subscribe Now
                </button>
              </div>
            </div>
            <div className="hidden justify-end md:flex">
              <div className="relative">
                <div className="bg-[#b3f021]/20 dark:bg-purple-500/20 absolute inset-0 rotate-6 rounded-2xl" />
                <img
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=320&h=240"
                  alt="Dashboard preview"
                  className="relative w-80 rounded-2xl object-cover shadow-2xl border border-border/50"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2 pr-8">
            <Link href={`/${locale}`} className="mb-6 flex items-center space-x-2">
              <div className="bg-[#b3f021] dark:bg-purple-600 flex h-10 w-10 items-center justify-center rounded-xl shadow-sm">
                <Sparkles className="text-zinc-900 dark:text-white h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Next Dashboard</span>
            </Link>
            <p className="text-muted-foreground mb-6 max-w-xs leading-relaxed">
              Empowering businesses with reliable, scalable, and innovative solutions to unify their operations.
            </p>
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
          
          {footerColumns.map((col) => (
            <div key={col.title}>
              <h4 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-border flex flex-col items-center justify-between border-t pt-8 md:flex-row">
          <p className="text-muted-foreground mb-4 text-sm md:mb-0">
            &copy; {new Date().getFullYear()} Next Dashboard. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {legalLinks.map((text) => (
              <a
                key={text}
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}