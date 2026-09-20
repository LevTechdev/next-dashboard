"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Settings2,
  Sparkles,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ScheduledReportsDialog() {
  const t = useTranslations("scheduledReports");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [recipients, setRecipients] = useState<string[]>([
    "admin@example.com",
    "stakeholders@example.com",
  ]);
  const [newEmail, setNewEmail] = useState("");
  const [metrics, setMetrics] = useState({
    gmv: true,
    topProducts: true,
    forecast: true,
    channelBreakdown: true,
  });

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/reports/scheduled")
        .then((r) => r.json())
        .then((data) => {
          if (data.schedule) {
            setFrequency(data.schedule.frequency || "WEEKLY");
            if (data.schedule.recipients?.length) setRecipients(data.schedule.recipients);
            if (data.schedule.metrics) setMetrics(data.schedule.metrics);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes("@")) {
      toast.error(t("validEmailError"));
      return;
    }
    if (recipients.includes(newEmail.trim())) {
      toast.error(t("duplicateEmailError"));
      return;
    }
    setRecipients([...recipients, newEmail.trim()]);
    setNewEmail("");
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleSaveSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reports/scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency,
          recipients,
          metrics,
        }),
      });
      if (!res.ok) throw new Error("Failed to save schedule");
      toast.success(t("saveSuccess"));
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update schedule");
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNow = async () => {
    try {
      setSendingTest(true);
      const email = recipients[0] || "admin@example.com";
      const res = await fetch("/api/reports/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch digest");
      toast.success(t("testSent", { email }));
    } catch (err: any) {
      toast.error(err.message || "Could not send digest");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs border-primary/30 hover:border-primary/50"
        >
          <Mail className="h-3.5 w-3.5 text-indigo-500" />
          {t("buttonLabel")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-indigo-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Frequency Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t("deliveryFrequency")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setFrequency(freq)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    frequency === freq
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {freq === "DAILY"
                    ? t("freqDaily")
                    : freq === "WEEKLY"
                      ? t("freqWeekly")
                      : t("freqMonthly")}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients List */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t("recipients")}
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-muted/20 min-h-[44px]">
              {recipients.map((email) => (
                <Badge
                  key={email}
                  variant="outline"
                  className="gap-1 pr-1 text-xs py-1 bg-background border"
                >
                  {email}
                  <button
                    type="button"
                    onClick={() => handleRemoveEmail(email)}
                    className="hover:text-destructive transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <form onSubmit={handleAddEmail} className="flex gap-2 pt-1">
              <input
                type="email"
                placeholder={t("emailPlaceholder")}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" size="sm" variant="outline" className="h-8 gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                {t("addEmail")}
              </Button>
            </form>
          </div>

          {/* Included KPIs */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {t("includedKpis")}
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metrics.gmv}
                  onChange={(e) => setMetrics({ ...metrics, gmv: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span>{t("kpiGmv")}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metrics.topProducts}
                  onChange={(e) => setMetrics({ ...metrics, topProducts: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span>{t("kpiTopProducts")}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metrics.forecast}
                  onChange={(e) => setMetrics({ ...metrics, forecast: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span>{t("kpiForecast")}</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={metrics.channelBreakdown}
                  onChange={(e) => setMetrics({ ...metrics, channelBreakdown: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <span>{t("kpiChannels")}</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 text-xs text-primary border-primary/30"
              onClick={handleSendTestNow}
              disabled={sendingTest}
            >
              {sendingTest ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {t("sendTestNow")}
            </Button>
            <div className="flex-1" />
            <Button size="sm" onClick={handleSaveSchedule} disabled={loading} className="text-xs">
              {t("saveSchedule")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
