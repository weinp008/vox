import * as Haptics from 'expo-haptics';

/** Haptic + audio notification when Claude finishes. */
export function useChime() {
  async function playChime() {
    try {
      // Double haptic tap = "done" feeling
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Non-critical
    }
  }

  return { playChime };
}
