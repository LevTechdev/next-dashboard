"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  LogOut,
  Power,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserX,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/sora-ui/base/alert-dialog";
import { Button } from "@/components/sora-ui/base/button";
import { cn } from "@/lib/utils";

const easeSmooth = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ── Snippet sources (rendered under each demo for design/dev review) ── */

const SNIPPET_BASIC = `<AlertDialog>
  <AlertDialogTrigger
    render={<Button variant="destructive">Delete project</Button>}
  />
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogMedia className="bg-destructive/10 text-destructive">
        <AlertTriangleIcon />
      </AlertDialogMedia>
      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete your
        project repository, database records, and remove all associated
        API keys.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction closeOnClick variant="destructive">
        Delete repository
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`;

const SNIPPET_TRASH = `<AlertDialogContent>
  <AlertDialogHeader>
    <AlertDialogMedia className="bg-destructive/10 text-destructive">
      <Trash2Icon />
    </AlertDialogMedia>
    <AlertDialogTitle>Delete this customer?</AlertDialogTitle>
    <AlertDialogDescription>
      The customer is deactivated to preserve order history.
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction closeOnClick variant="destructive">
      Delete customer
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>`;

const SNIPPET_REVOKE = `<AlertDialogContent>
  <AlertDialogHeader>
    <AlertDialogMedia className="bg-destructive/10 text-destructive">
      <KeyRoundIcon />
    </AlertDialogMedia>
    <AlertDialogTitle>Revoke this passkey?</AlertDialogTitle>
    <AlertDialogDescription>
      Devices using this passkey will immediately lose access. You can
      register a new passkey at any time.
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction closeOnClick variant="destructive">
      Revoke passkey
    </AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>`;

const SNIPPET_CONFIRM = `<AlertDialogContent>
  <AlertDialogHeader>
    <AlertDialogMedia className="bg-primary/10 text-primary">
      <RefreshCwIcon />
    </AlertDialogMedia>
    <AlertDialogTitle>Regenerate backup codes?</AlertDialogTitle>
    <AlertDialogDescription>
      Your existing backup codes stop working immediately. Download the
      new codes before continuing.
    </AlertDialogDescription>
  </AlertDialogHeader>
  <AlertDialogFooter>
    <AlertDialogCancel>Cancel</AlertDialogCancel>
    <AlertDialogAction closeOnClick>Regenerate</AlertDialogAction>
  </AlertDialogFooter>
</AlertDialogContent>`;

/* ── Reusable demo shell ── */

interface DemoVariant {
  id: string;
  title: string;
  description: string;
  trigger: string;
  triggerVariant: "destructive" | "default" | "outline" | "ghost";
  media: React.ReactNode;
  mediaTone: string;
  dialogTitle: string;
  dialogDescription: string;
  actionLabel: string;
  destructive: boolean;
  snippet: string;
}

