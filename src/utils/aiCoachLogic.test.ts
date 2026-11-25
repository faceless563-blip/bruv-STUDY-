import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWallet } from '../data/seedData.ts';
import {
  AI_TIER_CATALOG,
  buildStudyPlannerContext,
  consumeAiMessageQuota,
  getAiQuotaStatus,
  normalizeWalletState,
  sanitizeSuggestedTasks,
  unlockAiTierWithCoins,
} from './aiCoachLogic.ts';
import type { Subject } from '../types/ypt.ts';

test('Option A quota defaults to 5 messages/day on Free and resets on new studyDayKey', () => {
  const wallet = createDefaultWallet();
  const status1 = getAiQuotaStatus(wallet, '2026-11-25');
  assert.equal(status1.tier, 'free');
  assert.equal(status1.dailyLimit, 5);
  assert.equal(status1.remaining, 5);
  assert.equal(status1.canSend, true);

  let current = wallet;
  for (let i = 0; i < 5; i++) {
    const res = consumeAiMessageQuota(current, '2026-11-25');
    assert.equal(res.ok, true);
    if (res.ok) current = res.wallet;
  }

  const exhausted = getAiQuotaStatus(current, '2026-11-25');
  assert.equal(exhausted.usedToday, 5);
  assert.equal(exhausted.remaining, 0);
  assert.equal(exhausted.canSend, false);

  const blocked = consumeAiMessageQuota(current, '2026-11-25');
  assert.equal(blocked.ok, false);

  // Next study day resets count automatically
  const nextDay = getAiQuotaStatus(current, '2026-11-26');
  assert.equal(nextDay.usedToday, 0);
  assert.equal(nextDay.remaining, 5);
  assert.equal(nextDay.canSend, true);
});

test('Option A Coin unlocks enforce 500 Coins for Bruv Premium (15/day) and 1,800 Coins for Bruv Ultimate (Unlimited)', () => {
  assert.equal(AI_TIER_CATALOG.premium.coinCost, 500);
  assert.equal(AI_TIER_CATALOG.premium.dailyLimit, 15);
  assert.equal(AI_TIER_CATALOG.ultimate.coinCost, 1800);
  assert.equal(AI_TIER_CATALOG.ultimate.dailyLimit, null);

  const poorWallet = { ...createDefaultWallet(), coins: 400 };
  const failPremium = unlockAiTierWithCoins(poorWallet, 'premium');
  assert.equal(failPremium.ok, false);

  const richWallet = { ...createDefaultWallet(), coins: 2400 };
  const unlockPrem = unlockAiTierWithCoins(richWallet, 'premium');
  assert.equal(unlockPrem.ok, true);
  if (!unlockPrem.ok) return;
  assert.equal(unlockPrem.wallet.coins, 1900);
  assert.equal(unlockPrem.wallet.aiTier, 'premium');
  assert.equal(getAiQuotaStatus(unlockPrem.wallet, '2026-11-25').dailyLimit, 15);

  const unlockUlt = unlockAiTierWithCoins(unlockPrem.wallet, 'ultimate');
  assert.equal(unlockUlt.ok, true);
  if (!unlockUlt.ok) return;
  assert.equal(unlockUlt.wallet.coins, 100);
  assert.equal(unlockUlt.wallet.aiTier, 'ultimate');

  const ultStatus = getAiQuotaStatus(unlockUlt.wallet, '2026-11-25');
  assert.equal(ultStatus.isUnlimited, true);
  assert.equal(ultStatus.remaining, null);
  assert.equal(ultStatus.canSend, true);

  // Prevent downgrade from ultimate to premium
  const downgradeAttempt = unlockAiTierWithCoins(unlockUlt.wallet, 'premium');
  assert.equal(downgradeAttempt.ok, true);
  if (downgradeAttempt.ok) {
    assert.equal(downgradeAttempt.wallet.aiTier, 'ultimate');
    assert.equal(downgradeAttempt.wallet.coins, 100);
  }
});

test('normalizeWalletState gracefully backfills missing AI fields for legacy wallets', () => {
  const legacy = normalizeWalletState({ coins: 220, accentTheme: 'cobalt' });
  assert.equal(legacy.coins, 220);
  assert.equal(legacy.accentTheme, 'cobalt');
  assert.equal(legacy.aiTier, 'free');
  assert.equal(legacy.aiUsageDayKey, '');
  assert.equal(legacy.aiMessagesUsedToday, 0);
});

test('sanitizeSuggestedTasks matches subjects case-insensitively, falls back to general, and clamps duration', () => {
  const subjects: Subject[] = [
    { id: 'subj-math', name: 'Calculus II', color: '#F97316', dailyTargetMinutes: 90 },
    { id: 'subj-chem', name: 'Organic Chemistry', color: '#2563EB', dailyTargetMinutes: 60 },
  ];

  const tasks = sanitizeSuggestedTasks(
    [
      {
        title: 'Solve 12 integration by parts problems',
        subjectName: 'calculus ii',
        estimatedMinutes: 50,
        studyDayKey: '2026-11-25',
        rationale: 'Builds speed on core exam problems.',
      },
      {
        title: 'Revise weekly planner notes',
        subjectName: 'Unlisted Topic',
        estimatedMinutes: 999,
        studyDayKey: 'invalid-date',
        rationale: 'Quick recap.',
      },
      {
        title: '   ',
        subjectName: 'Calculus II',
      },
    ],
    subjects,
    '2026-11-25'
  );

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].subjectId, 'subj-math');
  assert.equal(tasks[0].subjectName, 'Calculus II');
  assert.equal(tasks[0].estimatedMinutes, 50);

  assert.equal(tasks[1].subjectId, 'general');
  assert.equal(tasks[1].estimatedMinutes, 240);
  assert.equal(tasks[1].studyDayKey, '2026-11-25');
});

test('buildStudyPlannerContext summarizes D-Days, subjects, and pending tasks accurately', () => {
  const ctx = buildStudyPlannerContext(
    {
      profile: {
        name: 'Arafat',
        category: 'University & STEM',
        dailyGoalHours: 6,
        resetHour: 5,
        motto: 'Steady blocks',
      },
      subjects: [
        { id: 's1', name: 'Physics', color: '#F97316', dailyTargetMinutes: 120 },
      ],
      sessions: [
        {
          id: 'sess1',
          subjectId: 's1',
          startTime: new Date(2026, 10, 25, 9, 0).getTime(),
          endTime: new Date(2026, 10, 25, 10, 30).getTime(),
          durationSeconds: 5400,
          mode: 'stopwatch',
        },
      ],
      todos: [
        {
          id: 't1',
          subjectId: 's1',
          title: 'Kinematics problem set',
          completed: false,
          studyDayKey: '2026-11-25',
          estimatedMinutes: 45,
        },
      ],
      ddays: [
        { id: 'd1', title: 'Midterm Exam', targetDate: '2026-12-05', isPinned: true },
      ],
    },
    '2026-11-25'
  );

  assert.equal(ctx.todayStudiedMinutes, 90);
  assert.equal(ctx.subjects[0].todayMinutes, 90);
  assert.equal(ctx.pendingTodosToday.length, 1);
  assert.equal(ctx.upcomingDDays[0].label, 'D-10');
});
