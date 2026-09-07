"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Globe,
  Users,
  TrendingUp,
  Truck,
  ShieldCheck,
  Activity,
  Wifi,
  Zap,
  CheckCircle2,
  RotateCw,
  Map as MapIcon,
  Plus,
  Minus,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/components/currency-provider";
import { TacticalGlobe3D, GlobeMarker } from "./tactical-globe-3d";
import { InteractiveMap2D } from "./interactive-map-2d";

export interface CityTelemetryHub extends GlobeMarker {
  x: number; // percentage 0-100 on Equirectangular map
  y: number; // percentage 0-100 on Equirectangular map
}

const CITY_HUBS: CityTelemetryHub[] = [
  {
    id: "jakarta",
    city: "Jakarta",
    country: "Indonesia",
    region: "Southeast Asia (HQ)",
    flag: "🇮🇩",
    latitude: -6.2088,
    longitude: 106.8456,
    x: 79.7,
    y: 53.5,
    revenue: 68420,
    share: 24.1,
    visitors: 384,
    deliverySla: "0.8 days",
    latencyMs: 14,
    slaPercent: 99.98,
    growth: 26.4,
    topProduct: "Midtrans & QRIS Unified Checkout",
    edgeCluster: "APAC-JKT-01",
    status: "Optimal",
    color: "bg-emerald-500",
    dotColor: "#10b981",
  },
  {
    id: "singapore",
    city: "Singapore",
    country: "Singapore",
    region: "Southeast Asia Core",
    flag: "🇸🇬",
    latitude: 1.3521,
    longitude: 103.8198,
    x: 78.8,
    y: 49.3,
    revenue: 42150,
    share: 14.8,
    visitors: 265,
    deliverySla: "0.9 days",
    latencyMs: 18,
    slaPercent: 99.99,
    growth: 21.2,
    topProduct: "Cross-Border Settlement Engine",
    edgeCluster: "APAC-SIN-01",
    status: "Optimal",
    color: "bg-emerald-500",
    dotColor: "#10b981",
  },
  {
    id: "tokyo",
    city: "Tokyo",
    country: "Japan",
    region: "East Asia Hub",
    flag: "🇯🇵",
    latitude: 35.6762,
    longitude: 139.6503,
    x: 88.8,
    y: 30.2,
    revenue: 54900,
    share: 19.3,
    visitors: 298,
    deliverySla: "1.0 days",
    latencyMs: 22,
    slaPercent: 99.95,
    growth: 16.8,
    topProduct: "Analytics Ultra Core",
    edgeCluster: "APAC-HND-02",
    status: "Optimal",
    color: "bg-sky-500",
    dotColor: "#0ea5e9",
  },
  {
    id: "seoul",
    city: "Seoul",
    country: "South Korea",
    region: "Northeast Asia",
    flag: "🇰🇷",
    latitude: 37.5665,
    longitude: 126.978,
    x: 85.3,
    y: 29.1,
    revenue: 28300,
    share: 9.9,
    visitors: 176,
    deliverySla: "1.1 days",
    latencyMs: 25,
    slaPercent: 99.92,
    growth: 18.5,
    topProduct: "Developer Gateway Bundle",
    edgeCluster: "APAC-ICN-01",
    status: "Optimal",
    color: "bg-sky-500",
    dotColor: "#0ea5e9",
  },
  {
    id: "sydney",
    city: "Sydney",
    country: "Australia",
    region: "Oceania Edge",
    flag: "🇦🇺",
    latitude: -33.8688,
    longitude: 151.2093,
    x: 92.0,
    y: 68.8,
    revenue: 31200,
    share: 10.9,
    visitors: 189,
    deliverySla: "1.4 days",
    latencyMs: 34,
    slaPercent: 99.9,
    growth: 14.1,
    topProduct: "Enterprise Cloud Pro",
    edgeCluster: "OCN-SYD-01",
    status: "Operational",
    color: "bg-indigo-500",
    dotColor: "#6366f1",
  },
  {
    id: "dubai",
    city: "Dubai",
    country: "United Arab Emirates",
    region: "MENA Transit Core",
    flag: "🇦🇪",
    latitude: 25.2048,
    longitude: 55.2708,
    x: 65.4,
    y: 36.0,
    revenue: 39800,
    share: 14.0,
    visitors: 220,
    deliverySla: "1.2 days",
    latencyMs: 36,
    slaPercent: 99.94,
    growth: 28.7,
    topProduct: "High-Volume B2B Ledger",
    edgeCluster: "MEA-DXB-01",
    status: "Optimal",
    color: "bg-amber-500",
    dotColor: "#f59e0b",
  },
  {
    id: "frankfurt",
    city: "Frankfurt",
    country: "Germany",
    region: "Central Europe",
    flag: "🇩🇪",
    latitude: 50.1109,
    longitude: 8.6821,
    x: 52.4,
    y: 22.2,
    revenue: 58400,
    share: 20.5,
    visitors: 310,
    deliverySla: "1.0 days",
    latencyMs: 19,
    slaPercent: 99.97,
    growth: 13.9,
    topProduct: "Security Suite v2 & DPoP",
    edgeCluster: "EUR-FRA-01",
    status: "Optimal",
    color: "bg-purple-500",
    dotColor: "#a855f7",
  },
  {
    id: "london",
    city: "London",
    country: "United Kingdom",
    region: "Western Europe",
    flag: "🇬🇧",
    latitude: 51.5074,
    longitude: -0.1278,
    x: 50.0,
    y: 21.4,
    revenue: 62700,
    share: 22.0,
    visitors: 345,
    deliverySla: "1.1 days",
    latencyMs: 21,
    slaPercent: 99.96,
    growth: 15.2,
    topProduct: "Omnichannel API Router",
    edgeCluster: "EUR-LON-02",
    status: "Optimal",
    color: "bg-purple-500",
    dotColor: "#a855f7",
  },
  {
    id: "amsterdam",
    city: "Amsterdam",
    country: "Netherlands",
    region: "Northwest Europe",
    flag: "🇳🇱",
    latitude: 52.3676,
    longitude: 4.9041,
    x: 51.4,
    y: 20.9,
    revenue: 33600,
    share: 11.8,
    visitors: 195,
    deliverySla: "0.9 days",
    latencyMs: 16,
    slaPercent: 99.99,
    growth: 19.3,
    topProduct: "Cloud CDN Edge Mesh",
    edgeCluster: "EUR-AMS-01",
    status: "Optimal",
    color: "bg-purple-500",
    dotColor: "#a855f7",
  },
  {
    id: "new-york",
    city: "New York",
    country: "USA",
    region: "North America (East)",
    flag: "🇺🇸",
    latitude: 40.7128,
    longitude: -74.006,
    x: 29.4,
    y: 27.4,
    revenue: 124500,
    share: 43.8,
    visitors: 520,
    deliverySla: "1.0 days",
    latencyMs: 12,
    slaPercent: 99.99,
    growth: 17.5,
    topProduct: "Enterprise Multi-Region Pro",
    edgeCluster: "USA-NYC-01",
    status: "Optimal",
    color: "bg-blue-500",
    dotColor: "#3b82f6",
  },
  {
    id: "san-francisco",
    city: "San Francisco",
    country: "USA",
    region: "North America (West)",
    flag: "🇺🇸",
    latitude: 37.7749,
    longitude: -122.4194,
    x: 16.0,
    y: 29.0,
    revenue: 89600,
    share: 31.5,
    visitors: 430,
    deliverySla: "1.1 days",
    latencyMs: 15,
    slaPercent: 99.97,
    growth: 12.8,
    topProduct: "AI Copilot Intelligence Suite",
    edgeCluster: "USA-SFO-01",
    status: "Optimal",
    color: "bg-blue-500",
    dotColor: "#3b82f6",
  },
  {
    id: "sao-paulo",
    city: "São Paulo",
    country: "Brazil",
    region: "Latin America Edge",
    flag: "🇧🇷",
    latitude: -23.5505,
    longitude: -46.6333,
    x: 37.1,
    y: 63.1,
    revenue: 27400,
    share: 9.6,
    visitors: 162,
    deliverySla: "1.8 days",
    latencyMs: 45,
    slaPercent: 99.88,
    growth: 22.4,
    topProduct: "Local Pix & Card Ingestion",
    edgeCluster: "LAM-GRU-01",
    status: "Operational",
    color: "bg-rose-500",
    dotColor: "#f43f5e",
  },
];

