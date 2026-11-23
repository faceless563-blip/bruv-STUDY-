import React from 'react';
import {
  BarChart3,
  CalendarClock,
  Coins,
  Flame,
  LogIn,
  LogOut,
  Moon,
  Settings,
  Sun,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import { TabId, UserProfile } from '../types/ypt';
import { formatDurationShort } from '../utils/yptLogic';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  profile: UserProfile;
  todaySeconds: number;
  streakDays: number;
  coins: number;
  claimableCount: number;
  isFocusing: boolean;
  authUser: { uid: string; email: string | null; displayName: string | null } | null;
  authReady: boolean;
  isSigningIn?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'timer', label: 'Timer & Subjects', icon: Timer },
  { id: 'planner', label: '10-Min Planner', icon: CalendarClock },
  { id: 'insights', label: 'Insights & Flame', icon: BarChart3 },
  { id: 'groups', label: 'Study Groups', icon: Users },
  { id: 'rankings', label: 'Rankings', icon: Trophy },
  { id: 'vault', label: 'Challenges & Vault', icon: Coins },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  theme,
  onToggleTheme,
  profile,
  todaySeconds,
  streakDays,
  coins,
  claimableCount,
  isFocusing,
  authUser,
  authReady,
  isSigningIn = false,
  onSignIn,
  onSignOut,
}) => {
  const goalSeconds = profile.dailyGoalHours * 3600;
  const goalPct = Math.min(100, Math.round((todaySeconds / Math.max(1, goalSeconds)) * 100));

  return (
    <aside
      aria-label="Primary Navigation"
      className="w-[244px] shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111318] flex flex-col justify-between select-none"
    >
      <div>
        {/* Brand lockup */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white shadow-xs">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <span className="font-display font-bold text-base tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
              Bruv-study
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/12 dark:text-orange-400'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === 'vault' && claimableCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] font-bold text-orange-600 dark:text-orange-400">
                    {claimableCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Study Summary & Profile */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Daily Goal</span>
            <span className="font-mono tabular-nums text-neutral-800 dark:text-neutral-200 font-medium">
              {formatDurationShort(todaySeconds)} / {profile.dailyGoalHours}h
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Streak</span>
            <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 font-semibold">
              {streakDays} {streakDays === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>Bruv Coins</span>
            <button
              type="button"
              onClick={() => onSelectTab('vault')}
              className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100 font-semibold hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer"
            >
              {coins} Coins
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-neutral-900 dark:bg-neutral-700 text-white font-display font-semibold text-xs flex items-center justify-center shrink-0">
                {profile.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  {profile.name}
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {isFocusing ? 'Focusing now' : profile.category}
                </div>
              </div>
            </div>

            {authReady && authUser && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out of Google account"
                title={authUser.email ?? 'Sign out'}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {authReady && !authUser && (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={onSignIn}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-60 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer disabled:cursor-wait"
            >
              <LogIn className="w-3.5 h-3.5 text-orange-500" />
              <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          )}

          <PWAInstallButton variant="sidebar" />
        </div>
      </div>
    </aside>
  );
};
