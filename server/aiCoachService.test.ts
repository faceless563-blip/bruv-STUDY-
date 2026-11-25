import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiCoachError,
  buildCoachSystemInstruction,
  extractReadableGeminiError,
  generateStudyCoachPlan,
  parseCoachResponseJson,
  sanitizeChatInput,
} from './aiCoachService.ts';

test('sanitizeChatInput rejects empty messages and bounds history + context', () => {
  assert.throws(
    () => sanitizeChatInput({ message: '   ', context: {} }),
    (err: unknown) => err instanceof AiCoachError && err.status === 400
  );

  const sanitized = sanitizeChatInput({
    message: 'Help me plan math today',
    history: [
      { role: 'user', content: 'Hi' },
      { role: 'invalid', content: 'skip' },
      { role: 'assistant', content: 'Hello!' },
    ],
    context: {
      todayKey: '2026-11-25',
      profile: {
        name: 'Tariq',
        category: 'SAT / ACT Prep',
        dailyGoalHours: 4,
        resetHour: 5,
        motto: 'Focus',
      },
      subjects: [{ id: 's1', name: 'Math', dailyTargetMinutes: 90, todayMinutes: 20 }],
      pendingTodosToday: [{ title: 'Practice test 1', subjectName: 'Math', estimatedMinutes: 45 }],
      upcomingDDays: [{ title: 'SAT', targetDate: '2026-12-10', label: 'D-15' }],
    },
  });

  assert.equal(sanitized.message, 'Help me plan math today');
  assert.equal(sanitized.history.length, 2);
  assert.equal(sanitized.context.subjects[0].name, 'Math');
});

test('parseCoachResponseJson extracts structured reply and tasks cleanly', () => {
  const parsed = parseCoachResponseJson(
    JSON.stringify({
      reply: 'Start with a focused 45m Math drill.',
      planSummary: '2 blocks · 75m total',
      suggestedTasks: [
        {
          title: 'Complete Section 3 algebra drill',
          subjectName: 'Math',
          estimatedMinutes: 45,
          studyDayKey: '2026-11-25',
          rationale: 'Targets your weakest section before D-15.',
        },
      ],
    })
  );

  assert.equal(parsed.reply, 'Start with a focused 45m Math drill.');
  assert.equal(parsed.planSummary, '2 blocks · 75m total');
  assert.equal(parsed.suggestedTasks.length, 1);
  assert.equal(parsed.suggestedTasks[0].estimatedMinutes, 45);
});

test('generateStudyCoachPlan fails honestly with 503 when GEMINI_API_KEY is missing', async () => {
  const prev = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const input = sanitizeChatInput({
      message: 'Make my plan',
      context: { todayKey: '2026-11-25' },
    });
    await assert.rejects(
      () => generateStudyCoachPlan(input),
      (err: unknown) => err instanceof AiCoachError && err.status === 503 && err.code === 'AI_NOT_CONFIGURED'
    );
  } finally {
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
  }
});

test('buildCoachSystemInstruction embeds D-Days, subjects, and pending tasks', () => {
  const { context } = sanitizeChatInput({
    message: 'Plan',
    context: {
      todayKey: '2026-11-25',
      subjects: [{ id: 's1', name: 'Biology', dailyTargetMinutes: 60, todayMinutes: 10 }],
      upcomingDDays: [{ title: 'Finals', targetDate: '2026-12-01', label: 'D-6' }],
    },
  });
  const sys = buildCoachSystemInstruction(context);
  assert.match(sys, /Biology/);
  assert.match(sys, /Finals: D-6/);
});

test('extractReadableGeminiError unwraps JSON 503 payloads into clean user-facing text', () => {
  const err = new Error(
    JSON.stringify({
      error: {
        code: 503,
        message: 'This model is currently experiencing high demand.',
        status: 'UNAVAILABLE',
      },
    })
  );
  const parsed = extractReadableGeminiError(err);
  assert.equal(parsed.status, 503);
  assert.doesNotMatch(parsed.message, /^\{/);
  assert.match(parsed.message, /temporarily busy/i);
});

test('parseCoachResponseJson strips optional markdown json fences', () => {
  const parsed = parseCoachResponseJson(
    '```json\n{"reply":"Review notes first.","planSummary":"1 block · 30m","suggestedTasks":[{"title":"Revise integrals","subjectName":"Math","estimatedMinutes":30,"studyDayKey":"2026-11-25","rationale":"Core warmup"}]}\n```'
  );
  assert.equal(parsed.reply, 'Review notes first.');
  assert.equal(parsed.suggestedTasks.length, 1);
  assert.equal(parsed.suggestedTasks[0].title, 'Revise integrals');
});

test('extractReadableGeminiError formats timeout errors cleanly', () => {
  const parsed = extractReadableGeminiError(
    new AiCoachError('AI request timed out.', 504, 'AI_UPSTREAM_TIMEOUT')
  );
  assert.equal(parsed.status, 504);
  assert.match(parsed.message, /timed out/i);
});
