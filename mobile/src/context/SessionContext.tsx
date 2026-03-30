import React, { createContext, useContext, useState, ReactNode } from 'react';
import { PromptResponse, UIState } from '../types';

interface SessionContextValue {
  sessionId: string | null;
  projectName: string | null;
  lastResponse: PromptResponse | null;
  uiState: UIState;
  setSession: (id: string, name: string) => void;
  setLastResponse: (r: PromptResponse) => void;
  setUIState: (s: UIState) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [lastResponse, setLastResponseState] = useState<PromptResponse | null>(null);
  const [uiState, setUIState] = useState<UIState>('idle');

  function setSession(id: string, name: string) {
    setSessionId(id);
    setProjectName(name);
  }

  function setLastResponse(r: PromptResponse) {
    setLastResponseState(r);
  }

  function clearSession() {
    setSessionId(null);
    setProjectName(null);
    setLastResponseState(null);
    setUIState('idle');
  }

  return (
    <SessionContext.Provider
      value={{ sessionId, projectName, lastResponse, uiState, setSession, setLastResponse, setUIState, clearSession }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
