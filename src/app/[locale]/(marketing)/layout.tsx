"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useAnalytics } from "@/hooks/use-analytics";
import { setLocaleCookie } from "@/lib/locale-cookie";
import { motion, AnimatePresence } from "framer-motion";
import {
  XIcon,
  MenuIcon,
  ChevronRightIcon,
  SparklesIcon,
  LayersIcon,
  SunIcon,
  MoonIcon,
  MessageSquareIcon,
  EarthIcon,
  LayoutGridIcon,
  CircleDollarSignIcon,
  UsersIcon,
} from "lucide-animated";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RadialGlowButton } from "@/components/ui/radial-glow-button";
import { useAuth } from "@/hooks/use-auth";
import PageTransition from "@/components/page-transition";
import { ViewTransitionProvider } from "@/components/view-transition-provider";
import { TransitionLink } from "@/components/transition-link";
import UnsupportedBrowserBanner from "@/components/unsupported-browser-banner";

const navLinks = [
  { labelKey: "navFeatures", href: "/features", icon: LayoutGridIcon },
  { labelKey: "navIntegrations", href: "/integrations-overview", icon: LayersIcon },
  { labelKey: "navPricing", href: "/pricing", icon: CircleDollarSignIcon },
  { labelKey: "navChangelog", href: "/changelog", icon: SparklesIcon },
  { labelKey: "navAbout", href: "/about", icon: UsersIcon },
  { labelKey: "navContact", href: "/contact", icon: MessageSquareIcon },
] as const;

import { MarketingHeader } from "@/components/layout/marketing-header";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const locale = (params?.locale as string) || "en";
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("site");

  // Track scroll for navbar transparency
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <ViewTransitionProvider>
      <UnsupportedBrowserBanner />
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 transition-colors motion-spring">
        <MarketingHeader scrolled={scrolled} />



        {/* ═══ MAIN CONTENT with animated page transitions ═══ */}
        <main className="overflow-x-hidden">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* ═══ FOOTER ═══ */}
        <MarketingFooter />
      </div>
    </ViewTransitionProvider>
  );
}
