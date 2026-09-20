"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Member activity heat strip — a compact 12-week contribution grid for a
 * single team member, shown inline in the team table (admin view).
 *
 * Data comes from /api/profile/activity (admin may pass ?userId=) — the same
 * source as the profile heatmap, so per-member grids stay consistent with
 * what each member sees on their own profile.
 */

interface ActivityPayload {
  days: Record<string, number>;
  total: number;
  activeDays: number;
}

function levelClass(level: number): string {
  switch (level) {
    case 0:
      return "bg-muted";
    case 1:
      return "bg-primary/25";
    case 2:
      return "bg-primary/50";
    case 3:
      return "bg-primary/75";
    default:
      return "bg-primary";
  }
}

function levelOf(v: number): number {
  if (v <= 0) return 0;
  if (v <= 2) return 1;
  if (v <= 5) return 2;
  if (v <= 9) return 3;
  return 4;
}

const WEEKS = 12;

export function MemberActivityGrid({ userId }: { userId: string }) {
  const t = useTranslations("team");
  const [data, setData] = useState<ActivityPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile/activity?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ActivityPayload | null) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Trailing 12 full weeks, Monday-start columns like the profile heatmap.
  const columns: number[][] = (() => {
    const out: number[][] = [];
    const days = data?.days;
    if (!days || typeof days !== "object") return out;
    const today = new Date();
    const cursor = new Date(today);
    cursor.setDate(cursor.getDate() - (WEEKS * 7 - 1));
    cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const key = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    while (cursor <= today) {
      const col: number[] = [];
      for (let i = 0; i < 7; i += 1) {
        col.push(days[key(cursor)] ?? 0);
        cursor.setDate(cursor.getDate() + 1);
      }
      out.push(col);
    }
    return out;
  })();

  if (failed) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }

  if (!columns.length) {
    return (
      <span
        className="inline-block h-4 w-24 animate-pulse rounded bg-muted"
        data-member-grid-loading
      />
    );
  }

  return (
    <Tooltip
      side="top"
      content={t("activityTooltip", { total: data?.total ?? 0, days: data?.activeDays ?? 0 })}
    >
      <div
        tabIndex={0}
        className="inline-flex flex-col gap-[2px] outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
        data-testid={`member-grid-${userId}`}
      >
        {columns.map((col, ci) => (
          <div key={ci} className="flex gap-[2px]">
            {col.map((v, di) => (
              <span
                key={di}
                className={cn("h-[7px] w-[7px] rounded-[2px]", levelClass(levelOf(v)))}
              />
            ))}
          </div>
        ))}
      </div>
    </Tooltip>
  );
}
