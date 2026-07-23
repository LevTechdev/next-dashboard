import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dashboard - Business Management Platform",
    short_name: "Dashboard",
    description:
      "Comprehensive business management dashboard with real-time analytics, order tracking, and team collaboration",
    start_url: "/en/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    orientation: "portrait-primary",
    categories: ["business", "productivity", "analytics"],
    icons: [
      { src: "/icon", sizes: "any", type: "image/png" },
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
    screenshots: [],
    prefer_related_applications: false,
    scope: "/",
    id: "/",
  };
}
