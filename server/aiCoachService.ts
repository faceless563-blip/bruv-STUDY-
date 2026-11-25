import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

export class AiCoachError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'AiCoachError';
    this.status = status;
    this.code = code;
  }
}

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface PlannerContextPayload {
  todayKey: string;
  profile: {
    name: string;
    category: string;
    dailyGoalHours: number;
    resetHour: number;
    motto: string;
  };
  todayStudiedMinutes: number;
  weekStudiedMinutes: number;
  subjects: Array<{
    id: string;
    name: string;
    dailyTargetMinutes: number;
    todayMinutes: number;
  }>;
  pendingTodosToday: Array<{
    title: string;
    subjectName: string;
    estimatedMinutes: number;
  }>;
  completedTodosTodayCount: number;
  upcomingDDays: Array<{
    title: string;
    targetDate: string;
    label: string;
  }>;
}

export interface RawSuggestedTask {
  title: string;
  subjectName: string;
  estimatedMinutes: number;
  studyDayKey: string;
  rationale: string;
}

export interface AiCoachResponsePayload {
  reply: string;
  planSummary: string;
  suggestedTasks: RawSuggestedTask[];
}

export function sanitizeChatInput(body: unknown): {
  message: string;
  history: ChatHistoryTurn[];
  context: PlannerContextPayload;
} {
  if (!body || typeof body !== 'object') {
    throw new AiCoachError('Invalid request body.', 400, 'INVALID_REQUEST');
  }
  const rec = body as Record<string, unknown>;
  const message = String(rec.message ?? '').trim().slice(0, 1500);
  if (!message) {
    throw new AiCoachError('Enter a message for AI Study Coach.', 400, 'EMPTY_MESSAGE');
  }

  const rawHistory = Array.isArray(rec.history) ? rec.history.slice(-10) : [];
  const history: ChatHistoryTurn[] = [];
  for (const h of rawHistory) {
    if (!h || typeof h !== 'object') continue;
    const turn = h as Record<string, unknown>;
    const role = turn.role === 'assistant' ? 'assistant' : turn.role === 'user' ? 'user' : null;
    const content = String(turn.content ?? '').trim().slice(0, 1200);
    if (role && content) {
      history.push({ role, content });
    }
  }

  const rawCtx = (rec.context && typeof rec.context === 'object' ? rec.context : {}) as Record<
    string,
    unknown
  >;
  const rawProfile = (
    rawCtx.profile && typeof rawCtx.profile === 'object' ? rawCtx.profile : {}
  ) as Record<string, unknown>;

  const todayKeyRaw = String(rawCtx.todayKey ?? '').trim();
  const todayKey = /^\d{4}-\d{2}-\d{2}$/.test(todayKeyRaw)
    ? todayKeyRaw
    : new Date().toISOString().slice(0, 10);

  const subjects = Array.isArray(rawCtx.subjects)
    ? rawCtx.subjects.slice(0, 15).map((s) => {
        const sub = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
        return {
          id: String(sub.id ?? '').slice(0, 128),
          name: String(sub.name ?? 'Subject').trim().slice(0, 60),
          dailyTargetMinutes: Math.max(0, Math.min(720, Number(sub.dailyTargetMinutes) || 60)),
          todayMinutes: Math.max(0, Math.min(1440, Number(sub.todayMinutes) || 0)),
        };
      })
    : [];

  const pendingTodosToday = Array.isArray(rawCtx.pendingTodosToday)
    ? rawCtx.pendingTodosToday.slice(0, 20).map((t) => {
        const td = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>;
        return {
          title: String(td.title ?? '').trim().slice(0, 140),
          subjectName: String(td.subjectName ?? 'General').trim().slice(0, 60),
          estimatedMinutes: Math.max(5, Math.min(240, Number(td.estimatedMinutes) || 30)),
        };
      })
    : [];

  const upcomingDDays = Array.isArray(rawCtx.upcomingDDays)
    ? rawCtx.upcomingDDays.slice(0, 5).map((d) => {
        const dd = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
        return {
          title: String(dd.title ?? '').trim().slice(0, 80),
          targetDate: String(dd.targetDate ?? '').trim().slice(0, 10),
          label: String(dd.label ?? '').trim().slice(0, 20),
        };
      })
    : [];

  const context: PlannerContextPayload = {
    todayKey,
    profile: {
      name: String(rawProfile.name ?? 'My Desk').trim().slice(0, 60) || 'My Desk',
      category:
        String(rawProfile.category ?? 'University & STEM').trim().slice(0, 50) ||
        'University & STEM',
      dailyGoalHours: Math.max(1, Math.min(18, Number(rawProfile.dailyGoalHours) || 6)),
      resetHour: Math.max(0, Math.min(11, Number(rawProfile.resetHour) ?? 5)),
      motto: String(rawProfile.motto ?? '').trim().slice(0, 140),
    },
    todayStudiedMinutes: Math.max(0, Math.min(1440, Number(rawCtx.todayStudiedMinutes) || 0)),
    weekStudiedMinutes: Math.max(0, Math.min(10080, Number(rawCtx.weekStudiedMinutes) || 0)),
    subjects,
    pendingTodosToday,
    completedTodosTodayCount: Math.max(
      0,
      Math.min(200, Number(rawCtx.completedTodosTodayCount) || 0)
    ),
    upcomingDDays,
  };

  return { message, history, context };
}

