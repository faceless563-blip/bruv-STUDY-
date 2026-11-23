export type InstallFlowMode = 'installed' | 'native-prompt' | 'ios-guide' | 'desktop-guide';

export interface InstallDetectionInput {
  isInstalled: boolean;
  hasDeferredPrompt: boolean;
  isIOS: boolean;
}

export interface DesktopInstallSteps {
  browserLabel: string;
  steps: string[];
}

export function isStandaloneDisplayMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return Boolean(input.matchMediaStandalone || input.navigatorStandalone === true);
}

export function isIosUserAgent(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return true;
  // iPadOS Safari often reports Macintosh with touch points
  return /macintosh/.test(ua) && maxTouchPoints > 1;
}

export function resolveInstallFlowMode(input: InstallDetectionInput): InstallFlowMode {
  if (input.isInstalled) return 'installed';
  if (input.hasDeferredPrompt) return 'native-prompt';
  if (input.isIOS) return 'ios-guide';
  return 'desktop-guide';
}

export function getDesktopInstallGuidance(userAgent: string): DesktopInstallSteps {
  const ua = userAgent.toLowerCase();

  if (ua.includes('edg/')) {
    return {
      browserLabel: 'Microsoft Edge',
      steps: [
        'Look for the App Available icon on the right side of the Edge address bar.',
        'Or open Edge menu (⋯) → Apps → Install Bruv-study.',
        'Click Install to launch Bruv-study in its own desktop window and taskbar shortcut.',
      ],
    };
  }

  if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium')) {
    return {
      browserLabel: 'Safari on macOS',
      steps: [
        'In the macOS menu bar, click File → Add to Dock.',
        'Confirm the app name ("Bruv-study") and click Add.',
        'Launch Bruv-study anytime directly from your macOS Dock or Applications.',
      ],
    };
  }

  return {
    browserLabel: 'Chrome / Desktop Browser',
    steps: [
      'Click the Install App icon on the right side of the browser address bar.',
      'Or open the browser menu (⋮) → Cast, save, and share → Install Bruv-study.',
      'If viewing inside an embedded preview frame, open the app URL in a standalone tab first.',
    ],
  };
}
