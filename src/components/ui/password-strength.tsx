"use client";

import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): {
  score: number;
  label: string;
  color: string;
  bgColor: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "text-red-500", bgColor: "bg-red-500" };
  if (score <= 2)
    return { score, label: "Fair", color: "text-orange-500", bgColor: "bg-orange-500" };
  if (score <= 3)
    return { score, label: "Good", color: "text-yellow-500", bgColor: "bg-yellow-500" };
  if (score <= 4)
    return { score, label: "Strong", color: "text-green-500", bgColor: "bg-green-500" };
  return { score, label: "Very Strong", color: "text-emerald-500", bgColor: "bg-emerald-500" };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label, color, bgColor } = getStrength(password);
  const segments = 5;

  return (
    <div className="mt-2 space-y-1" data-testid="password-strength">
      <div className="flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? bgColor : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", color)}>{label}</p>
    </div>
  );
}
