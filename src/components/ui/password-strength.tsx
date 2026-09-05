"use client";

import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
}

function getStrength(password: string): { score: number; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak" };
  if (score <= 2) return { score, label: "Fair" };
  if (score <= 3) return { score, label: "Good" };
  if (score <= 4) return { score, label: "Strong" };
  return { score, label: "Very Strong" };
}

/**
 * Password strength meter. The fill segments use a gradient of the app's
 * accent color (hsl(var(--primary))) so it follows the Settings → Appearance
 * choice (including a custom color) instead of a fixed green/red palette.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { score, label } = getStrength(password);

  return (
    <div className="mt-2 space-y-1" data-testid="password-strength">
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < score ? "opacity-100" : "bg-muted opacity-40",
            )}
            style={
              i < score
                ? {
                    backgroundImage:
                      "linear-gradient(90deg, hsl(var(--primary) / 0.45), hsl(var(--primary)))",
                  }
                : undefined
            }
          />
        ))}
      </div>
      <p
        className={cn(
          "text-xs font-medium transition-colors",
          score >= 4 ? "text-primary" : "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}
