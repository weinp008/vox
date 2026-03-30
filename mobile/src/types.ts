export type ResponseType = 'options' | 'confirmation' | 'freeform';
export type SessionState = 'idle' | 'awaiting_response' | 'confirmed';
export type UIState = 'idle' | 'recording' | 'transcribing' | 'processing' | 'listening';

export interface StartSessionResponse {
  session_id: string;
  project_name: string;
  files: string[];
  recent_commits: string[];
}

export interface PromptResponse {
  session_id: string;
  transcript: string;
  response_text: string;
  response_type: ResponseType;
  options: string[] | null;
  pending_diff: string | null;
  audio_url: string | null;
  state: SessionState;
  timing?: { claude: number; tts: number } | null;
  context_tokens?: number;
}

/** A single exchange in the conversation history. */
export interface ConversationEntry {
  id: string;
  userText: string;
  response: PromptResponse | null; // null while Claude is still thinking
}
