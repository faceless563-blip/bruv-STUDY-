import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Edit3,
  Lock,
  Pin,
  Play,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import {
  DDayTarget,
  FeaturePackId,
  FocusGuardSettings,
  Subject,
  TimerMode,
  TodoItem,
} from '../types/ypt';
import {
  calculateDDay,
  formatDurationHMS,
  formatDurationShort,
} from '../utils/yptLogic';
import { SUBJECT_COLOR_PALETTE } from '../data/seedData';

interface TimerHomeViewProps {
  todayKey: string;
  todayTotalSeconds: number;
  dailyGoalHours: number;
  subjects: Subject[];
  subjectTodaySeconds: Map<string, number>;
  todos: TodoItem[];
  ddays: DDayTarget[];
  activeTimerMode: TimerMode;
  focusGuard: FocusGuardSettings;
  focusLockUnlocked: boolean;
  motto: string;
  onChangeTimerMode: (mode: TimerMode) => void;
  onStartSubject: (subjectId: string) => void;
  onAddSubject: (name: string, color: string, dailyTargetMinutes: number) => void;
  onUpdateSubject: (id: string, name: string, color: string, dailyTargetMinutes: number) => void;
  onDeleteSubject: (id: string) => void;
  onAddDDay: (title: string, targetDate: string) => void;
  onDeleteDDay: (id: string) => void;
  onPinDDay: (id: string) => void;
  onToggleFocusGuard: () => void;
  onNavigateTab: (tab: 'planner' | 'settings') => void;
  onRequestUnlock: (packId: FeaturePackId) => void;
}

