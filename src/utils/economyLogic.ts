import {
  AppState,
  ChallengeDefinition,
  ChallengeStatus,
  FeaturePackDefinition,
  FeaturePackId,
  StudySession,
  Subject,
  WalletState,
} from '../types/ypt';
import {
  computeDailyTotalsMap,
  getStudyDayKey,
  getWeekDayKeys,
} from './yptLogic';

export const FEATURE_PACKS: FeaturePackDefinition[] = [
  {
    id: 'custom_pomodoro',
    title: 'Custom Pomodoro & Sound Alerts',
    tagline: 'Tailor work and rest intervals to your exact attention span.',
    freeLimit: 'Fixed 25m focus / 5m break / 15m long break without chime',
    unlockedBenefit: 'Custom focus & break durations + completion audio chime',
    coinCost: 150,
  },
  {
    id: 'sounds_themes',
    title: 'Ambient Focus Sounds & Custom Themes',
    tagline: 'Study with rain, brown noise, library tone, and custom workspace palettes.',
    freeLimit: 'Silent focus mode & Flame Orange theme only',
    unlockedBenefit: 'Rain, Brown Noise & Library audio + Cobalt, Emerald & Violet themes',
    coinCost: 200,
  },
  {
    id: 'focus_lock',
    title: 'Strict Focus Lock & Extra D-Days',
    tagline: 'Enforce tab-switch protection and track every exam deadline.',
    freeLimit: '1 D-Day countdown, no Focus Guard tab-switch pause or whitelist',
    unlockedBenefit: 'Unlimited D-Days + tab-switch auto-pause & Allowed Tools list',
    coinCost: 250,
  },
  {
    id: 'study_groups',
    title: 'Unlimited Study Groups & Private Rooms',
    tagline: 'Build multiple accountability circles or invite-only study rooms.',
    freeLimit: 'Join or create up to 1 public study room',
    unlockedBenefit: 'Unlimited study rooms + private invite-only rooms',
    coinCost: 250,
  },
  {
    id: 'advanced_insights',
    title: 'Advanced Insights & CSV Export',
    tagline: 'Analyze weekly/monthly rhythms and export your study logs anytime.',
    freeLimit: 'Daily Insights view only',
    unlockedBenefit: 'Weekly & Monthly reports, Hourly Focus Pattern & CSV export',
    coinCost: 350,
  },
];

export interface CoinStoreOffer {
  id: 'pack-300' | 'pack-1000' | 'pro-bundle';
  title: string;
  subtitle: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlocksPro: boolean;
}

export const COIN_STORE_OFFERS: CoinStoreOffer[] = [
  {
    id: 'pack-300',
    title: 'Starter Coin Pack',
    subtitle: '300 Bruv Coins (0.27 BDT/coin)',
    priceBdt: 80,
    priceLabel: '80 BDT',
    coinsAdded: 300,
    unlocksPro: false,
  },
  {
    id: 'pack-1000',
    title: 'Scholar Coin Pack',
    subtitle: '1,000 Bruv Coins — 10% bundle discount off 267 BDT base rate',
    priceBdt: 240,
    priceLabel: '240 BDT',
    coinsAdded: 1000,
    unlocksPro: false,
  },
  {
    id: 'pro-bundle',
    title: 'Bruv Pro All-Access',
    subtitle: 'Unlocks all 5 feature packs permanently across your desk',
    priceBdt: 1000,
    priceLabel: '1,000 BDT',
    coinsAdded: 0,
    unlocksPro: true,
  },
];

