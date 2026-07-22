"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * Context that provides view-transition-aware navigation methods.
 * Intercepts router.push/router.replace and wraps them in
 * document.startViewTransition() for native browser page transitions.
 */
interface ViewTransitionContextValue {
  push: (href: string) => void;
  replace: (href: string) => void;
  isSupported: boolean;
}

const ViewTransitionContext = createContext<ViewTransitionContextValue>({
  push: () => {},
  replace: () => {},
  isSupported: false,
});

/**
 * Provider that intercepts navigation and wraps it with the View Transition API.
 * Also sets up a global click handler to intercept same-origin <a> clicks
 * (including Next.js <Link> components).
 */
export function ViewTransitionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isSupported =
    typeof document !== "undefined" &&
    typeof document.startViewTransition === "function";

  // Wrap router.push with startViewTransition
  const pushWithTransition = useCallback(
    (href: string) => {
      if (!isSupported) {
        router.push(href);
        return;
      }

      // Don't transition to the same page
      if (href === pathname) return;

      document.startViewTransition(() => {
        router.push(href);
      });
    },
    [router, pathname, isSupported]
  );

  const replaceWithTransition = useCallback(
    (href: string) => {
      if (!isSupported) {
        router.replace(href);
        return;
      }

      if (href === pathname) return;

      document.startViewTransition(() => {
        router.replace(href);
      });
    },
    [router, pathname, isSupported]
  );

  // Global click handler to intercept <a> tag clicks (including <Link>)
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (!isSupported) return;

    const handleClick = (e: MouseEvent) => {
      // Ignore non-left clicks, modified clicks, etc.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;

      const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a");
      if (!link || !link.href) return;

      // Only intercept same-origin internal navigations
      if (
        link.origin !== window.location.origin ||
        link.target === "_blank" ||
        link.hasAttribute("download") ||
        link.getAttribute("rel")?.includes("external")
      )
        return;

      // Skip if already navigating
      if (navigatingRef.current) return;

      const href = link.pathname + link.search + link.hash;

      // Skip hash-only changes on the same page
      if (href === window.location.pathname + window.location.search)
        return;

      e.preventDefault();
      navigatingRef.current = true;

      // Find any elements with data-view-transition-name and apply them
      // before the browser captures the old state. This enables shared-element
      // morphing animations (e.g., logo, nav active indicator).
      const morphedElements: HTMLElement[] = [];
      document
        .querySelectorAll<HTMLElement>("[data-view-transition-name]")
        .forEach((el) => {
          const name = el.getAttribute("data-view-transition-name");
          if (name) {
            // Only set if not already set by the element itself
            if (!el.style.viewTransitionName) {
              el.style.viewTransitionName = name;
              morphedElements.push(el);
            }
          }
        });

      // Also check if the clicked link itself has a transition name
      const linkName = link.getAttribute("data-view-transition-name");
      if (linkName && !link.style.viewTransitionName) {
        link.style.viewTransitionName = linkName;
        morphedElements.push(link);
      }

      document.startViewTransition(async () => {
        router.push(href);
      });

      // Clean up after the transition completes (with a safety timeout)
      setTimeout(() => {
        for (const el of morphedElements) {
          el.style.viewTransitionName = "";
        }
        morphedElements.length = 0;
      }, 1000);
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [router, pathname, isSupported]);

  // Reset navigating flag when pathname changes
  useEffect(() => {
    navigatingRef.current = false;
  }, [pathname]);

  return (
    <ViewTransitionContext.Provider
      value={{
        push: pushWithTransition,
        replace: replaceWithTransition,
        isSupported,
      }}
    >
      {children}
    </ViewTransitionContext.Provider>
  );
}

/**
 * Hook to get view-transition-aware navigation methods.
 * Use push() and replace() instead of router.push/router.replace
 * to get smooth page transitions.
 */
export function useViewTransition() {
  return useContext(ViewTransitionContext);
}
