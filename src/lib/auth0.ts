// Auth0 has been removed. All pages are now public.
// This file is kept as a stub to prevent import errors during migration.

export const auth0 = {
  middleware: async () => undefined,
  getSession: async (): Promise<{ user: Record<string, unknown> } | null> => null,
  withApiAuthRequired: () => () => undefined,
  getAccessToken: async (): Promise<string | null> => null,
};

