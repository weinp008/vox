import AsyncStorage from '@react-native-async-storage/async-storage';
import { PromptResponse, SessionState, StartSessionResponse } from './types';

const DEFAULT_URL = 'http://192.168.68.60:8000';
export let BASE_URL = DEFAULT_URL;

/** Load saved server URL from storage. Call once on app start. */
export async function loadBaseUrl(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem('vox_base_url');
    if (saved) BASE_URL = saved;
  } catch {}
  return BASE_URL;
}

/** Update and persist the server URL. */
export async function setBaseUrl(url: string): Promise<void> {
  // Clean up: strip trailing slash, ensure http://
  let clean = url.trim().replace(/\/+$/, '');
  if (clean && !clean.startsWith('http')) clean = 'http://' + clean;
  BASE_URL = clean || DEFAULT_URL;
  await AsyncStorage.setItem('vox_base_url', BASE_URL);
}

/** Fetch with timeout (default 120s for Claude Code calls).
 *  Uses Promise.race instead of AbortController — RN's fetch polyfill
 *  does not reliably reject on abort, which causes the UI to hang forever.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 120000,
): Promise<Response> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s`)), timeoutMs),
  );
  return Promise.race([fetch(url, options), timeout]);
}

/** Returns true if the error is a network-level failure (not an HTTP error). */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch throws TypeError on network failure
  if (err instanceof Error && err.message === 'Network request failed') return true;
  return false;
}

/** Optional callback invoked when a retry is about to happen. */
export type OnRetryCallback = () => void;

/**
 * Wrap a fetch-returning function with a single auto-retry on network errors.
 * HTTP errors (4xx/5xx) are NOT retried — only connectivity failures.
 * Waits 2 seconds before the retry attempt.
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  onRetry?: OnRetryCallback,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    // Wait 2s then retry once
    await new Promise((r) => setTimeout(r, 2000));
    onRetry?.();
    try {
      return await fn();
    } catch {
      throw err; // throw the original error
    }
  }
}

export interface SessionSummary {
  session_id: string;
  project_name: string;
  branch: string;
  message_count: number;
  last_message: string;
  updated_at: number;
  starred: boolean;
}

export interface ResumeSessionResponse {
  session_id: string;
  project_name: string;
  files: string[];
  recent_commits: string[];
  conversation: { role: string; content: string }[];
}

/** Fetch the latest assistant message for a session (used for timeout recovery). */
export async function getLastResponse(sessionId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/session/${sessionId}/resume`);
    if (!res.ok) return null;
    const data: ResumeSessionResponse = await res.json();
    const msgs = data.conversation;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') return msgs[i].content;
    }
    return null;
  } catch {
    return null;
  }
}

/** Ping the backend health endpoint. Returns true if reachable. */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/health`, {}, 5000);
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function listProjects(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE_URL}/projects`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.projects ?? [];
  } catch {
    return [];
  }
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
export async function transcribeAudio(audioUri: string, onRetry?: OnRetryCallback): Promise<string> {
  const form = new FormData();
  form.append('audio', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);

  return fetchWithRetry(async () => {
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
  }, onRetry);
}

/** Step 2: Send transcribed text to Claude → get response + TTS. */
export async function sendText(
  sessionId: string,
  text: string,
  sessionState: SessionState,
  tts: boolean = true,
  onRetry?: OnRetryCallback,
): Promise<PromptResponse> {
  const endpoint = sessionState === 'awaiting_response' ? '/respond/text' : '/prompt/text';

  return fetchWithRetry(async () => {
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
  }, onRetry);
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

export interface VoxSettings {
  model: string;
  effort: string;
  allowed_tools: string[];
  use_claude_code: boolean;
  plan_mode: boolean;
  mobile_mode: 'diff_only' | 'diff_with_accept' | 'pure_vibe';
}

export async function getSettings(): Promise<VoxSettings> {
  const res = await fetch(`${BASE_URL}/settings`);
  return res.json();
}

export async function updateSettings(updates: Partial<Pick<VoxSettings, 'model' | 'effort' | 'plan_mode' | 'mobile_mode'>>): Promise<VoxSettings> {
  const res = await fetch(`${BASE_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function compactSession(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const res = await fetchWithTimeout(`${BASE_URL}/session/${sessionId}/compact`, {
    method: 'POST',
  }, 60000);
  return res.json();
}

export async function clearContext(sessionId: string): Promise<void> {
  await fetch(`${BASE_URL}/session/${sessionId}/clear`, { method: 'POST' });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${BASE_URL}/session/${sessionId}`, { method: 'DELETE' });
}

export async function starSession(sessionId: string): Promise<{ starred: boolean }> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/star`, { method: 'POST' });
  return res.json();
}

export async function listBranches(sessionId: string): Promise<{ branches: string[]; current: string }> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/branches`);
  return res.json();
}

export async function switchBranch(sessionId: string, branch: string, create = false): Promise<{ branch: string }> {
  const res = await fetch(`${BASE_URL}/session/${sessionId}/branch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ branch, create }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Branch switch failed');
  }
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
