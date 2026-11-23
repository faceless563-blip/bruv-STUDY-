import React from 'react';
import { AlertTriangle, LogOut, RotateCcw } from 'lucide-react';
import { signOutUser } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught application error:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      let parsedDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as {
          error?: string;
          operationType?: string;
          path?: string;
        };
        if (parsed?.error) {
          parsedDetail = `${parsed.operationType ?? 'operation'} on ${
            parsed.path ?? 'Firestore'
          }: ${parsed.error}`;
        }
      } catch {
        // use raw message
      }

      const handleSignOutAndReload = async () => {
        try {
          await signOutUser();
        } catch {
          // ignore
        }
        window.location.reload();
      };

      return (
        <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0B0D11] text-neutral-900 dark:text-neutral-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="font-display font-semibold text-base">
                Workspace Sync Error
              </h1>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 break-words font-mono bg-neutral-50 dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
              {parsedDetail}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Bruv-study</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSignOutAndReload();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out &amp; Continue Locally</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
