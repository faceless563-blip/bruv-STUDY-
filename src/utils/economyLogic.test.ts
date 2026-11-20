import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyVerifiedPurchase,
  buildSessionsCsv,
  CHALLENGE_CATALOG,
  claimChallengeReward,
  COIN_STORE_OFFERS,
  computeHighHourStreak,
  evaluateChallenges,
  isPackUnlocked,
  unlockPackWithCoins,
} from './economyLogic';
import { createEmptyState } from '../data/seedData';
import { StudySession } from '../types/ypt';

test('BDT pricing and lowered challenge rewards match economy rules', () => {
  const pack300 = COIN_STORE_OFFERS.find((o) => o.id === 'pack-300')!;
  const pack1000 = COIN_STORE_OFFERS.find((o) => o.id === 'pack-1000')!;
  const pro = COIN_STORE_OFFERS.find((o) => o.id === 'pro-bundle')!;

  assert.equal(pack300.priceBdt, 80);
  assert.equal(pack300.coinsAdded, 300);
  assert.equal(pack1000.priceBdt, 240);
  assert.equal(pack1000.coinsAdded, 1000);
  assert.equal(pro.priceBdt, 1000);
  assert.equal(pro.unlocksPro, true);

  const daily2h = CHALLENGE_CATALOG.find((c) => c.id === 'daily-2h')!;
  const dailyTasks = CHALLENGE_CATALOG.find((c) => c.id === 'daily-tasks-3')!;
  assert.equal(daily2h.rewardCoins, 8);
  assert.equal(dailyTasks.rewardCoins, 5);
});

test('computeHighHourStreak detects 8h x 7-day consecutive streak', () => {
  const sessions: StudySession[] = [];
  for (let d = 0; d < 7; d++) {
    const start = new Date(2026, 10, 20 - d, 8, 0, 0).getTime();
    sessions.push({
      id: `s-${d}`,
      subjectId: 'math',
      startTime: start,
      endTime: start + 8 * 3600 * 1000,
      durationSeconds: 8 * 3600,
      mode: 'stopwatch',
    });
  }
  assert.equal(computeHighHourStreak(sessions, '2026-11-20', 5, 8), 7);

  sessions[2].durationSeconds = 4 * 3600;
  assert.equal(computeHighHourStreak(sessions, '2026-11-20', 5, 8), 2);
});

test('evaluateChallenges tracks daily, 8h x 7d streak, and 100h monthly challenge', () => {
  const base = createEmptyState();
  const ref = new Date(2026, 10, 20, 16, 0, 0).getTime();

  for (let d = 0; d < 10; d++) {
    const start = new Date(2026, 10, 20 - d, 7, 0, 0).getTime();
    base.sessions.push({
      id: `m-${d}`,
      subjectId: 'algo',
      startTime: start,
      endTime: start + 10 * 3600 * 1000,
      durationSeconds: 10 * 3600,
      mode: 'stopwatch',
    });
  }

  const statuses = evaluateChallenges(base, ref);
  const daily8 = statuses.find((c) => c.id === 'daily-8h')!;
  const streak87 = statuses.find((c) => c.id === 'weekly-8h7d')!;
  const monthly100 = statuses.find((c) => c.id === 'monthly-100h')!;

  assert.equal(daily8.completed, true);
  assert.equal(streak87.completed, true);
  assert.equal(monthly100.completed, true);
  assert.equal(monthly100.currentValue, 100);
});

