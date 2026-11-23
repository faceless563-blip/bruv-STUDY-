import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getDesktopInstallGuidance,
  isIosUserAgent,
  isStandaloneDisplayMode,
  resolveInstallFlowMode,
} from './pwaLogic';

test('isStandaloneDisplayMode detects display-mode standalone and navigator.standalone', () => {
  assert.equal(
    isStandaloneDisplayMode({ matchMediaStandalone: true, navigatorStandalone: false }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({ matchMediaStandalone: false, navigatorStandalone: true }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({ matchMediaStandalone: false, navigatorStandalone: false }),
    false
  );
});

test('isIosUserAgent detects iPhone, iPad, and touch-enabled iPadOS Macintosh', () => {
  assert.equal(
    isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'),
    true
  );
  assert.equal(
    isIosUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5),
    true
  );
  assert.equal(
    isIosUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0', 0),
    false
  );
});

test('resolveInstallFlowMode prioritizes installed, native-prompt, ios-guide, then desktop-guide', () => {
  assert.equal(
    resolveInstallFlowMode({ isInstalled: true, hasDeferredPrompt: true, isIOS: true }),
    'installed'
  );
  assert.equal(
    resolveInstallFlowMode({ isInstalled: false, hasDeferredPrompt: true, isIOS: false }),
    'native-prompt'
  );
  assert.equal(
    resolveInstallFlowMode({ isInstalled: false, hasDeferredPrompt: false, isIOS: true }),
    'ios-guide'
  );
  assert.equal(
    resolveInstallFlowMode({ isInstalled: false, hasDeferredPrompt: false, isIOS: false }),
    'desktop-guide'
  );
});

test('getDesktopInstallGuidance tailors instructions for Edge, Safari macOS, and Chrome', () => {
  const edge = getDesktopInstallGuidance(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/126.0.0.0'
  );
  assert.equal(edge.browserLabel, 'Microsoft Edge');
  assert.equal(edge.steps.length, 3);

  const safari = getDesktopInstallGuidance(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15'
  );
  assert.equal(safari.browserLabel, 'Safari on macOS');

  const chrome = getDesktopInstallGuidance(
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36'
  );
  assert.equal(chrome.browserLabel, 'Chrome / Desktop Browser');
});
