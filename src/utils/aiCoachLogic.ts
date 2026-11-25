import {
  AiPlanTaskSuggestion,
  AiTier,
  AiTierDefinition,
  AppState,
  Subject,
  WalletState,
} from '../types/ypt';
import { calculateDDay, computeSubjectTotals, getStudyDayKey, getWeekDayKeys } from './yptLogic';

export const AI_TIER_LIST: AiTierDefinition[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Starter daily coaching to plan your core tasks.',
    dailyLimit: 5,
    coinCost: 0,
  },
  {
    id: 'premium',
    name: 'Bruv Premium',
    tagline: 'Triple your daily coaching limit for active exam prep.',
    dailyLimit: 15,
    coinCost: 500,
  },
  {
    id: 'ultimate',
    name: 'Bruv Ultimate',
    tagline: 'Unlimited daily AI coaching & instant plan adjustments.',
    dailyLimit: null,
    coinCost: 1800,
  },
];

export const AI_TIER_CATALOG: Record<AiTier, AiTierDefinition> = {
  free: AI_TIER_LIST[0],
  premium: AI_TIER_LIST[1],
  ultimate: AI_TIER_LIST[2],
};

const TIER_RANK: Record<AiTier, number> = {
  free: 0,
  premium: 1,
  ultimate: 2,
};

export function isValidAiTier(val: unknown): val is AiTier {
  return val === 'free' || val === 'premium' || val === 'ultimate';
}

export function normalizeWalletState(
  rawWallet?: Partial<WalletState> | null
): WalletState {
  const w = rawWallet ?? {};
  return {
    coins: typeof w.coins === 'number' && Number.isFinite(w.coins) ? Math.max(0, w.coins) : 0,
    unlockedPacks: Array.isArray(w.unlockedPacks) ? w.unlockedPacks : [],
    proAllAccess: Boolean(w.proAllAccess),
    claimedPeriodKeys: Array.isArray(w.claimedPeriodKeys) ? w.claimedPeriodKeys : [],
    accentTheme:
      w.accentTheme === 'orange' ||
      w.accentTheme === 'cobalt' ||
      w.accentTheme === 'emerald' ||
      w.accentTheme === 'violet'
        ? w.accentTheme
        : 'orange',
    purchaseHistory: Array.isArray(w.purchaseHistory) ? w.purchaseHistory : [],
    aiTier: isValidAiTier(w.aiTier) ? w.aiTier : 'free',
    aiUsageDayKey: typeof w.aiUsageDayKey === 'string' ? w.aiUsageDayKey : '',
    aiMessagesUsedToday:
      typeof w.aiMessagesUsedToday === 'number' && Number.isFinite(w.aiMessagesUsedToday)
        ? Math.max(0, Math.floor(w.aiMessagesUsedToday))
        : 0,
  };
}

export interface AiQuotaStatus {
  tier: AiTier;
  tierName: string;
  dailyLimit: number | null;
  usedToday: number;
  remaining: number | null;
  canSend: boolean;
  isUnlimited: boolean;
}

export function getAiQuotaStatus(wallet: WalletState, todayKey: string): AiQuotaStatus {
  const tier: AiTier = isValidAiTier(wallet.aiTier) ? wallet.aiTier : 'free';
  const def = AI_TIER_CATALOG[tier];
  const usedToday =
    wallet.aiUsageDayKey === todayKey
      ? Math.max(0, Math.floor(wallet.aiMessagesUsedToday || 0))
      : 0;

  if (def.dailyLimit === null) {
    return {
      tier,
      tierName: def.name,
      dailyLimit: null,
      usedToday,
      remaining: null,
      canSend: true,
      isUnlimited: true,
    };
  }

  const remaining = Math.max(0, def.dailyLimit - usedToday);
  return {
    tier,
    tierName: def.name,
    dailyLimit: def.dailyLimit,
    usedToday,
    remaining,
    canSend: remaining > 0,
    isUnlimited: false,
  };
}

export function consumeAiMessageQuota(
  wallet: WalletState,
  todayKey: string
): { ok: true; wallet: WalletState } | { ok: false; error: string } {
  const status = getAiQuotaStatus(wallet, todayKey);
  if (!status.canSend) {
    return {
      ok: false,
      error: `You used all ${status.dailyLimit} AI Coach messages for today (${todayKey}). Upgrade in Vault or wait until your next study-day reset.`,
    };
  }

  return {
    ok: true,
    wallet: {
      ...wallet,
      aiUsageDayKey: todayKey,
      aiMessagesUsedToday: status.usedToday + 1,
    },
  };
}

export function hasUnlockedAiTier(currentTier: AiTier, targetTier: AiTier): boolean {
  return TIER_RANK[currentTier] >= TIER_RANK[targetTier];
}

export function unlockAiTierWithCoins(
  wallet: WalletState,
  targetTier: AiTier
): { ok: true; wallet: WalletState } | { ok: false; error: string } {
  const currentTier: AiTier = isValidAiTier(wallet.aiTier) ? wallet.aiTier : 'free';
  if (hasUnlockedAiTier(currentTier, targetTier)) {
    return { ok: true, wallet };
  }

  const targetDef = AI_TIER_CATALOG[targetTier];
  if (wallet.coins < targetDef.coinCost) {
    return {
      ok: false,
      error: `Need ${targetDef.coinCost - wallet.coins} more Bruv Coins to unlock ${targetDef.name}.`,
    };
  }

  return {
    ok: true,
    wallet: {
      ...wallet,
      coins: wallet.coins - targetDef.coinCost,
      aiTier: targetTier,
    },
  };
}

