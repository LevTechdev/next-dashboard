"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { installAuthFetch, refreshAccessToken } from "@/lib/client-refresh";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  avatar?: string | null;
  role: string;
  totpEnabled: boolean;
  emailVerified?: string | null;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (
    email: string,
    password: string,
    totpToken?: string,
  ) => Promise<{ success: boolean; requires2FA?: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  error: null,
  isAuthenticated: false,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: async () => {},
  refreshUser: async () => {},
  updateUser: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    // Ensure the 401→refresh→retry fetch wrapper is active before the first call.
    installAuthFetch();
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setError(null);
        return;
      }
    } catch {
      // Ignore fetch errors
    }
    // Not authenticated or error
    setUser(null);
  }, []);

  // Check auth status on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  // Proactively rotate the short-lived access token while authenticated so it
  // stays fresh (well under its 15m lifetime) and 401s stay rare.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(
      () => {
        refreshAccessToken();
      },
      12 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, [user]);

  const login = useCallback(
    async (email: string, password: string, totpToken?: string) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, totpToken }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || "Login failed" };
        }

        if (data.requires2FA) {
          return { success: false, requires2FA: true };
        }

        if (data.user) {
          setUser(data.user);
        }

        router.refresh();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    [router],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      setError(null);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          return { success: false, error: data.error || "Registration failed" };
        }

        if (data.user) {
          setUser(data.user);
        }

        router.refresh();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: "Network error. Please try again." };
      }
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore errors
    }
    setUser(null);
    router.push("/en/login");
    router.refresh();
  }, [router]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
