import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAuthErrorCode, parseFirebaseAuthError } from './authErrorLogic';

test('extractAuthErrorCode parses FirebaseError objects and message strings', () => {
  assert.equal(extractAuthErrorCode({ code: 'auth/unauthorized-domain' }), 'auth/unauthorized-domain');
  assert.equal(
    extractAuthErrorCode(new Error('Firebase: Error (auth/popup-blocked).')),
    'auth/popup-blocked'
  );
  assert.equal(extractAuthErrorCode(new Error('Something broke')), 'auth/unknown');
});

test('parseFirebaseAuthError provides actionable unauthorized-domain guidance with hostname', () => {
  const parsed = parseFirebaseAuthError(
    { code: 'auth/unauthorized-domain' },
    { hostname: 'bruv-study.vercel.app', inIframe: false, firebaseProjectId: 'savvy-proxy-7sjh2' }
  );
  assert.equal(parsed.code, 'auth/unauthorized-domain');
  assert.equal(parsed.unauthorizedDomain, 'bruv-study.vercel.app');
  assert.ok(parsed.message.includes('bruv-study.vercel.app'));
  assert.ok(parsed.actionHint.includes('Authorized domains'));
});

test('parseFirebaseAuthError differentiates iframe vs top-level popup-blocked guidance', () => {
  const iframeErr = parseFirebaseAuthError(
    { code: 'auth/popup-blocked' },
    { hostname: 'ais-dev.run.app', inIframe: true }
  );
  assert.ok(iframeErr.actionHint.includes('standalone browser tab'));

  const tabErr = parseFirebaseAuthError(
    { code: 'auth/popup-blocked' },
    { hostname: 'ais-dev.run.app', inIframe: false }
  );
  assert.ok(tabErr.actionHint.includes('Allow popups'));
});