function DemoCard({ variant, t }: { variant: DemoVariant; t: ReturnType<typeof useTranslations> }) {
  const [open, setOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      <div className="px-4 py-3.5 flex items-center gap-3">
        <span className="font-mono text-xs font-bold text-primary shrink-0 uppercase">
          {variant.id}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground truncate">{variant.title}</h3>
          <p className="text-xs text-muted-foreground truncate">{variant.description}</p>
        </div>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button variant={variant.triggerVariant}>{variant.trigger}</Button>}
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className={variant.mediaTone}>{variant.media}</AlertDialogMedia>
              <AlertDialogTitle>{variant.dialogTitle}</AlertDialogTitle>
              <AlertDialogDescription>{variant.dialogDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                closeOnClick
                onClick={() => setOpen(false)}
                variant={variant.destructive ? "destructive" : "default"}
              >
                {variant.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <button
        onClick={() => setShowCode((v) => !v)}
        className="w-full border-t border-border px-4 py-2 text-left text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors cursor-pointer"
      >
        {showCode ? "▾" : "▸"} JSX
      </button>
      {showCode && (
        <pre className="bg-gray-950 dark:bg-black p-3 overflow-x-auto text-xs font-mono text-emerald-400 max-h-72 overflow-y-auto">
          <code>{variant.snippet}</code>
        </pre>
      )}
    </div>
  );
}

export default function SoraGalleryPage({ params }: { params: Promise<{ locale: string }> }) {
  use(params);
  const t = useTranslations("soraGalleryPage");
  const tCommon = useTranslations("common");

  const destructive: DemoVariant[] = [
    {
      id: "delete",
      title: t("variants.delete.title"),
      description: t("variants.delete.description"),
      trigger: t("variants.delete.trigger"),
      triggerVariant: "destructive",
      media: <Trash2 />,
      mediaTone: "bg-destructive/10 text-destructive",
      dialogTitle: t("variants.delete.dialogTitle"),
      dialogDescription: t("variants.delete.dialogDescription"),
      actionLabel: t("variants.delete.action"),
      destructive: true,
      snippet: SNIPPET_TRASH,
    },
    {
      id: "revoke",
      title: t("variants.revoke.title"),
      description: t("variants.revoke.description"),
      trigger: t("variants.revoke.trigger"),
      triggerVariant: "outline",
      media: <KeyRound />,
      // Match the shipped ConfirmProvider contract: the glyph says WHAT kind
      // of loss this is (credential), the destructive red tint says HOW BAD
      // (access is gone). Reversible soft-removals keep the amber tone below.
      mediaTone: "bg-destructive/10 text-destructive",
      dialogTitle: t("variants.revoke.dialogTitle"),
      dialogDescription: t("variants.revoke.dialogDescription"),
      actionLabel: t("variants.revoke.action"),
      destructive: true,
      snippet: SNIPPET_REVOKE,
    },
    {
      id: "warning",
      title: t("variants.warning.title"),
      description: t("variants.warning.description"),
      trigger: t("variants.warning.trigger"),
      triggerVariant: "outline",
      media: <AlertTriangle />,
      mediaTone: "bg-destructive/10 text-destructive",
      dialogTitle: t("variants.warning.dialogTitle"),
      dialogDescription: t("variants.warning.dialogDescription"),
      actionLabel: t("variants.warning.action"),
      destructive: true,
      snippet: SNIPPET_BASIC,
    },
    {
      id: "confirm",
      title: t("variants.confirm.title"),
      description: t("variants.confirm.description"),
      trigger: t("variants.confirm.trigger"),
      triggerVariant: "default",
      media: <RefreshCw />,
      mediaTone: "bg-primary/10 text-primary",
      dialogTitle: t("variants.confirm.dialogTitle"),
      dialogDescription: t("variants.confirm.dialogDescription"),
      actionLabel: t("variants.confirm.action"),
      destructive: false,
      snippet: SNIPPET_CONFIRM,
    },
    {
      id: "signout",
      title: t("variants.signout.title"),
      description: t("variants.signout.description"),
      trigger: t("variants.signout.trigger"),
      triggerVariant: "ghost",
      media: <LogOut />,
      mediaTone: "bg-muted text-foreground",
      dialogTitle: t("variants.signout.dialogTitle"),
      dialogDescription: t("variants.signout.dialogDescription"),
      actionLabel: t("variants.signout.action"),
      destructive: true,
      snippet: SNIPPET_BASIC,
    },
    {
      id: "deactivate",
      title: t("variants.deactivate.title"),
      description: t("variants.deactivate.description"),
      trigger: t("variants.deactivate.trigger"),
      triggerVariant: "outline",
      media: <UserX />,
      mediaTone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      dialogTitle: t("variants.deactivate.dialogTitle"),
      dialogDescription: t("variants.deactivate.dialogDescription"),
      actionLabel: t("variants.deactivate.action"),
      destructive: true,
      snippet: SNIPPET_TRASH,
    },
  ];

  const usage = [
    { icon: <Trash2 className="size-4" />, label: t("rules.deleteRecords") },
    { icon: <KeyRound className="size-4" />, label: t("rules.revokeCredentials") },
    { icon: <AlertTriangle className="size-4" />, label: t("rules.irreversible") },
    { icon: <ShieldCheck className="size-4" />, label: t("rules.destructiveAction") },
    { icon: <Power className="size-4" />, label: t("rules.confirmFirst") },
  ];

  return (
    <div className="bg-zinc-50 dark:bg-[#0b0c11] text-zinc-900 dark:text-zinc-100 overflow-x-hidden min-h-screen">
      {/* ── HERO ── */}
      <section className="relative pt-24 pb-10 px-4 sm:px-6 lg:px-12 text-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: easeSmooth }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          <Link
            href="/docs"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("backToDocs")}
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-dashed border-primary/40 bg-primary/5 text-xs font-semibold text-primary mb-4">
            <ShieldCheck className="h-3 w-3" />
            {t("badge")}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground">{t("subtitle")}</p>
        </motion.div>
      </section>

      {/* ── USAGE RULES ── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: easeSmooth }}
          className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("rulesTitle")}
          </span>
          {usage.map((u, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span className="text-primary">{u.icon}</span>
              {u.label}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ── VARIANTS ── */}
      <section className="px-4 sm:px-6 lg:px-12 pb-24 max-w-5xl mx-auto space-y-2.5">
        {destructive.map((v, i) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.3), ease: easeSmooth }}
          >
            <DemoCard variant={v} t={tCommon} />
          </motion.div>
        ))}
      </section>
    </div>
  );
}