interface LivePing {
  id: string;
  x: number;
  y: number;
  label: string;
  amount: number;
}

export function GlobalSalesMap() {
  const t = useTranslations("dashboard");
  const { formatMoney, formatCompactMoney, currency } = useCurrency();

  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [selectedHub, setSelectedHub] = useState<CityTelemetryHub>(CITY_HUBS[0]);
  const [hoveredHub, setHoveredHub] = useState<CityTelemetryHub | null>(null);
  const [hudPos, setHudPos] = useState<{ xPct: number; yPct: number } | null>(null);
  const [metric, setMetric] = useState<"revenue" | "visitors" | "sla">("revenue");
  const [livePings, setLivePings] = useState<LivePing[]>([]);
  const [zoomScale, setZoomScale] = useState(1.0);

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(viewMode === "3d" ? 1.75 : 2.2, +(prev + 0.15).toFixed(2)));
  };
  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(viewMode === "3d" ? 0.75 : 1.0, +(prev - 0.15).toFixed(2)));
  };
  const handleResetZoom = () => {
    setZoomScale(1.0);
  };

  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Active hub to display in result cards: hovered takes precedence, falls back to selected
  const activeHub = hoveredHub || selectedHub;

  // Listen for simulated orders dispatched across the application
  useEffect(() => {
    const handleSimulate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      let targetHub = CITY_HUBS[0]; // Jakarta default

      if (detail?.region === "us-east") {
        targetHub = CITY_HUBS.find((h) => h.id === "new-york") || targetHub;
      } else if (detail?.region === "us-west") {
        targetHub = CITY_HUBS.find((h) => h.id === "san-francisco") || targetHub;
      } else if (detail?.region === "eu-central") {
        targetHub = CITY_HUBS.find((h) => h.id === "frankfurt") || targetHub;
      } else if (detail?.region === "ap-japan") {
        targetHub = CITY_HUBS.find((h) => h.id === "tokyo") || targetHub;
      } else if (detail?.city) {
        const found = CITY_HUBS.find((h) =>
          h.city.toLowerCase().includes(detail.city.toLowerCase()),
        );
        if (found) targetHub = found;
      }

      const newPing: LivePing = {
        id: "ping-" + Date.now() + "-" + Math.random(),
        x: targetHub.x,
        y: targetHub.y,
        label: targetHub.flag + " " + targetHub.city,
        amount: detail?.amount || 320,
      };

      setLivePings((prev) => [...prev, newPing]);
      setTimeout(() => {
        setLivePings((prev) => prev.filter((p) => p.id !== newPing.id));
      }, 4500);
    };

    window.addEventListener("simulate-order", handleSimulate);
    return () => window.removeEventListener("simulate-order", handleSimulate);
  }, []);

  // Unified Telemetry Hover Callback (Synchronous across 3D Globe & 2D Planar Map)
  const handleHoverHub = useCallback(
    (hub: GlobeMarker | null, screenPos?: { x: number; y: number } | null) => {
      if (hub) {
        const fullHub = CITY_HUBS.find((h) => h.id === hub.id) || null;
        setHoveredHub(fullHub);
        if (screenPos && mapContainerRef.current) {
          const rect = mapContainerRef.current.getBoundingClientRect();
          const xPct = Math.max(0, Math.min(100, (screenPos.x / rect.width) * 100));
          const yPct = Math.max(0, Math.min(100, (screenPos.y / rect.height) * 100));
          setHudPos({ xPct, yPct });
        }
      } else {
        setHoveredHub(null);
        setHudPos(null);
      }
    },
    [],
  );

  const totalVisitors = useMemo(() => CITY_HUBS.reduce((acc, h) => acc + h.visitors, 0), []);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-sky-500 animate-pulse" />
            {t("globalSalesMapTitle")}
          </CardTitle>
          <CardDescription>{t("globalSalesMapDesc")}</CardDescription>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher (3D Globe vs 2D Planar) */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs shrink-0">
            <button
              onClick={() => {
                setViewMode("3d");
                setZoomScale(1.0);
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5",
                viewMode === "3d"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>3D Globe</span>
            </button>
            <button
              onClick={() => {
                setViewMode("2d");
                setZoomScale(1.0);
              }}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5",
                viewMode === "2d"
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>2D Planar</span>
            </button>
          </div>

          {/* Metric Selector Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs shrink-0">
            <button
              onClick={() => setMetric("revenue")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                metric === "revenue"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("metricRevenue")}
            </button>
            <button
              onClick={() => setMetric("visitors")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                metric === "visitors"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("metricVisitors")}
            </button>
            <button
              onClick={() => setMetric("sla")}
              className={cn(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer",
                metric === "sla"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("metricSla")}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-4">
        {/* Main Interactive Stage Container */}
        <div ref={mapContainerRef} className="relative w-full overflow-hidden rounded-2xl">
          {viewMode === "3d" ? (
            /* ─── 3D SPHERICAL GLOBE COMPONENT ─── */
            <TacticalGlobe3D
              markers={CITY_HUBS}
              selectedHubId={selectedHub.id}
              hoveredHubId={hoveredHub?.id}
              onHoverHub={handleHoverHub}
              onSelectHub={(m) => {
                const full = CITY_HUBS.find((h) => h.id === m.id) || selectedHub;
                setSelectedHub(full);
              }}
              metric={metric}
              autoRotate={true}
              autoRotateSpeed={7.0}
              zoomScale={zoomScale}
            />
          ) : (
            /* ─── 2D PLANAR VECTOR MAP STAGE (Natural Earth 110m) ─── */
            <InteractiveMap2D
              markers={CITY_HUBS}
              selectedHubId={selectedHub.id}
              hoveredHubId={hoveredHub?.id}
              onHoverHub={handleHoverHub}
              onSelectHub={(m) => {
                const full = CITY_HUBS.find((h) => h.id === m.id) || selectedHub;
                setSelectedHub(full);
              }}
              metric={metric}
              livePings={livePings}
              zoomScale={zoomScale}
            />
          )}

          {/* Floating Precision Zoom Controls (+ / - / ⟲) */}
          <div className="absolute bottom-12 sm:bottom-10 right-3 z-30 flex flex-col items-center rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-lg p-0.5 gap-0.5 transition-all">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label={t("zoomIn")}
              title={t("zoomIn")}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <div className="w-4 h-[1px] bg-slate-200 dark:bg-slate-800" />
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label={t("zoomOut")}
              title={t("zoomOut")}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="w-4 h-[1px] bg-slate-200 dark:bg-slate-800" />
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label={t("resetView")}
              title={t("resetView")}
              className="p-1.5 rounded-lg text-slate-700 dark:text-slate-300 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>

          {/* Floating Glassmorphism Telemetry HUD Tooltip (Synchronous across 3D & 2D) */}
          <AnimatePresence>
            {hudPos &&
              activeHub &&
              (() => {
                const isFlipped = hudPos.yPct < 26;
                const clampedX = Math.max(18, Math.min(82, hudPos.xPct));
                const caretOffset = Math.max(12, Math.min(88, 50 + (hudPos.xPct - clampedX) * 2.2));

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: isFlipped ? -6 : 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: isFlipped ? -4 : 4 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      left: `${clampedX}%`,
                      top: `${hudPos.yPct}%`,
                    }}
                    className={cn(
                      "absolute -translate-x-1/2 pointer-events-none z-40",
                      isFlipped ? "translate-y-4" : "-translate-y-[calc(100%+10px)]",
                    )}
                  >
                    <div className="relative p-3.5 rounded-xl bg-white/95 text-slate-900 border border-sky-400/60 shadow-2xl shadow-sky-950/20 backdrop-blur-md dark:bg-slate-950/95 dark:text-white dark:border-cyan-500/60 dark:shadow-[0_0_35px_rgba(6,182,212,0.35)] text-xs min-w-[240px] max-w-[290px] transition-all duration-200">
                      {/* Reticle pointer caret dynamically aligned to city beacon */}
                      <div
                        style={{ left: `${caretOffset}%` }}
                        className={cn(
                          "absolute -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-white dark:bg-slate-950 pointer-events-none",
                          isFlipped
                            ? "-top-1.5 border-l border-t border-sky-400/60 dark:border-cyan-500/60"
                            : "-bottom-1.5 border-r border-b border-sky-400/60 dark:border-cyan-500/60",
                        )}
                      />

                      {/* City Header & Status */}
                      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white truncate">
                          <span className="text-base leading-none">{activeHub.flag}</span>
                          <span className="truncate tracking-tight font-semibold">
                            {activeHub.city}, {activeHub.country}
                          </span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/50 dark:shadow-[0_0_10px_rgba(16,185,129,0.3)] shrink-0">
                          {activeHub.status}
                        </span>
                      </div>

                      {/* Telemetry Metrics */}
                      <div className="grid grid-cols-2 gap-2 pt-2.5 text-[11px]">
                        {/* Metric 1: Revenue */}
                        <div className="p-1.5 rounded-lg bg-sky-50/70 border border-sky-200/60 dark:bg-cyan-950/40 dark:border-cyan-800/60 transition-colors">
                          <span className="text-slate-500 dark:text-cyan-400/80 text-[10px] font-medium block">
                            {t("metricRevenue")}
                          </span>
                          <span
                            className="font-extrabold text-sky-600 dark:text-cyan-300 dark:drop-shadow-[0_0_8px_rgba(6,182,212,0.6)] truncate block font-mono text-xs mt-0.5"
                            title={formatMoney(activeHub.revenue)}
                          >
                            {formatMoney(activeHub.revenue)}
                          </span>
                        </div>

                        {/* Metric 2: Live Visitors */}
                        <div className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800/60 transition-colors">
                          <span className="text-slate-500 dark:text-emerald-400/80 text-[10px] font-medium block">
                            {t("metricVisitors")}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-emerald-300 dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] flex items-center gap-1 font-mono text-xs mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse shrink-0" />
                            <span className="truncate">
                              {activeHub.visitors} {t("shoppers")}
                            </span>
                          </span>
                        </div>

                        {/* Metric 3: SLA Speed */}
                        <div className="p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 dark:bg-emerald-950/40 dark:border-emerald-800/60 transition-colors">
                          <span className="text-slate-500 dark:text-emerald-400/80 text-[10px] font-medium block">
                            {t("metricSla")}
                          </span>
                          <span className="font-extrabold text-emerald-600 dark:text-emerald-300 dark:drop-shadow-[0_0_8px_rgba(16,185,129,0.5)] font-mono text-xs mt-0.5 block">
                            {activeHub.deliverySla}
                          </span>
                        </div>

                        {/* Metric 4: Edge Latency */}
                        <div className="p-1.5 rounded-lg bg-slate-50/70 border border-slate-200/60 dark:bg-slate-900/60 dark:border-slate-800/60 transition-colors">
                          <span className="text-slate-500 dark:text-slate-400 text-[10px] font-medium block">
                            {t("edgeLatency")}
                          </span>
                          <span className="font-bold text-sky-600 dark:text-cyan-400 font-mono text-xs mt-0.5 block truncate">
                            {activeHub.latencyMs}ms{" "}
                            <span className="text-[10px] opacity-80">
                              ({activeHub.slaPercent}%)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Edge Cluster Footer */}
                      <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        <span className="truncate">{activeHub.edgeCluster}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_6px_rgba(16,185,129,0.4)] font-semibold shrink-0 ml-1">
                          ● 100% {t("clusterHealth")}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
          </AnimatePresence>

          {/* Top Left Global Live Counter Pill */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-slate-200 shadow-sm text-xs dark:bg-slate-900/80 dark:border-slate-700/80 dark:shadow-lg pointer-events-none transition-colors duration-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">
              {t("globalActiveSessions")}
            </span>
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              {totalVisitors}
            </span>
          </div>

          {/* Top Right Mode & Telemetry Status Pill */}
          <div className="absolute top-3 right-3 z-20 hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-md border border-slate-200 text-[10px] font-mono text-sky-700 shadow-sm dark:bg-slate-900/80 dark:border-slate-800 dark:text-cyan-400 pointer-events-none transition-colors duration-200">
            <Activity className="h-3 w-3 animate-spin [animation-duration:6s]" />
            <span>{viewMode === "3d" ? t("orthographic3d") : t("equidistant2d")}</span>
          </div>
        </div>

        {/* Quick City Filter Chips (1-Click Hub Selection) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <span className="text-muted-foreground font-medium shrink-0 flex items-center gap-1 mr-1">
            <Zap className="h-3 w-3 text-amber-500" />
            {t("edgeNodes")}
          </span>
          {CITY_HUBS.map((hub) => {
            const isSelected = activeHub.id === hub.id;
            return (
              <button
                key={hub.id}
                onClick={() => {
                  setSelectedHub(hub);
                  setHoveredHub(null);
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1 font-medium transition cursor-pointer border",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/50 hover:text-foreground",
                )}
              >
                <span>{hub.flag}</span>
                <span>{hub.city}</span>
              </button>
            );
          })}
        </div>

        {/* Selected / Hovered Hub Real-Time Telemetry Deep-Dive Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Card 1: Active Territory & Edge Node */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{t("activeTerritory")}</p>
            <div className="flex items-center gap-2 mt-1 min-w-0">
              <span className="text-lg shrink-0">{activeHub.flag}</span>
              <p
                className="text-sm font-bold text-foreground truncate"
                title={activeHub.city + ", " + activeHub.country}
              >
                {activeHub.city}, {activeHub.country}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
              {activeHub.edgeCluster} • {activeHub.region}
            </p>
          </div>

          {/* Card 2: Regional Revenue (Zero Overflow Protected) */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{t("regionalRevenue")}</p>
            <p
              className="text-lg sm:text-xl font-bold text-foreground mt-0.5 truncate tracking-tight"
              title={formatMoney(activeHub.revenue)}
            >
              {currency === "IDR" && activeHub.revenue > 1000000
                ? formatCompactMoney(activeHub.revenue)
                : formatMoney(activeHub.revenue)}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
              ↑ +{activeHub.growth}% YoY ({activeHub.share}% total GMV)
            </p>
          </div>

          {/* Card 3: Live Sessions & SLA Speed */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{t("liveSessions")}</p>
            <div className="flex items-center gap-2 mt-0.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="text-base font-bold text-foreground truncate">
                {activeHub.visitors} {t("shoppers")}
              </p>
            </div>
            <p className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5 truncate">
              {t("avgSla")} {activeHub.deliverySla} • {activeHub.latencyMs}ms latency
            </p>
          </div>

          {/* Card 4: Top Performing Product & Route SLA */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 min-w-0 overflow-hidden">
            <p className="text-xs text-muted-foreground truncate">{t("topPerformingProduct")}</p>
            <p
              className="text-xs font-semibold text-foreground mt-1 truncate"
              title={activeHub.topProduct}
            >
              {activeHub.topProduct}
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium mt-1 truncate">
              <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />
              {activeHub.slaPercent}% {t("routeHealth")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
