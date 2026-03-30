import React, { useCallback } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { transcribeAudio, sendText, requestTTS } from '../api';
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
    sessionId, projectName, conversation, lastResponse, uiState, isCompact,
    addUserMessage, setEntryResponse, setUIState, toggleCompact, clearSession,
  } = useSession();

  const handlePlaybackFinished = useCallback(() => {
    setUIState('idle');
  }, [setUIState]);

  const { playAudio, stopAudio, replayAudio } = useAudioPlayer(handlePlaybackFinished);
  const { startRecording, stopRecording } = useAudioRecorder();

  function handleStopAudio() {
    stopAudio();
    setUIState('idle');
  }

  async function handleDoubleTapReplay() {
    setUIState('listening');
    const didReplay = await replayAudio();
    if (!didReplay) setUIState('idle');
  }

  async function handleReadAloud(text: string) {
    if (uiState !== 'idle') return;
    try {
      setUIState('listening');
      const audioBase64 = await requestTTS(text);
      await playAudio(audioBase64);
    } catch {
      setUIState('idle');
    }
  }

  async function handlePressIn() {
    if (uiState !== 'idle') return;
    try {
      setUIState('recording');
      await startRecording();
    } catch (e: any) {
      setUIState('idle');
      Alert.alert('Recording Error', e.message);
    }
  }

  async function handlePressOut() {
    if (uiState !== 'recording') return;
    try {
      const uri = await stopRecording();
      if (!uri) { setUIState('idle'); return; }

      // Step 1: Transcribe — show text immediately
      setUIState('transcribing');
      const transcript = await transcribeAudio(uri);

      // Show user's message right away with "Thinking..." placeholder
      const entryId = addUserMessage(transcript);

      // Step 2: Send to Claude
      setUIState('processing');
      const currentState = lastResponse?.state ?? 'idle';
      const response = await sendText(sessionId!, transcript, currentState);

      // Attach response to the conversation entry
      setEntryResponse(entryId, response);

      // Step 3: Play TTS
      if (response.audio_url) {
        setUIState('listening');
        await playAudio(response.audio_url);
      } else {
        setUIState('idle');
      }
    } catch (e: any) {
      setUIState('idle');
      Alert.alert('Error', e.message ?? 'Something went wrong');
    }
  }

  function handleLeave() {
    clearSession();
    onLeaveSession();
  }

  // Show options from the latest response that has them
  const showOptions =
    lastResponse?.response_type === 'options' && lastResponse.options && lastResponse.options.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.projectName} numberOfLines={1}>
          {projectName}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.body}>
        {showOptions && <OptionsDisplay options={lastResponse!.options!} />}
        <TranscriptDisplay
          conversation={conversation}
          isCompact={isCompact}
          onReadAloud={handleReadAloud}
          onToggleCompact={toggleCompact}
        />
      </View>

      <View style={styles.controls}>
        <StatusIndicator uiState={uiState} />
        <RecordButton
          uiState={uiState}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onStopAudio={handleStopAudio}
          onDoubleTapReplay={handleDoubleTapReplay}
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
  backBtn: { width: 60 },
  backText: { color: '#00d4ff', fontSize: 14 },
  projectName: { color: '#eef', fontWeight: '600', fontSize: 16, flex: 1, textAlign: 'center' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  controls: { alignItems: 'center', paddingBottom: 40, paddingTop: 20, gap: 16 },
});
