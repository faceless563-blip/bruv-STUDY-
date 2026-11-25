import React, { useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Plus,
  Trash2,
} from 'lucide-react';
import { StudySession, Subject, TenMinuteSlot, TodoItem } from '../types/ypt';
import {
  buildTenMinuteGrid,
  formatDurationShort,
  getStudyDayBounds,
  getStudyDayKey,
} from '../utils/yptLogic';

interface PlannerViewProps {
  todayKey: string;
  resetHour: number;
  subjects: Subject[];
  sessions: StudySession[];
  todos: TodoItem[];
  onAddTodo: (subjectId: string, title: string, studyDayKey: string, estimatedMinutes: number) => void;
  onToggleTodo: (todoId: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onRolloverTodos: (targetDayKey: string) => number;
  onLogManualSession: (subjectId: string, startTimeMs: number, durationMinutes: number, note: string) => void;
  onOpenAiCoach?: () => void;
}

function shiftDayKey(dayKey: string, delta: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
    dt.getUTCDate()
  ).padStart(2, '0')}`;
}

export const PlannerView: React.FC<PlannerViewProps> = ({
  todayKey,
  resetHour,
  subjects,
  sessions,
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onRolloverTodos,
  onLogManualSession,
  onOpenAiCoach,
}) => {
  const [selectedDayKey, setSelectedDayKey] = useState(todayKey);
  const [newTitle, setNewTitle] = useState('');
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id ?? '');
  const [newEstMinutes, setNewEstMinutes] = useState('45');
  const [todoError, setTodoError] = useState('');
  const [rolloverBanner, setRolloverBanner] = useState('');

  React.useEffect(() => {
    if (!newSubjectId && subjects.length > 0) {
      setNewSubjectId(subjects[0].id);
    }
  }, [newSubjectId, subjects]);

  // Manual block logging modal/inline
  const [selectedSlot, setSelectedSlot] = useState<TenMinuteSlot | null>(null);
  const [manualSubjectId, setManualSubjectId] = useState(subjects[0]?.id ?? '');
  const [manualMinutes, setManualMinutes] = useState('30');
  const [manualNote, setManualNote] = useState('');

  const grid = useMemo(
    () => buildTenMinuteGrid(sessions, subjects, selectedDayKey, resetHour),
    [sessions, subjects, selectedDayKey, resetHour]
  );

  const dayTodos = useMemo(
    () => todos.filter((t) => t.studyDayKey === selectedDayKey),
    [todos, selectedDayKey]
  );

  const pastUnfinishedCount = useMemo(
    () => todos.filter((t) => !t.completed && t.studyDayKey < selectedDayKey).length,
    [todos, selectedDayKey]
  );

  const dayTotalSeconds = useMemo(() => {
    return sessions
      .filter((s) => getStudyDayKey(s.startTime, resetHour) === selectedDayKey)
      .reduce((acc, s) => acc + s.durationSeconds, 0);
  }, [sessions, selectedDayKey, resetHour]);

  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setTodoError('Enter a task description.');
      return;
    }
    const targetSubject = newSubjectId || subjects[0]?.id || 'general';
    onAddTodo(targetSubject, trimmed, selectedDayKey, Math.max(5, Number(newEstMinutes) || 30));
    setNewTitle('');
    setTodoError('');
  };

  const handleRollover = () => {
    const count = onRolloverTodos(selectedDayKey);
    setRolloverBanner(
      count > 0
        ? `Moved ${count} unfinished ${count === 1 ? 'task' : 'tasks'} to ${selectedDayKey}.`
        : 'All past unfinished tasks are already in today’s list.'
    );
  };

  const handleSlotClick = (slot: TenMinuteSlot) => {
    setSelectedSlot(slot);
    setManualSubjectId(slot.subjectId || subjects[0]?.id || '');
    setManualMinutes('30');
    setManualNote('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !manualSubjectId) return;
    const { startMs } = getStudyDayBounds(selectedDayKey, resetHour);
    const slotStartMs =
      startMs + (selectedSlot.hourIndex * 60 + selectedSlot.minuteOffset) * 60 * 1000;
    const mins = Math.min(240, Math.max(10, Number(manualMinutes) || 30));
    onLogManualSession(manualSubjectId, slotStartMs, mins, manualNote.trim() || 'Manual Planner Log');
    setSelectedSlot(null);
  };

  return (
    <div className="max-w-[1240px] mx-auto space-y-5">
      {/* Date Navigation & Daily Total Strip */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedDayKey((k) => shiftDayKey(k, -1))}
            aria-label="Previous study day"
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-100 px-2">
            {selectedDayKey}
          </span>
          <button
            type="button"
            onClick={() => setSelectedDayKey((k) => shiftDayKey(k, 1))}
            aria-label="Next study day"
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {selectedDayKey !== todayKey && (
            <button
              type="button"
              onClick={() => setSelectedDayKey(todayKey)}
              className="ml-1 px-3 py-1.5 rounded-lg text-xs font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 cursor-pointer"
            >
              Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <span>
            Logged:{' '}
            <strong className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
              {formatDurationShort(dayTotalSeconds)}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Tasks:{' '}
            <strong className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
              {dayTodos.filter((t) => t.completed).length}/{dayTodos.length}
            </strong>
          </span>
        </div>
      </div>

      {/* Split Workspace: To-Do List (Left) + 10-Minute Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Subject To-Do List */}
        <section className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D]">
          <div className="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Daily To-Do List
            </h2>
            <div className="flex items-center gap-2.5">
              {onOpenAiCoach && (
                <button
                  type="button"
                  onClick={onOpenAiCoach}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/70 dark:bg-orange-500/10 hover:bg-orange-100/80 dark:hover:bg-orange-500/20 text-xs font-medium text-orange-700 dark:text-orange-300 cursor-pointer whitespace-nowrap"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Plan with AI</span>
                </button>
              )}
              {pastUnfinishedCount > 0 && (
                <button
                  type="button"
                  onClick={handleRollover}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer whitespace-nowrap"
                >
                  <ArrowRightCircle className="w-3.5 h-3.5" />
                  <span>Rollover ({pastUnfinishedCount})</span>
                </button>
              )}
            </div>
          </div>

          {rolloverBanner && (
            <div className="px-5 py-2.5 bg-orange-50 dark:bg-orange-500/10 border-b border-orange-200 dark:border-orange-500/20 text-xs text-orange-700 dark:text-orange-300">
              {rolloverBanner}
            </div>
          )}

          {/* Add Task Form */}
          <form
            onSubmit={handleAddTodo}
            className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3"
          >
            <div>
              <label htmlFor="todo-title-input" className="sr-only">
                New Task Title
              </label>
              <input
                id="todo-title-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Add a study task..."
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="todo-subject-select" className="sr-only">
                Subject
              </label>
              <select
                id="todo-subject-select"
                value={newSubjectId}
                onChange={(e) => setNewSubjectId(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-neutral-800 dark:text-neutral-200"
              >
                {subjects.length === 0 ? (
                  <option value="general">General (No subjects yet)</option>
                ) : (
                  subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))
                )}
              </select>

              <label htmlFor="todo-est-minutes" className="sr-only">
                Estimated Minutes
              </label>
              <input
                id="todo-est-minutes"
                type="number"
                min={5}
                max={360}
                value={newEstMinutes}
                onChange={(e) => setNewEstMinutes(e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums text-neutral-800 dark:text-neutral-200"
                title="Estimated minutes"
              />

              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
            {todoError && (
              <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                {todoError}
              </p>
            )}
          </form>

          {/* Task List */}
          {dayTodos.length === 0 ? (
            <div className="px-5 py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No tasks scheduled for {selectedDayKey}. Add a study task above.
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-[620px] overflow-y-auto">
              {dayTodos.map((todo) => {
                const subj = subjectMap.get(todo.subjectId);
                return (
                  <li
                    key={todo.id}
                    className="px-4 py-3 flex items-start justify-between gap-3 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTodo(todo.id)}
                      className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                    >
                      {todo.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-sm ${
                            todo.completed
                              ? 'line-through text-neutral-400 dark:text-neutral-500'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {todo.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: subj?.color ?? '#9CA3AF' }}
                          />
                          <span>{subj?.name ?? 'General'}</span>
                          {todo.estimatedMinutes && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {todo.estimatedMinutes}m
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteTodo(todo.id)}
                      aria-label={`Delete task ${todo.title}`}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-red-600 dark:hover:text-red-400 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right: YPT 10-Minute Time Table Grid */}
        <section className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                10-Minute Study Timeline
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Each cell represents a 10-minute block. Click any slot to manually backfill an offline block.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
              {subjects.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual Backfill Drawer when a slot is clicked */}
          {selectedSlot && (
            <form
              onSubmit={handleManualSubmit}
              className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/60 dark:bg-orange-500/10 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  <Clock className="w-3.5 h-3.5 text-orange-500" />
                  <span className="font-mono tabular-nums">
                    Log offline study starting {String(selectedSlot.displayHour).padStart(2, '0')}:
                    {String(selectedSlot.minuteOffset).padStart(2, '0')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(null)}
                  className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              {subjects.length === 0 ? (
                <div className="text-xs text-neutral-600 dark:text-neutral-400">
                  Add a subject in Timer &amp; Subjects first before logging offline study blocks.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4">
                    <label htmlFor="manual-subject" className="block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                      Subject
                    </label>
                    <select
                      id="manual-subject"
                      value={manualSubjectId}
                      onChange={(e) => setManualSubjectId(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="manual-duration" className="block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                      Duration (min)
                    </label>
                    <input
                      id="manual-duration"
                      type="number"
                      min={10}
                      max={240}
                      step={10}
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="manual-note" className="block text-[11px] text-neutral-600 dark:text-neutral-400 mb-1">
                      Note
                    </label>
                    <input
                      id="manual-note"
                      type="text"
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Textbook review"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
                    >
                      Log
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}

          {/* 24x6 Grid Header */}
          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))] bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
              <div className="py-1.5 px-2 text-center border-r border-neutral-200 dark:border-neutral-800">
                Hour
              </div>
              {['10m', '20m', '30m', '40m', '50m', '60m'].map((col) => (
                <div
                  key={col}
                  className="py-1.5 text-center border-r last:border-r-0 border-neutral-200 dark:border-neutral-800"
                >
                  {col}
                </div>
              ))}
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {grid.map((row, rowIdx) => {
                const hourLabel = String(row[0].displayHour).padStart(2, '0');
                return (
                  <div
                    key={rowIdx}
                    className="grid grid-cols-[52px_repeat(6,minmax(0,1fr))] h-6"
                  >
                    <div className="flex items-center justify-center text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
                      {hourLabel}:00
                    </div>
                    {row.map((slot, colIdx) => {
                      const timeRange = `${hourLabel}:${String(slot.minuteOffset).padStart(2, '0')}`;
                      return (
                        <button
                          key={colIdx}
                          type="button"
                          onClick={() => handleSlotClick(slot)}
                          aria-label={
                            slot.subjectName
                              ? `${timeRange} — ${slot.subjectName} (${Math.round(
                                  slot.secondsInSlot / 60
                                )} min)`
                              : `${timeRange} — Empty slot, click to log`
                          }
                          title={
                            slot.subjectName
                              ? `${timeRange} · ${slot.subjectName} (${Math.round(
                                  slot.secondsInSlot / 60
                                )}m)`
                              : `${timeRange} · Empty`
                          }
                          className="border-r last:border-r-0 border-neutral-100 dark:border-neutral-800/70 transition-opacity hover:opacity-80 cursor-pointer"
                          style={{
                            backgroundColor: slot.subjectColor ?? 'transparent',
                            opacity: slot.subjectColor
                              ? Math.max(0.45, Math.min(1, slot.secondsInSlot / 600))
                              : 1,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