test('claimChallengeReward credits lowered coins once and prevents double-claim', () => {
  const base = createEmptyState();
  const ref = new Date(2026, 10, 20, 12, 0, 0).getTime();
  const start = new Date(2026, 10, 20, 9, 0, 0).getTime();
  base.sessions.push({
    id: 'd1',
    subjectId: 'math',
    startTime: start,
    endTime: start + 2 * 3600 * 1000,
    durationSeconds: 7200,
    mode: 'stopwatch',
  });

  const statuses = evaluateChallenges(base, ref);
  const warmUp = statuses.find((c) => c.id === 'daily-2h')!;
  assert.equal(warmUp.completed, true);

  const w1 = claimChallengeReward(base.wallet, warmUp);
  assert.equal(w1.coins, 8);

  const statusesAfter = evaluateChallenges({ ...base, wallet: w1 }, ref);
  const warmUpAfter = statusesAfter.find((c) => c.id === 'daily-2h')!;
  assert.equal(warmUpAfter.claimed, true);

  const w2 = claimChallengeReward(w1, warmUpAfter);
  assert.equal(w2.coins, 8);
});

test('unlockPackWithCoins enforces balance and unlocks pack', () => {
  let wallet = createEmptyState().wallet;
  const fail = unlockPackWithCoins(wallet, 'custom_pomodoro');
  assert.equal(fail.ok, false);

  wallet = { ...wallet, coins: 200 };
  const ok = unlockPackWithCoins(wallet, 'custom_pomodoro');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.wallet.coins, 50);
    assert.equal(isPackUnlocked(ok.wallet, 'custom_pomodoro'), true);
    assert.equal(isPackUnlocked(ok.wallet, 'advanced_insights'), false);
  }
});

test('applyVerifiedPurchase credits server-verified BDT grant and blocks duplicate tranId', () => {
  const wallet = createEmptyState().wallet;
  const afterCoins = applyVerifiedPurchase(wallet, {
    tranId: 'BRUV_1001',
    provider: 'sslcommerz',
    offerId: 'pack-300',
    label: 'Starter Coin Pack',
    priceBdt: 80,
    priceLabel: '80 BDT',
    coinsAdded: 300,
    unlocksPro: false,
    verifiedAtMs: 1000,
  });
  assert.equal(afterCoins.coins, 300);
  assert.equal(afterCoins.proAllAccess, false);
  assert.equal(afterCoins.purchaseHistory.length, 1);

  // Duplicate tranId does nothing
  const afterDup = applyVerifiedPurchase(afterCoins, {
    tranId: 'BRUV_1001',
    provider: 'sslcommerz',
    offerId: 'pack-300',
    label: 'Starter Coin Pack',
    priceBdt: 80,
    priceLabel: '80 BDT',
    coinsAdded: 300,
    unlocksPro: false,
    verifiedAtMs: 1000,
  });
  assert.equal(afterDup.coins, 300);
  assert.equal(afterDup.purchaseHistory.length, 1);

  const afterPro = applyVerifiedPurchase(afterDup, {
    tranId: 'BRUV_1002',
    provider: 'sslcommerz',
    offerId: 'pro-bundle',
    label: 'Bruv Pro All-Access',
    priceBdt: 1000,
    priceLabel: '1,000 BDT',
    coinsAdded: 0,
    unlocksPro: true,
    verifiedAtMs: 2000,
  });
  assert.equal(afterPro.coins, 300);
  assert.equal(afterPro.proAllAccess, true);
  assert.equal(isPackUnlocked(afterPro, 'advanced_insights'), true);
  assert.equal(isPackUnlocked(afterPro, 'focus_lock'), true);
});

test('buildSessionsCsv escapes notes and includes headers', () => {
  const start = new Date(2026, 10, 20, 10, 0, 0).getTime();
  const csv = buildSessionsCsv(
    [
      {
        id: 's1',
        subjectId: 'math',
        startTime: start,
        endTime: start + 1800 * 1000,
        durationSeconds: 1800,
        mode: 'stopwatch',
        note: 'Chapter 1, Exercises',
      },
    ],
    [{ id: 'math', name: 'Calculus', color: '#F97316', dailyTargetMinutes: 60 }],
    5
  );
  assert.match(csv, /^StudyDay,Subject,Mode,StartISO,EndISO,DurationSeconds,Note/);
  assert.match(csv, /Calculus,stopwatch/);
  assert.match(csv, /"Chapter 1, Exercises"/);
});
