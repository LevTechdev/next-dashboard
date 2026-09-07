"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* =============================================================================
   Hero3D — a WebGL background for the marketing hero.
   -----------------------------------------------------------------------------
   Three.js scene (central glowing knot + orbit rings + satellites + starfield)
   rendered behind the DOM hero. Two layers of motion:

   1. Pointer — the whole world gently parallax-tilts toward the cursor.
   2. Scroll  — a GSAP ScrollTrigger scrub rotates the world and pulls the
      camera forward/down as the visitor leaves the hero, so the section feels
      volumetric ("scrollbar depth").

   Colors are derived live from the app's CSS theme tokens (--primary etc.) so
   the scene matches light/dark/accent settings; a MutationObserver re-tints
   the materials when the theme flips.

   Respects `prefers-reduced-motion` (static single frame) and stops the
   render loop when the hero is off-screen or the tab is hidden.
============================================================================= */

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Read the app's current --primary HSL triplet off <html>. */
function readPrimaryHsl(): { h: number; s: number; l: number } {
  const raw =
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
    "221 83% 53%";
  const parts = raw.split(/\s+/).map((part) => Number.parseFloat(part));
  if (parts.length < 3 || parts.some(Number.isNaN)) {
    return { h: 221, s: 0.83, l: 0.53 };
  }
  return { h: parts[0], s: parts[1] / 100, l: parts[2] / 100 };
}

function shiftHue(h: number, delta: number) {
  return (h + delta + 360) % 360;
}

