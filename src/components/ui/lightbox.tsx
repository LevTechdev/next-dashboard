"use client";

import { useEffect } from "react";

import { XIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-animated";

interface LightboxProps {
  images: string[];
  /** Active image index, or null when closed. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  alt?: string;
}

/**
 * Fullscreen image viewer. Controlled via `index` (null = closed). Supports
 * click-outside to close, prev/next arrows, and keyboard navigation
 * (Esc / ← / →).
 */
export function Lightbox({ images, index, onClose, onIndexChange, alt = "" }: LightboxProps) {
  const open = index !== null && index >= 0 && index < images.length;

  useEffect(() => {
    if (!open || index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      else if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open || index === null) return null;

  const go = (delta: number) => onIndexChange((index + delta + images.length) % images.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <XIcon size={20} className="h-5 w-5" />
      </button>

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="absolute left-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="Previous"
        >
          <ChevronLeftIcon size={24} className="h-6 w-6" />
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[index]}
        alt={alt}
        referrerPolicy="no-referrer"
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="absolute right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          aria-label="Next"
        >
          <ChevronRightIcon size={24} className="h-6 w-6" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
