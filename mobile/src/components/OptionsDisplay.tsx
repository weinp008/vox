import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function OptionsDisplay({ options }: { options: string[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Options — speak the number to select</Text>
      {options.map((opt, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.number}>
            <Text style={styles.numberText}>{i + 1}</Text>
          </View>
          <Text style={styles.optionText}>{opt}</Text>
        </View>
      ))}
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
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 12 },
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
});
