import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  Square,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  FeaturePackId,
  FocusGuardSettings,
  PomodoroConfig,
  PomodoroPhase,
  Subject,
  TimerMode,
  TodoItem,
} from '../types/ypt';
import { formatDurationHMS } from '../utils/yptLogic';
import { AmbientSoundType, soundEngine } from '../utils/soundEngine';

interface ActiveFocusOverlayProps {
  subject: Subject;
  allSubjects: Subject[];
  mode: TimerMode;
  pomodoroConfig: PomodoroConfig;
  focusGuard: FocusGuardSettings;
  todayTotalBeforeSession: number;
  subjectTodos: TodoItem[];
  soundsThemesUnlocked: boolean;
  customPomodoroUnlocked: boolean;
  focusLockUnlocked: boolean;
  onSwitchSubject: (subjectId: string) => void;
  onToggleTodo: (todoId: string) => void;
  onCompleteSession: (elapsedFocusSeconds: number, note: string) => void;
  onDiscardSession: () => void;
  onRequestUnlock: (packId: FeaturePackId) => void;
  onTickFocusSeconds?: (elapsedFocusSeconds: number) => void;
}

export const ActiveFocusOverlay: React.FC<ActiveFocusOverlayProps> = ({
  subject,
  allSubjects,
  mode,
  pomodoroConfig,
  focusGuard,
  todayTotalBeforeSession,
  subjectTodos,
  soundsThemesUnlocked,
  customPomodoroUnlocked,
  focusLockUnlocked,
  onSwitchSubject,
  onToggleTodo,
  onCompleteSession,
  onDiscardSession,
  onRequestUnlock,
  onTickFocusSeconds,
}) => {
  const effectivePomodoro: PomodoroConfig = customPomodoroUnlocked
    ? pomodoroConfig
    : {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        cyclesBeforeLongBreak: 4,
      };
  const effectiveFocusGuardActive =
    focusLockUnlocked && focusGuard.autoPauseOnTabSwitch;

  const [isPaused, setIsPaused] = useState(false);
  const [pausedByGuard, setPausedByGuard] = useState(false);
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState(0);
  const [phase, setPhase] = useState<PomodoroPhase>('focus');
  const [phaseRemainingSeconds, setPhaseRemainingSeconds] = useState(
    effectivePomodoro.focusMinutes * 60
  );
  const [completedCycles, setCompletedCycles] = useState(0);
  const [note, setNote] = useState('');
  const [ambient, setAmbient] = useState<AmbientSoundType>('off');

  // Stop ambient sound when unmounting focus mode
  useEffect(() => {
    return () => {
      soundEngine.stopAmbient();
      onTickFocusSeconds?.(0);
    };
  }, [onTickFocusSeconds]);

  useEffect(() => {
    onTickFocusSeconds?.(focusElapsedSeconds);
  }, [focusElapsedSeconds, onTickFocusSeconds]);

  // Desktop Focus Guard: auto-pause when user leaves the tab/window
  useEffect(() => {
    if (!effectiveFocusGuardActive) return;
    const handleVisibility = () => {
      if (document.hidden && !isPaused) {
        setIsPaused(true);
        setPausedByGuard(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [effectiveFocusGuardActive, isPaused]);

  // 1-second timer tick
  useEffect(() => {
    if (isPaused) return;
    const interval = window.setInterval(() => {
      if (mode === 'stopwatch') {
        setFocusElapsedSeconds((prev) => prev + 1);
      } else {
        setPhaseRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (customPomodoroUnlocked) {
              soundEngine.playChime();
            }
            if (phase === 'focus') {
              const nextCycles = completedCycles + 1;
              setCompletedCycles(nextCycles);
              const isLong = nextCycles % effectivePomodoro.cyclesBeforeLongBreak === 0;
              const nextPhase: PomodoroPhase = isLong ? 'longBreak' : 'shortBreak';
              setPhase(nextPhase);
              return (
                (isLong
                  ? effectivePomodoro.longBreakMinutes
                  : effectivePomodoro.shortBreakMinutes) * 60
              );
            } else {
              setPhase('focus');
              return effectivePomodoro.focusMinutes * 60;
            }
          }
          return prev - 1;
        });

        if (phase === 'focus') {
          setFocusElapsedSeconds((prev) => prev + 1);
        }
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [
    isPaused,
    mode,
    phase,
    completedCycles,
    customPomodoroUnlocked,
    effectivePomodoro.cyclesBeforeLongBreak,
    effectivePomodoro.focusMinutes,
    effectivePomodoro.longBreakMinutes,
    effectivePomodoro.shortBreakMinutes,
  ]);

  const handleAmbientChange = (next: AmbientSoundType) => {
    if (next !== 'off' && !soundsThemesUnlocked) {
      onRequestUnlock('sounds_themes');
      return;
    }
    setAmbient(next);
    soundEngine.startAmbient(next);
  };

  const handleResume = () => {
    setPausedByGuard(false);
    setIsPaused(false);
  };

  const handleSaveAndStop = () => {
    soundEngine.stopAmbient();
    onCompleteSession(focusElapsedSeconds, note.trim());
  };

  const displaySeconds =
    mode === 'stopwatch' ? focusElapsedSeconds : phaseRemainingSeconds;

  const phaseLabel =
    mode === 'stopwatch'
      ? 'Continuous Stopwatch'
      : phase === 'focus'
        ? `Pomodoro Focus · Cycle ${completedCycles + 1}`
        : phase === 'shortBreak'
          ? 'Short Break (not counted toward study hours)'
          : 'Long Break (not counted toward study hours)';

  return (
    <div
      data-testid="active-focus-screen"
      className="fixed inset-0 z-50 bg-[#0D1015] text-neutral-100 flex flex-col justify-between overflow-y-auto"
    >
      {/* Top Focus Header */}
      <div className="h-16 px-8 border-b border-neutral-800/90 flex items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: subject.color }}
          />
          <label htmlFor="focus-subject-switch" className="sr-only">
            Active Subject
          </label>
          <select
            id="focus-subject-switch"
            value={subject.id}
            onChange={(e) => onSwitchSubject(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
          >
            {allSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-neutral-400 hidden sm:inline">
            {phaseLabel}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-400 shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <span>Today&apos;s Accumulative:</span>
            <span className="font-mono tabular-nums text-neutral-100 font-semibold">
              {formatDurationHMS(todayTotalBeforeSession + focusElapsedSeconds)}
            </span>
          </div>
          {effectiveFocusGuardActive && (
            <div className="inline-flex items-center gap-1.5 text-orange-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Focus Guard</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Body: Center Timer + Right Subject Tasks & Tools */}
      <div className="flex-1 max-w-[1160px] w-full mx-auto px-8 py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* Timer Centerpiece */}
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left space-y-8">
          {pausedByGuard && (
            <div
              role="alert"
              className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-3 text-amber-200 text-sm"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Focus Guard paused your timer because you switched away from the study window.
              </span>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-medium text-neutral-400 tracking-wide">
              {mode === 'pomodoro' ? phaseLabel : 'Focused Study Elapsed'}
            </div>
            <div
              data-testid="active-focus-clock"
              className="font-mono tabular-nums font-bold text-7xl sm:text-8xl tracking-tight text-white"
            >
              {formatDurationHMS(displaySeconds)}
            </div>
            {mode === 'pomodoro' && (
              <div className="text-xs font-mono tabular-nums text-neutral-400">
                Logged focus time this session: {formatDurationHMS(focusElapsedSeconds)}
              </div>
            )}
          </div>

          {/* Primary Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {isPaused ? (
              <button
                type="button"
                onClick={handleResume}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume Focus</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPausedByGuard(false);
                  setIsPaused(true);
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveAndStop}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-neutral-700 hover:bg-neutral-800 text-neutral-100 text-sm font-medium transition-colors cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current text-orange-500" />
              <span>Finish &amp; Save</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.stopAmbient();
                onDiscardSession();
              }}
              className="px-4 py-3 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Discard
            </button>
          </div>

          {/* Ambient Soundscape + Session Note */}
          <div className="w-full max-w-lg space-y-4 pt-4 border-t border-neutral-800/80">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 mr-2">
                {ambient === 'off' ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-orange-400" />
                )}
                Ambient Audio:
              </span>
              {(['off', 'rain', 'brown', 'library'] as AmbientSoundType[]).map((type) => {
                const locked = type !== 'off' && !soundsThemesUnlocked;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAmbientChange(type)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      ambient === type
                        ? 'bg-orange-500 text-white'
                        : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                    }`}
                  >
                    {locked && <Lock className="w-3 h-3 text-neutral-500" />}
                    <span>
                      {type === 'off'
                        ? 'Off'
                        : type === 'rain'
                          ? 'Rain'
                          : type === 'brown'
                            ? 'Brown Noise'
                            : 'Library'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="session-note-input" className="sr-only">
                Session Study Note
              </label>
              <input
                id="session-note-input"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional session log note (e.g. Ch. 5 Practice Set)..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>
          </div>
        </div>

        {/* Right Side: Subject Tasks & Allowed Tools */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-neutral-800 bg-[#14171D] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-sm text-neutral-100">
                Tasks for {subject.name}
              </h2>
              <span className="font-mono tabular-nums text-xs text-neutral-400">
                {subjectTodos.filter((t) => t.completed).length}/{subjectTodos.length}
              </span>
            </div>
            {subjectTodos.length === 0 ? (
              <p className="text-xs text-neutral-500 py-2">
                No tasks queued for this subject today. Add tasks in the 10-Min Planner.
              </p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {subjectTodos.map((todo) => (
                  <li key={todo.id}>
                    <button
                      type="button"
                      onClick={() => onToggleTodo(todo.id)}
                      className="w-full flex items-start gap-2.5 text-left py-1.5 px-2 rounded-lg hover:bg-neutral-800/60 transition-colors cursor-pointer"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />
                      )}
                      <span
                        className={`text-sm ${
                          todo.completed
                            ? 'line-through text-neutral-500'
                            : 'text-neutral-200'
                        }`}
                      >
                        {todo.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-neutral-800 bg-[#14171D] p-5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-neutral-300">
                Allowed Study Tools Whitelist
              </h3>
              {!focusLockUnlocked && (
                <button
                  type="button"
                  onClick={() => onRequestUnlock('focus_lock')}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400 hover:underline cursor-pointer"
                >
                  <Lock className="w-3 h-3" />
                  <span>Unlock Focus Lock</span>
                </button>
              )}
            </div>
            {!focusLockUnlocked ? (
              <p className="text-xs text-neutral-500">
                Strict Focus Guard tab-switch protection and your approved tools whitelist are locked.
              </p>
            ) : focusGuard.allowedTools.length === 0 ? (
              <p className="text-xs text-neutral-500">
                No tools whitelisted yet. Add reference tools in Settings.
              </p>
            ) : (
              <>
                <p className="text-xs text-neutral-500">
                  Permitted desktop references during Focus Lock:
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-300">
                  {focusGuard.allowedTools.map((tool, i) => (
                    <React.Fragment key={tool}>
                      {i > 0 && <span className="text-neutral-600" aria-hidden="true">·</span>}
                      <span>{tool}</span>
                    </React.Fragment>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
