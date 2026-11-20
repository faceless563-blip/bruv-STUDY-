import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Flame, Lock } from 'lucide-react';
import { FeaturePackId, StudySession, Subject } from '../types/ypt';
import {
  computeDailyTotalsMap,
  computeHourlyDistribution,
  computeStreakDays,
  computeSubjectTotals,
  formatDurationHMS,
  formatDurationShort,
  getHeatLevel,
  getStudyDayKey,
  getWeekDayKeys,
} from '../utils/yptLogic';

interface InsightsViewProps {
  todayKey: string;
  resetHour: number;
  dailyGoalHours: number;
  subjects: Subject[];
  sessions: StudySession[];
  advancedInsightsUnlocked: boolean;
  onRequestUnlock: (packId: FeaturePackId) => void;
  onExportCsv: () => void;
}

type InsightsPeriod = 'day' | 'week' | 'month';

const HEAT_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-neutral-100 dark:bg-neutral-800/70 text-neutral-500 dark:text-neutral-400',
  1: 'bg-orange-100 dark:bg-orange-950/60 text-orange-900 dark:text-orange-200',
  2: 'bg-orange-300 dark:bg-orange-800/80 text-orange-950 dark:text-orange-50',
  3: 'bg-orange-500 text-white',
  4: 'bg-orange-700 text-white',
};

