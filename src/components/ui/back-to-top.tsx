"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface BackToTopProps {
  threshold?: number;
  className?: string;
}

export function BackToTop({ threshold = 350, className }: BackToTopProps) {
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const t = useTranslations("common");

  useEffect(() => {
    const checkScroll = () => {
      setVisible(window.scrollY > threshold);
    };

    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();

    return () => window.removeEventListener("scroll", checkScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          whileHover={prefersReducedMotion ? undefined : { scale: 1.1 }}
          whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
          className={cn("fixed bottom-8 right-8 z-50", className)}
        >
          <Tooltip content={t("backToTop")} side="left">
            <button
              onClick={scrollToTop}
              aria-label={t("backToTop")}
              className={cn(
                "flex items-center justify-center w-11 h-11 rounded-full",
                "bg-background/80 text-foreground border border-border/80 shadow-lg shadow-black/10 backdrop-blur-md",
                "hover:bg-accent hover:text-accent-foreground hover:border-border transition-colors cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              )}
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
