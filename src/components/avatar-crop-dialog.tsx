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

/** Max edge length of the cropped output (keeps the data URL well under the 500KB API limit). */
const MAX_OUTPUT = 512;

/**
 * Crop a source image to the given pixel area using a canvas, scaling the
 * output down to at most MAX_OUTPUT on the longest edge. Resolves to a PNG
 * data URL ready for the /api/profile/avatar upload.
 */
function cropImage(imageSrc: string, pixelCrop: Area): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, MAX_OUTPUT / Math.max(pixelCrop.width, pixelCrop.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(pixelCrop.width * scale));
        canvas.height = Math.max(1, Math.round(pixelCrop.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        // Opaque white base keeps the JPEG output small (well under the 500KB
        // API limit for a 512px avatar) regardless of source alpha/color depth.
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          canvas.width,
          canvas.height,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });
}

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string;
  onOpenChange: (open: boolean) => void;
  /** Uploads the cropped data URL; resolves true when saved successfully. */
  onSave: (croppedDataUrl: string) => Promise<boolean>;
}

/** Square (1:1) avatar crop dialog with zoom, shown before the photo is uploaded. */
export function AvatarCropDialog({ open, imageSrc, onOpenChange, onSave }: AvatarCropDialogProps) {
  const t = useTranslations("profile");
  const tcommon = useTranslations("common");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  // Note: the parent renders this dialog with key={imageSrc}, so the crop/zoom
  // state starts fresh for every new image without needing a reset effect.

  const handleSave = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setSaving(true);
    try {
      const dataUrl = await cropImage(imageSrc, croppedAreaPixels);
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("cropTitle")}</DialogTitle>
          <DialogDescription>{t("cropDesc")}</DialogDescription>
        </DialogHeader>

        {imageSrc && (
          <>
            <div className="relative w-full h-72 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
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
                className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
              <ZoomIn className="h-4 w-4 text-gray-400" />
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tcommon("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!croppedAreaPixels || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("cropSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
