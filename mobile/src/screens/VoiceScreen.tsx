import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { transcribeAudio, sendText, requestTTS, updateSettings, getSettings, renameSession, getActivity } from '../api';
import { OptionsDisplay } from '../components/OptionsDisplay';
import { RecordButton } from '../components/RecordButton';
import { StatusIndicator } from '../components/StatusIndicator';
import { TranscriptDisplay } from '../components/TranscriptDisplay';
import { useSession } from '../context/SessionContext';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface Props {
  onLeaveSession: () => void;
}

export function VoiceScreen({ onLeaveSession }: Props) {
  const {
    sessionId, projectName, conversation, lastResponse, uiState, isCompact, ttsEnabled,
    addUserMessage, setEntryResponse, setUIState, toggleCompact, toggleTTS, clearSession,
    messageQueue, enqueueMessage, dequeueMessage,
  } = useSession();

  const handlePlaybackFinished = useCallback(() => {
    setReadingEntryId(null);
    setUIState('idle');
  }, [setUIState]);

  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [readingEntryId, setReadingEntryId] = useState<string | null>(null);
  const [currentModel, setCurrentModel] = useState('sonnet');
  const [planMode, setPlanMode] = useState(false);
  const [displayName, setDisplayName] = useState(projectName);

  const activityPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { setDisplayName(projectName); }, [projectName]);
  useEffect(() => {
    getSettings().then((s) => {
      setCurrentModel(s.model);
      setPlanMode(s.plan_mode ?? false);
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
  // Auto-send queued messages when idle
  useEffect(() => {
    if (uiState === 'idle' && messageQueue.length > 0) {
      const next = dequeueMessage();
      if (next) {
        handleResendPrompt(next);
      }
    }
  }, [uiState, messageQueue.length]);

  const { playAudio, stopAudio, replayAudio, currentWordIndex } = useAudioPlayer(handlePlaybackFinished);
  const { startRecording, stopRecording } = useAudioRecorder();

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
      setEntryResponse(entryId, response);
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
      Alert.alert('Error', e.message ?? 'Something went wrong');
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
      setEntryResponse(entryId, response);
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
      Alert.alert('Error', e.message ?? 'Something went wrong');
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
      Alert.alert('Recording Error', e.message);
    }
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
      const transcript = await transcribeAudio(uri);
      const entryId = addUserMessage(transcript);

      setUIState('processing');
      setStatusDetail('Waiting for Claude...');
      const currentState = lastResponse?.state ?? 'idle';
      const response = await sendText(sessionId!, transcript, currentState, ttsEnabled);
      setEntryResponse(entryId, response);
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
      Alert.alert('Error', e.message ?? 'Something went wrong');
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
      setEntryResponse(entryId, response);
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
      Alert.alert('Error', e.message ?? 'Something went wrong');
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

  function handleModelSwitch() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Current: ${currentModel}`,
          options: ['Haiku (fastest)', 'Sonnet (balanced)', 'Opus (smartest)', 'Cancel'],
          cancelButtonIndex: 3,
        },
        (index) => {
          const models = ['haiku', 'sonnet', 'opus'];
          if (index < 3) {
            const model = models[index];
            setCurrentModel(model);
            updateSettings({ model });
          }
        },
      );
    }
  }

  function handleLeave() {
    clearSession();
    onLeaveSession();
  }

  const showOptions =
    lastResponse?.response_type === 'options' && lastResponse.options && lastResponse.options.length > 0;

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
          <TouchableOpacity onPress={handleTogglePlan}>
            <Text style={[styles.planText, !planMode && styles.planOff]}>Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleModelSwitch}>
            <Text style={styles.modelText}>{currentModel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleTTS}>
            <Text style={[styles.ttsText, !ttsEnabled && styles.ttsOff]}>
              {ttsEnabled ? 'TTS' : 'TTS'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {showOptions && (
          <OptionsDisplay
            options={lastResponse!.options!}
            onSelect={(n) => handleOptionSelect(n)}
            onSelectAll={() => handleOptionSelect('all')}
          />
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
        />
      </View>

      <View style={styles.controls}>
        <StatusIndicator uiState={uiState} statusDetail={statusDetail} />
        <View style={{ position: 'relative' }}>
          <RecordButton
            uiState={uiState}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onStopAudio={handleStopAudio}
            onDoubleTapReplay={handleDoubleTapReplay}
          />
          {messageQueue.length > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueBadgeText}>{messageQueue.length}</Text>
            </View>
          )}
        </View>
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
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center', width: 120, justifyContent: 'flex-end' },
  planText: { color: '#00ff88', fontSize: 11, fontWeight: '600' },
  planOff: { color: '#556' },
  modelText: { color: '#ffaa00', fontSize: 11, fontWeight: '600' },
  ttsText: { color: '#00d4ff', fontSize: 11, fontWeight: '600' },
  ttsOff: { color: '#556' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  controls: { alignItems: 'center', paddingBottom: 40, paddingTop: 20, gap: 16 },
  queueBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  queueBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
