"use client";

import { useRouter } from "next/navigation";
import { CheckIcon, EarthIcon } from "lucide-animated";
import { useViewTransition } from "@/components/view-transition-provider";
import { setLocaleCookie } from "@/lib/locale-cookie";
import { useAnalytics } from "@/hooks/use-analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Language Toggle (dropdown with view transitions for smooth locale switching) ─

const LANGUAGES = [
  { code: "en", label: "EN", name: "English", flag: "🇬🇧" },
  { code: "id", label: "ID", name: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "中文", name: "简体中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", name: "日本語", flag: "🇯🇵" },
];

export function LanguageToggle({ locale, pathname }: { locale: string; pathname: string }) {
  const { push: pushWithTransition } = useViewTransition();
  const { trackLanguageSwitch } = useAnalytics();
  const router = useRouter();

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    trackLanguageSwitch(locale, newLocale);
    const newPath = pathname.replace(/^\/[a-z]{2}(?:-\w{2})?/, `/${newLocale}`);
    localStorage.setItem("dashboard-locale", newLocale);
    // Persist locale for next-intl middleware and bust the client Router Cache
    // so server components re-render with the new locale's messages.
    setLocaleCookie(newLocale);
    pushWithTransition(newPath);
    router.refresh();
  };

  const current = LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-500 gap-1 px-2 min-w-[56px] active:scale-95 transition-transform duration-150"
          title={current.name}
        >
          <span className="flex items-center gap-1.5">
            <span className="text-sm leading-none">{current.flag}</span>
            <EarthIcon size={14} className="h-3.5 w-3.5" />
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs text-gray-400 dark:text-gray-500 font-normal">
          Switch Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGUAGES.map((lang) => {
          const isSelected = locale === lang.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => switchLocale(lang.code)}
              className={cn(
                "flex items-center gap-3 cursor-pointer group",
                isSelected
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium"
                  : "text-gray-700 dark:text-gray-300",
              )}
            >
              <span className="text-base shrink-0">{lang.flag}</span>
              <div className="flex-1 min-w-0">
                <span className="block text-sm leading-tight">{lang.label}</span>
                <span className="block text-[10px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5 truncate">
                  {lang.name}
                </span>
              </div>
              {isSelected ? (
                <CheckIcon
                  size={16}
                  className="h-4 w-4 text-indigo-500 animate-in zoom-in-50 duration-200"
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
