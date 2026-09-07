"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { GlobeMarker } from "./tactical-globe-3d";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-provider";
import { Crosshair, Radio } from "lucide-react";

/* ========================================================================== */
/* Mathematical Projection & TopoJSON Processing                             */
/* ========================================================================== */

function decArcs(t: any): [number, number][][] {
  const { scale, translate } = t.transform;
  return t.arcs.map((arc: number[][]) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number];
    });
  });
}

function resolveRing(ring: number[], arcs: [number, number][][]): [number, number][] {
  const pts: [number, number][] = [];
  for (const idx of ring) {
    const rev = idx < 0;
    const arc = arcs[rev ? ~idx : idx];
    const copy = rev ? arc.slice().reverse() : arc;
    for (let i = pts.length ? 1 : 0; i < copy.length; i++) {
      pts.push(copy[i]);
    }
  }
  return pts;
}

// Equirectangular cylindrical projection with Antimeridian Jump Splitting
function projectRingToSvg(pts: [number, number][], W: number, H: number): string {
  if (pts.length < 3) return "";
  let path = "";
  let started = false;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const x = ((p[0] + 180) / 360) * W;
    const y = ((90 - p[1]) / 180) * H;

    // Split subpath across 180°/-180° international dateline to avoid horizontal streaks
    if (i > 0 && Math.abs(pts[i][0] - pts[i - 1][0]) > 180) {
      path += "Z M" + x.toFixed(1) + "," + y.toFixed(1);
    } else if (!started) {
      path += "M" + x.toFixed(1) + "," + y.toFixed(1);
      started = true;
    } else {
      path += "L" + x.toFixed(1) + "," + y.toFixed(1);
    }
  }

  return path + "Z";
}

interface ProjectedCountry {
  id: string;
  name: string;
  pathD: string;
}

function extract2DCountries(t: any, W: number, H: number): ProjectedCountry[] {
  const arcs = decArcs(t);
  const gs = t.objects?.countries?.geometries;
  if (!gs) return [];

  const seenIds = new Set<string>();
  const results: ProjectedCountry[] = [];

  for (let idx = 0; idx < gs.length; idx++) {
    const g = gs[idx];
    const rawId = g.id != null ? String(g.id).trim() : "";
    const name = g.properties?.name || `Territory ${idx}`;
    const nameSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    let uniqueId = rawId || nameSlug || `country-${idx}`;
    if (seenIds.has(uniqueId)) {
      uniqueId = `${uniqueId}-${idx}`;
    }
    seenIds.add(uniqueId);

    const rings = g.type === "Polygon" ? [g.arcs] : g.arcs;
    let pathD = "";
    if (rings && Array.isArray(rings)) {
      pathD = rings
        .map((poly: number[][]) =>
          poly.map((r: number[]) => projectRingToSvg(resolveRing(r, arcs), W, H)).join(" "),
        )
        .join(" ");
    }

    if (pathD.trim().length > 0) {
      results.push({ id: uniqueId, name, pathD });
    }
  }

  return results;
}

// Curved great-circle style arc between two 2D points
function buildCurvedFlightArc(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  curvature: number = 0.22,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);

  // Perpendicular offset for organic curvature
  const nx = -dy / (dist || 1);
  const ny = dx / (dist || 1);
  const cx = mx + nx * dist * curvature;
  const cy = my + ny * dist * curvature;

  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/* ========================================================================== */
/* Flight Arc Routes                                                          */
/* ========================================================================== */
const FLIGHT_ROUTES: [string, string][] = [
  ["jakarta", "singapore"],
  ["singapore", "tokyo"],
  ["tokyo", "seoul"],
  ["jakarta", "sydney"],
  ["singapore", "dubai"],
  ["dubai", "frankfurt"],
  ["frankfurt", "london"],
  ["london", "amsterdam"],
  ["frankfurt", "new-york"],
  ["new-york", "san-francisco"],
  ["new-york", "sao-paulo"],
  ["san-francisco", "tokyo"],
];

/* ========================================================================== */
/* Props Interface                                                            */
/* ========================================================================== */
export interface InteractiveMap2DProps {
  markers: GlobeMarker[];
  selectedHubId?: string;
  hoveredHubId?: string | null;
  onHoverHub?: (hub: GlobeMarker | null, screenPos?: { x: number; y: number } | null) => void;
  onSelectHub?: (hub: GlobeMarker) => void;
  metric?: "revenue" | "visitors" | "sla";
  livePings?: Array<{ id: string; x: number; y: number; label: string; amount: number }>;
  theme?: "light" | "dark";
  className?: string;
  zoomScale?: number;
}

