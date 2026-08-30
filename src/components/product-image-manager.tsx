"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2, Star, ImageIcon } from "lucide-react";
import { PlusIcon, UploadIcon, ArrowLeftIcon, ArrowRightIcon } from "lucide-animated";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lightbox } from "@/components/ui/lightbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProductImageManagerProps {
  productId: string;
  name: string;
  initialImage: string | null;
  initialImages: string[];
  canEdit: boolean;
}

const MAX_UPLOAD_BYTES = 800 * 1024; // 800KB per uploaded image (stored as data URL)

/** Build the ordered image list with the cover image first. */
function buildList(cover: string | null, images: string[]): string[] {
  const list = Array.from(new Set([...(cover ? [cover] : []), ...images]));
  return list;
}

export function ProductImageManager({
  productId,
  name,
  initialImage,
  initialImages,
  canEdit,
}: ProductImageManagerProps) {
  const t = useTranslations("affiliates");
  const tcommon = useTranslations("common");
  const fileRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<string[]>(() => buildList(initialImage, initialImages));
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const update = (next: string[]) => {
    setImages(next);
    setDirty(true);
  };

  const addUrl = () => {
    const u = urlInput.trim();
    if (!/^https?:\/\//i.test(u)) {
      toast.error(t("invalidImageUrl"));
      return;
    }
    if (images.includes(u)) {
      setUrlInput("");
      return;
    }
    update([...images, u]);
    setUrlInput("");
  };

  const onUpload = (file: File) => {
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("imageTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl && !images.includes(dataUrl)) update([...images, dataUrl]);
    };
    reader.readAsDataURL(file);
  };

  const removeAt = (idx: number) => update(images.filter((_, i) => i !== idx));

  const setCover = (idx: number) => {
    if (idx === 0) return;
    const next = [...images];
    const [img] = next.splice(idx, 1);
    next.unshift(img);
    update(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    update(next);
  };

  /** Move an image from one position to another (used by drag-and-drop). */
  const reorder = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    const next = [...images];
    const [img] = next.splice(from, 1);
    next.splice(to, 0, img);
    update(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: images[0] || null, images }),
      });
      if (res.ok) {
        toast.success(t("imagesSaved"));
        setDirty(false);
      } else {
        toast.error(tcommon("error"));
      }
    } catch {
      toast.error(tcommon("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          {t("productImages")}
          {images.length > 0 && <span className="text-xs text-gray-400">({images.length})</span>}
        </CardTitle>
        {canEdit && dirty && (
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? tcommon("loading") : tcommon("save")}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && images.length > 1 && (
          <p className="text-xs text-gray-400">{t("dragToReorder")}</p>
        )}
        {images.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {images.map((img, idx) => (
              <div
                key={img}
                draggable={canEdit}
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, idx);
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={cn(
                  "group relative aspect-square rounded-lg overflow-hidden border-2 bg-gray-100 dark:bg-gray-800 transition-all",
                  idx === 0 ? "border-indigo-500" : "border-transparent",
                  canEdit && "cursor-move",
                  dragIndex === idx && "opacity-40",
                  dragOverIndex === idx && dragIndex !== idx && "ring-2 ring-indigo-400 scale-95",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightboxIdx(idx)}
                />
                {idx === 0 && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-indigo-500 text-white text-[10px] font-medium flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    {t("cover")}
                  </span>
                )}
                {canEdit && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30"
                      title={t("moveLeft")}
                    >
                      <ArrowLeftIcon size={14} className="h-3.5 w-3.5" />
                    </button>
                    {idx !== 0 && (
                      <button
                        onClick={() => setCover(idx)}
                        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center"
                        title={t("setCover")}
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => removeAt(idx)}
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-red-500 text-white flex items-center justify-center"
                      title={tcommon("delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === images.length - 1}
                      className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center disabled:opacity-30"
                      title={t("moveRight")}
                    >
                      <ArrowRightIcon size={14} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{t("noImages")}</p>
          </div>
        )}

        {canEdit && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder={t("imageUrlPlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
              />
              <Button variant="outline" size="sm" onClick={addUrl} disabled={!urlInput.trim()}>
                <PlusIcon size={16} className="h-4 w-4 mr-1" />
                {t("addImage")}
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => fileRef.current?.click()}
            >
              <UploadIcon size={16} className="h-4 w-4 mr-1" />
              {t("uploadImage")}
            </Button>
          </div>
        )}
      </CardContent>

      <Lightbox
        images={images}
        index={lightboxIdx}
        onClose={() => setLightboxIdx(null)}
        onIndexChange={setLightboxIdx}
        alt={name}
      />
    </Card>
  );
}