export interface StudyPlannerContext {
  todayKey: string;
  profile: {
    name: string;
    category: string;
    dailyGoalHours: number;
    resetHour: number;
    motto: string;
  };
  todayStudiedMinutes: number;
  weekStudiedMinutes: number;
  subjects: Array<{
    id: string;
    name: string;
    dailyTargetMinutes: number;
    todayMinutes: number;
  }>;
  pendingTodosToday: Array<{
    title: string;
    subjectName: string;
    estimatedMinutes: number;
  }>;
  completedTodosTodayCount: number;
  upcomingDDays: Array<{
    title: string;
    targetDate: string;
    label: string;
  }>;
}

export function buildStudyPlannerContext(
  state: Pick<AppState, 'profile' | 'subjects' | 'sessions' | 'todos' | 'ddays'>,
  todayKey: string
): StudyPlannerContext {
  const resetHour = state.profile.resetHour;
  const todaySet = new Set([todayKey]);
  const weekSet = new Set(getWeekDayKeys(todayKey));

  const subjectTotalsToday = computeSubjectTotals(
    state.sessions,
    state.subjects,
    todaySet,
    resetHour
  );
  const todayMinutesBySubject = new Map(
    subjectTotalsToday.map((item) => [item.subject.id, Math.round(item.totalSeconds / 60)])
  );

  const todayStudiedMinutes = Math.round(
    subjectTotalsToday.reduce((acc, item) => acc + item.totalSeconds, 0) / 60
  );

  const weekStudiedMinutes = Math.round(
    state.sessions
      .filter((s) => weekSet.has(getStudyDayKey(s.startTime, resetHour)))
      .reduce((acc, s) => acc + s.durationSeconds, 0) / 60
  );

  const subjectMap = new Map(state.subjects.map((s) => [s.id, s.name]));
  const activeSubjects = state.subjects
    .filter((s) => !s.archived)
    .slice(0, 15)
    .map((s) => ({
      id: s.id,
      name: s.name,
      dailyTargetMinutes: s.dailyTargetMinutes,
      todayMinutes: todayMinutesBySubject.get(s.id) ?? 0,
    }));

  const todayTodos = state.todos.filter((t) => t.studyDayKey === todayKey);
  const pendingTodosToday = todayTodos
    .filter((t) => !t.completed)
    .slice(0, 20)
    .map((t) => ({
      title: t.title,
      subjectName: subjectMap.get(t.subjectId) ?? 'General',
      estimatedMinutes: t.estimatedMinutes ?? 30,
    }));

  const completedTodosTodayCount = todayTodos.filter((t) => t.completed).length;

  const upcomingDDays = state.ddays.slice(0, 5).map((d) => ({
    title: d.title,
    targetDate: d.targetDate,
    label: calculateDDay(d.targetDate, todayKey).label,
  }));

  return {
    todayKey,
    profile: {
      name: state.profile.name,
      category: state.profile.category,
      dailyGoalHours: state.profile.dailyGoalHours,
      resetHour: state.profile.resetHour,
      motto: state.profile.motto,
    },
    todayStudiedMinutes,
    weekStudiedMinutes,
    subjects: activeSubjects,
    pendingTodosToday,
    completedTodosTodayCount,
    upcomingDDays,
  };
}

export function sanitizeSuggestedTasks(
  rawTasks: unknown,
  subjects: Subject[],
  defaultDayKey: string
): AiPlanTaskSuggestion[] {
  if (!Array.isArray(rawTasks)) return [];

  const activeSubjects = subjects.filter((s) => !s.archived);
  const byId = new Map(activeSubjects.map((s) => [s.id, s]));
  const byLowerName = new Map(
    activeSubjects.map((s) => [s.name.trim().toLowerCase(), s])
  );

  const results: AiPlanTaskSuggestion[] = [];
  const baseTs = Date.now();

  for (let i = 0; i < rawTasks.length && results.length < 8; i++) {
    const item = rawTasks[i];
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;

    const rawTitle = String(rec.title ?? '').trim().slice(0, 140);
    if (!rawTitle) continue;

    const rawSubjectId = String(rec.subjectId ?? '').trim();
    const rawSubjectName = String(rec.subjectName ?? '').trim();
    const matchedSubject =
      byId.get(rawSubjectId) ??
      byLowerName.get(rawSubjectName.toLowerCase()) ??
      activeSubjects.find((s) => {
        const lowerSubj = s.name.trim().toLowerCase();
        const lowerInput = rawSubjectName.toLowerCase();
        return Boolean(
          lowerInput && (lowerSubj.includes(lowerInput) || lowerInput.includes(lowerSubj))
        );
      });

    const rawMinutes = Number(rec.estimatedMinutes);
    const estimatedMinutes = Number.isFinite(rawMinutes)
      ? Math.min(240, Math.max(5, Math.round(rawMinutes)))
      : 30;

    const rawDayKey = String(rec.studyDayKey ?? '').trim();
    const studyDayKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDayKey)
      ? rawDayKey
      : defaultDayKey;

    const rationale = String(rec.rationale ?? '').trim().slice(0, 180);

    results.push({
      id: `ai-task-${baseTs}-${i}`,
      title: rawTitle,
      subjectId: matchedSubject ? matchedSubject.id : 'general',
      subjectName: matchedSubject ? matchedSubject.name : rawSubjectName || 'General',
      estimatedMinutes,
      studyDayKey,
      rationale,
    });
  }

  return results;
}
