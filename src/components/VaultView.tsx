import React, { useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Coins,
  Lock,
  Trophy,
  Unlock,
} from 'lucide-react';
import {
  AiTier,
  ChallengePeriod,
  ChallengeStatus,
  FeaturePackId,
  WalletState,
} from '../types/ypt';
import { FEATURE_PACKS, isPackUnlocked } from '../utils/economyLogic';
import {
  AI_TIER_CATALOG,
  AI_TIER_LIST,
  hasUnlockedAiTier,
} from '../utils/aiCoachLogic';

interface VaultViewProps {
  wallet: WalletState;
  challenges: ChallengeStatus[];
  initialSubTab?: 'challenges' | 'vault';
  onClaimChallenge: (challenge: ChallengeStatus) => void;
  onUnlockPack: (packId: FeaturePackId) => void;
  onUnlockAiTier: (tier: AiTier) => void;
  onOpenAiCoach?: () => void;
}

export const VaultView: React.FC<VaultViewProps> = ({
  wallet,
  challenges,
  initialSubTab = 'challenges',
  onClaimChallenge,
  onUnlockPack,
  onUnlockAiTier,
  onOpenAiCoach,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'challenges' | 'vault'>(
    initialSubTab
  );

  React.useEffect(() => {
    setActiveSubTab(initialSubTab);
  }, [initialSubTab]);
  const [challengePeriod, setChallengePeriod] = useState<ChallengePeriod>('daily');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const visibleChallenges = useMemo(
    () => challenges.filter((c) => c.period === challengePeriod),
    [challenges, challengePeriod]
  );

  const claimableCount = useMemo(
    () => challenges.filter((c) => c.completed && !c.claimed).length,
    [challenges]
  );

  const unlockedCount = useMemo(
    () => FEATURE_PACKS.filter((p) => isPackUnlocked(wallet, p.id)).length,
    [wallet]
  );

  const handleClaim = (challenge: ChallengeStatus) => {
    onClaimChallenge(challenge);
    setFeedbackMsg(
      `Claimed +${challenge.rewardCoins} Bruv Coins from "${challenge.title}".`
    );
  };

  const handleUnlock = (packId: FeaturePackId, title: string) => {
    onUnlockPack(packId);
    setFeedbackMsg(`Unlocked "${title}".`);
  };

  const activeAiTierDef = AI_TIER_CATALOG[wallet.aiTier ?? 'free'];

  const handleUnlockAi = (tier: AiTier) => {
    onUnlockAiTier(tier);
    setFeedbackMsg(`Unlocked ${AI_TIER_CATALOG[tier].name} AI Study Coach tier.`);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Top Wallet & Progression Banner */}
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span>Bruv Wallet</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {unlockedCount}/{FEATURE_PACKS.length} packs unlocked
            </span>
            <span aria-hidden="true">·</span>
            <span>
              AI Coach: <strong className="text-neutral-800 dark:text-neutral-200">{activeAiTierDef.name}</strong>{' '}
              ({activeAiTierDef.dailyLimit === null ? 'Unlimited' : `${activeAiTierDef.dailyLimit}/day`})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Coins className="w-7 h-7 text-orange-500 shrink-0" />
            <div
              data-testid="wallet-coin-balance"
              className="font-mono tabular-nums font-bold text-4xl text-neutral-900 dark:text-neutral-100"
            >
              {wallet.coins}
            </div>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              Bruv Coins
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Earn Bruv Coins by completing Daily, Weekly, and Monthly study challenges, then spend them in the Feature Vault. Coin purchases are closed for now.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() =>
              setActiveSubTab((prev) => (prev === 'challenges' ? 'vault' : 'challenges'))
            }
            className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer whitespace-nowrap"
          >
            {activeSubTab === 'challenges'
              ? `Browse Vault (${unlockedCount}/${FEATURE_PACKS.length})`
              : `View Challenges${claimableCount > 0 ? ` (${claimableCount} ready)` : ''}`}
          </button>
        </div>
      </section>

      {feedbackMsg && (
        <div
          role="status"
          className="rounded-lg border border-orange-200 dark:border-orange-500/30 bg-orange-50/70 dark:bg-orange-500/10 px-4 py-2.5 text-xs text-orange-800 dark:text-orange-200 flex items-center justify-between gap-3"
        >
          <span>{feedbackMsg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg('')}
            className="text-xs font-medium hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Sub-Tab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div
          role="group"
          aria-label="Challenges and Vault Sections"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80"
        >
          <button
            type="button"
            onClick={() => setActiveSubTab('challenges')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'challenges'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Challenges{claimableCount > 0 ? ` (${claimableCount} ready)` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('vault')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeSubTab === 'vault'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
          >
            Feature Vault
          </button>
        </div>

        {activeSubTab === 'challenges' && (
          <div
            role="group"
            aria-label="Challenge Period"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800/80"
          >
            {(['daily', 'weekly', 'monthly'] as ChallengePeriod[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setChallengePeriod(p)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  challengePeriod === p
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {p === 'daily' ? 'Daily' : p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Section 1: Challenges (Daily / Weekly / Monthly) */}
      {activeSubTab === 'challenges' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleChallenges.map((ch) => {
            const unitLabel =
              ch.unit === 'hours'
                ? 'h'
                : ch.unit === 'tasks'
                  ? ' tasks'
                  : ' days';
            return (
              <article
                key={ch.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-orange-500 shrink-0" />
                      <h3 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                        {ch.title}
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {ch.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono tabular-nums text-sm font-bold text-orange-600 dark:text-orange-400">
                      +{ch.rewardCoins}
                    </div>
                    <div className="text-[11px] text-neutral-400">Coins</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                    <span>
                      {ch.currentValue}
                      {unitLabel} / {ch.targetValue}
                      {unitLabel}
                    </span>
                    <span>{ch.progressPct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-orange-500 transition-all duration-300"
                      style={{ width: `${ch.progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  {ch.claimed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Claimed</span>
                    </span>
                  ) : ch.completed ? (
                    <button
                      type="button"
                      onClick={() => handleClaim(ch)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Claim +{ch.rewardCoins} Coins</span>
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">In Progress</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Section 2: Feature Vault (AI Coach Tiers + 5 Unlockable Packs) */}
      {activeSubTab === 'vault' && (
        <div className="space-y-8">
          {/* AI Study Coach Tiers (Option A) */}
          <section className="space-y-3" aria-label="AI Study Coach Access Tiers">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  AI Study Coach Access
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Upgrade your daily AI Study Coach message allowance using earned Bruv Coins.
                </p>
              </div>
              {onOpenAiCoach && (
                <button
                  type="button"
                  onClick={onOpenAiCoach}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-orange-500" />
                  <span>Open AI Coach</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {AI_TIER_LIST.map((tier) => {
                const currentTier = wallet.aiTier ?? 'free';
                const isUnlocked = hasUnlockedAiTier(currentTier, tier.id);
                const isActive = currentTier === tier.id;
                const canAfford = wallet.coins >= tier.coinCost;
                return (
                  <article
                    key={tier.id}
                    data-testid={`ai-tier-card-${tier.id}`}
                    className={`rounded-xl border p-5 flex flex-col justify-between gap-4 bg-white dark:bg-[#14171D] ${
                      isActive
                        ? 'border-orange-400 dark:border-orange-500/50'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {isUnlocked ? (
                            <Unlock className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-orange-500 shrink-0" />
                          )}
                          <h3 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                            {tier.name}
                          </h3>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0">
                          {tier.coinCost === 0
                            ? 'Free'
                            : isUnlocked
                              ? 'Unlocked'
                              : `${tier.coinCost} Coins`}
                        </span>
                      </div>

                      <div className="font-mono tabular-nums text-xs font-semibold text-orange-600 dark:text-orange-400">
                        {tier.dailyLimit === null
                          ? 'Unlimited messages / day'
                          : `${tier.dailyLimit} messages / day`}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">
                        {tier.tagline}
                      </p>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Current Plan</span>
                        </span>
                      ) : isUnlocked ? (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">
                          Included in higher tier
                        </span>
                      ) : canAfford ? (
                        <button
                          type="button"
                          onClick={() => handleUnlockAi(tier.id)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          <span>Unlock ({tier.coinCost} Coins)</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('challenges')}
                          className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                        >
                          Need {tier.coinCost - wallet.coins} more Coins
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Desk Feature Packs */}
          <section className="space-y-3" aria-label="Desk Feature Packs">
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Desk Feature Packs
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Permanent unlocks for Focus Guard, Insights, Sounds &amp; Themes, and Study Groups.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURE_PACKS.map((pack) => {
            const unlocked = isPackUnlocked(wallet, pack.id);
            const canAfford = wallet.coins >= pack.coinCost;
            return (
              <article
                key={pack.id}
                className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {unlocked ? (
                        <Unlock className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Lock className="w-4 h-4 text-orange-500 shrink-0" />
                      )}
                      <h3 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                        {pack.title}
                      </h3>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0">
                      {unlocked ? 'Unlocked' : `${pack.coinCost} Coins`}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {pack.tagline}
                  </p>
                  <div className="pt-1 text-xs space-y-1">
                    <div className="text-neutral-500 dark:text-neutral-400">
                      Free: {pack.freeLimit}
                    </div>
                    <div className="text-neutral-800 dark:text-neutral-200 font-medium">
                      Unlock: {pack.unlockedBenefit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  {unlocked ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Active on Your Desk</span>
                    </span>
                  ) : canAfford ? (
                    <button
                      type="button"
                      onClick={() => handleUnlock(pack.id, pack.title)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Unlock ({pack.coinCost} Coins)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('challenges')}
                      className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                      Need {pack.coinCost - wallet.coins} more Coins · Earn in Challenges
                    </button>
                  )}
                </div>
              </article>
            );
          })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
