import { AppState, DDayTarget } from '../types/ypt';
import {
  calculateDDay,
  computeStreakDays,
  getStudyDayKey,
  getWeekDayKeys,
} from './yptLogic';

export interface WidgetDDaySummary {
  id: string;
  title: string;
  targetDate: string;
  label: string;
  diffDays: number;
  isPinned: boolean;
}

export interface WidgetStats {
  todayKey: string;
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  dailyGoalSeconds: number;
  dailyGoalPct: number;
  streakDays: number;
  selectedDDay: WidgetDDaySummary | null;
}

export interface ComputeWidgetStatsInput {
  state: Pick<AppState, 'sessions' | 'ddays' | 'profile'>;
  nowMs: number;
  liveFocusSeconds?: number;
  selectedDDayId?: string | null;
}

export type WidgetLaunchSupport = 'document-pip' | 'in-app-floating';

export function detectWidgetLaunchSupport(win?: {
  top?: unknown;
  self?: unknown;
  documentPictureInPicture?: { requestWindow?: unknown };
} | null): WidgetLaunchSupport {
  if (!win) return 'in-app-floating';
  const isTopLevel = win.top === win.self;
  const hasPip =
    typeof win.documentPictureInPicture?.requestWindow === 'function';
  return isTopLevel && hasPip ? 'document-pip' : 'in-app-floating';
}

export function resolveWidgetDDay(
  ddays: DDayTarget[],
  todayKey: string,
  selectedDDayId?: string | null
): WidgetDDaySummary | null {
  if (ddays.length === 0) return null;

  const chosen =
    (selectedDDayId ? ddays.find((d) => d.id === selectedDDayId) : undefined) ??
    ddays.find((d) => d.isPinned) ??
    ddays[0];

  const { label, diffDays } = calculateDDay(chosen.targetDate, todayKey);
  return {
    id: chosen.id,
    title: chosen.title,
    targetDate: chosen.targetDate,
    label,
    diffDays,
    isPinned: Boolean(chosen.isPinned),
  };
}

export function computeWidgetStats({
  state,
  nowMs,
  liveFocusSeconds = 0,
  selectedDDayId = null,
}: ComputeWidgetStatsInput): WidgetStats {
  const resetHour = state.profile.resetHour ?? 5;
  const todayKey = getStudyDayKey(nowMs, resetHour);
  const weekSet = new Set(getWeekDayKeys(todayKey));
  const monthPrefix = todayKey.slice(0, 7);

  let todayCompleted = 0;
  let weekCompleted = 0;
  let monthCompleted = 0;

  for (const session of state.sessions) {
    const key = getStudyDayKey(session.startTime, resetHour);
    const secs = Math.max(0, session.durationSeconds);
    if (key === todayKey) {
      todayCompleted += secs;
    }
    if (weekSet.has(key)) {
      weekCompleted += secs;
    }
    if (key.startsWith(monthPrefix)) {
      monthCompleted += secs;
    }
  }

  const extraLive = Math.max(0, Math.floor(liveFocusSeconds));
  const todaySeconds = todayCompleted + extraLive;
  const weekSeconds = weekCompleted + extraLive;
  const monthSeconds = monthCompleted + extraLive;

  const dailyGoalSeconds = Math.max(1, state.profile.dailyGoalHours) * 3600;
  const dailyGoalPct = Math.min(
    100,
    Math.round((todaySeconds / dailyGoalSeconds) * 100)
  );

  const baseStreak = computeStreakDays(state.sessions, todayKey, resetHour);
  const streakDays =
    baseStreak === 0 && extraLive > 0 ? 1 : baseStreak;

  const selectedDDay = resolveWidgetDDay(state.ddays, todayKey, selectedDDayId);

  return {
    todayKey,
    todaySeconds,
    weekSeconds,
    monthSeconds,
    dailyGoalSeconds,
    dailyGoalPct,
    streakDays,
    selectedDDay,
  };
}