export const InsightsView: React.FC<InsightsViewProps> = ({
  todayKey,
  resetHour,
  dailyGoalHours,
  subjects,
  sessions,
  advancedInsightsUnlocked,
  onRequestUnlock,
  onExportCsv,
}) => {
  const [period, setPeriod] = useState<InsightsPeriod>('day');
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [y, m] = todayKey.split('-').map(Number);
    return { year: y, month: m }; // 1-based month
  });

  const dailyMap = useMemo(
    () => computeDailyTotalsMap(sessions, resetHour),
    [sessions, resetHour]
  );

  const streakDays = useMemo(
    () => computeStreakDays(sessions, todayKey, resetHour),
    [sessions, todayKey, resetHour]
  );

  // Determine dayKeys included in the active period
  const periodDayKeys = useMemo(() => {
    if (period === 'day') {
      return new Set([selectedDayKey]);
    }
    if (period === 'week') {
      return new Set(getWeekDayKeys(selectedDayKey));
    }
    // Month
    const prefix = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-`;
    const keys = new Set<string>();
    const daysInMonth = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      keys.add(`${prefix}${String(d).padStart(2, '0')}`);
    }
    return keys;
  }, [period, selectedDayKey, calendarMonth]);

  const subjectTotals = useMemo(() => {
    return computeSubjectTotals(sessions, subjects, periodDayKeys, resetHour).sort(
      (a, b) => b.totalSeconds - a.totalSeconds
    );
  }, [sessions, subjects, periodDayKeys, resetHour]);

  const totalPeriodSeconds = useMemo(
    () => subjectTotals.reduce((acc, item) => acc + item.totalSeconds, 0),
    [subjectTotals]
  );

  const activeDaysInPeriod = useMemo(() => {
    let count = 0;
    for (const k of periodDayKeys) {
      if ((dailyMap.get(k) ?? 0) > 0) count += 1;
    }
    return count;
  }, [periodDayKeys, dailyMap]);

  const avgSecondsPerActiveDay =
    activeDaysInPeriod > 0 ? Math.round(totalPeriodSeconds / activeDaysInPeriod) : 0;

  const goalAchievedPct = useMemo(() => {
    const daysCount = period === 'day' ? 1 : Math.max(1, activeDaysInPeriod);
    const target = daysCount * dailyGoalHours * 3600;
    return Math.min(100, Math.round((totalPeriodSeconds / Math.max(1, target)) * 100));
  }, [period, activeDaysInPeriod, dailyGoalHours, totalPeriodSeconds]);

  const hourlyBuckets = useMemo(
    () => computeHourlyDistribution(sessions, periodDayKeys, resetHour),
    [sessions, periodDayKeys, resetHour]
  );
  const maxHourlySeconds = Math.max(1, ...hourlyBuckets);

  // Calendar grid cells for calendarMonth
  const calendarCells = useMemo(() => {
    const firstDay = new Date(Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1));
    const startWeekday = firstDay.getUTCDay(); // 0=Sun..6=Sat
    const daysInMonth = new Date(
      Date.UTC(calendarMonth.year, calendarMonth.month, 0)
    ).getUTCDate();

    const cells: Array<{ dayNum: number | null; dayKey: string | null; seconds: number }> = [];
    for (let i = 0; i < startWeekday; i++) {
      cells.push({ dayNum: null, dayKey: null, seconds: 0 });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${calendarMonth.year}-${String(calendarMonth.month).padStart(
        2,
        '0'
      )}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        dayKey: key,
        seconds: dailyMap.get(key) ?? 0,
      });
    }
    return cells;
  }, [calendarMonth, dailyMap]);

  const monthLabel = new Date(
    Date.UTC(calendarMonth.year, calendarMonth.month - 1, 1)
  ).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  const shiftMonth = (delta: number) => {
    setCalendarMonth((prev) => {
      const dt = new Date(Date.UTC(prev.year, prev.month - 1 + delta, 1));
      return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1 };
    });
  };

  const recentSessions = useMemo(() => {
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));
    return sessions
      .filter((s) => periodDayKeys.has(getStudyDayKey(s.startTime, resetHour)))
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 8)
      .map((s) => ({
        ...s,
        subject: subjectMap.get(s.subjectId),
      }));
  }, [sessions, subjects, periodDayKeys, resetHour]);

  return (
    <div className="max-w-[1240px] mx-auto space-y-6">
      {/* Top Toolbar: Period Switcher + Active Scope */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Analytics Period"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80"
        >
          {(['day', 'week', 'month'] as InsightsPeriod[]).map((p) => {
            const locked = p !== 'day' && !advancedInsightsUnlocked;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (locked) {
                    onRequestUnlock('advanced_insights');
                    return;
                  }
                  setPeriod(p);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                  period === p
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <span>{p}</span>
                {locked && <Lock className="w-3 h-3 text-neutral-400" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
            {period === 'day'
              ? `Viewing Day: ${selectedDayKey}`
              : period === 'week'
                ? `Week of ${selectedDayKey}`
                : monthLabel}
          </div>
          <button
            type="button"
            onClick={() =>
              advancedInsightsUnlocked
                ? onExportCsv()
                : onRequestUnlock('advanced_insights')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer whitespace-nowrap"
          >
            {advancedInsightsUnlocked ? (
              <Download className="w-3.5 h-3.5 text-orange-500" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4-Metric KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Total Study Time
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationHMS(totalPeriodSeconds)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Daily Avg (Active Days)
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {formatDurationShort(avgSecondsPerActiveDay)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Current Flame Streak
          </div>
          <div className="mt-1.5 flex items-center gap-2 font-mono tabular-nums text-2xl font-bold text-orange-600 dark:text-orange-400">
            <Flame className="w-5 h-5 fill-current" />
            <span>{streakDays} days</span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            Goal Achievement
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {goalAchievedPct}%
          </div>
        </div>
      </div>

      {/* Main 2-Column Insights: Monthly Flame Calendar + Subject Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* YPT Flame Heatmap Calendar */}
        <section className="lg:col-span-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Study Flame Calendar
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Click any date to inspect its daily breakdown
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold px-2 min-w-[110px] text-center text-neutral-800 dark:text-neutral-200">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-neutral-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell.dayNum || !cell.dayKey) {
                return <div key={idx} className="h-11" />;
              }
              const level = getHeatLevel(cell.seconds);
              const isSelected = cell.dayKey === selectedDayKey;
              return (
                <button
                  key={cell.dayKey}
                  type="button"
                  onClick={() => {
                    setSelectedDayKey(cell.dayKey!);
                    setPeriod('day');
                  }}
                  aria-label={`${cell.dayKey}: ${formatDurationShort(cell.seconds)}`}
                  className={`h-11 rounded-lg flex flex-col items-center justify-center transition-transform hover:scale-[1.03] cursor-pointer ${
                    HEAT_CLASSES[level]
                  } ${
                    isSelected
                      ? 'ring-2 ring-neutral-900 dark:ring-white ring-offset-1 dark:ring-offset-[#14171D]'
                      : ''
                  }`}
                >
                  <span className="font-mono tabular-nums text-xs font-semibold leading-none">
                    {cell.dayNum}
                  </span>
                  {cell.seconds > 0 && (
                    <span className="font-mono tabular-nums text-[10px] opacity-85 mt-0.5 leading-none">
                      {Math.floor(cell.seconds / 3600)}h
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>Flame Intensity:</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`w-4 h-4 rounded-sm inline-block ${HEAT_CLASSES[lvl]}`}
                title={
                  lvl === 0
                    ? '0h'
                    : lvl === 1
                      ? '<2h'
                      : lvl === 2
                        ? '2–5h'
                        : lvl === 3
                          ? '5–8h'
                          : '8h+'
                }
              />
            ))}
            <span>8h+</span>
          </div>
        </section>

        {/* Subject Distribution & Peak Focus Hours */}
        <div className="lg:col-span-6 space-y-6">
          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-4">
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Subject Breakdown
            </h2>
            {totalPeriodSeconds === 0 ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 py-4">
                No study sessions logged in this period yet.
              </p>
            ) : (
              <div className="space-y-3.5">
                {subjectTotals.map(({ subject, totalSeconds }) => {
                  const pct = Math.round((totalSeconds / Math.max(1, totalPeriodSeconds)) * 100);
                  return (
                    <div key={subject.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: subject.color }}
                          />
                          <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                            {subject.name}
                          </span>
                        </div>
                        <div className="font-mono tabular-nums text-neutral-600 dark:text-neutral-400 shrink-0">
                          {formatDurationShort(totalSeconds)} · {pct}%
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: subject.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 24-Hour Peak Focus Rhythm */}
          <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Hourly Focus Pattern
              </h2>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                00:00 – 23:00
              </span>
            </div>
            {!advancedInsightsUnlocked ? (
              <div className="py-5 px-4 rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 text-center space-y-2.5">
                <Lock className="w-5 h-5 text-orange-500 mx-auto" />
                <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto">
                  Unlock the 24-hour peak rhythm breakdown, Weekly &amp; Monthly analytics, and CSV exports.
                </p>
                <button
                  type="button"
                  onClick={() => onRequestUnlock('advanced_insights')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Unlock Advanced Insights</span>
                </button>
              </div>
            ) : (
              <>
                <div className="h-28 flex items-end gap-1 pt-2">
                  {hourlyBuckets.map((secs, hour) => {
                    const heightPct = secs > 0 ? Math.max(8, Math.round((secs / maxHourlySeconds) * 100)) : 2;
                    return (
                      <div
                        key={hour}
                        className="flex-1 flex flex-col items-center justify-end h-full group"
                        title={`${String(hour).padStart(2, '0')}:00 · ${formatDurationShort(secs)}`}
                      >
                        <div
                          className={`w-full rounded-t-xs transition-all ${
                            secs > 0
                              ? 'bg-orange-500/85 group-hover:bg-orange-500'
                              : 'bg-neutral-100 dark:bg-neutral-800'
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-mono tabular-nums text-neutral-400">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* Session History Table */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
            Session Logs
          </h2>
        </div>
        {recentSessions.length === 0 ? (
          <div className="px-6 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            No recorded study sessions for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2.5 px-6 font-medium">Subject</th>
                  <th className="py-2.5 px-4 font-medium">Note</th>
                  <th className="py-2.5 px-4 font-medium">Mode</th>
                  <th className="py-2.5 px-4 font-medium">Time</th>
                  <th className="py-2.5 px-6 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                {recentSessions.map((sess) => {
                  const dt = new Date(sess.startTime);
                  const timeStr = `${getStudyDayKey(sess.startTime, resetHour)} ${String(
                    dt.getHours()
                  ).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                  return (
                    <tr key={sess.id} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30">
                      <td className="py-3 px-6 font-medium text-neutral-900 dark:text-neutral-100">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: sess.subject?.color ?? '#9CA3AF' }}
                          />
                          <span>{sess.subject?.name ?? 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                        {sess.note || '—'}
                      </td>
                      <td className="py-3 px-4 capitalize text-xs text-neutral-500 dark:text-neutral-400">
                        {sess.mode}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
                        {timeStr}
                      </td>
                      <td className="py-3 px-6 font-mono tabular-nums text-right font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatDurationHMS(sess.durationSeconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
