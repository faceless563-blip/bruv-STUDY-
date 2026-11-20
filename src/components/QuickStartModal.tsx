import React, { useState } from 'react';
import { Check, Play, Plus, X } from 'lucide-react';
import { Subject, TimerMode } from '../types/ypt';
import { SUBJECT_COLOR_PALETTE } from '../data/seedData';

interface QuickStartModalProps {
  subjects: Subject[];
  activeTimerMode: TimerMode;
  onClose: () => void;
  onStartSubject: (subjectId: string) => void;
  onCreateAndStart: (name: string, color: string, dailyTargetMinutes: number) => void;
}

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  subjects,
  activeTimerMode,
  onClose,
  onStartSubject,
  onCreateAndStart,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(subjects.length === 0);
  const [name, setName] = useState('');
  const [color, setColor] = useState(
    SUBJECT_COLOR_PALETTE[subjects.length % SUBJECT_COLOR_PALETTE.length]
  );
  const [targetMinutes, setTargetMinutes] = useState('90');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const mins = Number(targetMinutes);
    if (!trimmed) {
      setError('Enter a subject name to start focusing.');
      return;
    }
    if (!Number.isFinite(mins) || mins < 10 || mins > 720) {
      setError('Daily target must be between 10 and 720 minutes.');
      return;
    }
    onCreateAndStart(trimmed, color, mins);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-start-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div>
            <h2
              id="quick-start-modal-title"
              className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100"
            >
              {showCreateForm ? 'Create Subject & Start Focus' : 'Choose Subject to Focus'}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Mode: {activeTimerMode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close start focus dialog"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {!showCreateForm && subjects.length > 0 ? (
            <>
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {subjects.map((subj) => (
                  <li key={subj.id}>
                    <button
                      type="button"
                      onClick={() => onStartSubject(subj.id)}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-orange-500 hover:bg-orange-50/40 dark:hover:bg-orange-500/10 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: subj.color }}
                        />
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {subj.name}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400 shrink-0">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Focus</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setShowCreateForm(true);
                }}
                className="w-full py-2.5 px-4 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-xs font-medium text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Subject &amp; Start</span>
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="quick-subject-name"
                  className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                >
                  Subject Name
                </label>
                <input
                  id="quick-subject-name"
                  type="text"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Organic Chemistry, SAT Math, IELTS..."
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>

              <div>
                <label
                  htmlFor="quick-subject-target"
                  className="block text-xs text-neutral-600 dark:text-neutral-400 mb-1"
                >
                  Daily Target (minutes)
                </label>
                <input
                  id="quick-subject-target"
                  type="number"
                  min={10}
                  max={720}
                  value={targetMinutes}
                  onChange={(e) => setTargetMinutes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm font-mono tabular-nums text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500 dark:text-neutral-400 mr-1">
                  Color:
                </span>
                {SUBJECT_COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setColor(hex)}
                    aria-label={`Select color ${hex}`}
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-transform cursor-pointer ${
                      color === hex
                        ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white dark:ring-offset-neutral-900 scale-105'
                        : ''
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {color === hex && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                {subjects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-3.5 py-2 rounded-lg text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Create &amp; Start Focus</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
