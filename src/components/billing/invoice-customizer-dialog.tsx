"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  FileText,
  Sliders,
  Printer,
  Check,
  QrCode,
  Barcode as BarcodeIcon,
  Palette,
  Building,
  FileCheck2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { generateBarcodeSvg } from "@/lib/barcode";

export interface InvoiceTemplateSettings {
  companyName: string;
  taxId: string;
  accentColor: string;
  notes: string;
  showBarcode: boolean;
  showQr: boolean;
}

const STORAGE_KEY = "levtech-invoice-template-config";

export const DEFAULT_INVOICE_CONFIG: InvoiceTemplateSettings = {
  companyName: "LevTech Solutions Ltd.",
  taxId: "01.847.291.0-014.000",
  accentColor: "#6366f1",
  notes:
    "Official computerized tax invoice. Valid proof of transaction under BI-FAST clearing rules.",
  showBarcode: true,
  showQr: true,
};

export function InvoiceCustomizerDialog({
  open,
  onOpenChange,
  sampleOrderId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sampleOrderId?: string;
}) {
  const [config, setConfig] = useState<InvoiceTemplateSettings>(DEFAULT_INVOICE_CONFIG);
  const [previewBarcodeSvg, setPreviewBarcodeSvg] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setConfig(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (config.showBarcode) {
      try {
        const svg = generateBarcodeSvg("ORD-2026-8942", {
          height: 38,
          moduleWidth: 1.5,
          color: "#18181b",
          showText: true,
          fontSize: 10,
        });
        setPreviewBarcodeSvg(svg);
      } catch {
        setPreviewBarcodeSvg("");
      }
    } else {
      setPreviewBarcodeSvg("");
    }
  }, [config.showBarcode]);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    toast.success("Invoice template preferences saved successfully!");
    onOpenChange(false);
  };

  const handleOpenPreview = () => {
    const params = new URLSearchParams({
      companyName: config.companyName,
      taxId: config.taxId,
      accent: config.accentColor,
      notes: config.notes,
      barcode: config.showBarcode ? "true" : "false",
    });
    const orderId = sampleOrderId || "sample-order-id";
    window.open(`/api/orders/${orderId}/invoice?${params.toString()}`, "_blank");
  };

  const presetColors = ["#6366f1", "#10b981", "#f43f5e", "#f59e0b", "#0284c7", "#8b5cf6"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Sliders size={20} />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Invoice Template & Barcode Customizer
              </DialogTitle>
              <DialogDescription>
                Customize real-time Code 128 barcodes, company tax headers, and branding colors
                across all downloadable and printable customer invoices.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3">
          {/* Settings Column */}
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Company / Issuer Name
              </Label>
              <Input
                value={config.companyName}
                onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                placeholder="LevTech Solutions Ltd."
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Tax Identification Number (NPWP / VAT ID)
              </Label>
              <Input
                value={config.taxId}
                onChange={(e) => setConfig({ ...config, taxId: e.target.value })}
                placeholder="01.847.291.0-014.000"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Brand Accent Color
              </Label>
              <div className="flex items-center gap-2 mt-1.5">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setConfig({ ...config, accentColor: color })}
                    className={`h-7 w-7 rounded-full transition-transform border-2 ${
                      config.accentColor === color
                        ? "scale-110 border-gray-900 dark:border-white ring-2 ring-indigo-400"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
                <Input
                  type="text"
                  value={config.accentColor}
                  onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                  className="w-24 h-7 text-xs font-mono ml-2"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Footer Legal Notes & Terms
              </Label>
              <textarea
                value={config.notes}
                onChange={(e) => setConfig({ ...config, notes: e.target.value })}
                rows={3}
                className="w-full mt-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Official computerized tax invoice..."
              />
            </div>

            <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
              <Label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Security & Barcode Badges
              </Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBarcode}
                    onChange={(e) => setConfig({ ...config, showBarcode: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <BarcodeIcon className="h-4 w-4 text-gray-600" />
                  Code 128 Barcode
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showQr}
                    onChange={(e) => setConfig({ ...config, showQr: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  <QrCode className="h-4 w-4 text-gray-600" />
                  Verification QR
                </label>
              </div>
            </div>
          </div>

          {/* Live Mini Preview */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <span className="text-sm font-extrabold tracking-tight">
                    {config.companyName.split(" ")[0] || "LevTech"}{" "}
                    <span style={{ color: config.accentColor }}>
                      {config.companyName.split(" ").slice(1).join(" ") || "Unified"}
                    </span>
                  </span>
                  <p className="text-[10px] text-gray-500">Tax ID: {config.taxId}</p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                  SAMPLE PREVIEW
                </Badge>
              </div>

              {/* Barcode preview container */}
              {config.showBarcode && previewBarcodeSvg && (
                <div className="my-4 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                  <div
                    dangerouslySetInnerHTML={{ __html: previewBarcodeSvg }}
                    className="max-w-full overflow-hidden"
                  />
                </div>
              )}

              <div className="space-y-2 text-[11px] text-gray-600 dark:text-gray-400 mt-3">
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span>Standard Commerce Package</span>
                  <span className="font-semibold">$120.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                  <span>VAT / Tax (11%)</span>
                  <span className="font-semibold">$13.20</span>
                </div>
                <div className="flex justify-between py-1 font-bold text-gray-900 dark:text-gray-100">
                  <span>Total Due / Paid</span>
                  <span style={{ color: config.accentColor }}>$133.20</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[10px] text-gray-400 italic line-clamp-2">{config.notes}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button variant="outline" size="sm" onClick={handleOpenPreview} className="gap-1.5">
            <Printer className="h-4 w-4" />
            Live Preview & Print
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <FileCheck2 className="h-4 w-4" />
              Save Preferences
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
