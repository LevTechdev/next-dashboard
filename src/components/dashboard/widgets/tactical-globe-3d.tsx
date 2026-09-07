"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback, useId } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/* ========================================================================== */
/* 3D Sphere Math & Orthographic Projection                                   */
/* ========================================================================== */
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export interface ProjectedPoint {
  sx: number;
  sy: number;
  rx: number;
  ry: number;
  rz: number;
  v: boolean;
}

export function project(
  lng: number,
  lat: number,
  lambda: number,
  phi: number,
  gamma: number,
  R: number,
  cx: number,
  cy: number,
): ProjectedPoint {
  const lr = (lng - lambda) * D2R;
  const la = lat * D2R;
  const cl = Math.cos(la);

  // Unrotated unit-sphere position (post-Z-rotation by lambda)
  const x0 = cl * Math.cos(lr);
  const y0 = cl * Math.sin(lr);
  const z0 = Math.sin(la);

  // Rotate around Y by phi (tilts north pole forward)
  const cp = Math.cos(phi * D2R);
  const sp = Math.sin(phi * D2R);
  const x1 = x0 * cp + z0 * sp;
  const y1 = y0;
  const z1 = -x0 * sp + z0 * cp;

  // Rotate around X by gamma (rolls around the viewer-facing axis)
  const cg = Math.cos(gamma * D2R);
  const sg = Math.sin(gamma * D2R);
  const rx = x1;
  const ry = y1 * cg - z1 * sg;
  const rz = y1 * sg + z1 * cg;

  return {
    sx: cx + R * ry,
    sy: cy - R * rz,
    rx,
    ry,
    rz,
    v: rx >= 0,
  };
}

export function unproject(
  px: number,
  py: number,
  lambda: number,
  phi: number,
  gamma: number,
  R: number,
  cx: number,
  cy: number,
): { lng: number; lat: number } | null {
  const Ry = (px - cx) / R;
  const Rz = -(py - cy) / R;
  const r2 = Ry * Ry + Rz * Rz;
  if (r2 > 1) return null;

  // Inverse X rotation (roll): undo gamma in the (y, z) plane
  const cg = Math.cos(gamma * D2R);
  const sg = Math.sin(gamma * D2R);
  const y1 = Ry * cg + Rz * sg;
  const z1 = -Ry * sg + Rz * cg;

  // Visible-side depth (rotation preserves length, so y1² + z1² == r2)
  const x1 = Math.sqrt(Math.max(0, 1 - r2));

  // Inverse Y rotation: undo phi in the (x, z) plane
  const cp = Math.cos(phi * D2R);
  const sp = Math.sin(phi * D2R);
  const x0 = x1 * cp - z1 * sp;
  const y0 = y1;
  const z0 = x1 * sp + z1 * cp;

  const lat = Math.asin(clamp(z0, -1, 1)) * R2D;
  let lng = Math.atan2(y0, x0) * R2D + lambda;
  lng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lng, lat };
}

function limbIntersect(
  a: ProjectedPoint,
  b: ProjectedPoint,
  R: number,
  cx: number,
  cy: number,
): ProjectedPoint | null {
  const dr = a.rx - b.rx;
  if (Math.abs(dr) < 1e-12) return null;
  const t = a.rx / dr;
  if (t < 0 || t > 1) return null;
  let ry = a.ry + t * (b.ry - a.ry);
  let rz = a.rz + t * (b.rz - a.rz);
  const norm = Math.sqrt(ry * ry + rz * rz);
  if (norm < 1e-9) return null;
  ry /= norm;
  rz /= norm;
  return { sx: cx + R * ry, sy: cy - R * rz, rx: 0, ry, rz, v: true };
}

