import "@testing-library/jest-dom";
import { vi } from "vitest";

// ── Mock next/navigation ───────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useParams: () => ({ locale: "en" }),
  usePathname: () => "/en",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

// ── Mock next-intl (uses real en.json translations; individual test files can override) ────
// Load the real translations so all dashboard/marketing page tests get correct text
const enMessages = require("../../../../i18n/locales/en.json");

vi.mock("next-intl", () => {
  const messages = enMessages;

  const tFn = (namespace: string) => {
    const ns = (messages as any)[namespace] || {};
    const t = (key: string) => (ns as any)[key] ?? key;
    t.raw = (key: string) => (ns as any)[key] ?? key;
    t.rich = (key: string) => (ns as any)[key] ?? key;
    return t;
  };

  return {
    useTranslations: tFn,
    NextIntlClientProvider: ({ children }: any) => children,
    useLocale: () => "en",
    useMessages: () => messages,
    useTimeZone: () => "Asia/Jakarta",
    useNow: () => new Date(),
  };
});

// ── Mock next/link ─────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, className, ...props }: any) => {
    const React = require("react");
    return React.createElement("a", { href, className, ...props }, children);
  },
}));

// ── Mock ResizeObserver (required by recharts ResponsiveContainer) ────────
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ── Mock next-themes ───────────────────────────────────────────────────────
vi.mock("next-themes", () => ({
  useTheme: vi.fn(() => ({ theme: "light", setTheme: vi.fn(), themes: ["light", "dark", "system"] })),
  ThemeProvider: ({ children }: any) => children,
}));

// ── Mock framer-motion ─────────────────────────────────────────────────────
vi.mock("framer-motion", () => {
  const React = require("react");
  const noop = (props: any) => {
    const { children, ...rest } = props;
    const tag = rest.tag || "div";
    // Extract framer-motion specific props that shouldn't be passed to DOM
    const {
      initial, animate, exit, variants, whileInView, whileHover,
      whileTap, viewport, transition, layout, layoutId, onAnimationComplete,
      ...domProps
    } = rest;
    return React.createElement(tag === "details" ? "details" : "div", domProps, children);
  };

  const motion = new Proxy(
    {},
    {
      get: (_, tag: any) =>
        (props: any) => React.createElement(noop, { ...props, tag }),
    }
  );

  return {
    motion,
    AnimatePresence: ({ children }: any) => children,
    domAnimation: {},
    useMotionValue: (initial: any) => ({
      get: () => initial,
      set: () => {},
      onChange: () => {},
    }),
    useTransform: (value: any, _input: any, _output: any) => ({
      get: () => 0,
      set: () => {},
    }),
    useScroll: () => ({ scrollY: { get: () => 0 } }),
    useSpring: (value: any) => value,
    useAnimation: () => ({ start: () => {}, stop: () => {} }),
    useAnimationFrame: () => {},
    useDragControls: () => ({})
  };
});

// ── Mock lucide-react (all icons across marketing AND dashboard pages) ──────
vi.mock("lucide-react", () => {
  const React = require("react");
  // All icon names used across the entire application
  const iconNames = [
    // Marketing page icons
    "ArrowRight", "Zap", "Sparkles", "Bug", "Rocket", "RefreshCw", "Shield",
    "BarChart3", "Package", "LayoutDashboard", "Menu", "X", "ChevronRight",
    "Rows", "Layers", "Globe", "ShoppingCart", "CreditCard", "Mail",
    "MessageSquare", "Database", "Cloud", "Share2", "Check", "TrendingUp",
    "Users", "Activity", "GitBranch", "Bell", "Star", "HelpCircle",
    "FileText", "Megaphone", "Tag", "UserCheck", "Clock", "PieChart",
    "CheckCircle", "Download", "Copy", "CopyCheck", "Github", "Twitter",
    "GitCommit", "Plug",
    // Dashboard page icons
    "Search", "Plus", "Settings", "Sun", "Moon", "Monitor", "Command", "Loader2",
    "Hash", "File", "Text", "Layout", "LogOut", "User", "ChevronLeft",
    "AlertCircle", "AlertTriangle", "Info", "Trash2", "Box", "Users2",
    "Gift", "BellRing", "ExternalLink",
    "ArrowUpDown", "ChevronDown", "MoreHorizontal", "Filter", "Eye",
    "DollarSign", "Palette", "Smartphone", "Key", "ShoppingBag", "MapPin",
    "Store", "Wifi", "WifiOff", "ArrowUpRight", "UserCircle", "ClipboardList",
    "Truck", "PackageCheck", "XCircle", "Pencil"," Monitor", "CopyCheck",
  ];

  const icons: Record<string, any> = {};
  for (const name of iconNames) {
    icons[name] = ({ className, ...props }: any) =>
      React.createElement("svg", { className, "data-testid": `icon-${name.toLowerCase()}`, ...props });
  }
  return icons;
});

