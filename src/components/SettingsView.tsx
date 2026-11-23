import React, { useEffect, useState } from 'react';
import { Cloud, Lock, LogIn, LogOut, Palette, Plus, RotateCcw, ShieldCheck, X } from 'lucide-react';
import {
  AccentTheme,
  FeaturePackId,
  FocusGuardSettings,
  PomodoroConfig,
  STUDY_CATEGORIES,
  StudyCategory,
  UserProfile,
  WalletState,
} from '../types/ypt';
import { PWAInstallButton } from './PWAInstallButton';

const ACCENT_THEMES: Array<{ id: AccentTheme; label: string; swatch: string }> = [
  { id: 'orange', label: 'Flame Orange', swatch: '#F97316' },
  { id: 'cobalt', label: 'Cobalt Blue', swatch: '#2563EB' },
  { id: 'emerald', label: 'Forest Emerald', swatch: '#10B981' },
  { id: 'violet', label: 'Royal Violet', swatch: '#8B5CF6' },
];

interface SettingsViewProps {
  profile: UserProfile;
  pomodoro: PomodoroConfig;
  focusGuard: FocusGuardSettings;
  theme: 'light' | 'dark';
  wallet: WalletState;
  focusLockUnlocked: boolean;
  customPomodoroUnlocked: boolean;
  soundsThemesUnlocked: boolean;
  onUpdateProfile: (next: UserProfile) => void;
  onUpdatePomodoro: (next: PomodoroConfig) => void;
  onUpdateFocusGuard: (next: FocusGuardSettings) => void;
  onSelectAccentTheme: (accent: AccentTheme) => void;
  onRequestUnlock: (packId: FeaturePackId) => void;
  onToggleTheme: () => void;
  onResetAllData: () => void;
  authUser: { uid: string; email: string | null; displayName: string | null } | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  pomodoro,
  focusGuard,
  theme,
  wallet,
  focusLockUnlocked,
  customPomodoroUnlocked,
  soundsThemesUnlocked,
  onUpdateProfile,
  onUpdatePomodoro,
  onUpdateFocusGuard,
  onSelectAccentTheme,
  onRequestUnlock,
  onToggleTheme,
  onResetAllData,
  authUser,
  onSignIn,
  onSignOut,
}) => {
  const [name, setName] = useState(profile.name);
  const [category, setCategory] = useState<StudyCategory>(profile.category);
  const [dailyGoalHours, setDailyGoalHours] = useState(String(profile.dailyGoalHours));
  const [resetHour, setResetHour] = useState(String(profile.resetHour));
  const [motto, setMotto] = useState(profile.motto);

  const [focusMin, setFocusMin] = useState(String(pomodoro.focusMinutes));
  const [shortBreakMin, setShortBreakMin] = useState(String(pomodoro.shortBreakMinutes));
  const [longBreakMin, setLongBreakMin] = useState(String(pomodoro.longBreakMinutes));

  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    setName(profile.name);
    setCategory(profile.category);
    setDailyGoalHours(String(profile.dailyGoalHours));
    setResetHour(String(profile.resetHour));
    setMotto(profile.motto);
    setFocusMin(String(pomodoro.focusMinutes));
    setShortBreakMin(String(pomodoro.shortBreakMinutes));
    setLongBreakMin(String(pomodoro.longBreakMinutes));
  }, [profile, pomodoro]);

  const handleSaveProfileAndTimer = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: name.trim() || 'My Desk',
      category,
      dailyGoalHours: Math.min(18, Math.max(1, Number(dailyGoalHours) || 8)),
      resetHour: Math.min(11, Math.max(0, Number(resetHour) || 5)),
      motto: motto.trim(),
    });
    if (customPomodoroUnlocked) {
      onUpdatePomodoro({
        focusMinutes: Math.min(120, Math.max(5, Number(focusMin) || 25)),
        shortBreakMinutes: Math.min(30, Math.max(1, Number(shortBreakMin) || 5)),
        longBreakMinutes: Math.min(60, Math.max(5, Number(longBreakMin) || 15)),
        cyclesBeforeLongBreak: pomodoro.cyclesBeforeLongBreak,
      });
    }
    setSavedNotice('Settings saved.');
    window.setTimeout(() => setSavedNotice(''), 2500);
  };

  const handleAddAllowedTool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusLockUnlocked) {
      onRequestUnlock('focus_lock');
      return;
    }
    const trimmed = newAllowedTool.trim();
    if (!trimmed) return;
    if (!focusGuard.allowedTools.includes(trimmed)) {
      onUpdateFocusGuard({
        ...focusGuard,
        allowedTools: [...focusGuard.allowedTools, trimmed],
      });
    }
    setNewAllowedTool('');
  };

  const handleRemoveAllowedTool = (tool: string) => {
    onUpdateFocusGuard({
      ...focusGuard,
      allowedTools: focusGuard.allowedTools.filter((t) => t !== tool),
    });
  };

  return (
    <div className="max-w-[960px] mx-auto space-y-6">
      {/* Cloud Sync Account Card */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Cloud className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Firebase Cloud Sync
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {authUser
                ? `Signed in as ${authUser.displayName || authUser.email || 'Google Account'}${authUser.email ? ` (${authUser.email})` : ''}. Your subjects, study logs, tasks, and wallet sync automatically.`
                : 'Sign in with Google to save and sync your subjects, study hours, tasks, and feature unlocks across devices.'}
            </p>
          </div>
        </div>
        {authUser ? (
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onSignIn}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign in with Google</span>
          </button>
        )}
      </section>

      {/* Desktop App Installation */}
      <PWAInstallButton variant="card" />

      {/* Profile & Study Cycle Settings */}
      <form
        onSubmit={handleSaveProfileAndTimer}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div>
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Profile &amp; Daily Reset Cycle
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Set your display name, ranking category, daily target, and when your study day resets.
            </p>
          </div>
          {savedNotice && (
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
              {savedNotice}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-name" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              Display Name
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            />
          </div>
          <div>
            <label htmlFor="settings-category" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              Ranking Category
            </label>
            <select
              id="settings-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as StudyCategory)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
            >
              {STUDY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="settings-goal" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              Daily Study Goal (Hours)
            </label>
            <input
              id="settings-goal"
              type="number"
              min={1}
              max={18}
              value={dailyGoalHours}
              onChange={(e) => setDailyGoalHours(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="settings-reset" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
              Daily Reset Hour (0–11 AM)
            </label>
            <input
              id="settings-reset"
              type="number"
              min={0}
              max={11}
              value={resetHour}
              onChange={(e) => setResetHour(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono tabular-nums"
            />
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              When your study clock resets to 00:00:00 (default 5 AM). If you study late at 1 AM, it still counts toward today instead of starting a new day at midnight.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="settings-motto" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
            Desk Motto
          </label>
          <input
            id="settings-motto"
            type="text"
            value={motto}
            onChange={(e) => setMotto(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          />
        </div>

        {/* Pomodoro Intervals */}
        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              Pomodoro Intervals (Minutes)
            </h3>
            {!customPomodoroUnlocked && (
              <button
                type="button"
                onClick={() => onRequestUnlock('custom_pomodoro')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Unlock Custom Intervals &amp; Chime (150 Coins)</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="pomo-focus" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Focus Block
              </label>
              <input
                id="pomo-focus"
                type="number"
                min={5}
                max={120}
                disabled={!customPomodoroUnlocked}
                value={customPomodoroUnlocked ? focusMin : '25'}
                onChange={(e) => setFocusMin(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 disabled:opacity-50 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="pomo-short" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Short Break
              </label>
              <input
                id="pomo-short"
                type="number"
                min={1}
                max={30}
                disabled={!customPomodoroUnlocked}
                value={customPomodoroUnlocked ? shortBreakMin : '5'}
                onChange={(e) => setShortBreakMin(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 disabled:opacity-50 text-sm font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="pomo-long" className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1">
                Long Break
              </label>
              <input
                id="pomo-long"
                type="number"
                min={5}
                max={60}
                disabled={!customPomodoroUnlocked}
                value={customPomodoroUnlocked ? longBreakMin : '15'}
                onChange={(e) => setLongBreakMin(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 disabled:opacity-50 text-sm font-mono tabular-nums"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </form>

      {/* Desktop Focus Guard & Allowed Tools */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Desktop Focus Guard &amp; Allowed Tools
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Automatically pauses your study timer if you switch browser tabs during a focus session, and documents your approved reference tools.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!focusLockUnlocked) {
                onRequestUnlock('focus_lock');
                return;
              }
              onUpdateFocusGuard({
                ...focusGuard,
                autoPauseOnTabSwitch: !focusGuard.autoPauseOnTabSwitch,
              });
            }}
            aria-pressed={focusLockUnlocked && focusGuard.autoPauseOnTabSwitch}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 ${
              focusLockUnlocked && focusGuard.autoPauseOnTabSwitch
                ? 'bg-orange-500 text-white'
                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
            }`}
          >
            {!focusLockUnlocked && <Lock className="w-3.5 h-3.5 text-neutral-400" />}
            <span>
              {!focusLockUnlocked
                ? 'Locked (250 Coins)'
                : focusGuard.autoPauseOnTabSwitch
                  ? 'Enabled'
                  : 'Disabled'}
            </span>
          </button>
        </div>

        <form onSubmit={handleAddAllowedTool} className="flex gap-2">
          <label htmlFor="allowed-tool-input" className="sr-only">
            Add Allowed Tool
          </label>
          <input
            id="allowed-tool-input"
            type="text"
            value={newAllowedTool}
            onChange={(e) => setNewAllowedTool(e.target.value)}
            placeholder="Add approved study tool (e.g. Obsidian, Zotero, WolframAlpha)..."
            className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            {focusLockUnlocked ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span>Add Tool</span>
          </button>
        </form>

        {focusGuard.allowedTools.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">
            No allowed tools added yet. Add reference tools you permit during Focus Lock.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {focusGuard.allowedTools.map((tool) => (
              <li key={tool} className="py-2.5 flex items-center justify-between text-sm">
                <span className="text-neutral-800 dark:text-neutral-200">{tool}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAllowedTool(tool)}
                  aria-label={`Remove ${tool}`}
                  className="p-1 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Appearance, Custom Accent Themes & Reset */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Appearance &amp; Local Storage
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Current theme: <strong className="capitalize">{theme}</strong> · All study sessions and tasks persist locally in your browser.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleTheme}
              className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium cursor-pointer"
            >
              Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
            <button
              type="button"
              onClick={onResetAllData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear All Data</span>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Workspace Accent Theme
              </span>
            </div>
            {!soundsThemesUnlocked && (
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Custom palettes require Ambient Sounds &amp; Themes Pack
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ACCENT_THEMES.map((item) => {
              const locked = item.id !== 'orange' && !soundsThemesUnlocked;
              const active = wallet.accentTheme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    locked ? onRequestUnlock('sounds_themes') : onSelectAccentTheme(item.id)
                  }
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-orange-500 bg-orange-50/70 dark:bg-orange-500/10 text-neutral-900 dark:text-neutral-100'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {locked && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
