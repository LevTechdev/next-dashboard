"use client";

import { useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { useTranslations } from "next-intl";
import { ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Cover crop — a 4:1 (banner) variant of the avatar crop dialog.
 *
 * The user frames the image themselves instead of a blind center-crop; the
 * output is a 1600×400 WebP data URL matching what /api/profile/avatar
 * expects for `coverImage` (well under the 500KB API limit).
 */

/** Output resolution of the cropped banner. */
const OUT_W = 1600;
const OUT_H = 400;

function cropCover(imageSrc: string, pixelCrop: Area): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = OUT_W;
        canvas.height = OUT_H;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        // Opaque base keeps WebP output compact regardless of source alpha.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, OUT_W, OUT_H);
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          OUT_W,
          OUT_H,
        );
        resolve(canvas.toDataURL("image/webp", 0.85));
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}

interface CoverCropDialogProps {
  open: boolean;
  imageSrc: string;
  onOpenChange: (open: boolean) => void;
  /** Uploads the cropped data URL; resolves true when saved successfully. */
  onSave: (croppedDataUrl: string) => Promise<boolean>;
}

export function CoverCropDialog({ open, imageSrc, onOpenChange, onSave }: CoverCropDialogProps) {
  const t = useTranslations("profile");
  const tcommon = useTranslations("common");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // The parent renders this dialog with key={imageSrc}, so crop/zoom state
  // starts fresh for every new image without a reset effect.

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setSaving(true);
    try {
      const dataUrl = await cropCover(imageSrc, croppedAreaPixels);
      const ok = await onSave(dataUrl);
      if (ok) onOpenChange(false);
    } catch {
      toast.error(t("cropFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="cover-crop-dialog">
        <DialogHeader>
          <DialogTitle>{t("coverCropTitle")}</DialogTitle>
          <DialogDescription>{t("coverCropDesc")}</DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <>
            <div
              className="relative w-full h-56 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800"
              data-testid="cover-crop-area"
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={OUT_W / OUT_H}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
                showGrid={false}
              />
            </div>

            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-gray-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                aria-label={t("zoom")}
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                data-testid="cover-crop-zoom"
              />
              <ZoomIn className="h-4 w-4 text-gray-400" />
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tcommon("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!croppedAreaPixels || saving}
            data-testid="cover-crop-save"
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("coverCropSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
