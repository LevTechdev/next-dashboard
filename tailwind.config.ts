import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      animation: {
        "progress-sweep": "progress-sweep 1.5s ease-in-out infinite",
        // Boardui tooltip: blur + scale from 0.9 on the way in, per side.
        slideDownFadeIn: "slideDownFadeIn 0.2s ease-out",
        slideUpFadeIn: "slideUpFadeIn 0.2s ease-out",
        slideLeftFadeIn: "slideLeftFadeIn 0.2s ease-out",
        slideRightFadeIn: "slideRightFadeIn 0.2s ease-out",
      },
      keyframes: {
        "progress-sweep": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        slideDownFadeIn: {
          from: { opacity: "0", transform: "scale(0.9)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "scale(1)", filter: "blur(0px)" },
        },
        slideUpFadeIn: {
          from: { opacity: "0", transform: "translateY(-2px) scale(0.9)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)", filter: "blur(0px)" },
        },
        slideLeftFadeIn: {
          from: { opacity: "0", transform: "translateX(2px) scale(0.9)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)", filter: "blur(0px)" },
        },
        slideRightFadeIn: {
          from: { opacity: "0", transform: "translateX(-2px) scale(0.9)", filter: "blur(4px)" },
          to: { opacity: "1", transform: "translateX(0) scale(1)", filter: "blur(0px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
