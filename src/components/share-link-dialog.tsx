"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { CopyIcon, DownloadIcon, CheckIcon } from "lucide-animated";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  WhatsAppBrandIcon,
  TelegramBrandIcon,
  XBrandIcon,
  FacebookBrandIcon,
} from "@/components/ui/brand-icons";
import { toast } from "sonner";

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
  productName?: string;
}

/**
 * Share an affiliate link: shows a downloadable QR code (reusing the `qrcode`
 * dependency) and one-tap share buttons for the platforms this system targets.
 */
export function ShareLinkDialog({ open, onClose, url, productName }: ShareLinkDialogProps) {
  const t = useTranslations("affiliates");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !url) return;
    let cancelled = false;
    import("qrcode")
      .then((mod) => {
        const QRCode = (mod as any).default ?? mod;
        return QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: "M" });
      })
      .then((dataUrl: string) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, url]);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(t("linkCopied"));
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `affiliate-qr-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const enc = encodeURIComponent;
  const text = productName ? `${productName} ${url}` : url;
  const shares = [
    {
      name: "WhatsApp",
      Icon: WhatsAppBrandIcon,
      href: `https://wa.me/?text=${enc(text)}`,
    },
    {
      name: "Telegram",
      Icon: TelegramBrandIcon,
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(productName || "")}`,
    },
    {
      name: "X",
      Icon: XBrandIcon,
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(productName || "")}`,
    },
    {
      name: "Facebook",
      Icon: FacebookBrandIcon,
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            {t("shareLink")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {productName && (
            <p className="text-sm text-center font-medium truncate" title={productName}>
              {productName}
            </p>
          )}

          {/* QR code */}
          <div className="flex justify-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code"
                className="w-48 h-48 rounded-lg border border-gray-200 dark:border-gray-700"
              />
            ) : (
              <div className="w-48 h-48 rounded-lg shimmer" />
            )}
          </div>

          {/* URL + copy. The truncation sits on the inner text node, not on the
              flex row: `truncate` (overflow hidden + ellipsis) does nothing to a
              flex container, whose anonymous text item refuses to shrink below
              its content width. That is what let a long affiliate URL widen the
              row and push the copy button out of the dialog. */}
          <div className="flex gap-2 min-w-0">
            <div
              className="flex-1 min-w-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2"
              title={url}
            >
              <p className="text-xs font-mono truncate">{url}</p>
            </div>
            <Tooltip side="top" content={t("linkCopied")}>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copy}
                aria-label={t("linkCopied")}
              >
                {copied ? (
                  <CheckIcon size={16} className="h-4 w-4 text-emerald-500" />
                ) : (
                  <CopyIcon size={16} className="h-4 w-4" />
                )}
              </Button>
            </Tooltip>
          </div>

          {/* Download QR */}
          <Button variant="outline" className="w-full" onClick={downloadQr} disabled={!qr}>
            <DownloadIcon size={16} className="h-4 w-4 mr-2" />
            {t("downloadQr")}
          </Button>

          {/* Social shares — official brand glyphs, buttons contained so
              long labels never push the row outside the dialog. */}
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-2">{t("shareOn")}</p>
            <div className="grid grid-cols-4 gap-2 min-w-0">
              {shares.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.name}
                  className="flex min-w-0 flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors overflow-hidden"
                >
                  <span className="flex items-center justify-center w-8 h-8 shrink-0">
                    <s.Icon size={28} />
                  </span>
                  <span className="text-[10px] leading-tight text-gray-600 dark:text-gray-300 w-full text-center truncate">
                    {s.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