export default function Hero3D() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const section = host.parentElement as HTMLElement | null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ── GPU budget ────────────────────────────────────────────────────────
    // Phones / small screens get a lighter scene: MSAA off, lower pixel ratio
    // cap, fewer stars and coarser geometry — the hero is a backdrop, so it
    // must not compete with the scroll animations for frame budget.
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const compact = Math.min(window.innerWidth, window.innerHeight) < 768 && coarsePointer;
    const lowBudget = compact;

    // ── Renderer ──────────────────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !lowBudget,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return; // WebGL unavailable — DOM hero gradient stays behind us.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowBudget ? 1.5 : 1.75));
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      (host.clientWidth || 1) / (host.clientHeight || 1),
      0.1,
      100,
    );
    camera.position.set(0, 0, 14);

    // ── Lights ────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x818cf8, 40, 30);
    rim.position.set(-6, -2, 5);
    scene.add(rim);

    // ── World group ───────────────────────────────────────────────────────
    const world = new THREE.Group();
    world.position.y = 0.9;
    scene.add(world);

    // Materials that need re-tinting when the theme changes (only .color is
    // touched, so any material with a color works).
    const tintable: Array<{
      mat: THREE.Material & { color: THREE.Color };
      colorFor: (dark: boolean) => THREE.Color;
    }> = [];

    // Central torus-knot "core" — metal finish in the accent color.
    const knotGeo = new THREE.TorusKnotGeometry(
      1.35,
      0.38,
      lowBudget ? 120 : 220,
      lowBudget ? 18 : 32,
    );
    const knotMat = new THREE.MeshStandardMaterial({
      metalness: 0.85,
      roughness: 0.22,
      emissive: new THREE.Color(0x000000),
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    knot.rotation.x = 0.4;
    knot.rotation.y = 0.6;
    world.add(knot);
    tintable.push({
      mat: knotMat,
      colorFor: (dark) => {
        const p = readPrimaryHsl();
        return new THREE.Color().setHSL(p.h, clamp01(p.s + 0.1), dark ? 0.72 : clamp01(p.l - 0.1));
      },
    });

    // Oversized wireframe shell that wraps the core.
    const shellGeo = new THREE.IcosahedronGeometry(2.6, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      wireframe: true,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.rotation.x = 0.2;
    world.add(shell);
    tintable.push({
      mat: shellMat,
      colorFor: () => new THREE.Color().setHSL(readPrimaryHsl().h / 360, 0.7, 0.6),
    });

    // Orbiting rings (rotated in different planes for depth).
    const ringCols: Array<{
      geo: THREE.TorusGeometry;
      mat: THREE.MeshBasicMaterial;
      mesh: THREE.Mesh;
    }> = [];
    for (const [radius, rotX, rotZ, opacity] of [
      [3.4, Math.PI / 2.15, 0.25, 0.28],
      [4.15, Math.PI / 1.75, 0.7, 0.16],
      [3.0, Math.PI / 2.6, 1.35, 0.2],
    ] as const) {
      const geo = new THREE.TorusGeometry(radius, 0.014, 8, lowBudget ? 96 : 160);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = rotX;
      mesh.rotation.z = rotZ;
      world.add(mesh);
      ringCols.push({ geo, mat, mesh });
      tintable.push({
        mat,
        colorFor: (dark) =>
          new THREE.Color().setHSL(
            shiftHue(readPrimaryHsl().h, 42) / 360,
            0.75,
            dark ? 0.68 : 0.42,
          ),
      });
    }

    // Small satellites orbiting the core.
    const sats: Array<{ mesh: THREE.Mesh; radius: number; speed: number; phase: number }> = [];
    const satGeo = new THREE.IcosahedronGeometry(0.16, 0);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({ metalness: 0.4, roughness: 0.5 });
      const mesh = new THREE.Mesh(satGeo, mat);
      world.add(mesh);
      const radius = 2.9 + (i % 3) * 0.75;
      sats.push({
        mesh,
        radius,
        speed: 0.18 + (i % 3) * 0.09,
        phase: (i / 6) * Math.PI * 2,
      });
      tintable.push({
        mat,
        colorFor: (dark) =>
          new THREE.Color().setHSL(
            shiftHue(readPrimaryHsl().h, i % 2 === 0 ? 130 : -60) / 360,
            0.65,
            dark ? 0.68 : 0.4,
          ),
      });
    }

    // Starfield — density scales with screen width (capped), small screens
    // get a sparse field since stars read as noise at phone sizes anyway.
    const starCount = lowBudget
      ? 220
      : Math.round(Math.min(700, Math.max(420, window.innerWidth / 2.1)));
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 34;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 6;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const stars = new THREE.Points(starGeo, starMat);
    world.add(stars);
    tintable.push({
      mat: starMat,
      colorFor: (dark) => new THREE.Color(dark ? 0xffffff : 0x334155).multiplyScalar(1),
    });

    // Soft radial glow sprite behind the core (additive).
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const gctx = glowCanvas.getContext("2d");
    if (gctx) {
      const grad = gctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,0.85)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.25)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 128, 128);
    }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(0xffffff),
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(13);
    glow.position.z = -2.5;
    world.add(glow);
    tintable.push({
      mat: glowMat,
      colorFor: (dark) =>
        new THREE.Color().setHSL(readPrimaryHsl().h / 360, 0.85, dark ? 0.65 : 0.5),
    });

    let disposed = false;
    let running = false;
    let rafId: number | null = null;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let scrollTarget = 0;

    // Monotonic clock so the world never snaps when the loop restarts.
    const startedAt = performance.now();

    const renderOnce = () => {
      renderer.render(scene, camera);
    };

    const loop = () => {
      if (!running || disposed) return;
      rafId = requestAnimationFrame(loop);
      const elapsed = (performance.now() - startedAt) / 1000;

      // Auto-rotation.
      world.rotation.y = elapsed * 0.08;

      // Pointer parallax (eased).
      pointerX += (targetX - pointerX) * 0.035;
      pointerY += (targetY - pointerY) * 0.035;
      world.rotation.x += (pointerY * 0.16 - world.rotation.x) * 0.035;
      camera.position.x += (targetX * 0.6 - camera.position.x) * 0.035;
      camera.position.y += (targetY * 0.45 - camera.position.y) * 0.035;

      // Scroll scrub: rotate further and pull the camera down/forward.
      const zTarget = 14 - scrollTarget * 4.5;
      const yTarget = scrollTarget * 3.2 + (targetY * 0.45 - 0);
      camera.position.z += (zTarget - camera.position.z) * 0.08;
      camera.position.y += (yTarget - camera.position.y) * 0.08;
      camera.lookAt(0, 0.9 + scrollTarget * -1.2, 0);

      // Satellites orbit; rings counter-rotate.
      for (const s of sats) {
        const a = elapsed * s.speed + s.phase;
        s.mesh.position.set(
          Math.cos(a) * s.radius,
          Math.sin(a * 1.3) * 0.7,
          Math.sin(a) * s.radius,
        );
      }
      for (const ring of ringCols) {
        ring.mesh.rotation.z += 0.0008;
        ring.mesh.rotation.y += 0.0004;
      }
      shell.rotation.y = elapsed * 0.03;
      shell.rotation.x = 0.2 + elapsed * 0.012;
      glow.scale.setScalar(13 + Math.sin(elapsed * 0.6) * 0.8);

      renderOnce();
    };

    const start = () => {
      if (running || disposed || reducedMotion) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    /** Re-tint every theme-dependent material from the live CSS palette. */
    const applyTheme = () => {
      const dark = document.documentElement.classList.contains("dark");
      for (const { mat, colorFor } of tintable) {
        mat.color.set(colorFor(dark));
      }
      if (renderer && (!running || reducedMotion)) renderOnce();
    };

    // ── Sizing ────────────────────────────────────────────────────────────
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      if (!running) renderOnce();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ── Pointer parallax targets ──────────────────────────────────────────
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth) * 2 - 1;
      targetY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ── Scroll scrub target ───────────────────────────────────────────────
    const st = ScrollTrigger.create({
      trigger: section ?? host,
      start: "top top",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        scrollTarget = self.progress;
      },
      onToggle: (self) => {
        if (reducedMotion) return;
        if (self.isActive) start();
        else stop();
      },
    });

    // ── Visibility / tab focus guards ─────────────────────────────────────
    const onVisibility = () => {
      if (document.hidden) stop();
      else if (st.isActive) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    // ── Theme re-tint ─────────────────────────────────────────────────────
    const mo = new MutationObserver(() => applyTheme());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-accent"],
    });

    applyTheme();

    if (reducedMotion) {
      world.rotation.x = -0.15;
      world.rotation.y = 0.7;
      renderOnce();
    } else if (st.isActive) {
      start();
    }

    return () => {
      disposed = true;
      stop();
      st.kill();
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVisibility);
      knotGeo.dispose();
      knotMat.dispose();
      shellGeo.dispose();
      shellMat.dispose();
      satGeo.dispose();
      starGeo.dispose();
      starMat.dispose();
      glowTex.dispose();
      glowMat.dispose();
      for (const ring of ringCols) {
        ring.geo.dispose();
        ring.mat.dispose();
      }
      for (const s of sats) {
        s.mesh.geometry.dispose();
        (s.mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
}
