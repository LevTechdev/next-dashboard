import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { PWARegister } from "@/components/pwa-register";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { OfflineIndicator } from "@/components/offline-indicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dashboard - All-in-One Business Management Platform",
  description:
    "Comprehensive business management platform with real-time analytics, multi-channel order management, team collaboration, and powerful reporting. Run your business with real-time intelligence.",
  manifest: "/manifest.json",
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
        {/* Theme and Appearance init script — runs synchronously before paint to prevent FOUC.
            Placed here (server-rendered head) so it executes before styles render. */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `(function(){
            try {
              var t = localStorage.getItem('theme');
              var sys = window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
              var resolved = (t === 'system' || !t) ? sys : t;
              document.documentElement.classList.toggle('dark', resolved === 'dark');
              document.documentElement.style.colorScheme = resolved;
            } catch(e){}
            try {
              var raw = localStorage.getItem('dashboard-appearance');
              if (raw) {
                var app = JSON.parse(raw);
                if (app && app.accent) {
                  if (app.accent === 'default') {
                    delete document.documentElement.dataset.accent;
                  } else if (app.accent === 'custom' && app.customColor) {
                    document.documentElement.dataset.accent = 'custom';
                    var hex = app.customColor.replace(/^#/, '');
                    if (hex.length === 3) hex = hex.split('').map(function(x){return x+x;}).join('');
                    var r = parseInt(hex.slice(0, 2), 16) / 255;
                    var g = parseInt(hex.slice(2, 4), 16) / 255;
                    var b = parseInt(hex.slice(4, 6), 16) / 255;
                    var max = Math.max(r, g, b), min = Math.min(r, g, b);
                    var h = 0, s = 0, l = (max + min) / 2;
                    if (max !== min) {
                      var d = max - min;
                      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                      switch (max) {
                        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                        case g: h = (b - r) / d + 2; break;
                        case b: h = (r - g) / d + 4; break;
                      }
                      h /= 6;
                    }
                    var hsl = Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + Math.round(l * 100) + '%';
                    document.documentElement.style.setProperty('--primary', hsl);
                    document.documentElement.style.setProperty('--ring', hsl);
                    document.documentElement.style.setProperty('--ai-accent', hsl);
                    var strongL = Math.max(0, Math.round(l * 100) - 12);
                    document.documentElement.style.setProperty('--ai-accent-strong', Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + strongL + '%');
                    var softL = Math.min(95, Math.round(l * 100) + 40);
                    document.documentElement.style.setProperty('--ai-accent-soft', Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + softL + '%');
                    var soft2L = Math.min(97, Math.round(l * 100) + 45);
                    document.documentElement.style.setProperty('--ai-accent-soft-2', Math.round(h * 360) + ' ' + Math.round(s * 100) + '% ' + soft2L + '%');
                  } else {
                    document.documentElement.dataset.accent = app.accent;
                  }
                }
                if (app && app.textSize && app.textSize !== 'base') {
                  document.documentElement.dataset.text = app.textSize;
                }
                if (app && app.density && app.density !== 'regular') {
                  document.documentElement.dataset.density = app.density;
                }
              }
            } catch(e){}
          })();`,
          }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <PWARegister />
        <Providers>
          <OfflineIndicator />
          {children}
          <PWAInstallPrompt />
        </Providers>
      </body>
    </html>
  );
}
