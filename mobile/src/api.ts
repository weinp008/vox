import { PromptResponse, SessionState, StartSessionResponse } from './types';

// iOS Simulator: http://localhost:8000
// Physical device: http://<your-lan-ip>:8000
// Android emulator: http://10.0.2.2:8000
export const BASE_URL = 'http://localhost:8000';

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

export async function sendPrompt(
  sessionId: string,
  audioUri: string,
  sessionState: SessionState,
): Promise<PromptResponse> {
  const endpoint = sessionState === 'awaiting_response' ? '/respond' : '/prompt';

  const form = new FormData();
  form.append('session_id', sessionId);
  form.append('audio', {
    uri: audioUri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  } as any);

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Request failed');
  }
  return res.json();
}