export const TimerHomeView: React.FC<TimerHomeViewProps> = ({
  todayKey,
  todayTotalSeconds,
  dailyGoalHours,
  subjects,
  subjectTodaySeconds,
  todos,
  ddays,
  activeTimerMode,
  focusGuard,
  focusLockUnlocked,
  motto,
  onChangeTimerMode,
  onStartSubject,
  onAddSubject,
  onUpdateSubject,
  onDeleteSubject,
  onAddDDay,
  onDeleteDDay,
  onPinDDay,
  onToggleFocusGuard,
  onNavigateTab,
  onRequestUnlock,
}) => {
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [subjectColor, setSubjectColor] = useState(SUBJECT_COLOR_PALETTE[0]);
  const [subjectTargetMin, setSubjectTargetMin] = useState('90');
  const [subjectError, setSubjectError] = useState('');

  const [showDDayForm, setShowDDayForm] = useState(false);
  const [ddayTitle, setDDayTitle] = useState('');
  const [ddayDate, setDDayDate] = useState('');
  const [ddayError, setDDayError] = useState('');

  const goalSeconds = dailyGoalHours * 3600;
  const goalPct = Math.min(100, Math.round((todayTotalSeconds / Math.max(1, goalSeconds)) * 100));

  const todayTodos = todos.filter((t) => t.studyDayKey === todayKey);
  const completedTodos = todayTodos.filter((t) => t.completed).length;

  const openNewSubjectForm = () => {
    setEditingSubjectId(null);
    setSubjectName('');
    setSubjectColor(SUBJECT_COLOR_PALETTE[subjects.length % SUBJECT_COLOR_PALETTE.length]);
    setSubjectTargetMin('90');
    setSubjectError('');
    setShowSubjectForm(true);
  };

  const openEditSubjectForm = (subj: Subject) => {
    setEditingSubjectId(subj.id);
    setSubjectName(subj.name);
    setSubjectColor(subj.color);
    setSubjectTargetMin(String(subj.dailyTargetMinutes));
    setSubjectError('');
    setShowSubjectForm(true);
  };

  const handleSaveSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = subjectName.trim();
    const mins = Number(subjectTargetMin);
    if (!trimmed) {
      setSubjectError('Enter a subject name.');
      return;
    }
    if (!Number.isFinite(mins) || mins < 10 || mins > 720) {
      setSubjectError('Daily target must be between 10 and 720 minutes.');
      return;
    }
    if (editingSubjectId) {
      onUpdateSubject(editingSubjectId, trimmed, subjectColor, mins);
    } else {
      onAddSubject(trimmed, subjectColor, mins);
    }
    setShowSubjectForm(false);
    setSubjectName('');
    setEditingSubjectId(null);
  };

  const handleSaveDDay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ddayTitle.trim()) {
      setDDayError('Enter an exam or milestone title.');
      return;
    }
    if (!ddayDate) {
      setDDayError('Select a target date.');
      return;
    }
    onAddDDay(ddayTitle.trim(), ddayDate);
    setDDayTitle('');
    setDDayDate('');
    setDDayError('');
    setShowDDayForm(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Hero Daily Timer & Mode Strip */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-neutral-500 dark:text-neutral-400">
              <span>Today&apos;s Total Study Time</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{goalPct}% of {dailyGoalHours}h goal</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onNavigateTab('planner')}
                className="text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                {completedTodos}/{todayTodos.length} tasks done
              </button>
            </div>
            <div
              data-testid="today-total-clock"
              className="font-mono tabular-nums font-bold text-5xl lg:text-6xl tracking-tight text-neutral-900 dark:text-neutral-50"
            >
              {formatDurationHMS(todayTotalSeconds)}
            </div>
            {motto ? (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xl">
                {motto}
              </p>
            ) : (
              <p className="text-sm text-neutral-400 dark:text-neutral-500 max-w-xl">
                Add a subject below and press play to begin logging your study hours.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end gap-3 shrink-0">
            {/* Segmented Mode Control */}
            <div
              role="group"
              aria-label="Timer Mode"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80"
            >
              <button
                type="button"
                onClick={() => onChangeTimerMode('stopwatch')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTimerMode === 'stopwatch'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Stopwatch
              </button>
              <button
                type="button"
                onClick={() => onChangeTimerMode('pomodoro')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  activeTimerMode === 'pomodoro'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                Pomodoro
              </button>
            </div>

            {/* Focus Guard Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!focusLockUnlocked) {
                    onRequestUnlock('focus_lock');
                    return;
                  }
                  onToggleFocusGuard();
                }}
                aria-pressed={focusLockUnlocked && focusGuard.autoPauseOnTabSwitch}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  focusLockUnlocked && focusGuard.autoPauseOnTabSwitch
                    ? 'border-orange-200 bg-orange-50/80 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300'
                    : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                {focusLockUnlocked ? (
                  <Shield className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-orange-500" />
                )}
                <span>
                  {focusLockUnlocked
                    ? `Focus Guard: ${focusGuard.autoPauseOnTabSwitch ? 'On' : 'Off'}`
                    : 'Focus Guard (Locked)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!focusLockUnlocked) {
                    onRequestUnlock('focus_lock');
                    return;
                  }
                  onNavigateTab('settings');
                }}
                className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 underline-offset-4 hover:underline whitespace-nowrap cursor-pointer"
              >
                {!focusLockUnlocked && <Lock className="w-3 h-3 text-neutral-400" />}
                <span>
                  {focusLockUnlocked
                    ? `Allowed Tools (${focusGuard.allowedTools.length})`
                    : 'Allowed Tools (Locked)'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Daily Goal Progress Bar */}
        <div className="mt-6 pt-5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center gap-4">
          <div className="flex-1 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${goalPct}%` }}
            />
          </div>
          <span className="font-mono tabular-nums text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
            {formatDurationShort(todayTotalSeconds)} / {dailyGoalHours}h 00m
          </span>
        </div>
      </section>

      {/* Main 2-Column Workspace: Subjects (Left/Main) + D-Day Countdowns (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Subjects Column */}
        <section className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D]">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Subjects
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Select a subject to start a {activeTimerMode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'} focus session
              </p>
            </div>
            <button
              type="button"
              onClick={openNewSubjectForm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subject</span>
            </button>
          </div>

          {showSubjectForm && (
            <form
              onSubmit={handleSaveSubject}
              className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  {editingSubjectId ? 'Edit Subject' : 'New Subject'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSubjectForm(false)}
                  aria-label="Close subject form"
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-6">
                  <label
                    htmlFor="subject-name-input"
                    className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                  >
                    Subject Name
                  </label>
                  <input
                    id="subject-name-input"
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="e.g. Organic Chemistry"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label
                    htmlFor="subject-target-input"
                    className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                  >
                    Daily Target (min)
                  </label>
                  <input
                    id="subject-target-input"
                    type="number"
                    min={10}
                    max={720}
                    value={subjectTargetMin}
                    onChange={(e) => setSubjectTargetMin(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono tabular-nums text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                  />
                </div>
                <div className="sm:col-span-3 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {editingSubjectId ? 'Save Changes' : 'Create Subject'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">Color:</span>
                {SUBJECT_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setSubjectColor(hex)}
                    aria-label={`Select color ${hex}`}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-transform cursor-pointer ${
                      subjectColor === hex ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white dark:ring-offset-neutral-900 scale-105' : ''
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {subjectColor === hex && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>
              {subjectError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {subjectError}
                </p>
              )}
            </form>
          )}

          {subjects.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                No study subjects yet. Add your first subject to start tracking hours.
              </p>
              <button
                type="button"
                onClick={openNewSubjectForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Subject</span>
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {subjects.map((subj) => {
                const secs = subjectTodaySeconds.get(subj.id) ?? 0;
                const targetSecs = subj.dailyTargetMinutes * 60;
                const pct = Math.min(100, Math.round((secs / Math.max(1, targetSecs)) * 100));
                const openTasks = todayTodos.filter(
                  (t) => t.subjectId === subj.id && !t.completed
                ).length;

                return (
                  <li
                    key={subj.id}
                    className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onStartSubject(subj.id)}
                        aria-label={`Start ${subj.name}`}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0 transition-transform hover:scale-105 cursor-pointer"
                        style={{ backgroundColor: subj.color }}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate">
                            {subj.name}
                          </span>
                          <span className="font-mono tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">
                            {formatDurationHMS(secs)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full transition-all duration-300"
                              style={{ width: `${pct}%`, backgroundColor: subj.color }}
                            />
                          </div>
                          <span className="text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap font-mono tabular-nums">
                            {pct}% · {subj.dailyTargetMinutes}m goal
                            {openTasks > 0 ? ` · ${openTasks} open` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditSubjectForm(subj)}
                        aria-label={`Edit ${subj.name}`}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSubject(subj.id)}
                        aria-label={`Delete ${subj.name}`}
                        className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* D-Day Countdowns Column */}
        <section className="lg:col-span-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D]">
          <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                D-Day Countdowns
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!focusLockUnlocked && ddays.length >= 1) {
                  onRequestUnlock('focus_lock');
                  return;
                }
                setShowDDayForm((v) => !v);
                setDDayError('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors whitespace-nowrap cursor-pointer"
            >
              {!focusLockUnlocked && ddays.length >= 1 ? (
                <Lock className="w-3.5 h-3.5 text-orange-500" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>{!focusLockUnlocked && ddays.length >= 1 ? 'Unlock Extra' : 'Add'}</span>
            </button>
          </div>

          {showDDayForm && (
            <form
              onSubmit={handleSaveDDay}
              className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/40 space-y-3"
            >
              <div>
                <label
                  htmlFor="dday-title-input"
                  className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                >
                  Target Exam or Milestone
                </label>
                <input
                  id="dday-title-input"
                  type="text"
                  value={ddayTitle}
                  onChange={(e) => setDDayTitle(e.target.value)}
                  placeholder="e.g. Bar Exam Day 1"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              <div>
                <label
                  htmlFor="dday-date-input"
                  className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                >
                  Target Date
                </label>
                <input
                  id="dday-date-input"
                  type="date"
                  value={ddayDate}
                  onChange={(e) => setDDayDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              {ddayError && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {ddayError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDDayForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
                >
                  Save D-Day
                </button>
              </div>
            </form>
          )}

          {ddays.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No D-Days configured. Pin an exam date to keep it visible in your header.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {ddays.map((item) => {
                const { label, diffDays } = calculateDDay(item.targetDate, todayKey);
                return (
                  <li
                    key={item.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                        {item.targetDate}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono tabular-nums text-sm font-bold ${
                          diffDays >= 0 && diffDays <= 7
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-neutral-800 dark:text-neutral-200'
                        }`}
                      >
                        {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => onPinDDay(item.id)}
                        aria-label={`Pin ${item.title} to header`}
                        aria-pressed={Boolean(item.isPinned)}
                        className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                          item.isPinned
                            ? 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-500/15'
                            : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                        }`}
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDDay(item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
