import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { SessionProvider } from './src/context/SessionContext';
import { ProjectSelectScreen } from './src/screens/ProjectSelectScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { GamesScreen } from './src/screens/GamesScreen';

type Screen = 'project-select' | 'voice' | 'games';

export default function App() {
  const [screen, setScreen] = useState<Screen>('project-select');
  const [claudeStatus, setClaudeStatus] = useState<string | undefined>();

  return (
    <SessionProvider>
      <StatusBar style="light" />
      {screen === 'project-select' ? (
        <ProjectSelectScreen onSessionStarted={() => setScreen('voice')} />
      ) : screen === 'games' ? (
        <GamesScreen
          onBack={() => setScreen('voice')}
          statusLine={claudeStatus}
        />
      ) : (
        <VoiceScreen
          onLeaveSession={() => setScreen('project-select')}
          onOpenGames={() => setScreen('games')}
          onClaudeStatusChange={setClaudeStatus}
        />
      )}
    </SessionProvider>
  );
}