export const CHALLENGE_CATALOG: ChallengeDefinition[] = [
  // Daily Tasks (lowered rewards so consistent effort matters)
  {
    id: 'daily-2h',
    period: 'daily',
    title: 'Daily Warm-Up',
    description: 'Log 2 hours of focused study today.',
    targetValue: 2,
    unit: 'hours',
    rewardCoins: 8,
  },
  {
    id: 'daily-tasks-3',
    period: 'daily',
    title: 'Task Crusher',
    description: 'Check off 3 planned To-Do tasks today.',
    targetValue: 3,
    unit: 'tasks',
    rewardCoins: 5,
  },
  {
    id: 'daily-4h',
    period: 'daily',
    title: 'Deep Desk Session',
    description: 'Log 4 hours of focused study today.',
    targetValue: 4,
    unit: 'hours',
    rewardCoins: 15,
  },
  {
    id: 'daily-8h',
    period: 'daily',
    title: 'Iron Desk Day',
    description: 'Hit a full 8-hour study day.',
    targetValue: 8,
    unit: 'hours',
    rewardCoins: 30,
  },

  // Weekly Challenges
  {
    id: 'weekly-5days',
    period: 'weekly',
    title: 'Consistent Week',
    description: 'Study at least 1 hour on 5 different days this week.',
    targetValue: 5,
    unit: 'days',
    rewardCoins: 50,
  },
  {
    id: 'weekly-35h',
    period: 'weekly',
    title: '35-Hour Weekly Grind',
    description: 'Accumulate 35 total study hours this week.',
    targetValue: 35,
    unit: 'hours',
    rewardCoins: 80,
  },
  {
    id: 'weekly-8h7d',
    period: 'weekly',
    title: '8h × 7-Day Streak',
    description: 'Log 8+ hours every day for 7 consecutive days.',
    targetValue: 7,
    unit: 'streak8h',
    rewardCoins: 140,
  },

  // Monthly Challenges
  {
    id: 'monthly-20days',
    period: 'monthly',
    title: '20-Day Habit Month',
    description: 'Study at least 1 hour on 20 days this month.',
    targetValue: 20,
    unit: 'days',
    rewardCoins: 150,
  },
  {
    id: 'monthly-100h',
    period: 'monthly',
    title: '100-Hour Study Challenge',
    description: 'Reach 100 cumulative hours within the current month.',
    targetValue: 100,
    unit: 'hours',
    rewardCoins: 250,
  },
  {
    id: 'monthly-150h',
    period: 'monthly',
    title: '150-Hour Scholar Milestone',
    description: 'Reach 150 cumulative hours within the current month.',
    targetValue: 150,
    unit: 'hours',
    rewardCoins: 400,
  },
];

export function isPackUnlocked(wallet: WalletState, packId: FeaturePackId): boolean {
  return wallet.proAllAccess || wallet.unlockedPacks.includes(packId);
}

export function getFeaturePack(packId: FeaturePackId): FeaturePackDefinition {
  const found = FEATURE_PACKS.find((p) => p.id === packId);
  if (!found) {
    throw new Error(`Unknown feature pack: ${packId}`);
  }
  return found;
}

/**
 * Counts consecutive days ending on or immediately before todayKey where daily study >= minHours.
 */
export function computeHighHourStreak(
  sessions: StudySession[],
  todayKey: string,
  resetHour: number,
  minHours: number = 8
): number {
  const dailyMap = computeDailyTotalsMap(sessions, resetHour);
  const minSeconds = minHours * 3600;
  const [y, m, d] = todayKey.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));

  const formatUtcKey = (dt: Date) =>
    `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(
      dt.getUTCDate()
    ).padStart(2, '0')}`;

  if ((dailyMap.get(formatUtcKey(cursor)) ?? 0) < minSeconds) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while ((dailyMap.get(formatUtcKey(cursor)) ?? 0) >= minSeconds) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/**
 * Evaluates all Daily, Weekly, and Monthly challenges from live user sessions & tasks.
 */
export function evaluateChallenges(
  state: Pick<AppState, 'sessions' | 'todos' | 'profile' | 'wallet'>,
  nowMs: number = Date.now()
): ChallengeStatus[] {
  const resetHour = state.profile.resetHour;
  const todayKey = getStudyDayKey(nowMs, resetHour);
  const weekKeys = getWeekDayKeys(todayKey);
  const weekKeySet = new Set(weekKeys);
  const monthPrefix = todayKey.slice(0, 7); // YYYY-MM

  const dailyTotals = computeDailyTotalsMap(state.sessions, resetHour);

  const todayHours = (dailyTotals.get(todayKey) ?? 0) / 3600;
  const todayTasksCompleted = state.todos.filter(
    (t) => t.studyDayKey === todayKey && t.completed
  ).length;

  let weekHours = 0;
  let weekActiveDays = 0;
  for (const k of weekKeys) {
    const secs = dailyTotals.get(k) ?? 0;
    weekHours += secs / 3600;
    if (secs >= 3600) weekActiveDays += 1;
  }

  let monthHours = 0;
  let monthActiveDays = 0;
  for (const [dayKey, secs] of dailyTotals.entries()) {
    if (dayKey.startsWith(monthPrefix)) {
      monthHours += secs / 3600;
      if (secs >= 3600) monthActiveDays += 1;
    }
  }

  const streak8h = computeHighHourStreak(state.sessions, todayKey, resetHour, 8);
  const weekScopeKey = weekKeys[0]; // Monday of active week

  return CHALLENGE_CATALOG.map((def) => {
    let currentValue = 0;
    let periodScope = todayKey;

    if (def.period === 'daily') {
      periodScope = todayKey;
      currentValue = def.unit === 'tasks' ? todayTasksCompleted : todayHours;
    } else if (def.period === 'weekly') {
      periodScope = weekScopeKey;
      if (def.unit === 'days') currentValue = weekActiveDays;
      else if (def.unit === 'streak8h') currentValue = streak8h;
      else currentValue = weekHours;
    } else {
      periodScope = monthPrefix;
      currentValue = def.unit === 'days' ? monthActiveDays : monthHours;
    }

    const periodClaimKey = `${def.id}::${periodScope}`;
    const completed = currentValue >= def.targetValue;
    const claimed = state.wallet.claimedPeriodKeys.includes(periodClaimKey);
    const progressPct = Math.min(
      100,
      Math.round((currentValue / Math.max(1, def.targetValue)) * 100)
    );

    return {
      ...def,
      currentValue: Number(currentValue.toFixed(def.unit === 'hours' ? 1 : 0)),
      progressPct,
      periodClaimKey,
      completed,
      claimed,
    };
  });
}

