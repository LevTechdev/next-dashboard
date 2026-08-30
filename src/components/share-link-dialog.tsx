"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";
import { CopyIcon, DownloadIcon, CheckIcon } from "lucide-animated";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
    { name: "WhatsApp", color: "#25D366", href: `https://wa.me/?text=${enc(text)}` },
    {
      name: "Facebook",
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    },
    {
      name: "X",
      color: "#000000",
      href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(productName || "")}`,
    },
    {
      name: "Telegram",
      color: "#0088cc",
      href: `https://t.me/share/url?url=${enc(url)}&text=${enc(productName || "")}`,
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

          {/* URL + copy */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 flex items-center px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-xs font-mono truncate">
              {url}
            </div>
            <Button variant="outline" size="icon" onClick={copy} title={t("linkCopied")}>
              {copied ? (
                <CheckIcon size={16} className="h-4 w-4 text-emerald-500" />
              ) : (
                <CopyIcon size={16} className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Download QR */}
          <Button variant="outline" className="w-full" onClick={downloadQr} disabled={!qr}>
            <DownloadIcon size={16} className="h-4 w-4 mr-2" />
            {t("downloadQr")}
          </Button>

          {/* Social shares */}
          <div>
            <p className="text-xs text-gray-500 mb-2">{t("shareOn")}</p>
            <div className="grid grid-cols-4 gap-2">
              {shares.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-[10px] text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: s.color }}
                  >
                    {s.name.charAt(0)}
                  </span>
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
