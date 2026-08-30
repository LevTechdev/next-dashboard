"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { usePathname, useParams } from "next/navigation";

function PostHogPageViewTracker({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  useEffect(() => {
    if (typeof window !== "undefined" && posthog.__loaded) {
      posthog.capture("$pageview", {
        $current_url: window.location.href,
        locale,
        path: pathname,
      });
    }
  }, [pathname, locale]);

  return <>{children}</>;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

    // useEffect only runs on the client, so this is hydration-safe
    if (key && !posthog.__loaded) {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false, // We handle pageviews manually for locale tracking
        loaded: (ph) => {
          ph.register_for_session({ app: "dashboard" });
          setInitialized(true);
        },
      });
    } else if (posthog.__loaded) {
      setInitialized(true);
    }
  }, []);

  // Always render the same JSX structure for hydration consistency.
  // PostHogPageViewTracker guards on posthog.__loaded internally,
  // so it won't fire before init completes.
  return (
    <PHProvider client={posthog}>
      <PostHogPageViewTracker>{children}</PostHogPageViewTracker>
    </PHProvider>
  );
}
