"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface AiCopilotContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const AiCopilotContext = createContext<AiCopilotContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function useAiCopilot() {
  return useContext(AiCopilotContext);
}

export function AiCopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Global ⌘J / Ctrl+J hotkey to toggle the Copilot drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AiCopilotContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </AiCopilotContext.Provider>
  );
}
