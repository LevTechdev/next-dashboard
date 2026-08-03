import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard - All-in-One Business Management Platform",
  description:
    "Comprehensive business management platform with real-time analytics, multi-channel order management, team collaboration, and powerful reporting. Run your business with real-time intelligence.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dashboard",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Dashboard - Business Management Platform",
    description:
      "Run your business with real-time intelligence. Analytics, orders, customers, and team management in one place.",
    type: "website",
    siteName: "Dashboard",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Dashboard" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Dashboard" />
        {/* Theme init script — runs before paint to prevent FOUC.
            Placed here (server-rendered head) so React 19 executes it
            instead of the client-injected script from next-themes. */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function(){
            try {
              var t = localStorage.getItem('theme');
              var sys = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
              var resolved = (t === 'system' || !t) ? sys : t;
              document.documentElement.classList.toggle('dark', resolved === 'dark');
              document.documentElement.style.colorScheme = resolved;
            } catch(e){}
          })();
        `}</Script>
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