export function buildCoachSystemInstruction(ctx: PlannerContextPayload): string {
  const subjectsLine =
    ctx.subjects.length > 0
      ? ctx.subjects
          .map(
            (s) =>
              `- ${s.name} (logged ${s.todayMinutes}m / target ${s.dailyTargetMinutes}m)`
          )
          .join('\n')
      : '- No custom subjects created yet (use "General")';

  const ddayLine =
    ctx.upcomingDDays.length > 0
      ? ctx.upcomingDDays.map((d) => `- ${d.title}: ${d.label} (${d.targetDate})`).join('\n')
      : '- None set';

  const pendingLine =
    ctx.pendingTodosToday.length > 0
      ? ctx.pendingTodosToday
          .map((t) => `- [${t.subjectName}] ${t.title} (~${t.estimatedMinutes}m)`)
          .join('\n')
      : '- No pending tasks today';

  return `You are Bruv-study AI Study Coach — a focused, practical, encouraging academic study planner.
Help the student organize their study time, break down topics into realistic blocks, prioritize around exam D-Days, and create concrete To-Do tasks they can add directly to their 10-Minute Planner.

STUDENT DESK CONTEXT (Study Day: ${ctx.todayKey}, daily reset at ${String(ctx.profile.resetHour).padStart(2, '0')}:00):
- Name: ${ctx.profile.name}
- Track / Category: ${ctx.profile.category}
- Daily Goal: ${ctx.profile.dailyGoalHours}h (${ctx.profile.dailyGoalHours * 60}m)
- Studied Today: ${ctx.todayStudiedMinutes}m | Studied This Week: ${ctx.weekStudiedMinutes}m
- Tasks Completed Today: ${ctx.completedTodosTodayCount}
${ctx.profile.motto ? `- Desk Motto: "${ctx.profile.motto}"` : ''}

ACTIVE SUBJECTS:
${subjectsLine}

UPCOMING D-DAYS:
${ddayLine}

PENDING TODAY TASKS:
${pendingLine}

OUTPUT INSTRUCTIONS:
1. Respond with valid JSON matching the schema.
2. "reply": Concise, actionable coaching guidance tailored to the student's question and desk context (2-5 short sentences or clean bullet lines, no fluff).
3. "planSummary": A 1-line summary of the focus strategy (e.g., "3 focused blocks · 135m total prioritized for Calculus II"). Leave empty string "" if the student is only asking a general study question with no tasks.
4. "suggestedTasks": Whenever the student asks for a study plan, schedule, task breakdown, or prioritization, provide 2-6 specific, actionable To-Do tasks. Match "subjectName" to one of their ACTIVE SUBJECTS whenever relevant (or "General" if none fit). Set "estimatedMinutes" realistically between 15 and 90, and "studyDayKey" to "${ctx.todayKey}" unless they specifically ask for another date (YYYY-MM-DD). If no task suggestions are needed for a conversational reply, return an empty array [].`;
}

