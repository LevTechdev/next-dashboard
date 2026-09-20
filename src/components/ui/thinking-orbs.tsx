"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThinkingOrbsProps {
  size?: number;
  speed?: number;
  reverse?: boolean;
  accent?: string;
  dotColor?: string;
  pillColor?: string;
  labelColor?: string;
  showsPill?: boolean;
  showsLabel?: boolean;
  label?: string;
  className?: string;
}

export function ThinkingOrbs({
  size = 140,
  speed = 1,
  reverse = true,
  accent = "#53fd56",
  dotColor = "#F4F1EA",
  pillColor,
  labelColor,
  showsPill = true,
  showsLabel = true,
  label = "Generating...",
  className,
}: ThinkingOrbsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme, theme } = useTheme();
  const isDark =
    resolvedTheme === "dark" || theme === "dark" || typeof resolvedTheme === "undefined";

  const effectiveDotColor = isDark ? dotColor : "#25242A";
  const effectivePill = pillColor || (isDark ? "#1B1B1D" : "#ECECEF");
  const effectiveLabelColor = labelColor || (isDark ? "#F4F1EA" : "#25242A");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const numDots = 120;
    const period = 3.2; // 3.2s loop period
    const startTime = performance.now();

    // Fibonacci spiral points on unit sphere
    const spherePoints: [number, number, number][] = [];
    for (let e = 0; e < numDots; e++) {
      const t = 1 - (e / (numDots - 1)) * 2;
      const a = Math.sqrt(Math.max(0, 1 - t * t));
      const r = 2.399963 * e;
      spherePoints.push([Math.cos(r) * a, t, Math.sin(r) * a]);
    }

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const duration = period / Math.max(0.1, speed);
      let phase = (elapsed % duration) / duration;
      if (reverse) phase = 1 - phase;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;
      const pv = 3.5; // perspective distance

      // 3D rotation angles
      const rotY = 2 * Math.PI * phase * 0.25;
      const rotX = 0.35;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      interface RenderDot {
        x: number;
        y: number;
        z: number;
        r: number;
        alpha: number;
        color: string;
      }

      const dotsToDraw: RenderDot[] = [];

      for (let e = 0; e < numDots; e++) {
        const dotPhase = (phase + ((0.61803398875 * e) % 1)) % 1;
        const rNorm = Math.min(1, dotPhase / 0.72);
        // Elastic burst curve
        const s = 1 - Math.pow(2, -9 * rNorm) * Math.cos(rNorm * Math.PI * 4.5);
        // Fade envelope
        const dAlpha = Math.pow(Math.sin(Math.PI * dotPhase), 0.5);
        const isAccent = dotPhase < 0.12;

        const pt = spherePoints[e];
        const px = pt[0] * s;
        const py = pt[1] * s;
        const pz = pt[2] * s;

        // Apply Y then X rotation
        const ox = px * cosY - pz * sinY;
        let oz = px * sinY + pz * cosY;
        const oy = py * cosX - oz * sinX;
        oz = py * sinX + oz * cosX;

        // Perspective projection
        const projScale = pv / (pv - oz);
        const depthNorm = Math.max(0, Math.min(1, (oz + 1.1) / 2.2));
        const dotRadius = Math.max(
          0.8,
          2.2 * (0.4 + 1.6 * depthNorm) * projScale * (0.5 + 1.3 * (1 - dotPhase)),
        );
        const alpha = Math.min(1, Math.max(0, (0.07 + 0.93 * Math.pow(depthNorm, 1.55)) * dAlpha));

        dotsToDraw.push({
          x: centerX + ox * radius * projScale,
          y: centerY + oy * radius * projScale,
          z: oz,
          r: dotRadius,
          alpha,
          color: isAccent ? accent : effectiveDotColor,
        });
      }

      // Depth sort back to front
      dotsToDraw.sort((a, b) => a.z - b.z);

      for (const d of dotsToDraw) {
        if (d.alpha <= 0.01 || d.r <= 0.2) continue;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.color;
        ctx.globalAlpha = d.alpha;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [speed, reverse, accent, effectiveDotColor, size]);

  const orbCanvas = (
    <div
      className="relative flex items-center justify-center shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
    >
      <canvas ref={canvasRef} style={{ width: size, height: size }} className="block" />
    </div>
  );

  if (!showsPill) {
    return (
      <div className={cn("inline-flex items-center justify-center", className)}>{orbCanvas}</div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className={cn(
        "inline-flex items-center gap-3 px-4 py-2 rounded-full border shadow-xl transition-colors duration-300",
        className,
      )}
      style={{
        backgroundColor: effectivePill,
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
        color: effectiveLabelColor,
      }}
    >
      <div
        style={{ width: 36, height: 36 }}
        className="relative shrink-0 flex items-center justify-center"
      >
        <canvas ref={canvasRef} style={{ width: 36, height: 36 }} className="block" />
      </div>
      {showsLabel && (
        <span
          className="text-xs font-semibold tracking-wide pr-2 font-mono select-none"
          style={{ color: effectiveLabelColor }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
