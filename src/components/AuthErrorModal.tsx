import React, { useState } from 'react';
import { AlertCircle, Check, Copy, ExternalLink, RefreshCw, X } from 'lucide-react';
import { ParsedAuthError } from '../utils/authErrorLogic';

interface AuthErrorModalProps {
  error: ParsedAuthError;
  onRetry: () => void;
  onClose: () => void;
}

export const AuthErrorModal: React.FC<AuthErrorModalProps> = ({
  error,
  onRetry,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyDomain = async () => {
    if (!error.unauthorizedDomain || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(error.unauthorizedDomain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const currentHref = typeof window !== 'undefined' ? window.location.href : '/';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-error-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h2
                id="auth-error-title"
                className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100"
              >
                {error.title}
              </h2>
              <span className="inline-block mt-1 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                {error.code}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign-in error dialog"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">
          {error.message}
        </p>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/70 p-3.5 space-y-2.5">
          <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
            How to fix
          </div>
          {error.steps && error.steps.length > 0 ? (
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {error.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {error.actionHint}
            </p>
          )}

          {error.unauthorizedDomain && (
            <div className="pt-1 flex items-center justify-between gap-2">
              <code className="px-2 py-1 rounded bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-900 dark:text-neutral-100 truncate">
                {error.unauthorizedDomain}
              </code>
              <button
                type="button"
                onClick={handleCopyDomain}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy domain'}</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Your local study hours, tasks, and coins stay saved in this browser until cloud sync connects.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          {error.consoleSettingsUrl && (
            <a
              href={error.consoleSettingsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200"
            >
              <ExternalLink className="w-3.5 h-3.5 text-orange-500" />
              <span>Open Firebase Console</span>
            </a>
          )}
          {error.inIframe && (
            <a
              href={currentHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab</span>
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