// ── Mock @radix-ui/react-slot ──────────────────────────────────────────────
vi.mock("@radix-ui/react-slot", () => {
  const React = require("react");
  return {
    Slot: React.forwardRef((props: any, ref: any) => {
      const { children, ...rest } = props;
      if (!children) return null;
      return React.cloneElement(
        React.Children.only(Array.isArray(children) ? children[0] : children),
        { ...rest, ref }
      );
    }),
  };
});

// ── Mock class-variance-authority ───────────────────────────────────────────
vi.mock("class-variance-authority", () => ({
  cva: (base: string) => (variants?: any) => {
    if (!variants) return base;
    const v = variants.variant;
    const variantMap: Record<string, string> = {
      default: "bg-white text-black",
      outline: "border rounded",
    };
    return [base, variantMap[v] || "", variants.className || ""]
      .filter(Boolean)
      .join(" ");
  },
}));

// ── Mock LightPillar (uses Three.js WebGL which crashes in jsdom) ────────
vi.mock("@/components/backgrounds/LightPillar", () => ({
  __esModule: true,
  default: () => null,
}));

// ── Mock @/lib/utils (passthrough real utils, override cn for simplicity) ────
vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    cn: (...inputs: any[]) =>
      inputs
        .filter(Boolean)
        .flat()
        .join(" "),
  };
});

// ── Mock @/components/ui/button ────────────────────────────────────────────
vi.mock("@/components/ui/button", () => {
  const React = require("react");
  return {
    Button: React.forwardRef(
      ({ children, className, variant, size, asChild, ...props }: any, ref: any) =>
        React.createElement("button", { className, ref, ...props }, children)
    ),
    buttonVariants: "",
  };
});

// ── Mock AnimatedCounter to render end value immediately (avoids rAF timing) ──
vi.mock("@/components/ui/animated-counter", () => {
  const React = require("react");
  return {
    AnimatedCounter: ({ end, formatter, prefix, suffix, decimals }: any) => {
      const formatted = formatter
        ? formatter(end)
        : `${prefix || ""}${Number(end).toLocaleString(undefined, {
            minimumFractionDigits: decimals || 0,
            maximumFractionDigits: decimals || 0,
          })}${suffix || ""}`;
      return React.createElement("span", { className: "tabular-nums inline-block" }, formatted);
    },
  };
});

// ── Mock @/components/motion ───────────────────────────────────────────────
vi.mock("@/components/motion", () => {
  const React = require("react");
  return {
    AnimateSection: ({ children, className }: any) =>
      React.createElement("section", { className }, children),
    AnimateUp: ({ children, className }: any) =>
      React.createElement("div", { className }, children),
    StaggerGrid: ({ children, className }: any) =>
      React.createElement("div", { className }, children),
    StaggerItem: ({ children, className }: any) =>
      React.createElement("div", { className }, children),
    HoverCard: ({ children, className }: any) =>
      React.createElement("div", { className }, children),
    buttonTap: { scale: 0.97 },
  };
});
