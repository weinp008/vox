import React, { useCallback } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { sendPrompt } from '../api';
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
  const { sessionId, projectName, lastResponse, uiState, setLastResponse, setUIState, clearSession } =
    useSession();

  const handlePlaybackFinished = useCallback(() => {
    setUIState('idle');
  }, [setUIState]);

  const { playAudio, stopAudio } = useAudioPlayer(handlePlaybackFinished);
  const { startRecording, stopRecording } = useAudioRecorder();

  function handleInterruptTTS() {
    stopAudio();
    setUIState('idle');
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

      // Short press — cancelled, go back to idle
      if (!uri) {
        setUIState('idle');
        return;
      }

      setUIState('processing');

      const currentState = lastResponse?.state ?? 'idle';
      const response = await sendPrompt(sessionId!, uri, currentState);
      setLastResponse(response);

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

  const showOptions =
    lastResponse?.response_type === 'options' && lastResponse.options && lastResponse.options.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLeave} style={styles.backBtn}>
          <Text style={styles.backText}>← Projects</Text>
        </TouchableOpacity>
        <Text style={styles.projectName} numberOfLines={1}>
          {projectName}
        </Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Tap anywhere in the body to interrupt TTS */}
      <Pressable
        style={styles.body}
        onPress={uiState === 'listening' ? handleInterruptTTS : undefined}
      >
        {showOptions && <OptionsDisplay options={lastResponse!.options!} />}
        <TranscriptDisplay response={lastResponse} />
      </Pressable>

      <View style={styles.controls}>
        <StatusIndicator uiState={uiState} />
        <RecordButton
          uiState={uiState}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onTapInterrupt={handleInterruptTTS}
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
  backBtn: { width: 80 },
  backText: { color: '#00d4ff', fontSize: 14 },
  projectName: { color: '#eef', fontWeight: '600', fontSize: 16, flex: 1, textAlign: 'center' },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  controls: { alignItems: 'center', paddingBottom: 40, paddingTop: 20, gap: 16 },
});
