import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';

interface DiffFile {
  path: string;
  hunks: DiffLine[][];
}

interface DiffLine {
  type: 'added' | 'removed' | 'context';
  content: string;
}

function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffLine[] = [];

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      if (currentFile && currentHunk.length > 0) {
        currentFile.hunks.push(currentHunk);
      }
      currentHunk = [];
      const match = raw.match(/diff --git a\/.+ b\/(.+)/);
      currentFile = { path: match?.[1] ?? 'unknown', hunks: [] };
      files.push(currentFile);
    } else if (raw.startsWith('--- ') || raw.startsWith('+++ ') || raw.startsWith('index ') || raw.startsWith('@@')) {
      if (raw.startsWith('@@') && currentHunk.length > 0 && currentFile) {
        currentFile.hunks.push(currentHunk);
        currentHunk = [];
      }
    } else if (raw.startsWith('+')) {
      currentHunk.push({ type: 'added', content: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      currentHunk.push({ type: 'removed', content: raw.slice(1) });
    } else if (raw.startsWith(' ')) {
      currentHunk.push({ type: 'context', content: raw.slice(1) });
    }
  }

  if (currentFile && currentHunk.length > 0) {
    currentFile.hunks.push(currentHunk);
  }

  return files;
}

interface Props {
  diff: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiffDisplay({ diff, onConfirm, onCancel }: Props) {
  const [copied, setCopied] = useState(false);
  const isGitDiff = diff.trimStart().startsWith('diff --git');
  const files = isGitDiff ? parseUnifiedDiff(diff) : [];

  function handleCopy() {
    Clipboard.setStringAsync(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Pending changes</Text>
        <TouchableOpacity onPress={handleCopy}>
          <Text style={styles.copyBtn}>{copied ? 'Copied' : 'Copy'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isGitDiff && files.length > 0 ? (
          files.map((file, fi) => (
            <View key={fi} style={styles.fileBlock}>
              <Text style={styles.fileName}>📄 {file.path}</Text>
              {file.hunks.map((hunk, hi) => (
                <View key={hi} style={styles.hunk}>
                  {hunk.map((line, li) => (
                    <Text
                      key={li}
                      style={[
                        styles.diffLine,
                        line.type === 'added' && styles.addedLine,
                        line.type === 'removed' && styles.removedLine,
                        line.type === 'context' && styles.contextLine,
                      ]}
                      numberOfLines={1}
                    >
                      {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      {line.content}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ))
        ) : (
          // Fallback: raw code block
          <View style={styles.rawBlock}>
            <Text style={styles.rawText}>{diff}</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
          <Text style={styles.confirmText}>Apply changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0a1120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1a3055',
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a3055',
  },
  title: { color: '#ffaa00', fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
  copyBtn: { color: '#00d4ff', fontSize: 12 },
  scroll: { maxHeight: 280 },
  scrollContent: { paddingBottom: 8 },
  fileBlock: { marginTop: 8, paddingHorizontal: 4 },
  fileName: {
    color: '#aac',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0e1628',
  },
  hunk: { marginBottom: 4 },
  diffLine: {
    fontFamily: 'Courier',
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  addedLine: { color: '#00cc66', backgroundColor: '#00331a' },
  removedLine: { color: '#ff6666', backgroundColor: '#330011' },
  contextLine: { color: '#556' },
  rawBlock: { padding: 12 },
  rawText: { color: '#aac', fontFamily: 'Courier', fontSize: 11, lineHeight: 16 },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1a3055',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1a3055',
  },
  cancelText: { color: '#556', fontSize: 14 },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#003322',
  },
  confirmText: { color: '#00cc66', fontSize: 14, fontWeight: '600' },
});
