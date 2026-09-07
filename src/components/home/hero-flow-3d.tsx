"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Sparkles,
  ArrowRight,
  ChevronRight,
  Sun,
  Moon,
  Terminal,
  Activity,
  Zap,
  Globe,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FlipFadeText } from "@/components/ui/flip-fade-text";

gsap.registerPlugin(ScrollTrigger);

interface HeroFlow3DProps {
  locale: string;
  t: (key: string) => string;
}

export default function HeroFlow3D({ locale, t }: HeroFlow3DProps) {
  const containerRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const terminalCardRef = useRef<HTMLDivElement>(null);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  const [activeTab, setActiveTab] = useState<"terminal" | "metrics" | "arcade">("terminal");
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "INIT: LevTech Unified Engine 2.4-flow",
    "CLUSTER: 14 Global Regions Active (US, EU, AP-ID, SG)",
    "TELEMETRY: 1,847 Real-time Store Nodes Connected",
    "REVENUE_PULSE: $284,750 /mo (+12.5% WoW growth)",
    "SYSTEM_HEALTH: All systems nominal (99.98% SLA)",
  ]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Simulated Terminal Stream ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const logs = [
        "SYNC: Stripe & Midtrans webhooks reconciled [0.12ms]",
        "EVENT: Order #ORD-2849 completed via QRIS ($148.50)",
        "ORBIT: Satellite node Singapore sync OK",
        "CACHE: Edge cache hit ratio 98.4%",
        "SECURITY: 2FA TOTP verified for admin session",
      ];
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setTerminalLines((prev) => [...prev.slice(-4), randomLog]);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  // ── Three.js Ambient 3D Particle & Cosmos Layer ────────────────────────────
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !coarsePointer,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.25 : 1.75));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = "absolute inset-0 h-full w-full pointer-events-none z-10";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      (host.clientWidth || 1) / (host.clientHeight || 1),
      0.1,
      100,
    );
    camera.position.set(0, 0, 10);

    const world = new THREE.Group();
    scene.add(world);

    // Dynamic fireflies / cosmic butterflies particle system
    const count = coarsePointer ? 40 : 90;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 2] = Math.random() * 6 - 2;
      scales[i] = Math.random() * 0.8 + 0.3;
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particlesMaterial = new THREE.PointsMaterial({
      color: isDark ? 0x7dd3fc : 0xfde047,
      size: coarsePointer ? 0.04 : 0.055,
      transparent: true,
      opacity: isDark ? 0.85 : 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(geometry, particlesMaterial);
    world.add(particles);

    // Glowing orbital cyber ring
    const ringGeo = new THREE.TorusGeometry(3.6, 0.015, 8, 120);
    const ringMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0xb3f021,
      transparent: true,
      opacity: isDark ? 0.35 : 0.2,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.set(1.2, 0.2, -0.4);
    ring.position.set(0, -0.5, 0.5);
    world.add(ring);

    let disposed = false;
    let running = true;
    let rafId: number | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const scrollProgress = 0;
    const startTime = performance.now();

    const loop = () => {
      if (!running || disposed) return;
      rafId = requestAnimationFrame(loop);

      const elapsed = (performance.now() - startTime) / 1000;
      pointerX += (targetX - pointerX) * 0.05;
      pointerY += (targetY - pointerY) * 0.05;

      camera.position.x += (pointerX * 0.4 - camera.position.x) * 0.05;
      camera.position.y += (-scrollProgress * 1.2 + pointerY * 0.3 - camera.position.y) * 0.05;
      camera.position.z = 10 - scrollProgress * 2.5;
      camera.lookAt(pointerX * 0.2, -scrollProgress * 0.5, 0);

      world.rotation.y = pointerX * 0.08 + scrollProgress * 0.25;
      world.rotation.x = -pointerY * 0.04;
      ring.rotation.z = -0.4 + elapsed * 0.08 + scrollProgress * 1.2;

      // Particle floating drift
      const posArr = geometry.attributes.position.array;
      for (let i = 0; i < count; i++) {
        posArr[i * 3 + 1] += Math.sin(elapsed * 1.5 + phases[i]) * 0.003;
        posArr[i * 3] += Math.cos(elapsed * 0.8 + phases[i]) * 0.002;
      }
      geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    if (!reducedMotion) {
      rafId = requestAnimationFrame(loop);
    } else {
      renderer.render(scene, camera);
    }

    const onPointerMove = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      if (!host) return;
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      particlesMaterial.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [isDark]);

  // ── GSAP ScrollTrigger Pinned Scrubbing ────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    const terminalCard = terminalCardRef.current;
    if (!container || !content) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: container,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.6,
        },
      });

      // Scale up the content and fade out
      tl.to(
        content,
        {
          yPercent: -15,
          opacity: 0,
          scale: 0.92,
          ease: "power1.inOut",
        },
        0,
      );

      // Give terminal card a slight parallax
      if (terminalCard) {
        tl.to(
          terminalCard,
          {
            yPercent: -25,
            scale: 1.02,
            boxShadow: isDark
              ? "0 40px 120px -20px rgba(56, 189, 248, 0.4)"
              : "0 40px 120px -20px rgba(0, 0, 0, 0.3)",
            ease: "power1.out",
          },
          0,
        );
      }

      tl.to(
        ".hero-bg-layer",
        {
          scale: 1.08,
          yPercent: 4,
          ease: "none",
        },
        0,
      );
    }, container);

    return () => ctx.revert();
  }, [isDark]);

  const toggleDayNight = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <section
      ref={containerRef}
      className="relative min-h-[170vh] bg-transparent text-foreground"
      aria-label="3D Interactive Hero"
    >
      {/* ── Sticky Viewport Window ── */}
      <div
        ref={stickyRef}
        className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-between"
      >
        {/* ── Cinematic Video Backgrounds (Day & Night) ── */}
        <div className="hero-bg-layer absolute inset-0 w-full h-full pointer-events-none overflow-hidden will-change-transform">
          {/* Day Scene Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/images/hero-day.jpg"
            className={cn(
              "absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out",
              isDark ? "opacity-0" : "opacity-100",
            )}
          >
            <source src="/videos/hero-day.mp4" type="video/mp4" />
          </video>

          {/* Night Scene Video */}
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/images/hero-night.jpg"
            className={cn(
              "absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1000 ease-in-out",
              isDark ? "opacity-100" : "opacity-0",
            )}
          >
            <source src="/videos/hero-night.mp4" type="video/mp4" />
          </video>

          {/* Cinematic Atmosphere Overlays */}
          {/* Light Mode: Soft golden hour & crisp sky glow */}
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-700 pointer-events-none",
              isDark ? "opacity-0" : "opacity-100",
            )}
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 50%, rgba(0,0,0,0.2) 100%), linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 40%, rgba(244,244,245,0.85) 92%, #f4f4f5 100%)",
            }}
          />

          {/* Dark Mode: Cosmic nebula, starfield depth, and cyber glow */}
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-700 pointer-events-none",
              isDark ? "opacity-100" : "opacity-0",
            )}
            style={{
              background:
                "radial-gradient(ellipse at 50% 20%, rgba(56, 189, 248, 0.18) 0%, transparent 60%), linear-gradient(180deg, rgba(11,12,17,0.45) 0%, transparent 35%, rgba(11,12,17,0.75) 85%, #0b0c11 100%)",
            }}
          />
        </div>

        {/* ── Three.js Ambient Particle Host ── */}
        <div ref={canvasHostRef} className="absolute inset-0 pointer-events-none z-10" />

        {/* ── Top Bar Controls (Floating Theme Switcher Badge) ── */}
        <div className="relative z-30 pt-24 px-4 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between pointer-events-auto">
          {/* Tagline Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md transition-all shadow-md",
              isDark
                ? "border-sky-500/30 bg-black/50 text-sky-200 shadow-sky-950/40"
                : "border-white/60 bg-white/70 text-zinc-900 shadow-zinc-200/50",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span>{t("heroTag")}</span>
            <span className="hidden sm:inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          </div>

          {/* Day / Night Mode Interactive Cycle Button */}
          <button
            onClick={toggleDayNight}
            className={cn(
              "group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 shadow-md cursor-pointer",
              isDark
                ? "border-amber-400/30 bg-black/60 text-amber-300 hover:bg-black/80 hover:border-amber-400/60 shadow-amber-950/30"
                : "border-zinc-300/80 bg-white/80 text-zinc-800 hover:bg-white hover:border-zinc-400 shadow-zinc-200/60",
            )}
            title={isDark ? "Switch to Day Scene" : "Switch to Cosmic Night Scene"}
            aria-label="Toggle Hero Day/Night Mode"
          >
            {isDark ? (
              <>
                <Moon className="h-3.5 w-3.5 text-sky-400" />
                <span>Cosmic Night</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 text-sky-300 border border-sky-800/50">
                  Active
                </span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Daylight Meadow</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                  Active
                </span>
              </>
            )}
          </button>
        </div>

        {/* ── Main Hero Foreground Content & Retro CRT Telemetry ── */}
        <div
          ref={contentRef}
          className="relative z-20 max-w-5xl mx-auto w-full px-4 sm:px-8 py-6 my-auto flex flex-col items-center justify-center gap-10 lg:gap-14 mt-4 lg:mt-8"
        >
          {/* Top Column: Typography & CTAs */}
          <div className="flex-1 text-center max-w-4xl flex flex-col items-center w-full">
            <h1
              className={cn(
                "text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold tracking-tight leading-[1.05] transition-colors duration-500 mx-auto",
                isDark ? "text-white" : "text-zinc-950",
              )}
            >
              {t("heroPrefix")}{" "}
              <span className="block mt-2">
                <FlipFadeText
                  words={[t("heroWord1"), t("heroWord2"), t("heroWord3")]}
                  interval={2600}
                  className="!min-h-[1.2em] inline-flex justify-center"
                  textClassName="!text-5xl sm:!text-6xl md:!text-7xl lg:!text-[80px] !font-bold !tracking-tight !normal-case text-accent-gradient"
                />
              </span>
            </h1>

            <p
              className={cn(
                "mt-6 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed transition-colors duration-500",
                isDark ? "text-sky-100/80" : "text-zinc-600",
              )}
            >
              {t("heroSubtitle")}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
              <Link
                href={`/${locale}/register`}
                className={cn(
                  "inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm shadow-xl transition-all duration-300 hover:scale-105 active:scale-95",
                  isDark
                    ? "bg-gradient-to-r from-primary via-emerald-400 to-sky-400 text-zinc-950 hover:shadow-primary/30"
                    : "bg-zinc-950 text-white hover:bg-zinc-800 hover:shadow-zinc-900/30",
                )}
              >
                <span>{t("ctaAccess")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href={`/${locale}/login`}
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm border backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95",
                  isDark
                    ? "border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30"
                    : "border-zinc-300 bg-white/80 text-zinc-900 hover:bg-white hover:border-zinc-400",
                )}
              >
                <span>{t("heroCard.liveDemo")}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-10 pt-6 border-t border-border/40 min-w-[60%]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isDark ? "text-sky-100/90" : "text-zinc-800",
                  )}
                >
                  99.98% Uptime SLA
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isDark ? "text-sky-100/90" : "text-zinc-800",
                  )}
                >
                  4.8/5 Customer Score
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isDark ? "text-sky-100/90" : "text-zinc-800",
                  )}
                >
                  14 Edge Regions
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Column: Holographic CRT Retro Terminal */}
          <div
            ref={terminalCardRef}
            className="w-full max-w-[640px] mx-auto shrink-0 will-change-transform mt-2 lg:mt-4"
          >
            <div
              className={cn(
                "rounded-2xl border backdrop-blur-xl p-4 sm:p-5 shadow-2xl transition-all duration-500 relative overflow-hidden",
                isDark
                  ? "border-sky-500/30 bg-black/75 shadow-sky-950/50"
                  : "border-white/80 bg-white/85 shadow-zinc-400/30",
              )}
            >
              {/* Scanline CRT overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.15), rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)",
                }}
              />

              {/* Terminal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/40 relative z-10">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-xs font-mono font-medium text-muted-foreground ml-2 flex items-center gap-1">
                    <Terminal className="h-3 w-3 text-primary" />
                    crt-monitor-node.sh
                  </span>
                </div>

                {/* Tab switcher */}
                <div className="flex gap-1 bg-background/50 p-0.5 rounded-lg border border-border/40 text-[10px]">
                  <button
                    onClick={() => setActiveTab("terminal")}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      activeTab === "terminal"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground",
                    )}
                  >
                    Console
                  </button>
                  <button
                    onClick={() => setActiveTab("metrics")}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      activeTab === "metrics"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground",
                    )}
                  >
                    Pulse
                  </button>
                  <button
                    onClick={() => setActiveTab("arcade")}
                    className={cn(
                      "px-2 py-0.5 rounded transition cursor-pointer",
                      activeTab === "arcade"
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-muted-foreground",
                    )}
                  >
                    Arcade
                  </button>
                </div>
              </div>

              {/* Terminal Body */}
              <div className="mt-3 relative z-10 min-h-[220px] flex flex-col justify-between font-mono text-xs">
                {activeTab === "terminal" && (
                  <div className="space-y-2 p-2.5 rounded-lg bg-black/60 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] leading-relaxed select-none">
                    <div className="flex items-center justify-between text-[10px] text-emerald-500/70 border-b border-emerald-500/20 pb-1">
                      <span>LIVE TELEMETRY STREAM</span>
                      <span className="animate-pulse">● CONNECTED</span>
                    </div>
                    {terminalLines.map((line, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-emerald-500/50">&gt;</span>
                        <span className="truncate">{line}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 text-emerald-400">
                      <span>&gt;</span>
                      <span className="w-2 h-3.5 bg-emerald-400 inline-block animate-pulse" />
                    </div>
                  </div>
                )}

                {activeTab === "metrics" && (
                  <div className="grid grid-cols-2 gap-2 p-1">
                    <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                      <p className="text-[10px] text-muted-foreground">Monthly GMV</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">$284,750</p>
                      <p className="text-[10px] text-emerald-500 font-semibold mt-1">
                        ↑ +12.5% vs last mo
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                      <p className="text-[10px] text-muted-foreground">Active Orders</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">1,847</p>
                      <p className="text-[10px] text-sky-500 font-semibold mt-1">
                        99.8% checkout rate
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                      <p className="text-[10px] text-muted-foreground">Sync Velocity</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">12 ms</p>
                      <p className="text-[10px] text-purple-500 font-semibold mt-1">Edge latency</p>
                    </div>
                    <div className="p-3 rounded-xl bg-background/60 border border-border/60">
                      <p className="text-[10px] text-muted-foreground">Active Hubs</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">14 / 14</p>
                      <p className="text-[10px] text-amber-500 font-semibold mt-1">
                        Full redundancy
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "arcade" && (
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 via-black to-sky-950/40 border border-purple-500/30 text-center flex flex-col items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-bounce">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                    <p className="font-bold text-sm text-purple-300">Retro Arcade Matrix</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">
                      High score: 98,420 pts. Inspired by the field arcade in the Google Flow world.
                    </p>
                    <Link
                      href={`/${locale}/dashboard`}
                      className="mt-1 px-4 py-1.5 rounded-full bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs transition shadow"
                    >
                      Enter Simulation
                    </Link>
                  </div>
                )}

                {/* Sticky Note on CRT (like the yellow sticky in the video) */}
                <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    Streaming live from Supabase + Prisma Edge
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-500 border border-amber-400/30 font-sans font-bold">
                    POST-IT: GO PRO!
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Scroll Cue & Badges ── */}
        <div className="relative z-30 pb-6 px-4 max-w-7xl mx-auto w-full flex flex-col items-center justify-center gap-3 pointer-events-auto">
          <a
            href="#features"
            aria-label="Scroll to features"
            className={cn(
              "group inline-flex flex-col items-center gap-1.5 text-xs font-medium transition-all duration-300 hover:scale-105",
              isDark ? "text-sky-200/70 hover:text-sky-100" : "text-zinc-600 hover:text-zinc-900",
            )}
          >
            <span className="uppercase tracking-widest text-[10px]">Explore Platform</span>
            <div className="w-5 h-8 rounded-full border border-current flex items-start justify-center p-1">
              <div className="w-1.5 h-2 rounded-full bg-primary animate-bounce" />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