export function claimChallengeReward(
  wallet: WalletState,
  challenge: ChallengeStatus
): WalletState {
  if (!challenge.completed || challenge.claimed) {
    return wallet;
  }
  if (wallet.claimedPeriodKeys.includes(challenge.periodClaimKey)) {
    return wallet;
  }
  return {
    ...wallet,
    coins: wallet.coins + challenge.rewardCoins,
    claimedPeriodKeys: [...wallet.claimedPeriodKeys, challenge.periodClaimKey],
  };
}

export function unlockPackWithCoins(
  wallet: WalletState,
  packId: FeaturePackId
): { ok: true; wallet: WalletState } | { ok: false; error: string } {
  if (isPackUnlocked(wallet, packId)) {
    return { ok: true, wallet };
  }
  const pack = getFeaturePack(packId);
  if (wallet.coins < pack.coinCost) {
    return {
      ok: false,
      error: `Need ${pack.coinCost - wallet.coins} more Bruv Coins to unlock ${pack.title}.`,
    };
  }
  return {
    ok: true,
    wallet: {
      ...wallet,
      coins: wallet.coins - pack.coinCost,
      unlockedPacks: [...wallet.unlockedPacks, packId],
    },
  };
}

export interface VerifiedPaymentGrant {
  tranId: string;
  provider: string;
  offerId: CoinStoreOffer['id'];
  label: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlocksPro: boolean;
  verifiedAtMs: number;
}

/**
 * Credits coins or Pro All-Access ONLY from a server-verified payment grant.
 * Prevents duplicate application of the same verified transaction ID.
 */
export function applyVerifiedPurchase(
  wallet: WalletState,
  grant: VerifiedPaymentGrant
): WalletState {
  if (!grant.tranId || !grant.verifiedAtMs) {
    return wallet;
  }
  if (wallet.purchaseHistory.some((r) => r.tranId === grant.tranId)) {
    return wallet;
  }

  const receipt = {
    id: `rcpt-${grant.tranId}`,
    tranId: grant.tranId,
    provider: grant.provider,
    offerId: grant.offerId,
    label: grant.label,
    priceBdt: grant.priceBdt,
    priceLabel: grant.priceLabel,
    coinsAdded: grant.coinsAdded,
    unlockedPro: grant.unlocksPro,
    timestampMs: grant.verifiedAtMs,
  };

  return {
    ...wallet,
    coins: wallet.coins + grant.coinsAdded,
    proAllAccess: wallet.proAllAccess || grant.unlocksPro,
    unlockedPacks: grant.unlocksPro
      ? FEATURE_PACKS.map((p) => p.id)
      : wallet.unlockedPacks,
    purchaseHistory: [receipt, ...wallet.purchaseHistory],
  };
}

export function buildSessionsCsv(
  sessions: StudySession[],
  subjects: Subject[],
  resetHour: number = 5
): string {
  const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));
  const escapeCsv = (val: string) => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const header = ['StudyDay', 'Subject', 'Mode', 'StartISO', 'EndISO', 'DurationSeconds', 'Note'];
  const rows = [...sessions]
    .sort((a, b) => a.startTime - b.startTime)
    .map((sess) => [
      getStudyDayKey(sess.startTime, resetHour),
      escapeCsv(subjectMap.get(sess.subjectId) ?? 'Unknown'),
      sess.mode,
      new Date(sess.startTime).toISOString(),
      new Date(sess.endTime).toISOString(),
      String(sess.durationSeconds),
      escapeCsv(sess.note ?? ''),
    ]);

  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}
