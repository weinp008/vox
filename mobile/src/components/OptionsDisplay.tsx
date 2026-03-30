import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  options: string[];
  onSelect: (selection: string) => void;
  onSelectAll: () => void;
}

export function OptionsDisplay({ options, onSelect, onSelectAll }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Tap to select, or speak</Text>
      {options.map((opt, i) => (
        <TouchableOpacity
          key={i}
          style={styles.row}
          activeOpacity={0.6}
          onPress={() => onSelect(String(i + 1))}
        >
          <View style={styles.number}>
            <Text style={styles.numberText}>{i + 1}</Text>
          </View>
          <Text style={styles.optionText}>{opt}</Text>
        </TouchableOpacity>
      ))}
      {options.length > 1 && (
        <TouchableOpacity style={styles.allBtn} activeOpacity={0.6} onPress={onSelectAll}>
          <Text style={styles.allBtnText}>Select all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0a1020',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1a3055',
  },
  header: { color: '#00d4ff', fontSize: 12, marginBottom: 12, letterSpacing: 0.8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00d4ff22',
    borderWidth: 1,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: { color: '#00d4ff', fontWeight: 'bold', fontSize: 14 },
  optionText: { flex: 1, color: '#dde', fontSize: 14, lineHeight: 20, paddingTop: 4 },
  allBtn: {
    marginTop: 4,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1a3055',
  },
  allBtnText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
});
