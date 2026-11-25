import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  Coins,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Unlock,
} from 'lucide-react';
import {
  AiCoachMessage,
  AiPlanTaskSuggestion,
  AiTier,
  DDayTarget,
  StudySession,
  Subject,
  TodoItem,
  UserProfile,
  WalletState,
} from '../types/ypt';
import {
  AI_TIER_CATALOG,
  AI_TIER_LIST,
  getAiQuotaStatus,
  hasUnlockedAiTier,
} from '../utils/aiCoachLogic';
import { calculateDDay, formatDurationShort } from '../utils/yptLogic';

interface AiCoachViewProps {
  todayKey: string;
  profile: UserProfile;
  subjects: Subject[];
  sessions: StudySession[];
  todos: TodoItem[];
  ddays: DDayTarget[];
  wallet: WalletState;
  messages: AiCoachMessage[];
  isSending: boolean;
  errorMessage: string;
  onDismissError: () => void;
  onSendMessage: (promptText: string) => Promise<void>;
  onClearChat: () => void;
  onAddSuggestedTask: (messageId: string, task: AiPlanTaskSuggestion) => void;
  onAddAllSuggestedTasks: (messageId: string, tasks: AiPlanTaskSuggestion[]) => void;
  onUnlockAiTier: (tier: AiTier) => void;
  onOpenVault: () => void;
  onOpenPlanner: () => void;
}

const EMPTY_STARTERS = [
  {
    label: "Build today's study plan",
    prompt:
      'Build a realistic study plan for today based on my active subjects, pending tasks, and D-Day countdown.',
  },
  {
    label: 'Turn a topic into tasks',
    prompt:
      'Help me break down a key topic into 3-4 focused study blocks with realistic durations for today.',
  },
  {
    label: 'Rebalance unfinished tasks',
    prompt:
      'Look at my pending tasks and help me reprioritize today so I stay on track for my daily study goal.',
  },
  {
    label: 'Exam sprint checklist',
    prompt:
      'Create a focused revision checklist prioritized around my closest upcoming D-Day.',
  },
];

const FOLLOWUP_CHIPS = [
  'Shorten these into 25m Pomodoro tasks',
  'Add 2 practice problem tasks for today',
  'Adjust plan for remaining study time today',
];

