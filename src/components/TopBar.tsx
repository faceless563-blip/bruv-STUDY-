import React from 'react';
import { Coins, Play, ShieldCheck } from 'lucide-react';
import { DDayTarget, TabId } from '../types/ypt';
import { calculateDDay } from '../utils/yptLogic';

interface TopBarProps {
  activeTab: TabId;
  todayKey: string;
  resetHour: number;
  pinnedDDay?: DDayTarget;
  focusGuardEnabled: boolean;
  coins: number;
  onOpenVault: () => void;
  onQuickStart: () => void;
}

const TAB_TITLES: Record<TabId, string> = {
  timer: 'Study Timer & Subjects',
  planner: '10-Minute Planner & To-Do',
  insights: 'Study Insights & Flame Calendar',
  groups: 'Virtual Study Groups',
  rankings: 'Global Category Rankings',
  vault: 'Challenges & Feature Vault',
  settings: 'Preferences & Focus Guard',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  todayKey,
  resetHour,
  pinnedDDay,
  focusGuardEnabled,
  coins,
  onOpenVault,
  onQuickStart,
}) => {
  const dday = pinnedDDay ? calculateDDay(pinnedDDay.targetDate, todayKey) : null;

  return (
    <header className="h-16 px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111318] flex items-center justify-between gap-8 shrink-0">
      {/* Zone 1: Current Section Title */}
      <h1 className="font-display font-semibold text-lg text-neutral-900 dark:text-neutral-100 whitespace-nowrap shrink-0">
        {TAB_TITLES[activeTab]}
      </h1>

      {/* Zone 2: Clean inline study-day & D-Day context */}
      <div className="hidden lg:flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
        <span className="font-mono tabular-nums">{todayKey}</span>
        <span aria-hidden="true">·</span>
        <span
          title="Your study day resets at this hour so late-night studying before then still counts toward today."
          className="cursor-help"
        >
          Day resets {String(resetHour).padStart(2, '0')}:00
        </span>
        {dday && pinnedDDay && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-neutral-700 dark:text-neutral-300 font-medium">
              {pinnedDDay.title}:{' '}
              <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 font-semibold">
                {dday.label}
              </span>
            </span>
          </>
        )}
        {focusGuardEnabled && (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-300">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
              Focus Guard Active
            </span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={onOpenVault}
          className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-neutral-800 dark:text-neutral-200 hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer"
        >
          <Coins className="w-3.5 h-3.5 text-orange-500" />
          <span>{coins} Coins</span>
        </button>
      </div>

      {/* Zone 3: Single Primary Action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onQuickStart}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start Focus</span>
        </button>
      </div>
    </header>
  );
};
