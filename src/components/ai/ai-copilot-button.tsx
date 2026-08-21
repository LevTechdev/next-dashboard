"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { SparklesIcon } from "lucide-animated";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useAiCopilot } from "@/components/ai/ai-copilot-provider";

export function AiCopilotButton() {
  const { isOpen, toggle } = useAiCopilot();
  const t = useTranslations("ai");
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.div
          key="ai-copilot-fab"
          initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.8 }}
          transition={
            prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
          }
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-6 z-40 lg:bottom-6"
        >
          {/* Pulse ring — perpetual motion; skipped entirely under reduced motion. */}
          {!prefersReducedMotion && (
            <motion.div
              className="absolute inset-0 rounded-full bg-[hsl(var(--ai-accent)/0.2)]"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 0, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[hsl(var(--ai-accent))] to-[hsl(var(--ai-accent-strong))] text-white shadow-xl shadow-[hsl(var(--ai-accent)/0.35)] hover:shadow-[hsl(var(--ai-accent)/0.45)]"
            aria-label={t("openCopilot")}
          >
            <SparklesIcon size={24} className="h-6 w-6" />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
