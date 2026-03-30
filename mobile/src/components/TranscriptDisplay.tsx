import React, { useState, useRef, useEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Platform,
  Pressable,
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
  /** Index of the word currently being read aloud (-1 if not reading). */
  readingWordIndex: number;
  /** ID of the entry currently being read aloud. */
  readingEntryId: string | null;
  onReadAloud: (text: string, entryId: string) => void;
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

/** Render text with the current word highlighted. */
function HighlightedText({ text, highlightIndex, style }: { text: string; highlightIndex: number; style: any }) {
  if (highlightIndex < 0) {
    return <Text style={style}>{text}</Text>;
  }
  const words = text.split(/(\s+)/); // Keep whitespace as separate tokens
  let wordIdx = 0;
  return (
    <Text style={style}>
      {words.map((token, i) => {
        if (/^\s+$/.test(token)) {
          return token; // whitespace, render as-is
        }
        const isHighlighted = wordIdx === highlightIndex;
        wordIdx++;
        return (
          <Text key={i} style={isHighlighted ? styles.highlightedWord : undefined}>
            {token}
          </Text>
        );
      })}
    </Text>
  );
}

export function TranscriptDisplay({
  conversation, isCompact, readingWordIndex, readingEntryId,
  onReadAloud, onAskClaude, onToggleCompact,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  function toggleExpand(entryId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [conversation.length, conversation[conversation.length - 1]?.response]);

  function showMenu(textFromHere: string, fullText: string, id: string, entryId: string) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Read from here', 'Ask Claude about this', 'Copy section', 'Copy all', 'Cancel'],
          cancelButtonIndex: 4,
        },
        (index) => {
          if (index === 0) onReadAloud(textFromHere, entryId);
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
        const isExpanded = expandedIds.has(entry.id);
        const showFull = isLast || !isCompact || isExpanded;
        const isBeingRead = readingEntryId === entry.id;

        return (
          <View key={entry.id} style={[styles.entry, !isLast && isCompact && styles.entryCompact]}>
            <Pressable
              style={styles.userBubble}
              onPress={!showFull ? () => toggleExpand(entry.id) : undefined}
            >
              <Text style={styles.userText}>
                {showFull ? entry.userText : summarize(entry.userText)}
              </Text>
            </Pressable>

            {entry.response ? (
              <View style={[styles.responseBubble, isBeingRead && styles.responseBubbleReading]}>
                {showFull ? (
                  <>
                    {splitIntoParagraphs(entry.response.response_text).map((para, pi) => {
                      const allParas = splitIntoParagraphs(entry.response!.response_text);
                      const textFromHere = allParas.slice(pi).join('\n\n');
                      // Calculate word offset for this paragraph
                      const wordsBeforePara = allParas.slice(0, pi).join(' ').split(/\s+/).filter(Boolean).length;
                      const paraHighlightIndex = isBeingRead
                        ? readingWordIndex - wordsBeforePara
                        : -1;
                      return (
                        <Pressable
                          key={pi}
                          onLongPress={() => showMenu(textFromHere, entry.response!.response_text, `${entry.id}-${pi}`, entry.id)}
                          delayLongPress={500}
                        >
                          <HighlightedText
                            text={para}
                            highlightIndex={paraHighlightIndex}
                            style={[styles.responseText, pi > 0 && styles.paragraphGap]}
                          />
                        </Pressable>
                      );
                    })}
                    {entry.response.timing && (
                      <Text style={styles.timingText}>
                        Claude {entry.response.timing.claude}s
                        {entry.response.timing.tts > 0 ? ` · TTS ${entry.response.timing.tts}s` : ''}
                      </Text>
                    )}
                  </>
                ) : (
                  <Pressable onPress={() => toggleExpand(entry.id)}>
                    <Text style={styles.responseTextCompact}>
                      {summarize(entry.response.response_text)}
                    </Text>
                    <Text style={styles.expandHint}>Tap to expand</Text>
                  </Pressable>
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
  responseBubbleReading: {
    borderLeftColor: '#00ff88',
  },
  responseText: { color: '#eef', fontSize: 14, lineHeight: 20 },
  responseTextCompact: { color: '#889', fontSize: 13 },
  expandHint: { color: '#445', fontSize: 10, marginTop: 4 },
  paragraphGap: { marginTop: 10 },
  highlightedWord: {
    backgroundColor: '#00d4ff33',
    color: '#00d4ff',
    borderRadius: 2,
  },
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
  timingText: { color: '#334', fontSize: 10, marginTop: 8, textAlign: 'right' },
});
