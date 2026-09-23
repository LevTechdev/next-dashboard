"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface LinkedPlatformsBadgeProps {
  productId: string;
  count: number;
  className?: string;
}

/**
 * Small clickable badge showing how many affiliate platforms a product is
 * linked to. Clicking jumps straight to that product's Platform Links section
 * (/products/[id]#platform-links). Renders nothing when count is 0.
 */
export function LinkedPlatformsBadge({ productId, count, className }: LinkedPlatformsBadgeProps) {
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  const t = useTranslations("products");

  if (!count || count <= 0) return null;

  return (
    <Tooltip side="top" content={t("linkedPlatforms")}>
      <Link
        href={`/${locale}/products/${productId}#platform-links`}
        onClick={(e) => e.stopPropagation()}
        aria-label={`${t("linkedPlatforms")} (${count})`}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium align-middle hover:bg-primary/20 transition-colors",
          className,
        )}
      >
        <Share2 className="h-2.5 w-2.5" />
        {count}
      </Link>
    </Tooltip>
  );
}
