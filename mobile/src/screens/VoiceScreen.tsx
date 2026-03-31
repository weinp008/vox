import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { transcribeAudio, sendText, sendImage, requestTTS, updateSettings, getSettings, renameSession, getActivity, compactSession, clearContext, getLastResponse, resumeSession, SonarSettings } from '../api';
import { DiffDisplay } from '../components/DiffDisplay';
import { OptionsDisplay } from '../components/OptionsDisplay';
import { RecordButton } from '../components/RecordButton';
import { MiniGame } from '../components/MiniGame';
import { TranscriptDisplay } from '../components/TranscriptDisplay';
import { useSession } from '../context/SessionContext';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useChime } from '../hooks/useChime';

interface Props {
  onLeaveSession: () => void;
  onOpenGames?: () => void;
  onClaudeStatusChange?: (status: string | undefined) => void;
}

export function VoiceScreen({ onLeaveSession, onOpenGames, onClaudeStatusChange }: Props) {
  const {
    sessionId, projectName, conversation, lastResponse, uiState, isCompact, ttsEnabled,
    addUserMessage, setEntryResponse, setUIState, toggleCompact, toggleTTS, clearSession,
    messageQueue, enqueueMessage, dequeueMessage, restoreConversation,
  } = useSession();

  const handlePlaybackFinished = useCallback(() => {
    setReadingEntryId(null);
    setUIState('idle');
  }, [setUIState]);

  const [statusDetail, setStatusDetailRaw] = useState<string | undefined>();
  const setStatusDetail = useCallback((s: string | undefined) => {
    setStatusDetailRaw(s);
    onClaudeStatusChange?.(s);
  }, [onClaudeStatusChange]);
  const [readingEntryId, setReadingEntryId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState('sonnet');
  const [planMode, setPlanMode] = useState(false);
  const [mobileMode, setMobileMode] = useState<SonarSettings['mobile_mode']>('diff_only');
  const [reviewMode, setReviewMode] = useState(false);
  const [displayName, setDisplayName] = useState(projectName);
  const [contextTokens, setContextTokens] = useState(0);

  function handleResponse(entryId: string, response: import('../types').PromptResponse) {
    setEntryResponse(entryId, response);
    if (response.context_tokens) setContextTokens(response.context_tokens);
    playChime(); // Haptic feedback when response arrives
  }

  const activityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setDisplayName(projectName); }, [projectName]);
  useEffect(() => {
    getSettings().then((s) => {
      setCurrentModel(s.model);
      setPlanMode(s.plan_mode ?? false);
      setMobileMode(s.mobile_mode ?? 'diff_only');
    }).catch(() => {});
  }, []);

  // Poll for activity while processing
  useEffect(() => {
    if (uiState === 'processing' && sessionId) {
      activityPollRef.current = setInterval(async () => {
        const lines = await getActivity(sessionId);
        if (lines.length > 0) {
          setStatusDetail(lines[lines.length - 1]);
        }
      }, 1500);
      return () => { if (activityPollRef.current) clearInterval(activityPollRef.current); };
    } else {
      if (activityPollRef.current) clearInterval(activityPollRef.current);
    }
  }, [uiState, sessionId]);
  // Auto-send queued messages when idle (with guard to prevent re-entry)
  const processingQueueRef = useRef(false);
  useEffect(() => {
    if (uiState === 'idle' && messageQueue.length > 0 && !processingQueueRef.current) {
      processingQueueRef.current = true;
      const next = dequeueMessage();
      if (next) {
        handleResendPrompt(next).finally(() => {
          processingQueueRef.current = false;
        });
      } else {
        processingQueueRef.current = false;
      }
    }
  }, [uiState]);

  const { playAudio, stopAudio, replayAudio, currentWordIndex } = useAudioPlayer(handlePlaybackFinished);
  const { startRecording, stopRecording } = useAudioRecorder();
  const { playChime } = useChime();

  async function speakError(message: string) {
    setUIState('idle');
    setStatusDetail(message);
    if (ttsEnabled) {
      try {
        const audio = await requestTTS(message);
        setUIState('listening');
        await playAudio(audio, message);
      } catch {
        setUIState('idle');
      }
    }
    setStatusDetail(undefined);
  }

  /** After a timeout, check if the backend actually completed and recover the response. */
  async function tryRecoverResponse(entryId: string) {
    if (!sessionId) return;
    setStatusDetail('Checking for response...');
    const text = await getLastResponse(sessionId);
    setStatusDetail(undefined);
    if (!text) return;
    const recovered: import('../types').PromptResponse = {
      session_id: sessionId,
      transcript: '',
      response_text: text,
      response_type: 'freeform',
      options: null,
      pending_diff: null,
      audio_url: null,
      state: 'idle',
    };
    handleResponse(entryId, recovered);
    setUIState('idle');
  }

  function handleStopAudio() {
    stopAudio();
    setReadingEntryId(null);
    setUIState('idle');
  }

  async function handleDoubleTapReplay() {
    if (!ttsEnabled) return;
    setUIState('listening');
    const didReplay = await replayAudio();
    if (!didReplay) setUIState('idle');
  }

  async function handleAskClaude(text: string) {
    if (uiState !== 'idle') return;
    try {
      const preview = text.slice(0, 50) + (text.length > 50 ? '...' : '');
      const entryId = addUserMessage(`Tell me more about: "${preview}"`);
      setUIState('processing');
      setStatusDetail('Waiting for Claude...');
      const currentState = lastResponse?.state ?? 'idle';
      const response = await sendText(sessionId!, `Explain this in more detail: ${text}`, currentState, ttsEnabled);
      handleResponse(entryId, response);
      setStatusDetail(undefined);
      if (ttsEnabled && response.audio_url) {
        setUIState('listening');
        setReadingEntryId(entryId);
        await playAudio(response.audio_url, response.response_text);
      } else {
        setUIState('idle');
      }
    } catch (e: any) {
      setUIState('idle');
      await speakError(e.message ?? 'Something went wrong');
    }
  }

  async function handleReadAloud(text: string, entryId: string) {
    if (uiState !== 'idle') return;
    try {
      setUIState('listening');
      setReadingEntryId(entryId);
      setStatusDetail('Generating speech...');
      const audioBase64 = await requestTTS(text);
      setStatusDetail(undefined);
      await playAudio(audioBase64, text);
    } catch (e: any) {
      console.error('Read aloud error:', e);
      setReadingEntryId(null);
      setUIState('idle');
    }
  }

  async function handleResendPrompt(text: string) {
    if (uiState !== 'idle') {
      // Queue the message if processing
      enqueueMessage(text);
      return;
    }
    try {
      const entryId = addUserMessage(text);
      setUIState('processing');
      setStatusDetail('Waiting for Claude...');
      const currentState = lastResponse?.state ?? 'idle';
      const response = await sendText(sessionId!, text, currentState, ttsEnabled);
      handleResponse(entryId, response);
      setStatusDetail(undefined);
      if (ttsEnabled && response.audio_url) {
        setUIState('listening');
        setReadingEntryId(entryId);
        await playAudio(response.audio_url, response.response_text);
      } else {
        setUIState('idle');
      }
    } catch (e: any) {
      setUIState('idle');
      await speakError(e.message ?? 'Something went wrong');
    }
  }

  function handleTogglePlan() {
    const next = !planMode;
    setPlanMode(next);
    updateSettings({ plan_mode: next });
  }

  async function handlePressIn() {
    if (uiState === 'recording') return;
    // Allow recording even during processing — we'll enqueue the result
    if (uiState !== 'idle' && uiState !== 'processing' && uiState !== 'listening') return;
    try {
      if (uiState === 'idle') {
        setUIState('recording');
      }
      await startRecording();
    } catch (e: any) {
      if (uiState === 'recording') setUIState('idle');
      await speakError(e.message ?? 'Recording failed');
    }
  }

  function reviewTranscript(transcript: string): Promise<string | null> {
    return new Promise((resolve) => {
      Alert.prompt(
        'Review before sending',
        'Edit your message or tap Send to confirm.',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
          { text: 'Send', onPress: (text) => resolve(text?.trim() || transcript) },
        ],
        'plain-text',
        transcript,
      );
    });
  }

  async function handlePressOut() {
    try {
      const uri = await stopRecording();
      if (!uri) {
        if (uiState === 'recording') setUIState('idle');
        return;
      }

      // If we were recording during processing, transcribe and enqueue
      if (uiState !== 'recording') {
        const transcript = await transcribeAudio(uri);
        enqueueMessage(transcript);
        return;
      }

      setUIState('transcribing');
      setStatusDetail('Sending to Whisper...');
      const rawTranscript = await transcribeAudio(uri);

      let transcript = rawTranscript;
      if (reviewMode) {
        setUIState('idle');
        setStatusDetail(undefined);
        const reviewed = await reviewTranscript(rawTranscript);
        if (!reviewed) return; // user cancelled
        transcript = reviewed;
      }

      const entryId = addUserMessage(transcript);

      try {
        setUIState('processing');
        setStatusDetail('Waiting for Claude...');
        const currentState = lastResponse?.state ?? 'idle';
        const response = await sendText(sessionId!, transcript, currentState, ttsEnabled);
        handleResponse(entryId, response);
        setStatusDetail(undefined);

        if (ttsEnabled && response.audio_url) {
          setUIState('listening');
          setReadingEntryId(entryId);
          await playAudio(response.audio_url, response.response_text);
        } else {
          setUIState('idle');
        }
      } catch (e: any) {
        const isTimeout = e.message?.includes('timed out');
        if (isTimeout) {
          await tryRecoverResponse(entryId);
        } else {
          await speakError(e.message ?? 'Something went wrong');
        }
      }
    } catch (e: any) {
      setUIState('idle');
      await speakError(e.message ?? 'Something went wrong');
    }
  }

  async function handleOptionSelect(selection: string) {
    if (uiState !== 'idle') return;
    try {
      const label = selection === 'all' ? 'All options' : `Option ${selection}`;
      const entryId = addUserMessage(label);
      setUIState('processing');
      setStatusDetail('Waiting for Claude...');
      const text = selection === 'all'
        ? 'User selected all options. Proceed with all of them.'
        : `User selected option ${selection}.`;
      const response = await sendText(sessionId!, text, 'awaiting_response', ttsEnabled);
      handleResponse(entryId, response);
      setStatusDetail(undefined);
      if (ttsEnabled && response.audio_url) {
        setUIState('listening');
        setReadingEntryId(entryId);
        await playAudio(response.audio_url, response.response_text);
      } else {
        setUIState('idle');
      }
    } catch (e: any) {
      setUIState('idle');
      await speakError(e.message ?? 'Something went wrong');
    }
  }

  function handleRename() {
    Alert.prompt('Rename session', 'Enter a name:', (name) => {
      if (name?.trim()) {
        setDisplayName(name.trim());
        if (sessionId) renameSession(sessionId, name.trim());
      }
    }, 'plain-text', displayName ?? '');
  }

  function handleSettings() {
    const ctxPct = Math.round((contextTokens / 200000) * 100);
    const ctxLabel = contextTokens > 0 ? `${Math.round(contextTokens / 1000)}k (${ctxPct}%)` : '0k';
    const modeLabel = mobileMode === 'pure_vibe' ? 'Vibe' : mobileMode === 'diff_with_accept' ? 'Accept' : 'Diff';

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Settings',
        options: [
          `Model: ${currentModel}`,
          `Apply mode: ${modeLabel}`,
          `TTS: ${ttsEnabled ? 'ON ✓' : 'OFF'}`,
          `Plan mode: ${planMode ? 'ON ✓' : 'OFF'}`,
          `Review transcript: ${reviewMode ? 'ON ✓' : 'OFF'}`,
          `Context: ${ctxLabel}`,
          'Cancel',
        ],
        cancelButtonIndex: 6,
      },
      (index) => {
        if (index === 0) {
          ActionSheetIOS.showActionSheetWithOptions(
            { title: `Model: ${currentModel}`, options: ['Haiku (fastest)', 'Sonnet (balanced)', 'Opus (smartest)', 'Cancel'], cancelButtonIndex: 3 },
            (i) => { const models = ['haiku', 'sonnet', 'opus']; if (i < 3) { setCurrentModel(models[i]); updateSettings({ model: models[i] }); } },
          );
        } else if (index === 1) {
          ActionSheetIOS.showActionSheetWithOptions(
            { title: `Apply mode: ${modeLabel}`, options: ['Diff only (copy manually)', 'Diff + accept (tap to apply)', 'Pure vibe (auto-apply)', 'Cancel'], cancelButtonIndex: 3 },
            (i) => { const modes: SonarSettings['mobile_mode'][] = ['diff_only', 'diff_with_accept', 'pure_vibe']; if (i < 3) { setMobileMode(modes[i]); updateSettings({ mobile_mode: modes[i] }); } },
          );
        } else if (index === 2) {
          toggleTTS();
        } else if (index === 3) {
          handleTogglePlan();
        } else if (index === 4) {
          setReviewMode(r => !r);
        } else if (index === 5) {
          ActionSheetIOS.showActionSheetWithOptions(
            { title: `Context: ${contextTokens.toLocaleString()} tokens (${ctxPct}% of 200k)`, options: ['Compact (summarize)', 'Clear (start fresh)', 'Cancel'], cancelButtonIndex: 2, destructiveButtonIndex: 1 },
            async (i) => {
              if (i === 0 && sessionId) { setStatusDetail('Compacting context...'); await compactSession(sessionId); setContextTokens(0); setStatusDetail(undefined); }
              else if (i === 1 && sessionId) { await clearContext(sessionId); setContextTokens(0); }
            },
          );
        }
      },
    );
  }

  async function handleImageAttach() {
    if (uiState !== 'idle' || !sessionId) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Choose from Library', 'Paste from Clipboard', 'Cancel'],
          cancelButtonIndex: 2,
        },
        async (index) => {
          if (index === 0) await pickImageFromLibrary();
          if (index === 1) await pasteFromClipboard();
        },
      );
    } else {
      await pickImageFromLibrary();
    }
  }

  async function sendImagePrompt(uri: string) {
    try {
      const entryId = addUserMessage('📎 Image attached');
      setUIState('processing');
      setStatusDetail('Sending image...');
      const response = await sendImage(sessionId!, uri);
      handleResponse(entryId, response);
      setStatusDetail(undefined);
      if (ttsEnabled && response.audio_url) {
        setUIState('listening');
        setReadingEntryId(entryId);
        await playAudio(response.audio_url, response.response_text);
      } else {
        setUIState('idle');
      }
    } catch (e: any) {
      setUIState('idle');
      await speakError(e.message ?? 'Image upload failed');
    }
  }

  async function pickImageFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      await speakError('Photo library permission denied');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      await sendImagePrompt(result.assets[0].uri);
    }
  }

  async function pasteFromClipboard() {
    // Try image first, fall back to text
    const img = await Clipboard.getImageAsync({ format: 'jpeg' });
    if (img?.data) {
      const { FileSystem } = await import('expo-file-system');
      const path = FileSystem.cacheDirectory + 'sonar_paste.jpg';
      await FileSystem.writeAsStringAsync(path, img.data, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await sendImagePrompt(path);
      return;
    }

    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      await handleResendPrompt(text.trim());
      return;
    }

    await speakError('Nothing in clipboard');
  }

  async function handleRefresh() {
    if (!sessionId) return;
    try {
      const res = await resumeSession(sessionId);
      restoreConversation(res.conversation);
    } catch {
      // Silently fail — conversation stays as-is
    }
  }

  function handleLeave() {
    clearSession();
    onLeaveSession();
  }

  const showOptions =
    lastResponse?.response_type === 'options' && lastResponse.options && lastResponse.options.length > 0;
  const pendingDiff = lastResponse?.pending_diff ?? null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRename} style={styles.nameBtn}>
          <Text style={styles.projectName} numberOfLines={1}>
            {displayName}
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleSettings} style={styles.gearBtn}>
            <Text style={styles.gearText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {pendingDiff && (
          <DiffDisplay
            diff={pendingDiff}
            onConfirm={() => handleResendPrompt('send')}
            onCancel={() => handleResendPrompt('cancel')}
          />
        )}
        {showOptions && (
          <OptionsDisplay
            options={lastResponse!.options!}
            onSelect={(n) => handleOptionSelect(n)}
            onSelectAll={() => handleOptionSelect('all')}
          />
        )}
        {(uiState === 'processing' || uiState === 'transcribing') && onOpenGames && (
          <TouchableOpacity onPress={onOpenGames} style={styles.gamesPrompt}>
            <Text style={styles.gamesPromptText}>Play games while waiting →</Text>
          </TouchableOpacity>
        )}
        <TranscriptDisplay
          conversation={conversation}
          isCompact={isCompact}
          readingWordIndex={currentWordIndex}
          readingEntryId={readingEntryId}
          onReadAloud={handleReadAloud}
          onAskClaude={handleAskClaude}
          onToggleCompact={toggleCompact}
          onResendPrompt={handleResendPrompt}
          onRefresh={handleRefresh}
        />
      </View>

      <View style={styles.controls}>
        <RecordButton
          uiState={uiState}
          statusDetail={messageQueue.length > 0 ? `${messageQueue.length} queued` : statusDetail}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onStopAudio={handleStopAudio}
          onDoubleTapReplay={handleDoubleTapReplay}
          onImageAttach={handleImageAttach}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#060d1a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1628',
  },
  backBtn: { width: 50 },
  backText: { color: '#00d4ff', fontSize: 14 },
  nameBtn: { flex: 1 },
  projectName: { color: '#eef', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  headerRight: { alignItems: 'center', justifyContent: 'flex-end' },
  gearBtn: { padding: 4 },
  gearText: { color: '#556', fontSize: 18 },
  gamesPrompt: {
    alignSelf: 'center',
    backgroundColor: '#0e1628',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a3055',
  },
  gamesPromptText: { color: '#00d4ff', fontSize: 13 },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  controls: {},
});
