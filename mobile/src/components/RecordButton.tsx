import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { UIState } from '../types';

interface Props {
  uiState: UIState;
  statusDetail?: string;
  onPressIn: () => void;
  onPressOut: () => void;
  onStopAudio: () => void;
  onDoubleTapReplay: () => void;
  onImageAttach?: () => void;
}

const DOUBLE_TAP_MS = 300;

const STATE_CONFIG: Record<UIState, { color: string; label: string; action: string }> = {
  idle:         { color: '#334466', label: 'Ready',             action: 'Hold to speak' },
  recording:    { color: '#ff4444', label: 'Recording',         action: 'Release to send' },
  transcribing: { color: '#ff8800', label: 'Transcribing',      action: '' },
  processing:   { color: '#ffaa00', label: 'Claude is working', action: '' },
  listening:    { color: '#00d4ff', label: 'Playing',           action: 'Tap to stop' },
};

export function RecordButton({
  uiState, statusDetail, onPressIn, onPressOut, onStopAudio, onDoubleTapReplay, onImageAttach,
}: Props) {
  const lastTapRef = useRef<number>(0);
  const { color, label, action } = STATE_CONFIG[uiState];
  const isListening = uiState === 'listening';
  const isProcessing = uiState === 'processing' || uiState === 'transcribing';

  function handlePressIn() {
    if (isListening) {
      onStopAudio();
      return;
    }
    if (isProcessing) return;

    const now = Date.now();
    if (uiState === 'idle' && now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onDoubleTapReplay();
      return;
    }
    lastTapRef.current = now;
    onPressIn();
  }

  function handlePressOut() {
    if (isListening || isProcessing) return;
    onPressOut();
  }

  const micIcon = uiState === 'recording' ? '⏹' : isListening ? '⏸' : '🎙';

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={({ pressed }) => [
        styles.bar,
        { borderTopColor: color },
        pressed && !isProcessing && styles.barPressed,
      ]}
    >
      {/* Left: status */}
      <View style={styles.statusSide}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View>
          <Text style={[styles.stateLabel, { color }]}>{label}</Text>
          {statusDetail ? (
            <Text style={styles.detail} numberOfLines={1}>{statusDetail}</Text>
          ) : uiState === 'idle' ? (
            <Text style={styles.detail}>Double-tap to replay</Text>
          ) : null}
        </View>
      </View>

      {/* Right: attach button + action + mic icon */}
      <View style={styles.actionSide}>
        {onImageAttach && uiState === 'idle' && (
          <TouchableOpacity onPress={onImageAttach} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.attachIcon}>📎</Text>
          </TouchableOpacity>
        )}
        {action ? <Text style={[styles.actionText, { color }]}>{action}</Text> : null}
        <Text style={styles.icon}>{micIcon}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: '#0a1120',
    borderTopWidth: 2,
  },
  barPressed: {
    backgroundColor: '#0e1830',
  },
  statusSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stateLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detail: {
    color: '#445',
    fontSize: 10,
    marginTop: 2,
  },
  actionSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  icon: {
    fontSize: 24,
  },
  attachIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
});
