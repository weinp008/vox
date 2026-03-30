import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConversationEntry, PromptResponse, UIState } from '../types';

interface SessionContextValue {
  sessionId: string | null;
  projectName: string | null;
  conversation: ConversationEntry[];
  lastResponse: PromptResponse | null;
  uiState: UIState;
  isCompact: boolean;
  setSession: (id: string, name: string) => void;
  /** Add a new entry with the user's transcript (response pending). */
  addUserMessage: (text: string) => string;
  /** Attach the Claude response to an existing entry. */
  setEntryResponse: (entryId: string, response: PromptResponse) => void;
  setUIState: (s: UIState) => void;
  toggleCompact: () => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let entryCounter = 0;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<PromptResponse | null>(null);
  const [uiState, setUIState] = useState<UIState>('idle');
  const [isCompact, setIsCompact] = useState(false);

  function setSession(id: string, name: string) {
    setSessionId(id);
    setProjectName(name);
    setConversation([]);
    setLastResponse(null);
  }

  function addUserMessage(text: string): string {
    const id = `entry-${++entryCounter}`;
    setConversation((prev) => [...prev, { id, userText: text, response: null }]);
    return id;
  }

  function setEntryResponse(entryId: string, response: PromptResponse) {
    setConversation((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, response } : e)),
    );
    setLastResponse(response);
  }

  function toggleCompact() {
    setIsCompact((prev) => !prev);
  }

  function clearSession() {
    setSessionId(null);
    setProjectName(null);
    setConversation([]);
    setLastResponse(null);
    setUIState('idle');
    setIsCompact(false);
  }

  return (
    <SessionContext.Provider
      value={{
        sessionId, projectName, conversation, lastResponse, uiState, isCompact,
        setSession, addUserMessage, setEntryResponse, setUIState, toggleCompact, clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
