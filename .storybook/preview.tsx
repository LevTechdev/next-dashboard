import type { Preview, Decorator } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import { Toaster } from "sonner";

import "../src/app/globals.css";
import enMessages from "../src/i18n/locales/en.json";
import { ConfirmProvider } from "../src/components/ui/confirm-provider";

/**
 * next-intl provider for stories — most dashboard components call
 * `useTranslations`, which throws without this context. Storybook has no
 * locale routing, so every story renders with the default `en` messages.
 * ConfirmProvider + Toaster ride along because the security cards use
 * `useConfirm()` (imperative AlertDialog) and several cards toast on action.
 */
export const withIntl: Decorator = (Story) => (
  <NextIntlClientProvider locale="en" messages={enMessages} timeZone="UTC">
    <ConfirmProvider>
      <Toaster position="bottom-right" />
      <Story />
    </ConfirmProvider>
  </NextIntlClientProvider>
);

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
  decorators: [withIntl, withTheme, withMotion],

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
