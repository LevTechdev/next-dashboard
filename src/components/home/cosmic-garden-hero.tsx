"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDownRight, Orbit, Sparkles } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const STORY_BEATS = [
  {
    label: "Notice",
    title: "Signals surface first",
    body: "The scene opens wide so movement, spikes, and quiet changes can be felt before they become reports.",
  },
  {
    label: "Connect",
    title: "Context finds its orbit",
    body: "Channels, payments, teams, and activity stay in view as one connected system instead of isolated widgets.",
  },
  {
    label: "Act",
    title: "Decisions keep moving",
    body: "The scroll pulls the story forward, matching the way operators move from curiosity to action.",
  },
];

const IMAGE_SRC = "/images/cosmic-garden.jpg";

function coverPlaneToCamera(
  plane: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  width: number,
  height: number,
  imageAspect: number,
) {
  const distance = Math.abs(camera.position.z - plane.position.z);
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
  const visibleWidth = visibleHeight * (width / height);
  const viewportAspect = visibleWidth / visibleHeight;

  if (viewportAspect > imageAspect) {
    plane.scale.set(visibleWidth, visibleWidth / imageAspect, 1);
  } else {
    plane.scale.set(visibleHeight * imageAspect, visibleHeight, 1);
  }
}

export default function CosmicGardenHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const storyRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const host = canvasHostRef.current;
    const image = imageRef.current;
    const copy = copyRef.current;
    const story = storyRef.current;
    if (!section || !host || !image || !copy || !story) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reducedMotion) return;

      gsap.set("[data-story-beat]", { opacity: 0.35, y: 28 });
      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });

      timeline
        .to(image, { scale: 1.12, yPercent: -8, ease: "none" }, 0)
        .to(copy, { yPercent: -32, opacity: 0.82, ease: "none" }, 0)
        .to(
          "[data-story-beat]",
          {
            opacity: 1,
            y: 0,
            stagger: 0.16,
            ease: "power1.out",
          },
          0.18,
        );
    }, section);

    if (reducedMotion) {
      return () => ctx.revert();
    }

    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !coarsePointer,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
    } catch {
      return () => ctx.revert();
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarsePointer ? 1.25 : 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.className = "absolute inset-0 h-full w-full";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const world = new THREE.Group();
    scene.add(world);

    const imageGeometry = new THREE.PlaneGeometry(1, 1, 32, 32);
    const imageMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    const imagePlane = new THREE.Mesh(imageGeometry, imageMaterial);
    imagePlane.position.z = -0.8;
    world.add(imagePlane);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x9ed8ff,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    const ringGeometry = new THREE.TorusGeometry(2.9, 0.012, 8, 160);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.set(1.18, 0.1, -0.35);
    ring.position.set(0.2, -0.2, 0.6);
    world.add(ring);

    const particleCount = coarsePointer ? 54 : 120;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 11;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 7;
      particlePositions[i * 3 + 2] = Math.random() * 4.5 - 1.2;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xd7f2ff,
      size: coarsePointer ? 0.035 : 0.045,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    world.add(particles);

    let texture: THREE.Texture | null = null;
    let disposed = false;
    let running = false;
    let rafId: number | null = null;
    let scrollProgress = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    const startedAt = performance.now();

    const renderOnce = () => {
      renderer.render(scene, camera);
    };

    const loop = () => {
      if (!running || disposed) return;
      rafId = requestAnimationFrame(loop);

      const elapsed = (performance.now() - startedAt) / 1000;
      pointerX += (targetX - pointerX) * 0.045;
      pointerY += (targetY - pointerY) * 0.045;

      camera.position.x += (pointerX * 0.44 - camera.position.x) * 0.06;
      camera.position.y += (-scrollProgress * 0.95 + pointerY * 0.28 - camera.position.y) * 0.06;
      camera.position.z += (8 - scrollProgress * 1.35 - camera.position.z) * 0.055;
      camera.lookAt(pointerX * 0.25, -0.2 - scrollProgress * 0.45, 0);

      world.rotation.y = pointerX * 0.07 + scrollProgress * 0.12;
      world.rotation.x = -pointerY * 0.035;
      imagePlane.rotation.z = Math.sin(elapsed * 0.18) * 0.01;
      ring.rotation.z = -0.35 + elapsed * 0.07 + scrollProgress * 1.15;
      ring.rotation.y = 0.1 + pointerX * 0.1;
      particles.rotation.y = elapsed * 0.025 + scrollProgress * 0.4;
      particles.rotation.x = pointerY * 0.04;

      renderOnce();
    };

    const start = () => {
      if (running || disposed) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      coverPlaneToCamera(imagePlane, camera, width, height, 736 / 1104);
      if (!running) renderOnce();
    };

    texture = new THREE.TextureLoader().load(IMAGE_SRC, () => {
      if (!texture) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      imageMaterial.map = texture;
      imageMaterial.needsUpdate = true;
      resize();
      renderOnce();
    });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        scrollProgress = self.progress;
      },
      onToggle: (self) => {
        if (self.isActive) start();
        else stop();
      },
    });

    const onPointerMove = (event: PointerEvent) => {
      targetX = (event.clientX / window.innerWidth) * 2 - 1;
      targetY = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onVisibility = () => {
      if (document.hidden) stop();
      else if (scrollTrigger.isActive) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (scrollTrigger.isActive) start();
    else renderOnce();

    return () => {
      disposed = true;
      stop();
      ctx.revert();
      scrollTrigger.kill();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      imageGeometry.dispose();
      imageMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      texture?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="cosmic-garden-heading"
      className="relative min-h-[240svh] bg-[#061013] text-white"
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        <div ref={imageRef} className="absolute inset-0">
          <Image
            src={IMAGE_SRC}
            alt="Astronauts walk through a sunny field with bubbles, butterflies, an arcade cabinet and a vintage computer"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-85 saturate-[1.12]"
          />
        </div>

        <div ref={canvasHostRef} className="pointer-events-none absolute inset-0 z-[1]" />
        <div className="absolute inset-0 z-[2] bg-[linear-gradient(90deg,rgba(3,10,14,.88),rgba(3,10,14,.45)_43%,rgba(3,10,14,.1)),linear-gradient(180deg,rgba(3,10,14,.2),rgba(3,10,14,.74))]" />
        <div className="absolute inset-x-0 bottom-0 z-[2] h-40 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="absolute inset-x-0 top-0 z-[2] h-32 bg-gradient-to-b from-background/70 to-transparent" />

        <div className="relative z-[3] mx-auto flex h-full max-w-7xl flex-col justify-between px-4 py-20 sm:px-6 lg:px-12">
          <p className="flex w-fit items-center gap-2 text-xs font-semibold uppercase text-sky-100/80">
            <Sparkles className="size-4" />
            Beyond the dashboard
          </p>

          <div ref={copyRef} className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3 text-sm font-medium text-sky-100/80">
              <span className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur">
                <Orbit className="size-5" />
              </span>
              Scroll field notes / 01
            </div>
            <h2
              id="cosmic-garden-heading"
              className="max-w-4xl text-balance text-5xl font-semibold sm:text-6xl lg:text-7xl"
            >
              Make room for the unexpected.
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-8 text-sky-50/82 sm:text-xl">
              A business view should feel alive. Step through the data, follow the signal, and leave
              space for the ideas that do not fit in a spreadsheet.
            </p>
            <a
              href="#features"
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              Explore the platform <ArrowDownRight className="size-4" />
            </a>
          </div>

          <ol ref={storyRef} className="grid gap-5 sm:grid-cols-3">
            {STORY_BEATS.map((beat, index) => (
              <li
                key={beat.label}
                data-story-beat
                className="border-t border-white/25 pt-4 text-sky-50/88"
              >
                <span className="text-xs font-semibold uppercase text-sky-200/80">
                  0{index + 1} / {beat.label}
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">{beat.title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-sky-50/72">{beat.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
