import { AppState, WalletState } from '../types/ypt';

export const SUBJECT_COLOR_PALETTE = [
  '#F97316', // Flame Orange
  '#2563EB', // Cobalt Blue
  '#0D9488', // Deep Teal
  '#7C3AED', // Violet
  '#DC2626', // Crimson
  '#D97706', // Amber
  '#059669', // Emerald
  '#DB2777', // Rose
];

export function createDefaultWallet(): WalletState {
  return {
    coins: 0,
    unlockedPacks: [],
    proAllAccess: false,
    claimedPeriodKeys: [],
    accentTheme: 'orange',
    purchaseHistory: [],
  };
}

export function createEmptyState(): AppState {
  return {
    theme: 'light',
    profile: {
      name: 'My Desk',
      category: 'University & STEM',
      dailyGoalHours: 8,
      resetHour: 5,
      motto: '',
    },
    subjects: [],
    sessions: [],
    todos: [],
    ddays: [],
    groups: [],
    rankings: [],
    pomodoro: {
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
    },
    focusGuard: {
      autoPauseOnTabSwitch: false,
      allowedTools: [],
      showFloatingGoalBar: true,
    },
    activeTimerMode: 'stopwatch',
    checkedInToday: false,
    wallet: createDefaultWallet(),
  };
}
