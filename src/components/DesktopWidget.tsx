import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar,
  Flame,
  GripHorizontal,
  Moon,
  Play,
  Plus,
  Sun,
  X,
} from 'lucide-react';
import { AccentTheme, AppState, Subject } from '../types/ypt';
import {
  computeWidgetStats,
  detectWidgetLaunchSupport,
} from '../utils/widgetLogic';
import { formatDurationHMS, formatDurationShort } from '../utils/yptLogic';

interface DocumentPictureInPictureApi {
  requestWindow: (options?: {
    width?: number;
    height?: number;
  }) => Promise<Window>;
  window?: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPictureApi;
  }
}

export type DesktopWidgetMode = 'closed' | 'pip' | 'floating';

interface DesktopWidgetControllerProps {
  mode: DesktopWidgetMode;
  pipContainer: HTMLElement | null;
  pipWindow: Window | null;
  state: AppState;
  liveFocusSeconds: number;
  activeSubject: Subject | null;
  selectedDDayId: string | null;
  onSelectDDayId: (id: string) => void;
  onAddDDay: (title: string, targetDate: string) => void;
  onStartSubject: (subjectId: string) => void;
  onOpenQuickStart: () => void;
  onToggleTheme: () => void;
  onClose: () => void;
}

export async function openDocumentPipWindow(
  theme: 'light' | 'dark',
  accentTheme: AccentTheme
): Promise<{ pipWindow: Window; container: HTMLElement } | null> {
  if (typeof window === 'undefined') return null;
  if (detectWidgetLaunchSupport(window) !== 'document-pip') {
    return null;
  }
  const api = window.documentPictureInPicture;
  if (!api) return null;

  try {
    const pipWin = await api.requestWindow({ width: 360, height: 328 });
    pipWin.document.title = 'Bruv-study Widget';

    // Clone stylesheets and font links so Tailwind v4 + typography match main app
    const headNodes = document.querySelectorAll('style, link[rel="stylesheet"]');
    headNodes.forEach((node) => {
      pipWin.document.head.appendChild(node.cloneNode(true));
    });

    syncPipDocumentTheme(pipWin, theme, accentTheme);

    pipWin.document.body.style.margin = '0';
    pipWin.document.body.style.overflow = 'hidden';

    const container = pipWin.document.createElement('div');
    container.id = 'bruv-pip-widget-root';
    container.style.width = '100%';
    container.style.height = '100vh';
    pipWin.document.body.appendChild(container);

    return { pipWindow: pipWin, container };
  } catch {
    // Embedded browsing contexts or blocked PiP policies fall back cleanly
    return null;
  }
}

export function syncPipDocumentTheme(
  pipWin: Window | null,
  theme: 'light' | 'dark',
  accentTheme: AccentTheme
): void {
  if (!pipWin || pipWin.closed) return;
  const root = pipWin.document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  if (accentTheme === 'orange') {
    root.removeAttribute('data-accent');
  } else {
    root.setAttribute('data-accent', accentTheme);
  }
}

