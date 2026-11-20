import React, { useMemo, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { RankingEntry, STUDY_CATEGORIES, StudyCategory } from '../types/ypt';
import { buildLeaderboard, formatDurationHMS } from '../utils/yptLogic';

interface RankingsViewProps {
  entries: RankingEntry[];
  userName: string;
  userCategory: StudyCategory;
  userDailySeconds: number;
  userWeeklySeconds: number;
  userMonthlySeconds: number;
  userStreakDays: number;
  isFocusing: boolean;
}

const CATEGORY_FILTERS: Array<StudyCategory | 'All'> = ['All', ...STUDY_CATEGORIES];

export const RankingsView: React.FC<RankingsViewProps> = ({
  entries,
  userName,
  userCategory,
  userDailySeconds,
  userWeeklySeconds,
  userMonthlySeconds,
  userStreakDays,
  isFocusing,
}) => {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [categoryFilter, setCategoryFilter] = useState<StudyCategory | 'All'>(userCategory);

  const userEntry: RankingEntry = useMemo(
    () => ({
      id: 'current-user',
      name: userName,
      category: userCategory,
      status: isFocusing ? 'studying' : 'resting',
      dailySeconds: userDailySeconds,
      weeklySeconds: userWeeklySeconds,
      monthlySeconds: userMonthlySeconds,
      streakDays: userStreakDays,
    }),
    [
      userName,
      userCategory,
      isFocusing,
      userDailySeconds,
      userWeeklySeconds,
      userMonthlySeconds,
      userStreakDays,
    ]
  );

  const { rows, userRank } = useMemo(
    () => buildLeaderboard(entries, userEntry, period, categoryFilter),
    [entries, userEntry, period, categoryFilter]
  );

  const myRow = rows.find((r) => r.isCurrentUser);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Filter & Period Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="ranking-category-select"
            className="text-xs font-medium text-neutral-600 dark:text-neutral-400 whitespace-nowrap"
          >
            Category:
          </label>
          <select
            id="ranking-category-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as StudyCategory | 'All')}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            {CATEGORY_FILTERS.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'All' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>

        <div
          role="group"
          aria-label="Ranking Period"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80"
        >
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                period === p
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
              }`}
            >
              {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* Pinned My Rank Banner */}
      {myRow && (
        <section className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-orange-500/10 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg bg-orange-500 text-white flex items-center justify-center font-mono tabular-nums font-bold text-lg">
              #{userRank}
            </div>
            <div>
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                Your {period} standing in {categoryFilter}
              </div>
              <div className="font-display font-bold text-lg text-neutral-900 dark:text-neutral-100">
                {userName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">Streak</div>
              <div className="font-mono tabular-nums text-sm font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 fill-current" />
                <span>{userStreakDays}d</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {period.charAt(0).toUpperCase() + period.slice(1)} Study Time
              </div>
              <div className="font-mono tabular-nums text-xl font-bold text-neutral-900 dark:text-neutral-100">
                {formatDurationHMS(myRow.periodSeconds)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* High-Density Leaderboard Table */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-orange-500" />
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Category Leaderboard
            </h2>
          </div>
          <span className="font-mono tabular-nums text-xs text-neutral-500 dark:text-neutral-400">
            {rows.length} learners
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400">
              <tr>
                <th className="py-2.5 px-6 font-medium w-20">Rank</th>
                <th className="py-2.5 px-4 font-medium">Student</th>
                <th className="py-2.5 px-4 font-medium">Category</th>
                <th className="py-2.5 px-4 font-medium">Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Streak</th>
                <th className="py-2.5 px-6 font-medium text-right">Study Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.isCurrentUser
                      ? 'bg-orange-50/40 dark:bg-orange-500/8 font-medium'
                      : 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30'
                  }
                >
                  <td className="py-3 px-6 font-mono tabular-nums font-bold text-neutral-800 dark:text-neutral-200">
                    {row.rank <= 3 ? (
                      <span className="text-orange-600 dark:text-orange-400">#{row.rank}</span>
                    ) : (
                      `#${row.rank}`
                    )}
                  </td>
                  <td className="py-3 px-4 text-neutral-900 dark:text-neutral-100">
                    {row.name}
                    {row.isCurrentUser ? ' (You)' : ''}
                  </td>
                  <td className="py-3 px-4 text-xs text-neutral-500 dark:text-neutral-400">
                    {row.category}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <span
                      className={
                        row.status === 'studying'
                          ? 'text-orange-600 dark:text-orange-400 font-medium'
                          : row.status === 'resting'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-neutral-400'
                      }
                    >
                      {row.status === 'studying'
                        ? `Studying${row.currentSubject ? ` · ${row.currentSubject}` : ''}`
                        : row.status === 'resting'
                          ? 'Resting'
                          : 'Offline'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-xs text-neutral-600 dark:text-neutral-400">
                    {row.streakDays}d
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums text-right font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHMS(row.periodSeconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
