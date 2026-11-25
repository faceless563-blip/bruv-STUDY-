import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const blueprint = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8')
);
const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

test('firestore.rules covers every collection declared in firebase-blueprint.json', () => {
  const expectedMatches = [
    'match /users/{userId}',
    'match /subjects/{subjectId}',
    'match /sessions/{sessionId}',
    'match /todos/{todoId}',
    'match /ddays/{ddayId}',
    'match /leaderboard/{userId}',
    'match /studyGroups/{groupId}',
    'match /members/{memberId}',
    'match /missions/{missionId}',
  ];
  for (const m of expectedMatches) {
    assert.ok(rulesText.includes(m), `Missing rule block: ${m}`);
  }
  assert.ok(Object.keys(blueprint.firestore).length === expectedMatches.length);
});

test('firestore.rules enforces Eight Pillars hardened constraints', () => {
  assert.match(rulesText, /rules_version\s*=\s*'2'/);
  assert.match(rulesText, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /isValidId\(/);
  assert.match(rulesText, /affectedKeys\(\)\.hasOnly\(/);
  assert.match(rulesText, /request\.time/);
  assert.match(rulesText, /aiTier in \['free', 'premium', 'ultimate'\]/);
  assert.match(rulesText, /aiUsageDayKey/);
  assert.match(rulesText, /aiMessagesUsedToday/);
  // Never allow blanket list reads
  assert.doesNotMatch(rulesText, /allow\s+list:\s*if\s+isSignedIn\(\)\s*;/);
});