export const DesktopWidgetController: React.FC<DesktopWidgetControllerProps> = ({
  mode,
  pipContainer,
  pipWindow,
  state,
  liveFocusSeconds,
  activeSubject,
  selectedDDayId,
  onSelectDDayId,
  onAddDDay,
  onStartSubject,
  onOpenQuickStart,
  onToggleTheme,
  onClose,
}) => {
  const [floatingPos, setFloatingPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mode === 'pip' && pipWindow) {
      syncPipDocumentTheme(
        pipWindow,
        state.theme,
        state.wallet?.accentTheme ?? 'orange'
      );
    }
  }, [mode, pipWindow, state.theme, state.wallet?.accentTheme]);

  useEffect(() => {
    if (mode !== 'floating') {
      setFloatingPos(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const width = cardRef.current?.offsetWidth ?? 348;
      const height = cardRef.current?.offsetHeight ?? 330;
      const maxX = Math.max(12, window.innerWidth - width - 12);
      const maxY = Math.max(12, window.innerHeight - height - 12);
      const nextX = Math.min(maxX, Math.max(12, drag.origX + (e.clientX - drag.startX)));
      const nextY = Math.min(maxY, Math.max(12, drag.origY + (e.clientY - drag.startY)));
      setFloatingPos({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [mode]);

  if (mode === 'closed') return null;

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== 'floating') return;
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
  };

  const card = (
    <DesktopWidgetCard
      mode={mode}
      state={state}
      liveFocusSeconds={liveFocusSeconds}
      activeSubject={activeSubject}
      selectedDDayId={selectedDDayId}
      onSelectDDayId={onSelectDDayId}
      onAddDDay={onAddDDay}
      onStartSubject={(subjId) => {
        if (mode === 'pip') {
          window.focus();
        }
        onStartSubject(subjId);
      }}
      onOpenQuickStart={() => {
        if (mode === 'pip') {
          window.focus();
        }
        onOpenQuickStart();
      }}
      onReturnToApp={() => {
        window.focus();
        if (mode === 'floating') {
          onClose();
        }
      }}
      onToggleTheme={onToggleTheme}
      onClose={onClose}
      onHeaderPointerDown={startDrag}
    />
  );

  if (mode === 'pip' && pipContainer) {
    return createPortal(card, pipContainer);
  }

  return (
    <div
      ref={cardRef}
      data-testid="desktop-widget-floating"
      style={
        floatingPos
          ? { left: `${floatingPos.x}px`, top: `${floatingPos.y}px` }
          : undefined
      }
      className={`fixed z-[60] w-[348px] max-w-[calc(100vw-24px)] rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden ${
        floatingPos ? '' : 'bottom-5 right-5'
      }`}
    >
      {card}
    </div>
  );
};

interface DesktopWidgetCardProps {
  mode: DesktopWidgetMode;
  state: AppState;
  liveFocusSeconds: number;
  activeSubject: Subject | null;
  selectedDDayId: string | null;
  onSelectDDayId: (id: string) => void;
  onAddDDay: (title: string, targetDate: string) => void;
  onStartSubject: (subjectId: string) => void;
  onOpenQuickStart: () => void;
  onReturnToApp: () => void;
  onToggleTheme: () => void;
  onClose: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

const DesktopWidgetCard: React.FC<DesktopWidgetCardProps> = ({
  mode,
  state,
  liveFocusSeconds,
  activeSubject,
  selectedDDayId,
  onSelectDDayId,
  onAddDDay,
  onStartSubject,
  onOpenQuickStart,
  onReturnToApp,
  onToggleTheme,
  onClose,
  onHeaderPointerDown,
}) => {
  const [quickSubjId, setQuickSubjId] = useState<string>(
    state.subjects[0]?.id ?? ''
  );
  const [showAddDDay, setShowAddDDay] = useState(false);
  const [ddayTitle, setDDayTitle] = useState('');
  const [ddayDate, setDDayDate] = useState('');
  const [ddayError, setDDayError] = useState('');

  useEffect(() => {
    if (state.subjects.length === 0) {
      setQuickSubjId('');
      return;
    }
    if (!state.subjects.some((s) => s.id === quickSubjId)) {
      setQuickSubjId(state.subjects[0].id);
    }
  }, [state.subjects, quickSubjId]);

  const stats = useMemo(
    () =>
      computeWidgetStats({
        state,
        nowMs: Date.now(),
        liveFocusSeconds,
        selectedDDayId,
      }),
    [state, liveFocusSeconds, selectedDDayId]
  );

  const handleCreateDDay = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = ddayTitle.trim();
    if (!trimmed) {
      setDDayError('Enter a D-Day title.');
      return;
    }
    if (!ddayDate) {
      setDDayError('Pick a date.');
      return;
    }
    onAddDDay(trimmed, ddayDate);
    setDDayTitle('');
    setDDayDate('');
    setDDayError('');
    setShowAddDDay(false);
  };

  return (
    <section
      data-testid="desktop-widget-card"
      aria-label="Bruv-study Desktop Widget"
      className={`w-full flex flex-col bg-white dark:bg-[#111318] text-neutral-900 dark:text-neutral-100 select-none ${
        mode === 'pip' ? 'min-h-screen' : ''
      }`}
    >
      {/* Header Strip */}
      <div
        onPointerDown={onHeaderPointerDown}
        className={`px-3.5 py-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 bg-neutral-50/80 dark:bg-[#14171D] ${
          mode === 'floating' ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
            <Flame className="w-3 h-3 text-white fill-current" />
          </div>
          <span className="font-display font-semibold text-xs tracking-tight truncate">
            Bruv-study
          </span>
          {activeSubject ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Focusing
            </span>
          ) : (
            <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate">
              {mode === 'pip' ? 'Always on Top' : 'Widget'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {mode === 'floating' && (
            <GripHorizontal
              className="w-3.5 h-3.5 text-neutral-400 mr-0.5"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              state.theme === 'dark'
                ? 'Switch widget to light theme'
                : 'Switch widget to dark theme'
            }
            className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {state.theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Desktop Widget"
            className="p-1 rounded-md text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/70 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Widget Body */}
      <div
        className={`p-3.5 space-y-3 flex-1 ${
          mode === 'pip'
            ? 'flex flex-col justify-center max-w-lg w-full mx-auto'
            : ''
        }`}
      >
        {/* 1. D-Day Countdown Hero */}
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-[#14171D] p-3">
          {showAddDDay ? (
            <form onSubmit={handleCreateDDay} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  Pin D-Day Countdown
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddDDay(false);
                    setDDayError('');
                  }}
                  aria-label="Cancel D-Day form"
                  className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  value={ddayTitle}
                  onChange={(e) => setDDayTitle(e.target.value)}
                  placeholder="Exam title"
                  aria-label="D-Day title"
                  className="col-span-7 px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
                <input
                  type="date"
                  value={ddayDate}
                  onChange={(e) => setDDayDate(e.target.value)}
                  aria-label="D-Day target date"
                  className="col-span-5 px-2 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px] font-mono text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>
              {ddayError && (
                <p className="text-[11px] text-red-600 dark:text-red-400" role="alert">
                  {ddayError}
                </p>
              )}
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium cursor-pointer"
                >
                  Save D-Day
                </button>
              </div>
            </form>
          ) : stats.selectedDDay ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <Calendar className="w-3 h-3 text-orange-500 shrink-0" />
                  {state.ddays.length > 1 ? (
                    <select
                      aria-label="Select widget D-Day"
                      value={stats.selectedDDay.id}
                      onChange={(e) => onSelectDDayId(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-neutral-900 dark:text-neutral-100 focus:outline-none cursor-pointer truncate max-w-[165px]"
                    >
                      {state.ddays.map((d) => (
                        <option
                          key={d.id}
                          value={d.id}
                          className="bg-white dark:bg-neutral-900"
                        >
                          {d.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {stats.selectedDDay.title}
                    </span>
                  )}
                </div>
                <div className="font-mono tabular-nums text-[11px] text-neutral-500 dark:text-neutral-400 pl-[18px]">
                  {stats.selectedDDay.targetDate}
                </div>
              </div>

              <div
                data-testid="widget-dday-label"
                className={`font-mono tabular-nums text-2xl font-bold tracking-tight shrink-0 ${
                  stats.selectedDDay.diffDays >= 0 &&
                  stats.selectedDDay.diffDays <= 7
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-neutral-900 dark:text-neutral-100'
                }`}
              >
                {stats.selectedDDay.label}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  No D-Day set yet
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDDay(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 shrink-0 cursor-pointer"
              >
                <Plus className="w-3 h-3 text-orange-500" />
                <span>Set D-Day</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. Today · This Week · This Month Study Totals */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 bg-white dark:bg-[#14171D]">
            <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 dark:text-neutral-400">
              Today
            </div>
            <div
              data-testid="widget-today-time"
              className="font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1"
            >
              {formatDurationHMS(stats.todaySeconds)}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 bg-white dark:bg-[#14171D]">
            <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 dark:text-neutral-400">
              This Week
            </div>
            <div
              data-testid="widget-week-time"
              className="font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1"
            >
              {formatDurationShort(stats.weekSeconds)}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-2.5 bg-white dark:bg-[#14171D]">
            <div className="text-[10px] uppercase tracking-wider font-medium text-neutral-500 dark:text-neutral-400">
              This Month
            </div>
            <div
              data-testid="widget-month-time"
              className="font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-neutral-50 mt-1"
            >
              {formatDurationShort(stats.monthSeconds)}
            </div>
          </div>
        </div>

        {/* Daily Goal Bar & Streak */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="font-mono tabular-nums">
              Goal {stats.dailyGoalPct}% · {state.profile.dailyGoalHours}h
            </span>
            <span className="font-mono tabular-nums text-orange-600 dark:text-orange-400 font-medium">
              Streak {stats.streakDays}d
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-300"
              style={{ width: `${stats.dailyGoalPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Quick Focus Bar */}
      <div className="px-3.5 py-2.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#14171D] flex items-center justify-between gap-2">
        {activeSubject ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: activeSubject.color }}
              />
              <span className="text-xs font-medium truncate">
                {activeSubject.name}
              </span>
              <span className="font-mono tabular-nums text-xs text-orange-600 dark:text-orange-400 font-semibold shrink-0">
                {formatDurationHMS(liveFocusSeconds)}
              </span>
            </div>
            <button
              type="button"
              onClick={onReturnToApp}
              className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 text-[11px] font-medium shrink-0 cursor-pointer"
            >
              {mode === 'pip' ? 'Open App' : 'Hide'}
            </button>
          </>
        ) : state.subjects.length > 0 ? (
          <>
            {state.subjects.length > 1 ? (
              <select
                aria-label="Quick start subject"
                value={quickSubjId}
                onChange={(e) => setQuickSubjId(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200 focus:outline-none"
              >
                {state.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: state.subjects[0].color }}
                />
                <span className="text-xs font-medium truncate">
                  {state.subjects[0].name}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => quickSubjId && onStartSubject(quickSubjId)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium shrink-0 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Start</span>
            </button>
          </>
        ) : (
          <>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
              {mode === 'pip'
                ? 'Add a subject to start studying'
                : 'Floating preview · PWA enables OS PiP'}
            </span>
            <button
              type="button"
              onClick={onOpenQuickStart}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-medium shrink-0 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Subject</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
};
