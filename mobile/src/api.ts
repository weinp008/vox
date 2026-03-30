import { PromptResponse, SessionState, StartSessionResponse } from './types';

// iOS Simulator: http://localhost:8000
// Physical device: http://<your-lan-ip>:8000
export const BASE_URL = 'http://192.168.68.60:8000';

/** Fetch with timeout (default 120s for Claude Code calls). */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 120000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface SessionSummary {
  session_id: string;
  project_name: string;
  branch: string;
  message_count: number;
  last_message: string;
  updated_at: number;
}

export interface ResumeSessionResponse {
  session_id: string;
  project_name: string;
  files: string[];
  recent_commits: string[];
  conversation: { role: string; content: string }[];
}

export async function listSessions(): Promise<SessionSummary[]> {
  const res = await fetch(`${BASE_URL}/sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function resumeSession(sessionId: string): Promise<ResumeSessionResponse> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/resume`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to resume session');
  }
  return res.json();
}

export async function startSession(projectPath: string): Promise<StartSessionResponse> {
  const res = await fetch(`${BASE_URL}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_path: projectPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Failed to start session');
  }
  return res.json();
}

/** Step 1: Transcribe audio → get text back fast. */
export async function transcribeAudio(audioUri: string): Promise<string> {
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);

  const res = await fetchWithTimeout(`${BASE_URL}/transcribe`, {
    method: 'POST',
    body: form,
  }, 30000); // 30s for transcription
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Transcription failed');
  }
  const data = await res.json();
  return data.transcript;
}

/** Step 2: Send transcribed text to Claude → get response + TTS. */
export async function sendText(
  sessionId: string,
  text: string,
  sessionState: SessionState,
  tts: boolean = true,
): Promise<PromptResponse> {
  const endpoint = sessionState === 'awaiting_response' ? '/respond/text' : '/prompt/text';

  const res = await fetchWithTimeout(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, text, tts }),
  }, 120000); // 2 min timeout for Claude Code

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Request failed');
  }
  return res.json();
}

export async function requestTTS(text: string): Promise<string> {
  const res = await fetchWithTimeout(`${BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }, 30000); // 30s for TTS
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'TTS failed');
  }
  const data = await res.json();
  return data.audio_url;
}

export async function getActivity(sessionId: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/session/${sessionId}/activity`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.activity ?? [];
  } catch {
    return [];
  }
}

export interface SonarSettings {
  model: string;
  effort: string;
  allowed_tools: string[];
  use_claude_code: boolean;
  plan_mode: boolean;
}

export async function getSettings(): Promise<SonarSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  return res.json();
}

export async function updateSettings(updates: Partial<Pick<SonarSettings, 'model' | 'effort' | 'plan_mode'>>): Promise<SonarSettings> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function renameSession(sessionId: string, name: string): Promise<void> {
  await fetch(`${BASE_URL}/session/${sessionId}/rename`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function sendImage(
  sessionId: string,
  imageUri: string,
  caption?: string,
): Promise<PromptResponse> {
  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('image', {
    uri: imageUri,
    name: 'image.jpg',
    type: 'image/jpeg',
  } as any);
  if (caption) {
    form.append('caption', caption);
  }

  const res = await fetchWithTimeout(`${BASE_URL}/prompt/image`, {
    method: 'POST',
    body: form,
  }, 120000);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Image upload failed');
  }
  return res.json();
}