/* ========================================================================== */
/* Main Component                                                             */
/* ========================================================================== */
export function InteractiveMap2D({
  markers,
  selectedHubId,
  hoveredHubId,
  onHoverHub,
  onSelectHub,
  metric = "revenue",
  livePings = [],
  theme: propTheme,
  className,
  zoomScale = 1.0,
}: InteractiveMap2DProps) {
  const t = useTranslations("dashboard");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const currentTheme = propTheme || (mounted ? resolvedTheme : "dark");
  const isLight = currentTheme === "light";

  const containerRef = useRef<HTMLDivElement>(null);
  const [countries, setCountries] = useState<ProjectedCountry[]>([]);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{
    xPct: number;
    yPct: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [nearestMarker, setNearestMarker] = useState<GlobeMarker | null>(null);
  const { formatMoney } = useCurrency();

  // SVG Canvas dimensions: 1000 x 500 (2:1 aspect ratio matches 360° x 180°)
  const W = 1000;
  const H = 500;

  // Load Natural Earth 110m TopoJSON and project to 2D
  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const localRes = await fetch("/data/countries-110m.json");
        if (localRes.ok) {
          const topo = await localRes.json();
          if (active) setCountries(extract2DCountries(topo, W, H));
          return;
        }
      } catch {
        // Fallback to CDN
      }

      try {
        const cdnRes = await fetch(
          "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
        );
        if (cdnRes.ok) {
          const topo = await cdnRes.json();
          if (active) setCountries(extract2DCountries(topo, W, H));
        }
      } catch {
        // Handled silently
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Map markers to projection coordinates
  const projectedMarkers = useMemo(() => {
    return markers.map((m) => {
      const x = ((m.longitude + 180) / 360) * W;
      const y = ((90 - m.latitude) / 180) * H;
      const xPct = (x / W) * 100;
      const yPct = (y / H) * 100;
      return { ...m, px: x, py: y, xPct, yPct };
    });
  }, [markers]);

  // Precompute curved flight telemetry arcs
  const flightArcs = useMemo(() => {
    const markerMap = new Map(projectedMarkers.map((m) => [m.id, m]));
    const arcs: { id: string; d: string; from: string; to: string }[] = [];

    for (const [fromId, toId] of FLIGHT_ROUTES) {
      const p1 = markerMap.get(fromId);
      const p2 = markerMap.get(toId);
      if (p1 && p2) {
        let x1 = p1.px;
        let x2 = p2.px;
        if (Math.abs(x2 - x1) > W / 2) {
          if (x1 < x2) x1 += W;
          else x2 += W;
        }
        const d = buildCurvedFlightArc(p1.px, p1.py, p2.px, p2.py, 0.18);
        arcs.push({ id: `${fromId}-${toId}`, d, from: p1.city, to: p2.city });
      }
    }
    return arcs;
  }, [projectedMarkers]);

  // Handle cursor motion across the map with proximity telemetry
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const xPct = Math.max(0, Math.min(100, (clientX / rect.width) * 100));
      const yPct = Math.max(0, Math.min(100, (clientY / rect.height) * 100));

      const lng = (xPct / 100) * 360 - 180;
      const lat = 90 - (yPct / 100) * 180;

      setCursorPos({ xPct, yPct, lat, lng });

      // Find nearest city hub
      let nearest: (typeof projectedMarkers)[0] | null = null;
      let minDistance = Infinity;

      for (const m of projectedMarkers) {
        const dist = Math.hypot(xPct - m.xPct, yPct - m.yPct);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = m;
        }
      }

      // Proximity lock: within 9.0% screen distance locks on hub
      if (minDistance <= 9.0 && nearest) {
        setNearestMarker(nearest);
        if (onHoverHub) {
          const hubScreenX = (nearest.xPct / 100) * rect.width;
          const hubScreenY = (nearest.yPct / 100) * rect.height;
          onHoverHub(nearest, { x: hubScreenX, y: hubScreenY });
        }
      } else {
        setNearestMarker(null);
        if (onHoverHub) {
          onHoverHub(null);
        }
      }
    },
    [projectedMarkers, onHoverHub],
  );

  const handleMouseLeave = useCallback(() => {
    setCursorPos(null);
    setNearestMarker(null);
    setHoveredCountry(null);
    if (onHoverHub) onHoverHub(null);
  }, [onHoverHub]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative w-full h-[340px] sm:h-[420px] lg:h-[460px] xl:h-[500px] rounded-2xl bg-gradient-to-b from-slate-50 via-sky-50/40 to-slate-100 border border-slate-200 dark:from-[#060b13] dark:via-[#0b1322] dark:to-[#060b13] dark:border-slate-800/80 overflow-hidden select-none cursor-crosshair group shadow-sm dark:shadow-inner transition-colors duration-300",
        className,
      )}
    >
      {/* Zoomable Vector Stage */}
      <div
        className="w-full h-full relative transition-transform duration-200 ease-out origin-center"
        style={{ transform: `scale(${zoomScale})` }}
      >
        {/* 2D Vector Map Canvas */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full block" preserveAspectRatio="none">
          <defs>
            {/* Subtle Ocean Vignette */}
            <radialGradient id="oceanGlow2D" cx="50%" cy="50%" r="55%">
              <stop
                offset="0%"
                stopColor={isLight ? "#e0f2fe" : "#0284c7"}
                stopOpacity={isLight ? 0.45 : 0.08}
              />
              <stop
                offset="60%"
                stopColor={isLight ? "#f0f9ff" : "#0f172a"}
                stopOpacity={isLight ? 0.25 : 0.03}
              />
              <stop
                offset="100%"
                stopColor={isLight ? "#e2e8f0" : "#020617"}
                stopOpacity={isLight ? 0.4 : 0.3}
              />
            </radialGradient>

            {/* Land Mass Gradient */}
            <linearGradient id="landFill2D" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop
                offset="0%"
                stopColor={isLight ? "#ffffff" : "#1e293b"}
                stopOpacity={isLight ? 0.95 : 0.85}
              />
              <stop
                offset="100%"
                stopColor={isLight ? "#f1f5f9" : "#0f172a"}
                stopOpacity={isLight ? 0.98 : 0.95}
              />
            </linearGradient>

            {/* Hovered Land Gradient */}
            <linearGradient id="landHover2D" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop
                offset="0%"
                stopColor={isLight ? "#bae6fd" : "#0284c7"}
                stopOpacity={isLight ? 0.55 : 0.35}
              />
              <stop
                offset="100%"
                stopColor={isLight ? "#e0f2fe" : "#0369a1"}
                stopOpacity={isLight ? 0.45 : 0.25}
              />
            </linearGradient>
          </defs>

          {/* Ocean Background Fill */}
          <rect x="0" y="0" width={W} height={H} fill="url(#oceanGlow2D)" />

          {/* Cartographic Coordinate Graticule Grid */}
          <g
            opacity={isLight ? 0.18 : 0.22}
            stroke={isLight ? "#0284c7" : "#38bdf8"}
            strokeWidth="0.5"
            strokeDasharray="3 4"
          >
            {/* Parallels (Latitude lines) */}
            <line x1="0" y1="83.3" x2={W} y2="83.3" />
            <line x1="0" y1="166.7" x2={W} y2="166.7" />
            <line
              x1="0"
              y1="250"
              x2={W}
              y2="250"
              strokeWidth="0.9"
              strokeOpacity={isLight ? 0.5 : 0.6}
              strokeDasharray="none"
            />
            <line x1="0" y1="333.3" x2={W} y2="333.3" />
            <line x1="0" y1="416.7" x2={W} y2="416.7" />

            {/* Meridians (Longitude lines) */}
            <line x1="83.3" y1="0" x2="83.3" y2={H} />
            <line x1="166.7" y1="0" x2="166.7" y2={H} />
            <line x1="250" y1="0" x2="250" y2={H} />
            <line x1="333.3" y1="0" x2="333.3" y2={H} />
            <line x1="416.7" y1="0" x2="416.7" y2={H} />
            <line
              x1="500"
              y1="0"
              x2="500"
              y2={H}
              strokeWidth="0.9"
              strokeOpacity={isLight ? 0.5 : 0.6}
              strokeDasharray="none"
            />
            <line x1="583.3" y1="0" x2="583.3" y2={H} />
            <line x1="666.7" y1="0" x2="666.7" y2={H} />
            <line x1="750" y1="0" x2="750" y2={H} />
            <line x1="833.3" y1="0" x2="833.3" y2={H} />
            <line x1="916.7" y1="0" x2="916.7" y2={H} />
          </g>

          {/* Real Natural Earth 110m Country Polygons */}
          <g>
            {countries.map((c) => {
              const isHovered = hoveredCountry === c.id;
              return (
                <path
                  key={`country-2d-${c.id}`}
                  d={c.pathD}
                  fill={isHovered ? "url(#landHover2D)" : "url(#landFill2D)"}
                  stroke={
                    isHovered ? (isLight ? "#0284c7" : "#38bdf8") : isLight ? "#38bdf8" : "#0284c7"
                  }
                  strokeWidth={isHovered ? "0.9" : isLight ? "0.6" : "0.55"}
                  strokeOpacity={isHovered ? "0.9" : isLight ? "0.45" : "0.38"}
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() => setHoveredCountry(c.id)}
                  className="transition-all duration-150 cursor-pointer"
                >
                  <title>{c.name}</title>
                </path>
              );
            })}
          </g>

          {/* Inter-Hub Great-Circle Flight & Telemetry Arcs */}
          <g pointerEvents="none">
            {flightArcs.map((arc) => (
              <path
                key={arc.id}
                d={arc.d}
                fill="none"
                stroke={isLight ? "#0284c7" : "#38bdf8"}
                strokeWidth={isLight ? "1.1" : "0.9"}
                strokeOpacity={isLight ? "0.75" : "0.45"}
                strokeDasharray="3 4"
                className="animate-[pulse_3s_ease-in-out_infinite]"
              />
            ))}
          </g>

          {/* Cursor Targeting Lock Ray to Nearest City */}
          {cursorPos && nearestMarker && (
            <g pointerEvents="none">
              <line
                x1={(cursorPos.xPct / 100) * W}
                y1={(cursorPos.yPct / 100) * H}
                x2={((nearestMarker.longitude + 180) / 360) * W}
                y2={((90 - nearestMarker.latitude) / 180) * H}
                stroke={isLight ? "#0284c7" : "#06b6d4"}
                strokeWidth="1"
                strokeDasharray="2 3"
                strokeOpacity="0.75"
              />
              <circle
                cx={(cursorPos.xPct / 100) * W}
                cy={(cursorPos.yPct / 100) * H}
                r="4"
                fill="none"
                stroke={isLight ? "#0284c7" : "#06b6d4"}
                strokeWidth="1.2"
                strokeOpacity="0.8"
              />
            </g>
          )}

          {/* Latitude / Longitude Edge Coordinate Markers */}
          <g
            fill={isLight ? "#475569" : "#64748b"}
            fontSize="8"
            fontFamily="monospace"
            opacity="0.7"
            pointerEvents="none"
          >
            <text x="8" y="87">
              60°N
            </text>
            <text x="8" y="170">
              30°N
            </text>
            <text
              x="8"
              y="254"
              fill={isLight ? "#0284c7" : "#38bdf8"}
              opacity="0.95"
              fontWeight="bold"
            >
              0°EQ
            </text>
            <text x="8" y="337">
              30°S
            </text>
            <text x="8" y="420">
              60°S
            </text>

            <text x="160" y="492" textAnchor="middle">
              120°W
            </text>
            <text x="330" y="492" textAnchor="middle">
              60°W
            </text>
            <text
              x="500"
              y="492"
              textAnchor="middle"
              fill={isLight ? "#0284c7" : "#38bdf8"}
              opacity="0.95"
              fontWeight="bold"
            >
              0°GM
            </text>
            <text x="670" y="492" textAnchor="middle">
              60°E
            </text>
            <text x="840" y="492" textAnchor="middle">
              120°E
            </text>
          </g>
        </svg>

        {/* HTML Overlay: Interactive 12 Metro Hub Beacons */}
        {projectedMarkers.map((m) => {
          const isSelected = selectedHubId === m.id;
          const isHovered = hoveredHubId === m.id || nearestMarker?.id === m.id;
          const isHighlighted = isSelected || isHovered;

          return (
            <button
              key={`marker-2d-${m.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setNearestMarker(m);
                if (onSelectHub) onSelectHub(m);
                if (onHoverHub && containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  const hubScreenX = (m.xPct / 100) * rect.width;
                  const hubScreenY = (m.yPct / 100) * rect.height;
                  onHoverHub(m, { x: hubScreenX, y: hubScreenY });
                }
              }}
              onMouseEnter={() => {
                setNearestMarker(m);
                if (onHoverHub && containerRef.current) {
                  const rect = containerRef.current.getBoundingClientRect();
                  const hubScreenX = (m.xPct / 100) * rect.width;
                  const hubScreenY = (m.yPct / 100) * rect.height;
                  onHoverHub(m, { x: hubScreenX, y: hubScreenY });
                }
              }}
              style={{ left: `${m.xPct}%`, top: `${m.yPct}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer focus:outline-none z-20"
              aria-label={`Select ${m.city}, ${m.country}`}
            >
              {/* Concentric Pulsing Wave Rings */}
              <span
                style={{ backgroundColor: m.dotColor }}
                className={cn(
                  "absolute -inset-2.5 rounded-full opacity-60 animate-ping transition-all pointer-events-none",
                  isHighlighted && "opacity-90 scale-150",
                )}
              />

              {/* Glowing Hub Center Pin */}
              <span
                style={{
                  backgroundColor: m.dotColor,
                  boxShadow: isHighlighted ? `0 0 16px ${m.dotColor}` : `0 0 8px ${m.dotColor}`,
                }}
                className={cn(
                  "relative flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 shadow-md transition-all duration-300",
                  isHighlighted
                    ? "w-5 h-5 ring-4 ring-sky-400/80 dark:ring-cyan-400/70 scale-125"
                    : "w-3 h-3 group-hover:scale-125",
                )}
              />

              {/* City Label Badge Pill */}
              <span
                className={cn(
                  "absolute top-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap shadow-xl border transition-all duration-200 pointer-events-none z-30",
                  isHighlighted
                    ? isLight
                      ? "bg-white text-sky-900 border-sky-400 font-bold shadow-sky-200/80 scale-105"
                      : "bg-slate-900/95 text-cyan-300 border-cyan-400/90 scale-105 shadow-cyan-950/60"
                    : isLight
                      ? "bg-white/90 text-slate-700 border-slate-200 opacity-80 group-hover:opacity-100"
                      : "bg-slate-950/80 text-slate-300 border-slate-800 opacity-70 group-hover:opacity-100",
                )}
              >
                <span className="mr-1">{m.flag}</span>
                {m.city}
              </span>
            </button>
          );
        })}

        {/* Simulated Live Order Dynamic Ripple Pings */}
        {livePings.map((ping) => (
          <div
            key={ping.id}
            style={{ left: `${ping.x}%`, top: `${ping.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
          >
            <span className="absolute -inset-4 rounded-full bg-emerald-400 opacity-80 animate-ping" />
            <span className="absolute -inset-8 rounded-full bg-emerald-500/30 animate-pulse" />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/80 text-[10px] font-mono text-emerald-300 font-bold whitespace-nowrap shadow-lg animate-bounce">
              +{formatMoney(ping.amount)}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom-Left Real-Time Coordinate & Proximity Radar HUD */}
      <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/90 text-slate-700 border border-slate-200 shadow-sm dark:bg-slate-900/85 dark:text-slate-300 dark:border-slate-800 text-[10px] font-mono pointer-events-none transition-colors duration-200">
        <Radio className="h-3 w-3 text-sky-500 dark:text-cyan-400 animate-pulse" />
        {cursorPos ? (
          <span>
            LAT {Math.abs(cursorPos.lat).toFixed(1)}°{cursorPos.lat >= 0 ? "N" : "S"} • LON{" "}
            {Math.abs(cursorPos.lng).toFixed(1)}°{cursorPos.lng >= 0 ? "E" : "W"}
            {nearestMarker && (
              <span className="ml-1 text-sky-700 dark:text-cyan-300 font-bold">
                → {nearestMarker.flag} {nearestMarker.city} ({nearestMarker.deliverySla} SLA)
              </span>
            )}
          </span>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">{t("cursorRadarActive")}</span>
        )}
      </div>

      {/* Bottom-Right Projection Specification Pill */}
      <div className="absolute bottom-3 right-3 z-20 hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/90 text-slate-500 border border-slate-200 shadow-sm dark:bg-slate-900/80 dark:text-slate-400 dark:border-slate-800/80 text-[9px] font-mono pointer-events-none transition-colors duration-200">
        <Crosshair className="h-2.5 w-2.5 text-sky-500 dark:text-cyan-400" />
        <span>{t("equirectangularMesh")}</span>
      </div>
    </div>
  );
}
