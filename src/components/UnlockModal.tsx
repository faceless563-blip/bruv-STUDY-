import React from 'react';
import {
  CheckCircle2,
  Coins,
  Lock,
  Trophy,
  X,
} from 'lucide-react';
import { FeaturePackId, WalletState } from '../types/ypt';
import { getFeaturePack, isPackUnlocked } from '../utils/economyLogic';

interface UnlockModalProps {
  packId: FeaturePackId;
  wallet: WalletState;
  onClose: () => void;
  onUnlockWithCoins: (packId: FeaturePackId) => void;
  onOpenChallenges: () => void;
}

export const UnlockModal: React.FC<UnlockModalProps> = ({
  packId,
  wallet,
  onClose,
  onUnlockWithCoins,
  onOpenChallenges,
}) => {
  const pack = getFeaturePack(packId);
  const alreadyUnlocked = isPackUnlocked(wallet, packId);
  const canAfford = wallet.coins >= pack.coinCost;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-modal-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="unlock-modal-title"
                className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100"
              >
                {pack.title}
              </h2>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                Balance: {wallet.coins} Bruv Coins
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close unlock dialog"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-neutral-600 dark:text-neutral-300">
            {pack.tagline}
          </p>

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            <div className="px-4 py-3 flex items-start justify-between gap-4">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0">
                Free Tier
              </span>
              <span className="text-neutral-800 dark:text-neutral-200 text-right">
                {pack.freeLimit}
              </span>
            </div>
            <div className="px-4 py-3 flex items-start justify-between gap-4">
              <span className="text-orange-600 dark:text-orange-400 font-medium shrink-0">
                Unlocked Perk
              </span>
              <span className="text-neutral-900 dark:text-neutral-100 font-medium text-right">
                {pack.unlockedBenefit}
              </span>
            </div>
          </div>

          {alreadyUnlocked ? (
            <div className="flex items-center justify-between pt-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Feature Pack Unlocked</span>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
              >
                Continue
              </button>
            </div>
          ) : canAfford ? (
            <button
              type="button"
              onClick={() => onUnlockWithCoins(pack.id)}
              className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              <span>Unlock Now for {pack.coinCost} Bruv Coins</span>
            </button>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="text-xs text-neutral-600 dark:text-neutral-400">
                You need{' '}
                <strong className="font-mono tabular-nums text-neutral-900 dark:text-neutral-100">
                  {pack.coinCost - wallet.coins} more Coins
                </strong>{' '}
                (Costs {pack.coinCost} Coins). Complete Daily, Weekly, or Monthly study challenges to earn Coins. Coin purchases are closed for now.
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChallenges();
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Go to Challenges &amp; Earn Coins</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
