import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConversationEntry, PromptResponse, SessionState, UIState } from '../types';

interface SessionContextValue {
  sessionId: string | null;
  projectName: string | null;
  branch: string | null;
  conversation: ConversationEntry[];
  lastResponse: PromptResponse | null;
  uiState: UIState;
  isCompact: boolean;
  ttsEnabled: boolean;
  messageQueue: string[];
  setSession: (id: string, name: string, branch?: string) => void;
  setBranch: (branch: string) => void;
  /** Restore conversation from a resumed session. */
  restoreConversation: (messages: { role: string; content: string }[]) => void;
  addUserMessage: (text: string) => string;
  setEntryResponse: (entryId: string, response: PromptResponse) => void;
  setUIState: (s: UIState) => void;
  toggleCompact: () => void;
  toggleTTS: () => void;
  clearSession: () => void;
  enqueueMessage: (text: string) => void;
  dequeueMessage: () => string | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let entryCounter = 0;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [branch, setBranch] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<PromptResponse | null>(null);
  const [uiState, setUIState] = useState<UIState>('idle');
  const [isCompact, setIsCompact] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);

  function setSession(id: string, name: string, b?: string) {
    setSessionId(id);
    setProjectName(name);
    setBranch(b ?? null);
    setConversation([]);
    setLastResponse(null);
  }

  /** Rebuild ConversationEntry[] from raw backend messages. */
  function restoreConversation(messages: { role: string; content: string }[]) {
    const entries: ConversationEntry[] = [];
    let currentEntry: ConversationEntry | null = null;

    for (const msg of messages) {
      if (msg.role === 'user') {
        // Start a new entry
        const id = `entry-${++entryCounter}`;
        currentEntry = { id, userText: msg.content, response: null };
        entries.push(currentEntry);
      } else if (msg.role === 'assistant' && currentEntry) {
        // Attach as a minimal PromptResponse
        currentEntry.response = {
          session_id: sessionId ?? '',
          transcript: currentEntry.userText,
          response_text: msg.content,
          response_type: 'freeform',
          options: null,
          pending_diff: null,
          audio_url: null,
          state: 'idle' as SessionState,
        };
      }
    }

    setConversation(entries);
    // Set lastResponse from the last entry that has one
    const lastWithResponse = [...entries].reverse().find((e) => e.response);
    if (lastWithResponse?.response) {
      setLastResponse(lastWithResponse.response);
    }
    // Auto-compact if there are many entries
    if (entries.length > 4) {
      setIsCompact(true);
    }
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

  function toggleCompact() { setIsCompact((p) => !p); }
  function toggleTTS() { setTtsEnabled((p) => !p); }

  function enqueueMessage(text: string) {
    setMessageQueue((prev) => [...prev, text]);
  }

  function dequeueMessage(): string | undefined {
    let first: string | undefined;
    setMessageQueue((prev) => {
      if (prev.length === 0) return prev;
      first = prev[0];
      return prev.slice(1);
    });
    return first;
  }

  function clearSession() {
    setSessionId(null);
    setProjectName(null);
    setBranch(null);
    setConversation([]);
    setLastResponse(null);
    setUIState('idle');
    setIsCompact(false);
    setMessageQueue([]);
  }

  return (
    <SessionContext.Provider
      value={{
        sessionId, projectName, branch, conversation, lastResponse, uiState, isCompact, ttsEnabled,
        messageQueue,
        setSession, setBranch, restoreConversation, addUserMessage, setEntryResponse, setUIState,
        toggleCompact, toggleTTS, clearSession, enqueueMessage, dequeueMessage,
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
