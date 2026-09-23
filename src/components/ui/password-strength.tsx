"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type PasswordStrengthLevel = "weak" | "fair" | "good" | "strong";

interface PasswordStrengthProps {
  password: string;
}

/**
 * Score a password into 4 user-facing levels.
 * Returns the level plus a 0–4 filled-segment count for the meter UI:
 * weak → 1, fair → 2, good → 3, strong → 4 (of 4 segments).
 */
export function getPasswordStrength(password: string): {
  level: PasswordStrengthLevel;
  segments: number;
} {
  if (!password) return { level: "weak", segments: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  // 0–1 criteria → weak, 2 → fair, 3 → good, 4+ → strong
  if (score <= 1) return { level: "weak", segments: 1 };
  if (score === 2) return { level: "fair", segments: 2 };
  if (score === 3) return { level: "good", segments: 3 };
  return { level: "strong", segments: 4 };
}

/** Severity palette per level — works in light & dark mode. */
const LEVEL_STYLES: Record<PasswordStrengthLevel, { bar: string; text: string }> = {
  weak: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  fair: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  good: { bar: "bg-lime-500", text: "text-lime-600 dark:text-lime-400" },
  strong: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
};

/**
 * 4-level password strength meter (weak / fair / good / strong) with distinct
 * severity colors. Labels are translated through the `auth` namespace
 * (strength.weak … strength.strong) so the meter is localized on the sign-up,
 * reset-password, and change-password forms alike.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const t = useTranslations("auth");
  const { level, segments } = getPasswordStrength(password);
  const styles = LEVEL_STYLES[level];

  return (
    <div className="mt-2 space-y-1" data-testid="password-strength" data-level={level}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < segments ? styles.bar : "bg-muted opacity-40",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium transition-colors", styles.text)}>
        {t(`strength.${level}`)}
      </p>
    </div>
  );
}
