"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StratusFaqItem {
  id: string;
  question: string;
  answer: string;
}

interface StratusFaqProps {
  /** Translation function scoped to the namespace that holds the FAQ strings */
  t: (key: string) => string;
  /**
   * Override items. When omitted, the homepage's `homepage.faq.*` entries are
   * used (q1..q5 / a1..a5). Pages like /pricing pass their own set.
   */
  items?: StratusFaqItem[];
  /** Namespace-relative keys for the header (defaults to homepage faq.*). */
  badgeKey?: string;
  titlePart1Key?: string;
  titlePart2Key?: string;
  /** First item open by default on the homepage; pricing starts fully closed. */
  defaultOpenIndex?: number | null;
  id?: string;
  className?: string;
}

/**
 * Stratus FAQ — dashed badge, dual-tone typography and blur-reveal accordion.
 * Shared by the homepage and (with custom items) the pricing page so both
 * surfaces carry the exact same design language.
 */
export function StratusFaq({
  t,
  items,
  badgeKey = "faq.badge",
  titlePart1Key = "faq.titlePart1",
  titlePart2Key = "faq.titlePart2",
  defaultOpenIndex = 0,
  id = "faq",
  className,
}: StratusFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpenIndex);

  const faqItems: StratusFaqItem[] =
    items ??
    [1, 2, 3, 4, 5].map((n) => ({
      id: `faq-${n}`,
      question: t(`faq.q${n}`) || "",
      answer: t(`faq.a${n}`) || "",
    }));

  return (
    <section id={id} className={cn("px-4 sm:px-6 lg:px-12 py-20 max-w-4xl mx-auto", className)}>
      {/* Stratus Section Header */}
      <div className="flex flex-col justify-center items-center space-y-4 mb-14 text-center">
        {/* Dashed badge */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mx-auto w-fit"
        >
          <div className="flex items-center gap-2 border-2 border-dashed border-border/80 rounded-xl py-1.5 px-3 bg-background/50 backdrop-blur-sm">
            <HelpCircle className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(badgeKey)}
            </span>
          </div>
        </motion.div>

        {/* Dual-tone typography */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(8px)" }}
          whileInView={{ opacity: 1, filter: "blur(0px)" }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex flex-col items-center justify-center leading-tight"
        >
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-muted-foreground/50 dark:text-zinc-500">
            {t(titlePart1Key)}
          </h2>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mt-1">
            {t(titlePart2Key)}
          </h2>
        </motion.div>
      </div>

      {/* Accordion list */}
      <div className="flex flex-col gap-3.5 max-w-2xl mx-auto">
        {faqItems.map((item, index) => {
          const isOpen = openIndex === index;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="flex flex-col"
            >
              <div
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className={cn(
                  "flex flex-col gap-2 cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all duration-200 select-none",
                  isOpen
                    ? "bg-muted/70 dark:bg-zinc-900/80 border-primary/30 shadow-sm"
                    : "bg-background/80 dark:bg-zinc-950/60 border-border/70 hover:bg-muted/40 hover:border-border",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-[15px] sm:text-base font-semibold text-foreground leading-snug">
                    {item.question}
                  </h3>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      "shrink-0 rounded-lg p-1.5 transition-colors",
                      isOpen
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted dark:bg-zinc-800 text-foreground",
                    )}
                  >
                    {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  </motion.div>
                </div>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0, filter: "blur(6px)" }}
                      animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
                      exit={{ height: 0, opacity: 0, filter: "blur(6px)" }}
                      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pt-3 border-t border-border/50 text-sm text-muted-foreground leading-relaxed">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
