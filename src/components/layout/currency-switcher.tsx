"use client";

import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/currency-provider";
import { CURRENCIES, SupportedCurrencyCode } from "@/lib/currency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export function CurrencySwitcher({ className }: { className?: string }) {
  const t = useTranslations("currency");
  const { currency, setCurrency, currentConfig } = useCurrency();

  const currencyList = Object.values(CURRENCIES);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 px-2.5 gap-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors",
            className,
          )}
          title={t("switchCurrencyTooltip")}
        >
          <span className="font-semibold text-primary">{currentConfig.symbol}</span>
          <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">
            {currentConfig.code}
          </span>
          <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl">
        <DropdownMenuLabel className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1 flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-primary" />
          {t("dropdownTitle")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {currencyList.map((curr) => {
          const isSelected = curr.code === currency;
          return (
            <DropdownMenuItem
              key={curr.code}
              onClick={() => setCurrency(curr.code)}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs group",
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{curr.flag}</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-gray-900 dark:text-white">{curr.code}</span>
                    <span className="text-[11px] font-mono text-gray-400">({curr.symbol})</span>
                  </div>
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">
                    {curr.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {curr.code !== "USD" && (
                  <span className="text-[10px] font-mono text-gray-400">
                    ~{curr.rate >= 100 ? Math.round(curr.rate).toLocaleString() : curr.rate}
                  </span>
                )}
                {isSelected ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <span className="w-3.5 h-3.5" />
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
