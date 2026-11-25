import React from 'react';
import { Coins, PictureInPicture2, Play, ShieldCheck } from 'lucide-react';
import { DDayTarget, TabId } from '../types/ypt';
import { calculateDDay } from '../utils/yptLogic';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  activeTab: TabId;
  todayKey: string;
  resetHour: number;
  pinnedDDay?: DDayTarget;
  focusGuardEnabled: boolean;
  coins: number;
  widgetOpen: boolean;
  onToggleWidget: () => void;
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
  widgetOpen,
  onToggleWidget,
  onOpenVault,
  onQuickStart,
}) => {
  const dday = pinnedDDay ? calculateDDay(pinnedDDay.targetDate, todayKey) : null;

  return (
    <header className="h-16 px-4 sm:px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111318] flex items-center justify-between gap-3 sm:gap-8 shrink-0">
      {/* Zone 1: Current Section Title */}
      <h1 className="font-display font-semibold text-base sm:text-lg text-neutral-900 dark:text-neutral-100 truncate">
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

      {/* Zone 3: Desktop Widget + Install App + Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleWidget}
          aria-pressed={widgetOpen}
          aria-label="Desktop Widget"
          title="Launch floating always-on-top Desktop Widget"
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            widgetOpen
              ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-500/40 dark:bg-orange-500/15 dark:text-orange-300'
              : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
          }`}
        >
          <PictureInPicture2 className="w-3.5 h-3.5 text-orange-500" />
          <span className="hidden sm:inline">Desktop Widget</span>
          <span className="sm:hidden">Widget</span>
        </button>
        <PWAInstallButton variant="header" />
        <button
          type="button"
          onClick={onQuickStart}
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start Focus</span>
        </button>
      </div>
    </header>
  );
};
