import {
  RankingEntry,
  StudyCategory,
  StudySession,
  Subject,
  TenMinuteSlot,
  TodoItem,
} from '../types/ypt';

/**
 * Computes the YPT "Study Day Key" (YYYY-MM-DD) given a Unix ms timestamp
 * and a daily reset hour (YPT defaults to 5:00 AM so late-night study before 5 AM
 * belongs to the previous study day).
 */
export function getStudyDayKey(timestampMs: number, resetHour: number = 5): string {
  const shifted = new Date(timestampMs - resetHour * 3600 * 1000);
  const year = shifted.getFullYear();
  const month = String(shifted.getMonth() + 1).padStart(2, '0');
  const day = String(shifted.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats seconds as HH:MM:SS with tabular zero-padding.
 */
export function formatDurationHMS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Formats seconds cleanly for compact labels, e.g., "4h 23m" or "18m" or "42s".
 */
export function formatDurationShort(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${clamped}s`;
}

/**
 * Calculates YPT D-Day label and numeric delta from YYYY-MM-DD strings.
 */
export function calculateDDay(
  targetDateStr: string,
  referenceDateStr: string
): { label: string; diffDays: number } {
  const [ty, tm, td] = targetDateStr.split('-').map(Number);
  const [ry, rm, rd] = referenceDateStr.split('-').map(Number);
  const targetUtc = Date.UTC(ty, tm - 1, td);
  const refUtc = Date.UTC(ry, rm - 1, rd);
  const diffDays = Math.round((targetUtc - refUtc) / (24 * 3600 * 1000));

  if (diffDays === 0) return { label: 'D-DAY', diffDays: 0 };
  if (diffDays > 0) return { label: `D-${diffDays}`, diffDays };
  return { label: `D+${Math.abs(diffDays)}`, diffDays };
}

/**
 * Maps total daily study seconds to YPT's 0..4 flame intensity level.
 * 0: 0s
 * 1: 1s .. <2h
 * 2: 2h .. <5h
 * 3: 5h .. <8h
 * 4: >= 8h
 */
export function getHeatLevel(totalSeconds: number): 0 | 1 | 2 | 3 | 4 {
  if (totalSeconds <= 0) return 0;
  const hours = totalSeconds / 3600;
  if (hours < 2) return 1;
  if (hours < 5) return 2;
  if (hours < 8) return 3;
  return 4;
}

/**
 * Returns the start (inclusive) and end (exclusive) Unix ms bounds for a given studyDayKey.
 */
export function getStudyDayBounds(studyDayKey: string, resetHour: number = 5): {
  startMs: number;
  endMs: number;
} {
  const [year, month, day] = studyDayKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, resetHour, 0, 0, 0);
  const startMs = start.getTime();
  const endMs = startMs + 24 * 3600 * 1000;
  return { startMs, endMs };
}

/**
 * Builds the signature YPT 10-Minute Planner grid:
 * 24 hour rows (starting from resetHour, e.g. 05:00 through 04:00 next day)
 * x 6 ten-minute slots per hour = 144 slots.
 */
export function buildTenMinuteGrid(
  sessions: StudySession[],
  subjects: Subject[],
  studyDayKey: string,
  resetHour: number = 5
): TenMinuteSlot[][] {
  const { startMs } = getStudyDayBounds(studyDayKey, resetHour);
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));

  // Track seconds per subject in each of the 144 slots
  const slotSubjectSeconds: Array<Map<string, number>> = Array.from(
    { length: 144 },
    () => new Map<string, number>()
  );

  const slotDurationMs = 10 * 60 * 1000;
  const dayEndMs = startMs + 144 * slotDurationMs;

  for (const session of sessions) {
    const sStart = Math.max(session.startTime, startMs);
    const sEnd = Math.min(session.endTime, dayEndMs);
    if (sEnd <= sStart) continue;

    const firstSlot = Math.floor((sStart - startMs) / slotDurationMs);
    const lastSlot = Math.min(143, Math.floor((sEnd - 1 - startMs) / slotDurationMs));

    for (let idx = firstSlot; idx <= lastSlot; idx++) {
      const slotStart = startMs + idx * slotDurationMs;
      const slotEnd = slotStart + slotDurationMs;
      const overlapMs = Math.min(sEnd, slotEnd) - Math.max(sStart, slotStart);
      if (overlapMs > 0) {
        const prev = slotSubjectSeconds[idx].get(session.subjectId) ?? 0;
        slotSubjectSeconds[idx].set(session.subjectId, prev + overlapMs / 1000);
      }
    }
  }

  const rows: TenMinuteSlot[][] = [];
  for (let h = 0; h < 24; h++) {
    const displayHour = (resetHour + h) % 24;
    const row: TenMinuteSlot[] = [];
    for (let m = 0; m < 6; m++) {
      const idx = h * 6 + m;
      const counts = slotSubjectSeconds[idx];
      let dominantSubjectId: string | null = null;
      let maxSeconds = 0;
      let totalSlotSeconds = 0;

      for (const [subjId, secs] of counts.entries()) {
        totalSlotSeconds += secs;
        if (secs > maxSeconds) {
          maxSeconds = secs;
          dominantSubjectId = subjId;
        }
      }

      // Only fill slot visually if at least 30s studied in that 10-min block (or manual block)
      const subj = dominantSubjectId ? subjectMap.get(dominantSubjectId) : undefined;
      const filled = totalSlotSeconds >= 30 && subj !== undefined;

      row.push({
        hourIndex: h,
        displayHour,
        minuteOffset: m * 10,
        subjectId: filled ? subj.id : null,
        subjectColor: filled ? subj.color : null,
        subjectName: filled ? subj.name : null,
        secondsInSlot: Math.round(totalSlotSeconds),
      });
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Aggregates study seconds per subject for a set of studyDayKeys.
 */
export function computeSubjectTotals(
  sessions: StudySession[],
  subjects: Subject[],
  allowedDayKeys: Set<string>,
  resetHour: number = 5
): Array<{ subject: Subject; totalSeconds: number }> {
  const totals = new Map<string, number>();
  for (const subj of subjects) {
    totals.set(subj.id, 0);
  }

  for (const session of sessions) {
    const dayKey = getStudyDayKey(session.startTime, resetHour);
    if (!allowedDayKeys.has(dayKey)) continue;
    totals.set(
      session.subjectId,
      (totals.get(session.subjectId) ?? 0) + session.durationSeconds
    );
  }

  return subjects.map((subject) => ({
    subject,
    totalSeconds: totals.get(subject.id) ?? 0,
  }));
}

/**
 * Computes total study seconds for each dayKey present in sessions.
 */
export function computeDailyTotalsMap(
  sessions: StudySession[],
  resetHour: number = 5
): Map<string, number> {
  const map = new Map<string, number>();
  for (const session of sessions) {
    const dayKey = getStudyDayKey(session.startTime, resetHour);
    map.set(dayKey, (map.get(dayKey) ?? 0) + session.durationSeconds);
  }
  return map;
}

/**
 * Computes consecutive study streak days ending on or immediately before referenceDayKey.
 */
export function computeStreakDays(
  sessions: StudySession[],
  referenceDayKey: string,
  resetHour: number = 5
): number {
  const dailyMap = computeDailyTotalsMap(sessions, resetHour);
  const [y, m, d] = referenceDayKey.split('-').map(Number);
  let cursor = new Date(Date.UTC(y, m - 1, d));

  const formatUtcKey = (dt: Date) => {
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  // If today has 0 seconds yet, allow streak to count starting from yesterday
  if ((dailyMap.get(formatUtcKey(cursor)) ?? 0) <= 0) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while ((dailyMap.get(formatUtcKey(cursor)) ?? 0) > 0) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Returns the 7 studyDayKeys (Mon..Sun) for the week containing referenceDayKey.
 */
export function getWeekDayKeys(referenceDayKey: string): string[] {
  const [y, m, d] = referenceDayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(dt);
  monday.setUTCDate(dt.getUTCDate() + diffToMonday);

  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setUTCDate(monday.getUTCDate() + i);
    const yy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    keys.push(`${yy}-${mm}-${dd}`);
  }
  return keys;
}

/**
 * Computes hourly focus distribution (24 buckets aligned from 0..23 clock hours).
 */
export function computeHourlyDistribution(
  sessions: StudySession[],
  allowedDayKeys: Set<string>,
  resetHour: number = 5
): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const session of sessions) {
    const dayKey = getStudyDayKey(session.startTime, resetHour);
    if (!allowedDayKeys.has(dayKey)) continue;
    const hour = new Date(session.startTime).getHours();
    buckets[hour] += session.durationSeconds;
  }
  return buckets;
}

/**
 * Inserts the current user into category rankings and returns sorted leaderboard + user's 1-based rank.
 */
export function buildLeaderboard(
  entries: RankingEntry[],
  userEntry: RankingEntry,
  period: 'daily' | 'weekly' | 'monthly',
  categoryFilter: StudyCategory | 'All'
): {
  rows: Array<RankingEntry & { rank: number; isCurrentUser: boolean; periodSeconds: number }>;
  userRank: number;
} {
  const combined = [...entries, userEntry];
  const filtered =
    categoryFilter === 'All'
      ? combined
      : combined.filter((e) => e.category === categoryFilter);

  const getSecs = (e: RankingEntry) =>
    period === 'daily'
      ? e.dailySeconds
      : period === 'weekly'
        ? e.weeklySeconds
        : e.monthlySeconds;

  const sorted = [...filtered].sort((a, b) => getSecs(b) - getSecs(a));
  let userRank = 1;
  const rows = sorted.map((entry, idx) => {
    const rank = idx + 1;
    const isCurrentUser = entry.id === userEntry.id;
    if (isCurrentUser) {
      userRank = rank;
    }
    return {
      ...entry,
      rank,
      isCurrentUser,
      periodSeconds: getSecs(entry),
    };
  });

  return { rows, userRank };
}

/**
 * Rolls over uncompleted tasks from previous days into targetDayKey without duplicating existing titles.
 */
export function rolloverUnfinishedTodos(
  todos: TodoItem[],
  targetDayKey: string
): { updatedTodos: TodoItem[]; movedCount: number } {
  const existingOnTarget = new Set(
    todos
      .filter((t) => t.studyDayKey === targetDayKey)
      .map((t) => `${t.subjectId}::${t.title.trim().toLowerCase()}`)
  );

  let movedCount = 0;
  const updatedTodos = todos.map((todo) => {
    if (!todo.completed && todo.studyDayKey < targetDayKey) {
      const signature = `${todo.subjectId}::${todo.title.trim().toLowerCase()}`;
      if (!existingOnTarget.has(signature)) {
        existingOnTarget.add(signature);
        movedCount += 1;
        return { ...todo, studyDayKey: targetDayKey };
      }
    }
    return todo;
  });

  return { updatedTodos, movedCount };
}