function ringToSegments(
  ring: [number, number][],
  lambda: number,
  phi: number,
  gamma: number,
  R: number,
  cx: number,
  cy: number,
): ProjectedPoint[][] {
  const n = ring.length;
  if (n < 3) return [];
  const proj: ProjectedPoint[] = new Array(n);
  let visCount = 0;
  for (let i = 0; i < n; i++) {
    const p = ring[i];
    proj[i] = project(p[0], p[1], lambda, phi, gamma, R, cx, cy);
    if (proj[i].v) visCount++;
  }
  if (visCount === 0) return [];
  if (visCount === n) return [proj.slice()];

  let startIdx = -1;
  for (let i = 0; i < n; i++) {
    if (!proj[i].v && proj[(i + 1) % n].v) {
      startIdx = i;
      break;
    }
  }

  if (startIdx === -1) return [proj.slice()];
  const segments: ProjectedPoint[][] = [];
  let cur: ProjectedPoint[] = [];

  for (let k = 0; k < n; k++) {
    const i = (startIdx + k) % n;
    const j = (startIdx + k + 1) % n;
    const A = proj[i];
    const B = proj[j];

    if (A.v && B.v) {
      cur.push(B);
    } else if (A.v && !B.v) {
      const inter = limbIntersect(A, B, R, cx, cy);
      if (inter) cur.push(inter);
      if (cur.length >= 2) segments.push(cur);
      cur = [];
    } else if (!A.v && B.v) {
      const inter = limbIntersect(A, B, R, cx, cy);
      if (inter) cur.push(inter);
      cur.push(B);
    }
  }

  return segments;
}

function segmentsToPath(segs: ProjectedPoint[][]): string {
  if (segs.length === 0) return "";
  let out = "";
  for (const seg of segs) {
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i];
      out += (i === 0 ? "M" : "L") + p.sx.toFixed(1) + "," + p.sy.toFixed(1);
    }
    out += "Z";
  }
  return out;
}

function buildSphericalPath(
  type: string,
  coords: any,
  lambda: number,
  phi: number,
  gamma: number,
  R: number,
  cx: number,
  cy: number,
): string {
  if (!coords) return "";
  if (type === "Polygon") {
    let out = "";
    for (const ring of coords) {
      out += segmentsToPath(ringToSegments(ring, lambda, phi, gamma, R, cx, cy));
    }
    return out;
  }
  if (type === "MultiPolygon") {
    let out = "";
    for (const poly of coords) {
      for (const ring of poly) {
        out += segmentsToPath(ringToSegments(ring, lambda, phi, gamma, R, cx, cy));
      }
    }
    return out;
  }
  return "";
}

function buildGraticule(
  lambda: number,
  phi: number,
  gamma: number,
  R: number,
  cx: number,
  cy: number,
): string {
  let out = "";
  // Parallels (lat = const)
  for (let lat = -60; lat <= 60; lat += 30) {
    let started = false;
    let prev: ProjectedPoint | null = null;
    for (let lng = -180; lng <= 180; lng += 5) {
      const p = project(lng, lat, lambda, phi, gamma, R, cx, cy);
      if (p.v) {
        if (!started || (prev && !prev.v)) {
          out += "M" + p.sx.toFixed(1) + "," + p.sy.toFixed(1);
          started = true;
        } else {
          out += "L" + p.sx.toFixed(1) + "," + p.sy.toFixed(1);
        }
      }
      prev = p;
    }
  }

  // Meridians (lng = const)
  for (let lng = -180; lng < 180; lng += 30) {
    let started = false;
    let prev: ProjectedPoint | null = null;
    for (let lat = -80; lat <= 80; lat += 5) {
      const p = project(lng, lat, lambda, phi, gamma, R, cx, cy);
      if (p.v) {
        if (!started || (prev && !prev.v)) {
          out += "M" + p.sx.toFixed(1) + "," + p.sy.toFixed(1);
          started = true;
        } else {
          out += "L" + p.sx.toFixed(1) + "," + p.sy.toFixed(1);
        }
      }
      prev = p;
    }
  }
  return out;
}

