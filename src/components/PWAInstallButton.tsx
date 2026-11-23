import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, Laptop, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { getDesktopInstallGuidance } from '../utils/pwaLogic';

interface PWAInstallButtonProps {
  variant?: 'header' | 'sidebar' | 'card';
  collapsed?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  collapsed = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const desktopGuidance = useMemo(
    () =>
      getDesktopInstallGuidance(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
      ),
    []
  );

  // When already running in standalone installed mode:
  // suppress header/sidebar install buttons cleanly.
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
                Desktop App Installed
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Bruv-study is currently running in standalone desktop window mode with offline support enabled.
              </p>
            </div>
          </div>
        </section>
      );
    }
    return null;
  }

  const handlePrimaryAction = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  // Header variant only renders when browser offers native prompt or iOS manual trigger
  if (variant === 'header') {
    if (!isInstallable && !isIOS) {
      return null;
    }

    return (
      <>
        <button
          type="button"
          onClick={handlePrimaryAction}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-orange-500" />
          <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
        </button>

        {showGuideModal && (
          <InstallGuideDialog
            isIOS={isIOS}
            browserLabel={desktopGuidance.browserLabel}
            steps={desktopGuidance.steps}
            onClose={() => setShowGuideModal(false)}
          />
        )}
      </>
    );
  }

  if (variant === 'sidebar') {
    const label = isIOS ? 'Install on iOS' : 'Install Desktop App';
    return (
      <>
        <button
          type="button"
          onClick={handlePrimaryAction}
          aria-label={label}
          title={label}
          className={
            collapsed
              ? 'w-9 h-9 flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer'
              : 'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer'
          }
        >
          <Laptop className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          {!collapsed && <span>{label}</span>}
        </button>

        {showGuideModal && (
          <InstallGuideDialog
            isIOS={isIOS}
            browserLabel={desktopGuidance.browserLabel}
            steps={desktopGuidance.steps}
            onClose={() => setShowGuideModal(false)}
          />
        )}
      </>
    );
  }

  // Settings 'card' variant
  return (
    <>
      <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Laptop className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Desktop App (PWA)
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isInstallable
                ? 'Ready to install. Launch Bruv-study in its own desktop window with offline timer & planner caching.'
                : isIOS
                  ? 'Add Bruv-study to your iPhone or iPad Home Screen for full-screen offline study sessions.'
                  : 'Install Bruv-study directly from your browser as a standalone desktop app with offline caching.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handlePrimaryAction}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-colors ${
            isInstallable
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : 'border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>
            {isInstallable
              ? 'Install Desktop App'
              : isIOS
                ? 'iOS Install Steps'
                : 'How to Install'}
          </span>
        </button>
      </section>

      {showGuideModal && (
        <InstallGuideDialog
          isIOS={isIOS}
          browserLabel={desktopGuidance.browserLabel}
          steps={desktopGuidance.steps}
          onClose={() => setShowGuideModal(false)}
        />
      )}
    </>
  );
};

interface InstallGuideDialogProps {
  isIOS: boolean;
  browserLabel: string;
  steps: string[];
  onClose: () => void;
}

const InstallGuideDialog: React.FC<InstallGuideDialogProps> = ({
  isIOS,
  browserLabel,
  steps,
  onClose,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isIOS ? (
              <Share className="w-5 h-5 text-orange-500 shrink-0" />
            ) : (
              <Laptop className="w-5 h-5 text-orange-500 shrink-0" />
            )}
            <h3
              id="pwa-install-guide-title"
              className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100"
            >
              {isIOS ? 'Install on iPhone / iPad' : `Install on ${browserLabel}`}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install guide"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <ol className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300 list-decimal pl-5">
            <li>
              Tap the <strong>Share</strong> button in the Safari toolbar.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> to launch Bruv-study in standalone mode.
            </li>
          </ol>
        ) : (
          <ol className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300 list-decimal pl-5">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
