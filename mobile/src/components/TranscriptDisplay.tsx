import React, { useState, useRef, useEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ConversationEntry } from '../types';

interface Props {
  conversation: ConversationEntry[];
  isCompact: boolean;
  onReadAloud: (text: string) => void;
  onAskClaude: (text: string) => void;
  onToggleCompact: () => void;
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
}

function summarize(text: string): string {
  const first = text.split(/[.!?\n]/)[0]?.trim();
  if (!first) return text.slice(0, 60);
  return first.length > 80 ? first.slice(0, 77) + '...' : first;
}

export function TranscriptDisplay({ conversation, isCompact, onReadAloud, onAskClaude, onToggleCompact }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [conversation.length, conversation[conversation.length - 1]?.response]);

  function handleLongPress(textFromHere: string, fullText: string, id: string) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Read from here', 'Ask Claude about this', 'Copy section', 'Copy all', 'Cancel'],
          cancelButtonIndex: 4,
        },
        (index) => {
          if (index === 0) onReadAloud(textFromHere);
          if (index === 1) onAskClaude(textFromHere);
          if (index === 2) copyText(textFromHere, id);
          if (index === 3) copyText(fullText, id);
        },
      );
    } else {
      copyText(textFromHere, id);
    }
  }

  function copyText(text: string, id: string) {
    Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (conversation.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Hold the button and speak a voice command</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
      {conversation.length > 2 && (
        <TouchableOpacity onPress={onToggleCompact} style={styles.compactToggle}>
          <Text style={styles.compactToggleText}>
            {isCompact ? 'Show full conversation' : 'Compact view'}
          </Text>
        </TouchableOpacity>
      )}

      {conversation.map((entry, i) => {
        const isLast = i === conversation.length - 1;
        const showFull = isLast || !isCompact;

        return (
          <View key={entry.id} style={[styles.entry, !isLast && isCompact && styles.entryCompact]}>
            <View style={styles.userBubble}>
              <Text style={styles.userText}>
                {showFull ? entry.userText : summarize(entry.userText)}
              </Text>
            </View>

            {entry.response ? (
              <View style={styles.responseBubble}>
                {showFull ? (
                  splitIntoParagraphs(entry.response.response_text).map((para, pi) => {
                    const textFromHere = splitIntoParagraphs(entry.response!.response_text).slice(pi).join('\n\n');
                    return (
                      <TouchableOpacity
                        key={pi}
                        activeOpacity={0.7}
                        onLongPress={() => handleLongPress(textFromHere, entry.response!.response_text, `${entry.id}-${pi}`)}
                        delayLongPress={400}
                      >
                        <Text style={[styles.responseText, pi > 0 && styles.paragraphGap]}>
                          {para}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.responseTextCompact}>
                    {summarize(entry.response.response_text)}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.thinkingBubble}>
                <ActivityIndicator size="small" color="#00d4ff" />
                <Text style={styles.thinkingText}>Thinking...</Text>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  content: { padding: 16, gap: 8 },
  hint: { color: '#556', textAlign: 'center', marginTop: 40, fontSize: 15 },
  compactToggle: { alignSelf: 'center', marginBottom: 8 },
  compactToggleText: { color: '#00d4ff', fontSize: 12 },
  entry: { gap: 6, marginBottom: 12 },
  entryCompact: { marginBottom: 4 },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#1a2744',
    borderRadius: 12,
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '85%',
  },
  userText: { color: '#aac', fontSize: 14 },
  responseBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#0e1628',
    borderRadius: 12,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    maxWidth: '90%',
    borderLeftWidth: 2,
    borderLeftColor: '#00d4ff',
  },
  responseText: { color: '#eef', fontSize: 14, lineHeight: 20 },
  responseTextCompact: { color: '#889', fontSize: 13 },
  paragraphGap: { marginTop: 10 },
  thinkingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#0e1628',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#ffaa00',
  },
  thinkingText: { color: '#ffaa00', fontSize: 13 },
});
