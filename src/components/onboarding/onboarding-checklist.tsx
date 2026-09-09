"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useOnboarding } from "@/components/onboarding/onboarding-provider";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChevronRight, X, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function OnboardingChecklist() {
  const t = useTranslations("onboarding");
  const { steps, completeStep, progress, dismiss, isDismissed, isComplete } = useOnboarding();
  const [isExpanded, setIsExpanded] = useState(true);
  const pathname = usePathname();
  const locale = pathname?.split("/")[1] || "en";
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isComplete && !isDismissed) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isComplete, isDismissed]);

  if (isDismissed || isComplete) return null;

  return (
    <Card className="relative overflow-hidden border-border bg-card text-card-foreground shadow-sm mb-6 dark:bg-card">
      <div className="absolute top-0 left-0 h-1 bg-primary/20 w-full">
        <motion.div 
          className="h-full bg-primary" 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-50">
           <div className="text-6xl animate-bounce">🎉🎊✨</div>
        </div>
      )}

      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <div>
            <CardTitle className="text-lg font-semibold">{t("title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
            {t("progress", { percent: progress })}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss}>
            <X className="w-4 h-4 mr-1" />
            {t("dismiss")}
          </Button>
        </div>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <CardContent className="grid gap-2">
              {steps.map((step, index) => (
                <motion.div 
                  key={step.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link 
                    href={`/${locale}${step.href}`}
                    onClick={() => completeStep(step.id)}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-lg transition-colors border",
                      step.completed ? "bg-muted/50 border-transparent opacity-60" : "bg-card hover:bg-muted border-border"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {step.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "text-sm font-medium",
                        step.completed && "line-through text-muted-foreground"
                      )}>
                        {t(step.labelKey)}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {t(step.descKey)}
                      </p>
                    </div>
                    
                    <div className="flex-shrink-0">
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </Link>
                </motion.div>
              ))}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
