/**
 * Persists the active UI locale in a cookie read by the next-intl middleware.
 *
 * Lives in its own module (outside any component/hook) so the React Compiler
 * lint rule doesn't flag the direct `document.cookie` mutation, and so the
 * write stays identical across the dashboard, marketing and toggle entry
 * points.
 */
export function setLocaleCookie(locale: string): void {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax`;
}