export function parseCoachResponseJson(rawText: string | undefined): AiCoachResponsePayload {
  let cleaned = String(rawText ?? '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  if (!cleaned) {
    throw new AiCoachError(
      'AI Study Coach returned an empty response. Please try again.',
      502,
      'AI_EMPTY_RESPONSE'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AiCoachError(
      'AI Study Coach returned malformed structured output.',
      502,
      'AI_PARSE_ERROR'
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new AiCoachError('Invalid AI Study Coach payload.', 502, 'AI_PARSE_ERROR');
  }

  const rec = parsed as Record<string, unknown>;
  const reply = String(rec.reply ?? '').trim();
  const planSummary = String(rec.planSummary ?? '').trim();
  const rawList = Array.isArray(rec.suggestedTasks) ? rec.suggestedTasks : [];

  const suggestedTasks: RawSuggestedTask[] = rawList
    .slice(0, 8)
    .map((item) => {
      const t = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
      return {
        title: String(t.title ?? '').trim().slice(0, 140),
        subjectName: String(t.subjectName ?? 'General').trim().slice(0, 60) || 'General',
        estimatedMinutes: Math.max(5, Math.min(240, Math.round(Number(t.estimatedMinutes) || 30))),
        studyDayKey: /^\d{4}-\d{2}-\d{2}$/.test(String(t.studyDayKey ?? '').trim())
          ? String(t.studyDayKey).trim()
          : '',
        rationale: String(t.rationale ?? '').trim().slice(0, 180),
      };
    })
    .filter((t) => Boolean(t.title));

  return {
    reply: reply || 'Here is a focused plan based on your study desk.',
    planSummary,
    suggestedTasks,
  };
}

export function extractReadableGeminiError(err: unknown): {
  status: number;
  message: string;
} {
  if (err instanceof AiCoachError) {
    return { status: err.status, message: err.message };
  }

  const fallbackStatus =
    typeof (err as { status?: unknown })?.status === 'number'
      ? (err as { status: number }).status
      : 502;
  let status = fallbackStatus >= 400 && fallbackStatus < 600 ? fallbackStatus : 502;
  let rawMsg = err instanceof Error ? err.message : 'Gemini request failed.';

  const trimmed = rawMsg.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: { code?: number; message?: string; status?: string };
        message?: string;
      };
      if (typeof parsed?.error?.code === 'number') {
        status = parsed.error.code;
      }
      const innerMsg = parsed?.error?.message || parsed?.message;
      if (typeof innerMsg === 'string' && innerMsg.trim()) {
        rawMsg = innerMsg.trim();
      }
    } catch {
      // keep rawMsg
    }
  }

  if (status === 503 || /high demand|unavailable/i.test(rawMsg)) {
    return {
      status: 503,
      message:
        'AI Study Coach is temporarily busy due to high model demand. Please try again in a moment.',
    };
  }

  if (status === 429) {
    return {
      status: 429,
      message: 'AI service rate limit reached temporarily. Please wait a few seconds and try again.',
    };
  }

  if (status === 504 || /timed out|timeout/i.test(rawMsg)) {
    return {
      status: 504,
      message: 'AI Study Coach took too long to respond. Please try again in a moment.',
    };
  }

  return {
    status,
    message: rawMsg,
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new AiCoachError('AI request timed out.', 504, 'AI_UPSTREAM_TIMEOUT'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface ModelAttemptSpec {
  model: string;
  thinkingLevel?: ThinkingLevel;
}

export const AI_COACH_MODEL_ATTEMPTS: ModelAttemptSpec[] = [
  { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
  { model: 'gemini-3.1-flash-lite' },
];

export async function generateStudyCoachPlan(input: {
  message: string;
  history: ChatHistoryTurn[];
  context: PlannerContextPayload;
}): Promise<AiCoachResponsePayload> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new AiCoachError(
      'AI Study Coach is not configured yet: GEMINI_API_KEY is missing on the server.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const contents = [
    ...input.history.map((turn) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })),
    {
      role: 'user',
      parts: [{ text: input.message }],
    },
  ];

  const systemInstruction = buildCoachSystemInstruction(input.context);
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      reply: {
        type: Type.STRING,
        description: 'Helpful, concise study coaching response.',
      },
      planSummary: {
        type: Type.STRING,
        description: 'Optional 1-line summary of the suggested plan.',
      },
      suggestedTasks: {
        type: Type.ARRAY,
        description: 'Actionable To-Do study tasks tailored to the student.',
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subjectName: { type: Type.STRING },
            estimatedMinutes: { type: Type.INTEGER },
            studyDayKey: { type: Type.STRING },
            rationale: { type: Type.STRING },
          },
          required: [
            'title',
            'subjectName',
            'estimatedMinutes',
            'studyDayKey',
            'rationale',
          ],
        },
      },
    },
    required: ['reply', 'planSummary', 'suggestedTasks'],
  };

  let lastErr: unknown;
  for (let i = 0; i < AI_COACH_MODEL_ATTEMPTS.length; i++) {
    const spec = AI_COACH_MODEL_ATTEMPTS[i];
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: spec.model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            ...(spec.thinkingLevel
              ? { thinkingConfig: { thinkingLevel: spec.thinkingLevel } }
              : {}),
          },
        }),
        14000
      );
      return parseCoachResponseJson(response.text);
    } catch (err) {
      lastErr = err;
      const parsed = extractReadableGeminiError(err);
      const rawErrMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[AI Coach] ${spec.model} failed (status=${parsed.status}): ${rawErrMsg.slice(0, 300)}`
      );
      const isAuthOrClientError =
        parsed.status === 400 || parsed.status === 401 || parsed.status === 403;
      const hasNextModel = i < AI_COACH_MODEL_ATTEMPTS.length - 1;

      if (!isAuthOrClientError && hasNextModel) {
        continue;
      }
      throw new AiCoachError(parsed.message, parsed.status, 'AI_UPSTREAM_ERROR');
    }
  }

  const parsed = extractReadableGeminiError(lastErr);
  throw new AiCoachError(parsed.message, parsed.status, 'AI_UPSTREAM_ERROR');
}