/* ========================================================================== */
/* TopoJSON Decoder                                                           */
/* ========================================================================== */
function decArcs(t: any) {
  const tf = t.transform;
  if (!tf) return t.arcs;
  const sx = tf.scale[0],
    sy = tf.scale[1],
    dx = tf.translate[0],
    dy = tf.translate[1];
  return t.arcs.map((a: any[]) => {
    let x = 0,
      y = 0;
    return a.map((p: number[]) => {
      x += p[0];
      y += p[1];
      return [x * sx + dx, y * sy + dy];
    });
  });
}

function resolveRing(idx: number[], arcs: any[]) {
  const out: [number, number][] = [];
  for (const i of idx) {
    const a = i >= 0 ? arcs[i] : arcs[~i].slice().reverse();
    for (let j = out.length > 0 ? 1 : 0; j < a.length; j++) out.push(a[j]);
  }
  return out;
}

function extractFeatures(t: any) {
  const arcs = decArcs(t);
  const gs = t.objects?.countries?.geometries;
  if (!gs) return [];
  const seenIds = new Set<string>();
  return gs.map((g: any, idx: number) => {
    let c: any = null;
    if (g.type === "Polygon") c = g.arcs.map((r: number[]) => resolveRing(r, arcs));
    else if (g.type === "MultiPolygon")
      c = g.arcs.map((p: number[][]) => p.map((r: number[]) => resolveRing(r, arcs)));
    const rawId = g.id != null ? String(g.id).trim() : "";
    const nameSlug = g.properties?.name
      ? String(g.properties.name)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
      : "";
    let uniqueId = rawId || nameSlug || `country-${idx}`;
    if (seenIds.has(uniqueId)) {
      uniqueId = `${uniqueId}-${idx}`;
    }
    seenIds.add(uniqueId);
    return { id: uniqueId, type: g.type, coords: c };
  });
}

/* ========================================================================== */
/* Types & Interfaces                                                         */
/* ========================================================================== */
export interface GlobeMarker {
  id: string;
  city: string;
  country: string;
  region: string;
  flag: string;
  latitude: number;
  longitude: number;
  revenue: number;
  share: number;
  visitors: number;
  deliverySla: string;
  latencyMs: number;
  slaPercent: number;
  growth: number;
  topProduct: string;
  edgeCluster: string;
  status: "Optimal" | "Peak" | "Operational";
  color: string;
  dotColor: string;
}

export interface TacticalGlobe3DProps {
  markers: GlobeMarker[];
  selectedHubId?: string;
  hoveredHubId?: string | null;
  onHoverHub?: (hub: GlobeMarker | null, screenPos?: { x: number; y: number } | null) => void;
  onSelectHub?: (hub: GlobeMarker) => void;
  metric?: "revenue" | "visitors" | "sla";
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  glowColor?: string;
  theme?: "light" | "dark";
  className?: string;
  zoomScale?: number;
}