export const AiCoachView: React.FC<AiCoachViewProps> = ({
  todayKey,
  profile,
  subjects,
  sessions,
  todos,
  ddays,
  wallet,
  messages,
  isSending,
  errorMessage,
  onDismissError,
  onSendMessage,
  onClearChat,
  onAddSuggestedTask,
  onAddAllSuggestedTasks,
  onUnlockAiTier,
  onOpenVault,
  onOpenPlanner,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [tierFeedback, setTierFeedback] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quota = useMemo(
    () => getAiQuotaStatus(wallet, todayKey),
    [wallet, todayKey]
  );

  const subjectMap = useMemo(
    () => new Map(subjects.map((s) => [s.id, s])),
    [subjects]
  );

  const activeSubjects = useMemo(
    () => subjects.filter((s) => !s.archived),
    [subjects]
  );

  const todayStudiedSeconds = useMemo(
    () =>
      sessions
        .filter((s) => {
          const shifted = new Date(s.startTime - profile.resetHour * 3600 * 1000);
          const k = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(
            2,
            '0'
          )}-${String(shifted.getDate()).padStart(2, '0')}`;
          return k === todayKey;
        })
        .reduce((acc, s) => acc + s.durationSeconds, 0),
    [sessions, profile.resetHour, todayKey]
  );

  const pendingTodayCount = useMemo(
    () => todos.filter((t) => t.studyDayKey === todayKey && !t.completed).length,
    [todos, todayKey]
  );

  const pinnedDDay = useMemo(
    () => ddays.find((d) => d.isPinned) ?? ddays[0],
    [ddays]
  );

  const handleSubmitText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !quota.canSend) return;
    setInputValue('');
    setTierFeedback('');
    await onSendMessage(trimmed);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSubmitText(inputValue);
  };

  const handleUnlockTier = (tier: AiTier) => {
    const def = AI_TIER_CATALOG[tier];
    if (wallet.coins < def.coinCost) {
      onOpenVault();
      return;
    }
    onUnlockAiTier(tier);
    setTierFeedback(`Unlocked ${def.name}! Your daily AI Coach limit is updated.`);
  };

  return (
    <div className="max-w-[1040px] mx-auto flex flex-col h-full min-h-[460px] gap-4">
      {/* Top Status Strip */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-orange-50 dark:bg-orange-500/12 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm font-display font-semibold text-neutral-900 dark:text-neutral-100">
              <span>AI Study Coach</span>
              <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">
                ·
              </span>
              <span
                data-testid="ai-tier-label"
                className="text-xs font-medium text-orange-600 dark:text-orange-400"
              >
                {quota.tierName}
              </span>
            </div>
            <div
              data-testid="ai-quota-label"
              className="text-xs text-neutral-500 dark:text-neutral-400 flex flex-wrap items-center gap-2 font-mono tabular-nums"
            >
              {quota.isUnlimited ? (
                <span>Unlimited messages today</span>
              ) : (
                <span>
                  {quota.remaining} / {quota.dailyLimit} left today
                </span>
              )}
              <span aria-hidden="true">·</span>
              <span>{wallet.coins} Bruv Coins</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPlanner}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer whitespace-nowrap"
          >
            <span>Open Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {quota.tier !== 'ultimate' && (
            <button
              type="button"
              onClick={onOpenVault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/70 dark:bg-orange-500/10 hover:bg-orange-100/70 dark:hover:bg-orange-500/20 text-xs font-semibold text-orange-700 dark:text-orange-300 cursor-pointer whitespace-nowrap"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Upgrade Tier</span>
            </button>
          )}

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              title="Start a fresh conversation"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-600 dark:text-neutral-300 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>
          )}
        </div>
      </section>

      {tierFeedback && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/80 dark:bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shrink-0"
        >
          <span>{tierFeedback}</span>
          <button
            type="button"
            onClick={() => setTierFeedback('')}
            className="text-xs font-medium hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="ai-error-banner"
          className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/80 dark:bg-red-500/10 px-4 py-2.5 text-xs text-red-700 dark:text-red-300 flex flex-wrap items-center justify-between gap-2.5 shrink-0"
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words min-w-0">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            className="text-xs font-medium hover:underline cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Scrollable Conversation Area */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-[260px] overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5 space-y-5"
      >
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto py-6 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display font-semibold text-lg text-neutral-900 dark:text-neutral-100">
                Plan your study day around what matters most
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Ask for a daily block schedule, topic breakdown, or exam sprint checklist. Every suggested task can be added to your 10-Minute Planner in one click.
              </p>
            </div>

            {/* Live Desk Snapshot */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-neutral-500 dark:text-neutral-400">Studied Today</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {formatDurationShort(todayStudiedSeconds)} / {profile.dailyGoalHours}h
                </div>
              </div>
              <div>
                <div className="text-neutral-500 dark:text-neutral-400">Active Subjects</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {activeSubjects.length}
                </div>
              </div>
              <div>
                <div className="text-neutral-500 dark:text-neutral-400">Pending Tasks</div>
                <div className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                  {pendingTodayCount} today
                </div>
              </div>
              <div>
                <div className="text-neutral-500 dark:text-neutral-400">Pinned D-Day</div>
                <div className="font-mono tabular-nums font-semibold text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                  {pinnedDDay
                    ? `${pinnedDDay.title} (${calculateDDay(pinnedDDay.targetDate, todayKey).label})`
                    : 'None set'}
                </div>
              </div>
            </div>

            {/* One-tap Prompt Starters */}
            <div className="space-y-2.5">
              <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Quick Planning Prompts
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {EMPTY_STARTERS.map((starter) => (
                  <button
                    key={starter.label}
                    type="button"
                    disabled={isSending || !quota.canSend}
                    onClick={() => void handleSubmitText(starter.prompt)}
                    className="text-left p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-orange-300 dark:hover:border-orange-500/40 hover:bg-orange-50/40 dark:hover:bg-orange-500/5 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {starter.label}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {starter.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-xl bg-orange-500 text-white px-4 py-3 text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const suggested = msg.suggestedTasks ?? [];
              const addedIds = new Set(msg.addedTaskIds ?? []);
              const remainingUnadded = suggested.filter((t) => !addedIds.has(t.id));

              return (
                <div key={msg.id} className="flex justify-start">
                  <div className="w-full max-w-[92%] space-y-3">
                    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 px-4 py-3.5 space-y-2">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-orange-500" />
                        <span>AI Study Coach</span>
                      </div>
                      <div className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>
                    </div>

                    {suggested.length > 0 && (
                      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111318] overflow-hidden">
                        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                              Suggested Study Tasks ({suggested.length})
                            </div>
                            {msg.planSummary && (
                              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                                {msg.planSummary}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={remainingUnadded.length === 0}
                            onClick={() => onAddAllSuggestedTasks(msg.id, suggested)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                              remainingUnadded.length === 0
                                ? 'border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 cursor-default'
                                : 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                            }`}
                          >
                            {remainingUnadded.length === 0 ? (
                              <>
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>All Added to Planner</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5" />
                                <span>Add All ({remainingUnadded.length}) to Planner</span>
                              </>
                            )}
                          </button>
                        </div>

                        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                          {suggested.map((task) => {
                            const subj = subjectMap.get(task.subjectId);
                            const isAdded = addedIds.has(task.id);
                            return (
                              <li
                                key={task.id}
                                className="px-4 py-3 flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-1">
                                  <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                    {task.title}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                                    <span
                                      className="w-2 h-2 rounded-xs shrink-0"
                                      style={{
                                        backgroundColor: subj?.color ?? '#9CA3AF',
                                      }}
                                    />
                                    <span>{subj?.name ?? task.subjectName}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">
                                      {task.estimatedMinutes}m
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono tabular-nums">
                                      {task.studyDayKey}
                                    </span>
                                  </div>
                                  {task.rationale && (
                                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                                      {task.rationale}
                                    </p>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  disabled={isAdded}
                                  onClick={() => onAddSuggestedTask(msg.id, task)}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                                    isAdded
                                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-500/10 cursor-default'
                                      : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 cursor-pointer'
                                  }`}
                                >
                                  {isAdded ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Added</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Task</span>
                                    </>
                                  )}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/50 px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                  Building your study plan...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inline Upgrade Banner when Daily Quota Reaches 0 */}
      {!quota.canSend && (
        <section
          data-testid="ai-quota-exhausted-banner"
          className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/70 dark:bg-orange-500/10 p-4 space-y-3 shrink-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Lock className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                Daily limit reached ({quota.usedToday} / {quota.dailyLimit} messages used on {quota.tierName})
              </span>
            </div>
            <span className="text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-300">
              Balance: {wallet.coins} Coins
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AI_TIER_LIST.filter((t) => !hasUnlockedAiTier(quota.tier, t.id)).map((tierDef) => {
              const affordable = wallet.coins >= tierDef.coinCost;
              return (
                <div
                  key={tierDef.id}
                  className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      {tierDef.name} ·{' '}
                      {tierDef.dailyLimit === null
                        ? 'Unlimited / day'
                        : `${tierDef.dailyLimit} msgs / day`}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {tierDef.tagline}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnlockTier(tierDef.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      affordable
                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                        : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
                    }`}
                  >
                    {affordable ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unlock ({tierDef.coinCost})</span>
                      </>
                    ) : (
                      <span>Need {tierDef.coinCost - wallet.coins} more</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Composer */}
      <form
        onSubmit={handleFormSubmit}
        className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-3.5 space-y-2.5 shrink-0"
      >
        {messages.length > 0 && quota.canSend && (
          <div className="flex flex-wrap items-center gap-2">
            {FOLLOWUP_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isSending}
                onClick={() => void handleSubmitText(chip)}
                className="px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 cursor-pointer disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          <label htmlFor="ai-coach-input" className="sr-only">
            Ask AI Study Coach
          </label>
          <textarea
            id="ai-coach-input"
            rows={2}
            value={inputValue}
            disabled={!quota.canSend || isSending}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmitText(inputValue);
              }
            }}
            placeholder={
              quota.canSend
                ? 'Ask AI Coach to plan your day, break down a chapter, or organize tasks...'
                : 'Daily message limit reached — upgrade your AI tier above or check Challenges & Vault.'
            }
            className="flex-1 min-w-0 resize-none px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40 disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={!quota.canSend || isSending || !inputValue.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            <span>{isSending ? 'Planning...' : 'Send'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>
            Tailored to your desk ({activeSubjects.length}{' '}
            {activeSubjects.length === 1 ? 'subject' : 'subjects'} ·{' '}
            {pendingTodayCount} pending today)
          </span>
          <span className="font-mono tabular-nums">
            {quota.isUnlimited
              ? `${quota.tierName} · Unlimited`
              : `${quota.remaining}/${quota.dailyLimit} msgs left today`}
          </span>
        </div>
      </form>
    </div>
  );
};
