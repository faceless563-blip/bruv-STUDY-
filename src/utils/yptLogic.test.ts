import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLeaderboard,
  buildTenMinuteGrid,
  calculateDDay,
  computeStreakDays,
  formatDurationHMS,
  formatDurationShort,
  getHeatLevel,
  getStudyDayKey,
  rolloverUnfinishedTodos,
} from './yptLogic';
import { RankingEntry, StudySession, Subject, TodoItem } from '../types/ypt';

test('getStudyDayKey respects YPT 5:00 AM daily reset cycle', () => {
  // 2026-11-19 at 01:30 AM local should still belong to 2026-11-18
  const lateNight = new Date(2026, 10, 19, 1, 30, 0).getTime();
  assert.equal(getStudyDayKey(lateNight, 5), '2026-11-18');

  // 2026-11-19 at 05:00 AM local starts 2026-11-19
  const morningReset = new Date(2026, 10, 19, 5, 0, 0).getTime();
  assert.equal(getStudyDayKey(morningReset, 5), '2026-11-19');
});

test('formatDurationHMS and formatDurationShort format cleanly', () => {
  assert.equal(formatDurationHMS(0), '00:00:00');
  assert.equal(formatDurationHMS(3665), '01:01:05');
  assert.equal(formatDurationShort(5400), '1h 30m');
  assert.equal(formatDurationShort(420), '7m');
  assert.equal(formatDurationShort(42), '42s');
});

test('calculateDDay handles future, today, and past dates', () => {
  assert.deepEqual(calculateDDay('2026-12-03', '2026-11-19'), {
    label: 'D-14',
    diffDays: 14,
  });
  assert.deepEqual(calculateDDay('2026-11-19', '2026-11-19'), {
    label: 'D-DAY',
    diffDays: 0,
  });
  assert.deepEqual(calculateDDay('2026-11-16', '2026-11-19'), {
    label: 'D+3',
    diffDays: -3,
  });
});

test('getHeatLevel maps hours to YPT flame intensity 0..4', () => {
  assert.equal(getHeatLevel(0), 0);
  assert.equal(getHeatLevel(1800), 1); // 0.5h
  assert.equal(getHeatLevel(7200), 2); // 2h
  assert.equal(getHeatLevel(18000), 3); // 5h
  assert.equal(getHeatLevel(28800), 4); // 8h
});

test('buildTenMinuteGrid maps sessions into 24x6 10-minute slots', () => {
  const subjects: Subject[] = [
    { id: 'math', name: 'Mathematics', color: '#F97316', dailyTargetMinutes: 120 },
  ];
  // 09:05 to 09:25 on 2026-11-19 (hour index 4 from 05:00)
  const start = new Date(2026, 10, 19, 9, 5, 0).getTime();
  const end = new Date(2026, 10, 19, 9, 25, 0).getTime();
  const sessions: StudySession[] = [
    { id: 's1', subjectId: 'math', startTime: start, endTime: end, durationSeconds: 1200, mode: 'stopwatch' },
  ];

  const grid = buildTenMinuteGrid(sessions, subjects, '2026-11-19', 5);
  assert.equal(grid.length, 24);
  assert.equal(grid[4].length, 6);
  // 09:00-09:10 (5 mins = 300s)
  assert.equal(grid[4][0].subjectId, 'math');
  assert.equal(grid[4][0].secondsInSlot, 300);
  // 09:10-09:20 (10 mins = 600s)
  assert.equal(grid[4][1].subjectId, 'math');
  assert.equal(grid[4][1].secondsInSlot, 600);
  // 09:20-09:30 (5 mins = 300s)
  assert.equal(grid[4][2].subjectId, 'math');
  assert.equal(grid[4][2].secondsInSlot, 300);
  // 09:30-09:40 empty
  assert.equal(grid[4][3].subjectId, null);
});

test('computeStreakDays counts consecutive active days', () => {
  const sessions: StudySession[] = [
    {
      id: 'a',
      subjectId: 'math',
      startTime: new Date(2026, 10, 19, 10, 0, 0).getTime(),
      endTime: new Date(2026, 10, 19, 11, 0, 0).getTime(),
      durationSeconds: 3600,
      mode: 'stopwatch',
    },
    {
      id: 'b',
      subjectId: 'math',
      startTime: new Date(2026, 10, 18, 10, 0, 0).getTime(),
      endTime: new Date(2026, 10, 18, 11, 0, 0).getTime(),
      durationSeconds: 3600,
      mode: 'stopwatch',
    },
    {
      id: 'c',
      subjectId: 'math',
      startTime: new Date(2026, 10, 16, 10, 0, 0).getTime(),
      endTime: new Date(2026, 10, 16, 11, 0, 0).getTime(),
      durationSeconds: 3600,
      mode: 'stopwatch',
    },
  ];
  assert.equal(computeStreakDays(sessions, '2026-11-19', 5), 2);
});

test('buildLeaderboard ranks current user accurately by period and category', () => {
  const entries: RankingEntry[] = [
    {
      id: 'u1',
      name: 'Minjun',
      category: 'Computer Science',
      status: 'studying',
      dailySeconds: 18000,
      weeklySeconds: 72000,
      monthlySeconds: 200000,
      streakDays: 9,
    },
    {
      id: 'u2',
      name: 'Jisoo',
      category: 'Computer Science',
      status: 'resting',
      dailySeconds: 9000,
      weeklySeconds: 50000,
      monthlySeconds: 150000,
      streakDays: 4,
    },
  ];
  const me: RankingEntry = {
    id: 'me',
    name: 'Alex',
    category: 'Computer Science',
    status: 'offline',
    dailySeconds: 12000,
    weeklySeconds: 60000,
    monthlySeconds: 180000,
    streakDays: 5,
  };

  const result = buildLeaderboard(entries, me, 'daily', 'Computer Science');
  assert.equal(result.userRank, 2);
  assert.equal(result.rows[0].name, 'Minjun');
  assert.equal(result.rows[1].isCurrentUser, true);
});

test('rolloverUnfinishedTodos moves incomplete past tasks to today without duplicates', () => {
  const todos: TodoItem[] = [
    { id: '1', subjectId: 'math', title: 'Review Calculus Ch 4', completed: false, studyDayKey: '2026-11-18' },
    { id: '2', subjectId: 'math', title: 'Done task', completed: true, studyDayKey: '2026-11-18' },
    { id: '3', subjectId: 'math', title: 'Review Calculus Ch 4', completed: false, studyDayKey: '2026-11-19' },
  ];

  const { updatedTodos, movedCount } = rolloverUnfinishedTodos(todos, '2026-11-19');
  assert.equal(movedCount, 0);
  assert.equal(updatedTodos[0].studyDayKey, '2026-11-18');
});
