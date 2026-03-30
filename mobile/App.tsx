import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SessionProvider } from './src/context/SessionContext';
import { ProjectSelectScreen } from './src/screens/ProjectSelectScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';

type Screen = 'project-select' | 'voice';

export default function App() {
  const [screen, setScreen] = useState<Screen>('project-select');

  return (
    <SessionProvider>
      <StatusBar style="light" />
      {screen === 'project-select' ? (
        <ProjectSelectScreen onSessionStarted={() => setScreen('voice')} />
      ) : (
        <VoiceScreen onLeaveSession={() => setScreen('project-select')} />
      )}
    </SessionProvider>
  );
}
