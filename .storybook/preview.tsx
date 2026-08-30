import type { Preview, Decorator } from "@storybook/react";

import "../src/app/globals.css";

export const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme || "light";
  return (
    <div className={theme === "dark" ? "dark" : ""} style={{ padding: "1.5rem" }}>
      <Story />
    </div>
  );
};

/**
 * Emulates `prefers-reduced-motion: reduce` for stories by toggling a
 * `data-motion` attribute on the wrapper. Components that opt out of motion
 * via CSS (e.g. the radial-glow-button shine) are expected to also match
 * `[data-motion="reduced"]` so their reduced-motion state can be previewed.
 */
export const withMotion: Decorator = (Story, context) => {
  const motion = context.globals.motion || "full";
  return (
    <div data-motion={motion}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme, withMotion],

  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        mobile: { name: "Mobile 375", styles: { width: "375px", height: "812px" } },
        tablet: { name: "Tablet 768", styles: { width: "768px", height: "1024px" } },
        desktop: { name: "Desktop 1280", styles: { width: "1280px", height: "800px" } },
      },
    },
    a11y: { test: "todo" },
  },

  globalTypes: {
    motion: {
      name: "Motion",
      description: "Emulates the prefers-reduced-motion media query for stories",
      defaultValue: "full",
      toolbar: {
        icon: "eye",
        items: [
          { value: "full", icon: "eye", title: "Full motion" },
          { value: "reduced", icon: "eyeclose", title: "Reduced motion" },
        ],
        dynamicTitle: true,
      },
    },
    theme: {
      name: "Theme",
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light mode" },
          { value: "dark", icon: "moon", title: "Dark mode" },
        ],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
