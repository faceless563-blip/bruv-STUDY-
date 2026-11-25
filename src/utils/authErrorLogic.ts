export interface ParsedAuthError {
  code: string;
  title: string;
  message: string;
  actionHint: string;
  unauthorizedDomain?: string;
  consoleSettingsUrl?: string;
  steps?: string[];
  inIframe: boolean;
}

export function extractAuthErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? 'auth/unknown');
  }
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const match = msg.match(/\(?(auth\/[a-z0-9-]+)\)?/i);
  return match ? match[1].toLowerCase() : 'auth/unknown';
}

export function parseFirebaseAuthError(
  error: unknown,
  context: {
    hostname: string;
    inIframe: boolean;
    firebaseProjectId?: string;
  }
): ParsedAuthError {
  const code = extractAuthErrorCode(error);
  const host = context.hostname || 'this domain';
  const projectId = context.firebaseProjectId || 'savvy-proxy-7sjh2';
  const authSettingsUrl = `https://console.firebase.google.com/project/${encodeURIComponent(
    projectId
  )}/authentication/settings`;

  switch (code) {
    case 'auth/unauthorized-domain':
      return {
        code,
        title: 'Domain Not Authorized for Google Sign-In',
        message: `Firebase blocked Google Sign-In because "${host}" is not yet in Authorized Domains for project "${projectId}".`,
        actionHint: `Copy "${host}", open Firebase Console → Authentication → Settings → Authorized domains, click Add domain, paste "${host}", and click Try Again.`,
        unauthorizedDomain: host,
        consoleSettingsUrl: authSettingsUrl,
        steps: [
          `Click "Copy domain" below to copy "${host}".`,
          'Click "Open Firebase Console" → scroll to Authorized domains → click Add domain and paste it.',
          'Return to this tab and click "Try Again".',
        ],
        inIframe: context.inIframe,
      };

    case 'auth/popup-blocked':
      return {
        code,
        title: 'Google Sign-In Popup Blocked',
        message: context.inIframe
          ? 'Your browser blocked the Google Sign-In popup inside this embedded preview frame.'
          : 'Your browser blocked the Google Sign-In popup window.',
        actionHint: context.inIframe
          ? 'Allow popups for this site, or open Bruv-study in a standalone browser tab and click Sign in with Google.'
          : 'Allow popups for this site in your browser address bar, then click Sign in with Google again.',
        inIframe: context.inIframe,
      };

    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return {
        code,
        title: 'Sign-In Window Closed',
        message: 'The Google Sign-In popup was closed before sign-in finished.',
        actionHint: 'Click Sign in with Google again and finish choosing your Google account.',
        inIframe: context.inIframe,
      };

    case 'auth/operation-not-allowed':
      return {
        code,
        title: 'Google Provider Disabled',
        message: 'Google Sign-In is not currently enabled in Firebase Authentication.',
        actionHint: `Enable the Google sign-in provider under Firebase Console → Authentication → Sign-in method for "${projectId}".`,
        consoleSettingsUrl: `https://console.firebase.google.com/project/${encodeURIComponent(
          projectId
        )}/authentication/providers`,
        inIframe: context.inIframe,
      };

    case 'auth/network-request-failed':
      return {
        code,
        title: 'Network Error During Sign-In',
        message: 'Could not reach Firebase or Google authentication servers.',
        actionHint:
          'Check your internet connection and verify no ad/privacy blocker is blocking identitytoolkit.googleapis.com or accounts.google.com.',
        inIframe: context.inIframe,
      };

    case 'auth/web-storage-unsupported':
    case 'auth/internal-error':
      return {
        code,
        title: 'Browser Storage or Frame Restriction',
        message:
          'Your browser blocked cross-origin storage or popup messaging needed for Google Sign-In.',
        actionHint: context.inIframe
          ? 'Open Bruv-study in a full browser tab outside the preview frame, or enable third-party cookies for firebaseapp.com.'
          : 'Enable site cookies/storage for this app and firebaseapp.com, then try again.',
        inIframe: context.inIframe,
      };

    default: {
      const rawMsg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      return {
        code,
        title: 'Google Sign-In Failed',
        message: rawMsg,
        actionHint: 'Please try again, or open the app in a standalone browser tab if the issue persists.',
        inIframe: context.inIframe,
      };
    }
  }
}
