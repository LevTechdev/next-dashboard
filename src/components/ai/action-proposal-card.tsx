"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SparklesIcon, ZapIcon, CheckIcon, LoaderCircleIcon } from "lucide-animated";
import { Tag, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CopilotActionProposal } from "@/lib/ai/copilot-proposals";

interface ActionProposalCardProps {
  proposal: CopilotActionProposal;
}

export function ActionProposalCard({ proposal }: ActionProposalCardProps) {
  const t = useTranslations("copilotActions");
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(proposal.status === "executed");
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const handleExecute = async () => {
    if (executing || executed) return;
    setExecuting(true);
    try {
      const res = await fetch("/api/ai/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Execution failed");
      }

      setExecuted(true);
      setResultMessage(data.message || t("executedSuccess"));
      toast.success(data.message || t("executedSuccess"));
    } catch (err: any) {
      toast.error(err.message || t("executedFailed"));
    } finally {
      setExecuting(false);
    }
  };

  const isDiscount = proposal.type === "CREATE_DISCOUNT";

  return (
    <div className="mt-3 w-full max-w-md rounded-xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-primary/10 p-3.5 shadow-sm transition-all duration-200 hover:border-primary/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary">
            {isDiscount ? <Tag className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            {t("actionProposal")}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
          <SparklesIcon size={12} className="h-3 w-3" animateOnHover />
          {t("aiRecommended")}
        </span>
      </div>

      <h5 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {proposal.title}
      </h5>
      <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed mb-2.5">
        {proposal.description}
      </p>

      {proposal.estimatedImpact && (
        <div className="mb-3 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
          📈 {proposal.estimatedImpact}
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-primary/15">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {executed ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckIcon size={14} className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {resultMessage || t("actionExecuted")}
            </span>
          ) : (
            t("readyToExecute")
          )}
        </span>

        <button
          type="button"
          onClick={handleExecute}
          disabled={executing || executed}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm active:scale-[0.98] hover:scale-[1.02]",
            executed
              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 cursor-default"
              : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/20",
          )}
        >
          {executing ? (
            <>
              <LoaderCircleIcon size={14} className="h-3.5 w-3.5 animate-spin" />
              {t("executing")}
            </>
          ) : executed ? (
            <>
              <CheckIcon size={14} className="h-3.5 w-3.5" />
              {t("executed")}
            </>
          ) : (
            <>
              <ZapIcon size={14} className="h-3.5 w-3.5 fill-current" animateOnHover />
              {t("executeButton")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
