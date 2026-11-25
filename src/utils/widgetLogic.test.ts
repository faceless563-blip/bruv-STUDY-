import test from 'node:test';
import assert from 'node:assert/strict';
import { computeWidgetStats, detectWidgetLaunchSupport } from './widgetLogic';
import { AppState } from '../types/ypt';

const baseProfile: AppState['profile'] = {
  name: 'Alex',
  category: 'University & STEM',
  dailyGoalHours: 8,
  resetHour: 5,
  motto: '',
};

test('computeWidgetStats sums today, week, month and includes live focus seconds', () => {
  // Wednesday 2026-11-25 14:00 local
  const wedMs = new Date(2026, 10, 25, 14, 0, 0, 0).getTime();
  // Monday same week 2026-11-23 10:00 local
  const monMs = new Date(2026, 10, 23, 10, 0, 0, 0).getTime();
  // Earlier same month 2026-11-05 09:00 local
  const earlyMonthMs = new Date(2026, 10, 5, 9, 0, 0, 0).getTime();
  // Previous month 2026-10-20 11:00 local
  const prevMonthMs = new Date(2026, 9, 20, 11, 0, 0, 0).getTime();
  // Late night on 2026-11-25 03:00 AM -> belongs to 2026-11-24 study day (resetHour=5)
  const lateNightTueMs = new Date(2026, 10, 25, 3, 0, 0, 0).getTime();

  const stats = computeWidgetStats({
    state: {
      profile: baseProfile,
      ddays: [
        { id: 'd1', title: 'Physics Midterm', targetDate: '2026-11-28', isPinned: false },
        { id: 'd2', title: 'Final Exam', targetDate: '2026-12-05', isPinned: true },
      ],
      sessions: [
        { id: 's1', subjectId: 'math', startTime: wedMs, endTime: wedMs + 3600_000, durationSeconds: 3600, mode: 'stopwatch' },
        { id: 's2', subjectId: 'math', startTime: lateNightTueMs, endTime: lateNightTueMs + 1800_000, durationSeconds: 1800, mode: 'stopwatch' },
        { id: 's3', subjectId: 'cs', startTime: monMs, endTime: monMs + 7200_000, durationSeconds: 7200, mode: 'stopwatch' },
        { id: 's4', subjectId: 'cs', startTime: earlyMonthMs, endTime: earlyMonthMs + 5400_000, durationSeconds: 5400, mode: 'stopwatch' },
        { id: 's5', subjectId: 'cs', startTime: prevMonthMs, endTime: prevMonthMs + 9999_000, durationSeconds: 9999, mode: 'stopwatch' },
      ],
    },
    nowMs: wedMs,
    liveFocusSeconds: 120,
  });

  assert.equal(stats.todayKey, '2026-11-25');
  assert.equal(stats.todaySeconds, 3600 + 120);
  assert.equal(stats.weekSeconds, 3600 + 1800 + 7200 + 120);
  assert.equal(stats.monthSeconds, 3600 + 1800 + 7200 + 5400 + 120);
  assert.equal(stats.dailyGoalPct, 13);
  assert.equal(stats.selectedDDay?.id, 'd2');
  assert.equal(stats.selectedDDay?.label, 'D-10');
});

test('computeWidgetStats respects explicit selectedDDayId and handles empty state', () => {
  const nowMs = new Date(2026, 10, 25, 14, 0, 0, 0).getTime();

  const chosen = computeWidgetStats({
    state: {
      profile: baseProfile,
      ddays: [
        { id: 'd1', title: 'Quiz', targetDate: '2026-11-25', isPinned: false },
        { id: 'd2', title: 'Finals', targetDate: '2026-12-10', isPinned: true },
      ],
      sessions: [],
    },
    nowMs,
    selectedDDayId: 'd1',
  });

  assert.equal(chosen.selectedDDay?.id, 'd1');
  assert.equal(chosen.selectedDDay?.label, 'D-DAY');

  const empty = computeWidgetStats({
    state: {
      profile: baseProfile,
      ddays: [],
      sessions: [],
    },
    nowMs,
  });
  assert.equal(empty.selectedDDay, null);
  assert.equal(empty.todaySeconds, 0);
  assert.equal(empty.weekSeconds, 0);
  assert.equal(empty.monthSeconds, 0);
});

test('detectWidgetLaunchSupport detects top-level Document PiP vs embedded or unsupported environments', () => {
  const sameObj = {};
  assert.equal(
    detectWidgetLaunchSupport({
      top: sameObj,
      self: sameObj,
      documentPictureInPicture: { requestWindow: () => Promise.resolve({}) },
    }),
    'document-pip'
  );
  assert.equal(
    detectWidgetLaunchSupport({
      top: {},
      self: sameObj,
      documentPictureInPicture: { requestWindow: () => Promise.resolve({}) },
    }),
    'in-app-floating'
  );
  assert.equal(detectWidgetLaunchSupport({ top: sameObj, self: sameObj }), 'in-app-floating');
});
