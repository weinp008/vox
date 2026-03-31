import React, { useState, useEffect, useRef } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

interface Props {
  visible: boolean;
  initialText: string;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function ReviewModal({ visible, initialText, onSend, onCancel }: Props) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText(initialText);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible, initialText]);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Review before sending</Text>
          <Text style={styles.subtitle}>Edit your transcribed message below</Text>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            textAlignVertical="top"
            placeholderTextColor="#445"
          />

          <View style={styles.wordCount}>
            <Text style={styles.wordCountText}>{text.split(/\s+/).filter(Boolean).length} words</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
              onPress={() => text.trim() && onSend(text.trim())}
            >
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  container: {
    backgroundColor: '#0e1628',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  title: { color: '#eef', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  subtitle: { color: '#556', fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: '#060d1a',
    borderWidth: 1,
    borderColor: '#1a2744',
    borderRadius: 12,
    color: '#eef',
    fontSize: 16,
    lineHeight: 24,
    padding: 16,
    minHeight: 150,
    maxHeight: 300,
  },
  wordCount: { alignItems: 'flex-end', marginTop: 6, marginBottom: 12 },
  wordCountText: { color: '#445', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#1a2744',
    alignItems: 'center',
  },
  cancelText: { color: '#aac', fontSize: 15, fontWeight: '600' },
  sendBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#00d4ff',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#000', fontSize: 15, fontWeight: '600' },
});
