"use client";

import { motion } from "framer-motion";
import { SparklesIcon } from "lucide-animated";
import { cn } from "@/lib/utils";
import { useAiCopilot } from "@/components/ai/ai-copilot-provider";

export function AiCopilotButton() {
  const { isOpen, toggle } = useAiCopilot();

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-emerald-500/20"
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

      <motion.button
        onClick={toggle}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={cn(
          "relative flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-colors duration-300",
          isOpen
            ? "bg-gray-800 dark:bg-gray-700 text-white"
            : "bg-gradient-to-br from-emerald-500 to-[oklch(0.78_0.22_147.35)] text-white shadow-emerald-500/30 hover:shadow-emerald-500/40",
        )}
        aria-label={isOpen ? "Close AI Copilot" : "Open AI Copilot"}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <SparklesIcon size={24} className="h-6 w-6" />
        </motion.div>
      </motion.button>
    </div>
  );
}
