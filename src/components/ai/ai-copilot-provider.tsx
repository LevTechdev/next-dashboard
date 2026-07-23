"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

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

  return (
    <AiCopilotContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </AiCopilotContext.Provider>
  );
}