export function TacticalGlobe3D({
  markers,
  selectedHubId,
  hoveredHubId,
  onHoverHub,
  onSelectHub,
  metric = "revenue",
  autoRotate = true,
  autoRotateSpeed = 7.5,
  glowColor = "#38bdf8",
  theme: propTheme,
  className,
  zoomScale = 1.0,
}: TacticalGlobe3DProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const currentTheme = propTheme || (mounted ? resolvedTheme : "dark");
  const isLight = currentTheme === "light";

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const markerRefs = useRef(new Map<number, SVGGElement>());
  const gridPathRef = useRef<SVGPathElement>(null);
  const telemetryArcsRef = useRef<SVGPathElement>(null);

  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 700, h: 420 });
  const [features, setFeatures] = useState<any[] | null>(null);
  const [dataError, setDataError] = useState(false);

  // Rotation angles:
  // lambda: polar rotation (Z axis / longitude)
  // phi: tilt (Y axis / latitude, default tilted slightly ~12 deg)
  // gamma: roll (camera axis)
  const rotRef = useRef({ lambda: -105, phi: 12, gamma: 0 });
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startLambda: 0, startPhi: 0 });
  const userInteractedRef = useRef(0);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);

  // ResizeObserver for fluid container responsiveness
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) {
        setDims({ w: r.width, h: r.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch Natural Earth 110m TopoJSON (prefer local /data/countries-110m.json, fallback CDN)
  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const localRes = await fetch("/data/countries-110m.json");
        if (localRes.ok) {
          const topo = await localRes.json();
          if (active) setFeatures(extractFeatures(topo));
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
          if (active) setFeatures(extractFeatures(topo));
          return;
        }
      } catch {
        if (active) setDataError(true);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  // Geometry calculations
  const { w: W, h: H } = dims;
  const pad = 12;
  const innerW = Math.max(0, W - pad * 2);
  const innerH = Math.max(0, H - pad * 2);
  const baseR = Math.max(60, Math.min(innerW, innerH) / 2 - 14);
  const R = Math.max(45, baseR * Math.max(0.65, Math.min(1.85, zoomScale)));
  const cx = W / 2;
  const cy = H / 2;

  // Starfield background
  const stars = useMemo(() => {
    const out: { x: number; y: number; r: number; o: number }[] = [];
    const N = 55;
    for (let i = 0; i < N; i++) {
      const x = (i * 137.5) % W;
      const y = (i * 79.3) % H;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < (R + 18) * (R + 18)) continue;
      out.push({
        x,
        y,
        r: 0.6 + (i % 3) * 0.4,
        o: 0.2 + (i % 4) * 0.18,
      });
    }
    return out;
  }, [W, H, cx, cy, R]);

  // Imperative rAF Animation Loop
  useEffect(() => {
    if (!features || features.length === 0 || W <= 0 || H <= 0 || R <= 0) return;

    let raf = 0;
    let lastTime = typeof performance !== "undefined" ? performance.now() : 0;
    const idleMs = 1400;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Auto-spin if not dragging and idle
      const sinceUser = now - userInteractedRef.current;
      if (autoRotate && !dragRef.current.active && sinceUser > idleMs) {
        rotRef.current.lambda += autoRotateSpeed * dt;
      }

      const { lambda, phi, gamma } = rotRef.current;

      // 1. Update Country Polygon Paths
      for (const f of features) {
        const d = buildSphericalPath(f.type, f.coords, lambda, phi, gamma, R, cx, cy);
        const p = pathRefs.current.get(f.id);
        if (p) p.setAttribute("d", d);
      }

      // 2. Update Graticule Grid
      if (gridPathRef.current) {
        gridPathRef.current.setAttribute("d", buildGraticule(lambda, phi, gamma, R, cx, cy));
      }

      // 3. Update Markers with 3D Depth Culling & Horizon Fade
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const el = markerRefs.current.get(i);
        if (!el) continue;

        const p = project(m.longitude, m.latitude, lambda, phi, gamma, R, cx, cy);
        if (p.v) {
          const fade = clamp(p.rx * 3.5, 0, 1);
          el.style.opacity = String(fade);
          el.style.display = "";
          el.setAttribute(
            "transform",
            "translate(" + p.sx.toFixed(1) + "," + p.sy.toFixed(1) + ")",
          );
        } else {
          el.style.opacity = "0";
          el.style.display = "none";
        }
      }

      // 4. Update Inter-Hub Telemetry Arcs
      if (telemetryArcsRef.current) {
        let arcPaths = "";
        const hubRoutes: [number, number][] = [
          [0, 1], // Jakarta <-> Singapore
          [1, 2], // Singapore <-> Tokyo
          [2, 3], // Tokyo <-> Seoul
          [2, 10], // Tokyo <-> San Francisco
          [10, 9], // SF <-> NYC
          [9, 7], // NYC <-> London
          [7, 6], // London <-> Frankfurt
          [6, 8], // Frankfurt <-> Amsterdam
          [6, 5], // Frankfurt <-> Dubai
          [5, 0], // Dubai <-> Jakarta
          [0, 4], // Jakarta <-> Sydney
          [9, 11], // NYC <-> Sao Paulo
        ];

        for (const [idxA, idxB] of hubRoutes) {
          const mA = markers[idxA];
          const mB = markers[idxB];
          if (!mA || !mB) continue;

          const pA = project(mA.longitude, mA.latitude, lambda, phi, gamma, R, cx, cy);
          const pB = project(mB.longitude, mB.latitude, lambda, phi, gamma, R, cx, cy);

          // Interpolate intermediate spherical points along the route
          let started = false;
          let prevVisible = false;

          for (let step = 0; step <= 6; step++) {
            const t = step / 6;
            const curLng = mA.longitude + t * (mB.longitude - mA.longitude);
            const curLat = mA.latitude + t * (mB.latitude - mA.latitude);
            const curP = project(curLng, curLat, lambda, phi, gamma, R, cx, cy);

            if (curP.v) {
              if (!started || !prevVisible) {
                arcPaths += "M" + curP.sx.toFixed(1) + "," + curP.sy.toFixed(1);
                started = true;
              } else {
                arcPaths += "L" + curP.sx.toFixed(1) + "," + curP.sy.toFixed(1);
              }
              prevVisible = true;
            } else {
              prevVisible = false;
            }
          }
        }
        telemetryArcsRef.current.setAttribute("d", arcPaths);
      }

      // 5. Cursor Hover Proximity Check in 3D Space
      if (lastMouseRef.current && !dragRef.current.active) {
        const mouse = lastMouseRef.current;
        let closestHub: GlobeMarker | null = null;
        let closestPos: { x: number; y: number } | null = null;
        let minD = Infinity;

        for (let i = 0; i < markers.length; i++) {
          const m = markers[i];
          const p = project(m.longitude, m.latitude, lambda, phi, gamma, R, cx, cy);
          if (p.v) {
            const d = Math.hypot(mouse.x - p.sx, mouse.y - p.sy);
            if (d < minD) {
              minD = d;
              closestHub = m;
              closestPos = { x: p.sx, y: p.sy };
            }
          }
        }

        // Snapping radius of 28px around projected screen marker
        if (minD <= 28 && closestHub && closestPos) {
          onHoverHub?.(closestHub, closestPos);
        } else {
          // If cursor is on the globe disk, check unprojected lat/lng
          const ll = unproject(mouse.x, mouse.y, lambda, phi, gamma, R, cx, cy);
          if (ll) {
            let geoClosest: GlobeMarker | null = null;
            let geoMin = Infinity;
            for (const m of markers) {
              const d = Math.hypot(ll.lng - m.longitude, ll.lat - m.latitude);
              if (d < geoMin) {
                geoMin = d;
                geoClosest = m;
              }
            }
            if (geoMin <= 18 && geoClosest) {
              const pGeo = project(
                geoClosest.longitude,
                geoClosest.latitude,
                lambda,
                phi,
                gamma,
                R,
                cx,
                cy,
              );
              if (pGeo.v) {
                onHoverHub?.(geoClosest, { x: pGeo.sx, y: pGeo.sy });
              } else {
                onHoverHub?.(null, null);
              }
            } else {
              onHoverHub?.(null, null);
            }
          } else {
            onHoverHub?.(null, null);
          }
        }
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [features, markers, W, H, R, cx, cy, autoRotate, autoRotateSpeed, onHoverHub]);

  // Pointer drag interaction
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const dx = px - cx;
    const dy = py - cy;
    // Only drag when clicking inside globe disk + margin
    if (dx * dx + dy * dy > (R + 15) * (R + 15)) return;

    dragRef.current = {
      active: true,
      startX: px,
      startY: py,
      startLambda: rotRef.current.lambda,
      startPhi: rotRef.current.phi,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    lastMouseRef.current = { x: px, y: py };

    if (dragRef.current.active) {
      const sensitivity = 0.45;
      const dx = px - dragRef.current.startX;
      const dy = py - dragRef.current.startY;
      rotRef.current.lambda = dragRef.current.startLambda - dx * sensitivity;
      rotRef.current.phi = clamp(dragRef.current.startPhi + dy * sensitivity, -80, 80);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current.active) {
      dragRef.current.active = false;
      userInteractedRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handlePointerLeave = () => {
    lastMouseRef.current = null;
    if (!dragRef.current.active) {
      onHoverHub?.(null, null);
    }
  };

  const rawId = useId();
  const uid = rawId.replace(/[:]/g, "");
  const fGlow = "fg-" + uid;
  const fAtm = "fa-" + uid;
  const gShade = "gs-" + uid;
  const clipSphere = "cs-" + uid;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-[340px] sm:h-[420px] lg:h-[460px] xl:h-[500px] rounded-2xl bg-gradient-to-b from-slate-50 via-sky-50/40 to-slate-100 border border-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 dark:border-slate-800/80 overflow-hidden select-none shadow-sm dark:shadow-inner transition-colors duration-300",
        className,
      )}
      style={{ touchAction: "none" }}
    >
      {/* Loading state indicator */}
      {!features && !dataError && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wider animate-pulse z-10">
          INITIALIZING 3D SPHERICAL GEOMETRY…
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={"0 0 " + W + " " + H}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      >
        <defs>
          {/* Outer Atmosphere Glow */}
          <radialGradient id={fAtm} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={isLight ? "#0284c7" : glowColor} stopOpacity="0" />
            <stop
              offset={((R / (R + 45)) * 100).toFixed(1) + "%"}
              stopColor={isLight ? "#0284c7" : glowColor}
              stopOpacity="0"
            />
            <stop
              offset={(((R + 4) / (R + 45)) * 100).toFixed(1) + "%"}
              stopColor={isLight ? "#0284c7" : glowColor}
              stopOpacity={isLight ? 0.2 : 0.4}
            />
            <stop offset="100%" stopColor={isLight ? "#0284c7" : glowColor} stopOpacity="0" />
          </radialGradient>

          {/* 3D Sphere Specular Lighting & Twilight Terminator */}
          <radialGradient id={gShade} cx="36%" cy="30%" r="76%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={isLight ? 0.4 : 0.14} />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
            <stop
              offset="85%"
              stopColor={isLight ? "#0369a1" : "#000000"}
              stopOpacity={isLight ? 0.12 : 0.38}
            />
            <stop
              offset="100%"
              stopColor={isLight ? "#0284c7" : "#000000"}
              stopOpacity={isLight ? 0.28 : 0.68}
            />
          </radialGradient>

          {/* Ocean Base Gradient */}
          <radialGradient id="oceanGrad" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor={isLight ? "#e0f2fe" : "#0a1526"} />
            <stop offset="70%" stopColor={isLight ? "#bae6fd" : "#050b14"} />
            <stop offset="100%" stopColor={isLight ? "#93c5fd" : "#020509"} />
          </radialGradient>

          {/* Spherical Horizon Clip Disc */}
          <clipPath id={clipSphere}>
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>

          {/* Subtle marker glow */}
          <filter id={fGlow} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Background Stars / Particles */}
        {stars.map((s, i) => (
          <circle
            key={"s-" + i}
            cx={s.x.toFixed(1)}
            cy={s.y.toFixed(1)}
            r={s.r.toFixed(2)}
            fill={isLight ? "#0284c7" : "#ffffff"}
            opacity={isLight ? s.o * 0.15 : s.o}
          />
        ))}

        {/* Atmospheric Glow Halo */}
        <circle cx={cx} cy={cy} r={R + 45} fill={"url(#" + fAtm + ")"} pointerEvents="none" />

        {/* Ocean Disc */}
        <circle cx={cx} cy={cy} r={R} fill="url(#oceanGrad)" />

        {/* Content Clipped to 3D Horizon Sphere */}
        <g clipPath={"url(#" + clipSphere + ")"}>
          {/* Spherical Graticule Grid */}
          <path
            ref={gridPathRef}
            fill="none"
            stroke={isLight ? "#0284c7" : "#38bdf8"}
            strokeWidth="0.4"
            strokeOpacity={isLight ? 0.2 : 0.22}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />

          {/* Real Country Polygons (Natural Earth 110m) */}
          {features?.map((f, idx) => (
            <path
              key={`globe-c-${f.id}-${idx}`}
              ref={(el) => {
                if (el) pathRefs.current.set(f.id, el);
                else pathRefs.current.delete(f.id);
              }}
              fill={isLight ? "#f8fafc" : "#1e293b"}
              stroke="#0284c7"
              strokeWidth="0.5"
              strokeOpacity={isLight ? 0.45 : 0.4}
              vectorEffect="non-scaling-stroke"
              className={cn(
                "transition-colors duration-150",
                isLight ? "hover:fill-sky-100" : "hover:fill-sky-900/60",
              )}
            />
          ))}

          {/* Inter-Hub 3D Flight & Telemetry Arcs */}
          <path
            ref={telemetryArcsRef}
            fill="none"
            stroke={isLight ? "#0284c7" : "#38bdf8"}
            strokeWidth={isLight ? 1 : 0.75}
            strokeDasharray="2 3"
            strokeOpacity={isLight ? 0.8 : 0.6}
            className="animate-[pulse_3s_ease-in-out_infinite]"
            pointerEvents="none"
          />
        </g>

        {/* 3D Volumetric Sphere Shading Overlay */}
        <circle cx={cx} cy={cy} r={R} fill={"url(#" + gShade + ")"} pointerEvents="none" />

        {/* Outer Horizon Rim Light */}
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={isLight ? "#0284c7" : glowColor}
          strokeWidth="1.2"
          strokeOpacity={isLight ? 0.35 : 0.45}
          pointerEvents="none"
        />

        {/* 3D City Telemetry Markers */}
        {markers.map((m, i) => {
          const isSelected = selectedHubId === m.id;
          const isHovered = hoveredHubId === m.id;
          const isHighlighted = isSelected || isHovered;
          const sz = isHighlighted ? 6.5 : 4.5;

          return (
            <g
              key={m.id}
              ref={(el) => {
                if (el) markerRefs.current.set(i, el);
                else markerRefs.current.delete(i);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectHub?.(m);
                const { lambda, phi, gamma } = rotRef.current;
                const p = project(m.longitude, m.latitude, lambda, phi, gamma, R, cx, cy);
                if (p.v) {
                  onHoverHub?.(m, { x: p.sx, y: p.sy });
                }
              }}
              className="cursor-pointer"
              style={{ opacity: 0 }}
            >
              {/* Radar pulse ring */}
              <circle
                r={sz * 2.2}
                fill={m.dotColor}
                opacity={isHighlighted ? 0.35 : 0.18}
                className="animate-ping [animation-duration:2.5s]"
              />
              {/* Outer beacon disc */}
              <circle r={sz * 1.5} fill={m.dotColor} opacity={isHighlighted ? 0.45 : 0.25} />
              {/* Core solid marker */}
              <circle
                r={sz}
                fill={m.dotColor}
                stroke={isLight ? "#ffffff" : "#020617"}
                strokeWidth="1.5"
                filter={"url(#" + fGlow + ")"}
              />
              {/* Specular center dot */}
              <circle cx={-sz * 0.3} cy={-sz * 0.3} r={sz * 0.3} fill="#ffffff" opacity={0.7} />

              {/* City Name Label */}
              <text
                x={sz * 2.2}
                y={sz * 0.4}
                fill={isLight ? "#0f172a" : "#f8fafc"}
                fontSize={isHighlighted ? 11 : 9.5}
                fontWeight={isHighlighted ? "700" : "600"}
                fontFamily="monospace"
                stroke={isLight ? "#ffffff" : "#020617"}
                strokeWidth="2.5"
                strokeLinejoin="round"
                paintOrder="stroke"
                className="pointer-events-none select-none"
              >
                {m.flag} {m.city}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
