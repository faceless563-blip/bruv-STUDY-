import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AccentTheme,
  AppState,
  DDayTarget,
  FeaturePackId,
  GroupMember,
  GroupMission,
  RankingEntry,
  STUDY_CATEGORIES,
  StudyCategory,
  StudyGroup,
  StudySession,
  Subject,
  TodoItem,
} from '../types/ypt';

const ALLOWED_PACK_IDS = new Set<FeaturePackId>([
  'focus_lock',
  'study_groups',
  'advanced_insights',
  'sounds_themes',
  'custom_pomodoro',
]);

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function clampString(val: string, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

function sanitizeId(raw: string): string {
  const cleaned = String(raw ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  return cleaned.slice(0, 128) || `id-${Date.now()}`;
}

function sanitizeHexColor(hex: string): string {
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#F97316';
}

function sanitizeDateKey(val: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(val)
    ? val
    : new Date().toISOString().slice(0, 10);
}

export interface WorkspaceDocPayload {
  uid: string;
  theme: 'light' | 'dark';
  activeTimerMode: 'stopwatch' | 'pomodoro';
  profileName: string;
  profileCategory: string;
  dailyGoalHours: number;
  resetHour: number;
  motto: string;
  pomodoroFocusMinutes: number;
  pomodoroShortBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodoroCyclesBeforeLongBreak: number;
  autoPauseOnTabSwitch: boolean;
  allowedTools: string[];
  showFloatingGoalBar: boolean;
  coins: number;
  unlockedPacks: FeaturePackId[];
  proAllAccess: boolean;
  claimedPeriodKeys: string[];
  accentTheme: AccentTheme;
  checkedInToday: boolean;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

export function buildWorkspacePayload(uid: string, state: AppState): WorkspaceDocPayload {
  return {
    uid: sanitizeId(uid),
    theme: state.theme === 'dark' ? 'dark' : 'light',
    activeTimerMode: state.activeTimerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
    profileName: clampString(state.profile.name, 60) || 'My Desk',
    profileCategory: clampString(state.profile.category, 50) || 'University & STEM',
    dailyGoalHours: clampNumber(state.profile.dailyGoalHours, 1, 18),
    resetHour: clampNumber(state.profile.resetHour, 0, 11),
    motto: clampString(state.profile.motto, 140),
    pomodoroFocusMinutes: clampNumber(state.pomodoro.focusMinutes, 5, 120),
    pomodoroShortBreakMinutes: clampNumber(state.pomodoro.shortBreakMinutes, 1, 30),
    pomodoroLongBreakMinutes: clampNumber(state.pomodoro.longBreakMinutes, 5, 60),
    pomodoroCyclesBeforeLongBreak: clampNumber(state.pomodoro.cyclesBeforeLongBreak, 1, 10),
    autoPauseOnTabSwitch: Boolean(state.focusGuard.autoPauseOnTabSwitch),
    allowedTools: state.focusGuard.allowedTools
      .map((t) => clampString(t, 60))
      .filter(Boolean)
      .slice(0, 20),
    showFloatingGoalBar: Boolean(state.focusGuard.showFloatingGoalBar),
    coins: clampNumber(state.wallet.coins, 0, 1000000),
    unlockedPacks: state.wallet.unlockedPacks
      .filter((p) => ALLOWED_PACK_IDS.has(p))
      .slice(0, 5),
    proAllAccess: Boolean(state.wallet.proAllAccess),
    claimedPeriodKeys: state.wallet.claimedPeriodKeys
      .map((k) => clampString(k, 80))
      .filter(Boolean)
      .slice(0, 500),
    accentTheme: (['orange', 'cobalt', 'emerald', 'violet'] as AccentTheme[]).includes(
      state.wallet.accentTheme
    )
      ? state.wallet.accentTheme
      : 'orange',
    checkedInToday: Boolean(state.checkedInToday),
    updatedAt: serverTimestamp(),
  };
}

export async function saveWorkspaceDoc(uid: string, state: AppState): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), buildWorkspacePayload(uid, state));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureUserWorkspaceInitialized(
  uid: string,
  localState: AppState,
  displayName?: string | null
): Promise<boolean> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return false;
    }

    const seededState: AppState = {
      ...localState,
      profile: {
        ...localState.profile,
        name:
          localState.profile.name === 'My Desk' && displayName?.trim()
            ? clampString(displayName, 60)
            : localState.profile.name,
      },
    };

    await saveWorkspaceDoc(uid, seededState);

    for (const subj of seededState.subjects) {
      await upsertSubjectDoc(uid, subj);
    }
    for (const dday of seededState.ddays) {
      await upsertDDayDoc(uid, dday);
    }
    for (const sess of seededState.sessions) {
      await createSessionDoc(uid, sess);
    }
    for (const todo of seededState.todos) {
      await upsertTodoDoc(uid, todo);
    }
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertSubjectDoc(uid: string, subject: Subject): Promise<void> {
  const id = sanitizeId(subject.id);
  const path = `users/${uid}/subjects/${id}`;
  const ref = doc(db, 'users', uid, 'subjects', id);
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      await updateDoc(ref, {
        name: clampString(subject.name, 60) || 'Subject',
        color: sanitizeHexColor(subject.color),
        dailyTargetMinutes: clampNumber(subject.dailyTargetMinutes, 10, 720),
        archived: Boolean(subject.archived),
      });
    } else {
      await setDoc(ref, {
        id,
        userId: uid,
        name: clampString(subject.name, 60) || 'Subject',
        color: sanitizeHexColor(subject.color),
        dailyTargetMinutes: clampNumber(subject.dailyTargetMinutes, 10, 720),
        archived: Boolean(subject.archived),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteSubjectDoc(uid: string, subjectId: string): Promise<void> {
  const id = sanitizeId(subjectId);
  const path = `users/${uid}/subjects/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'subjects', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createSessionDoc(uid: string, session: StudySession): Promise<void> {
  const id = sanitizeId(session.id);
  const path = `users/${uid}/sessions/${id}`;
  try {
    const startTime = Math.max(1, Math.floor(session.startTime));
    const endTime = Math.max(startTime, Math.floor(session.endTime));
    await setDoc(doc(db, 'users', uid, 'sessions', id), {
      id,
      userId: uid,
      subjectId: sanitizeId(session.subjectId),
      startTime,
      endTime,
      durationSeconds: clampNumber(session.durationSeconds, 1, 86400),
      mode: session.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
      note: clampString(session.note ?? '', 200),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function upsertTodoDoc(uid: string, todo: TodoItem): Promise<void> {
  const id = sanitizeId(todo.id);
  const path = `users/${uid}/todos/${id}`;
  const ref = doc(db, 'users', uid, 'todos', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        title: clampString(todo.title, 140) || 'Study task',
        completed: Boolean(todo.completed),
        studyDayKey: sanitizeDateKey(todo.studyDayKey),
        estimatedMinutes: clampNumber(todo.estimatedMinutes ?? 30, 5, 720),
      });
    } else {
      await setDoc(ref, {
        id,
        userId: uid,
        subjectId: todo.subjectId === 'general' ? 'general' : sanitizeId(todo.subjectId),
        title: clampString(todo.title, 140) || 'Study task',
        completed: Boolean(todo.completed),
        studyDayKey: sanitizeDateKey(todo.studyDayKey),
        estimatedMinutes: clampNumber(todo.estimatedMinutes ?? 30, 5, 720),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTodoDoc(uid: string, todoId: string): Promise<void> {
  const id = sanitizeId(todoId);
  const path = `users/${uid}/todos/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'todos', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertDDayDoc(uid: string, dday: DDayTarget): Promise<void> {
  const id = sanitizeId(dday.id);
  const path = `users/${uid}/ddays/${id}`;
  const ref = doc(db, 'users', uid, 'ddays', id);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        title: clampString(dday.title, 80) || 'Target Date',
        targetDate: sanitizeDateKey(dday.targetDate),
        isPinned: Boolean(dday.isPinned),
      });
    } else {
      await setDoc(ref, {
        id,
        userId: uid,
        title: clampString(dday.title, 80) || 'Target Date',
        targetDate: sanitizeDateKey(dday.targetDate),
        isPinned: Boolean(dday.isPinned),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDDayDoc(uid: string, ddayId: string): Promise<void> {
  const id = sanitizeId(ddayId);
  const path = `users/${uid}/ddays/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'ddays', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncLeaderboardDoc(
  uid: string,
  entry: Omit<RankingEntry, 'id'>
): Promise<void> {
  const path = `leaderboard/${uid}`;
  try {
    await setDoc(doc(db, 'leaderboard', uid), {
      userId: uid,
      isPublic: true,
      name: clampString(entry.name, 60) || 'My Desk',
      category: clampString(entry.category, 50) || 'University & STEM',
      status: entry.status,
      currentSubject: clampString(entry.currentSubject ?? '', 60),
      dailySeconds: clampNumber(entry.dailySeconds, 0, 86400),
      weeklySeconds: clampNumber(entry.weeklySeconds, 0, 604800),
      monthlySeconds: clampNumber(entry.monthlySeconds, 0, 2678400),
      streakDays: clampNumber(entry.streakDays, 0, 3650),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createStudyGroupDoc(
  uid: string,
  userName: string,
  dailyGoalHours: number,
  todaySeconds: number,
  group: {
    id: string;
    name: string;
    category: StudyCategory;
    description: string;
    dailyMinHours: number;
    maxMembers: number;
    isPrivate: boolean;
  }
): Promise<void> {
  const groupId = sanitizeId(group.id);
  const path = `studyGroups/${groupId}`;
  try {
    await setDoc(doc(db, 'studyGroups', groupId), {
      id: groupId,
      ownerId: uid,
      name: clampString(group.name, 80) || 'Study Room',
      category: clampString(group.category, 50) || 'University & STEM',
      description: clampString(group.description, 240),
      maxMembers: clampNumber(group.maxMembers, 2, 100),
      dailyMinHours: clampNumber(group.dailyMinHours, 1, 16),
      isPrivate: Boolean(group.isPrivate),
      createdAt: serverTimestamp(),
    });

    await joinStudyGroupDoc(uid, groupId, group.isPrivate, userName, dailyGoalHours, todaySeconds);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinStudyGroupDoc(
  uid: string,
  groupId: string,
  isPrivateGroup: boolean,
  userName: string,
  dailyGoalHours: number,
  todaySeconds: number
): Promise<void> {
  const gId = sanitizeId(groupId);
  const path = `studyGroups/${gId}/members/${uid}`;
  const cleanName = clampString(userName, 60) || 'My Desk';
  const initials =
    cleanName
      .split(/\s+/)
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 4)
      .toUpperCase() || 'ME';
  try {
    await setDoc(doc(db, 'studyGroups', gId, 'members', uid), {
      id: uid,
      groupId: gId,
      userId: uid,
      isPrivateGroup: Boolean(isPrivateGroup),
      name: cleanName,
      avatarInitials: initials,
      status: 'resting',
      currentSubject: '',
      baseTodaySeconds: clampNumber(todaySeconds, 0, 86400),
      dailyGoalHours: clampNumber(dailyGoalHours, 1, 18),
      wakesReceived: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function leaveStudyGroupDoc(uid: string, groupId: string): Promise<void> {
  const gId = sanitizeId(groupId);
  const path = `studyGroups/${gId}/members/${uid}`;
  try {
    await deleteDoc(doc(db, 'studyGroups', gId, 'members', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function wakeGroupMemberDoc(groupId: string, memberId: string): Promise<void> {
  const gId = sanitizeId(groupId);
  const mId = sanitizeId(memberId);
  const path = `studyGroups/${gId}/members/${mId}`;
  try {
    await updateDoc(doc(db, 'studyGroups', gId, 'members', mId), {
      wakesReceived: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function postGroupMissionDoc(
  uid: string,
  groupId: string,
  isPrivateGroup: boolean,
  authorName: string,
  title: string,
  studyHoursLogged: string
): Promise<void> {
  const gId = sanitizeId(groupId);
  const missionId = sanitizeId(`mis-${Date.now()}`);
  const path = `studyGroups/${gId}/missions/${missionId}`;
  try {
    await setDoc(doc(db, 'studyGroups', gId, 'missions', missionId), {
      id: missionId,
      groupId: gId,
      authorId: uid,
      isPrivateGroup: Boolean(isPrivateGroup),
      authorName: clampString(authorName, 60) || 'My Desk',
      title: clampString(title, 160) || 'Completed daily desk check-in',
      studyHoursLogged: clampString(studyHoursLogged, 24) || '0s',
      cheers: 1,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function cheerGroupMissionDoc(groupId: string, missionId: string): Promise<void> {
  const gId = sanitizeId(groupId);
  const mId = sanitizeId(missionId);
  const path = `studyGroups/${gId}/missions/${mId}`;
  try {
    await updateDoc(doc(db, 'studyGroups', gId, 'missions', mId), {
      cheers: increment(1),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onWorkspace: (partial: Partial<AppState>) => void;
    onSubjects: (subjects: Subject[]) => void;
    onSessions: (sessions: StudySession[]) => void;
    onTodos: (todos: TodoItem[]) => void;
    onDDays: (ddays: DDayTarget[]) => void;
    onLeaderboard: (entries: RankingEntry[]) => void;
    onStudyGroups: (groups: StudyGroup[]) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  // 1. User workspace settings + wallet
  const userPath = `users/${uid}`;
  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const cat = STUDY_CATEGORIES.includes(d.profileCategory as StudyCategory)
          ? (d.profileCategory as StudyCategory)
          : 'University & STEM';
        callbacks.onWorkspace({
          theme: d.theme === 'dark' ? 'dark' : 'light',
          activeTimerMode: d.activeTimerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
          checkedInToday: Boolean(d.checkedInToday),
          profile: {
            name: String(d.profileName || 'My Desk'),
            category: cat,
            dailyGoalHours: Number(d.dailyGoalHours || 8),
            resetHour: Number(d.resetHour ?? 5),
            motto: String(d.motto || ''),
          },
          pomodoro: {
            focusMinutes: Number(d.pomodoroFocusMinutes || 25),
            shortBreakMinutes: Number(d.pomodoroShortBreakMinutes || 5),
            longBreakMinutes: Number(d.pomodoroLongBreakMinutes || 15),
            cyclesBeforeLongBreak: Number(d.pomodoroCyclesBeforeLongBreak || 4),
          },
          focusGuard: {
            autoPauseOnTabSwitch: Boolean(d.autoPauseOnTabSwitch),
            allowedTools: Array.isArray(d.allowedTools) ? d.allowedTools.map(String) : [],
            showFloatingGoalBar: Boolean(d.showFloatingGoalBar ?? true),
          },
          wallet: {
            coins: Number(d.coins || 0),
            unlockedPacks: Array.isArray(d.unlockedPacks)
              ? d.unlockedPacks.filter((p): p is FeaturePackId => ALLOWED_PACK_IDS.has(p as FeaturePackId))
              : [],
            proAllAccess: Boolean(d.proAllAccess),
            claimedPeriodKeys: Array.isArray(d.claimedPeriodKeys) ? d.claimedPeriodKeys.map(String) : [],
            accentTheme: (['orange', 'cobalt', 'emerald', 'violet'].includes(String(d.accentTheme))
              ? d.accentTheme
              : 'orange') as AccentTheme,
            purchaseHistory: [],
          },
        });
      },
      (error) => handleFirestoreError(error, OperationType.GET, userPath)
    )
  );

  // 2. Subjects
  const subjectsPath = `users/${uid}/subjects`;
  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'subjects'), where('userId', '==', uid)),
      (snap) => {
        const items: Subject[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            name: String(d.name ?? 'Subject'),
            color: String(d.color ?? '#F97316'),
            dailyTargetMinutes: Number(d.dailyTargetMinutes ?? 90),
            archived: Boolean(d.archived),
          };
        });
        callbacks.onSubjects(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, subjectsPath)
    )
  );

  // 3. Sessions
  const sessionsPath = `users/${uid}/sessions`;
  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'sessions'), where('userId', '==', uid)),
      (snap) => {
        const items: StudySession[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            subjectId: String(d.subjectId ?? ''),
            startTime: Number(d.startTime ?? 0),
            endTime: Number(d.endTime ?? 0),
            durationSeconds: Number(d.durationSeconds ?? 0),
            mode: d.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
            note: d.note ? String(d.note) : undefined,
          };
        });
        callbacks.onSessions(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, sessionsPath)
    )
  );

  // 4. Todos
  const todosPath = `users/${uid}/todos`;
  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'todos'), where('userId', '==', uid)),
      (snap) => {
        const items: TodoItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            subjectId: String(d.subjectId ?? 'general'),
            title: String(d.title ?? ''),
            completed: Boolean(d.completed),
            studyDayKey: String(d.studyDayKey ?? ''),
            estimatedMinutes: Number(d.estimatedMinutes ?? 30),
          };
        });
        callbacks.onTodos(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, todosPath)
    )
  );

  // 5. D-Days
  const ddaysPath = `users/${uid}/ddays`;
  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'ddays'), where('userId', '==', uid)),
      (snap) => {
        const items: DDayTarget[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            title: String(d.title ?? ''),
            targetDate: String(d.targetDate ?? ''),
            isPinned: Boolean(d.isPinned),
          };
        });
        callbacks.onDDays(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, ddaysPath)
    )
  );

  // 6. Public Non-PII Leaderboard
  const leaderboardPath = 'leaderboard';
  unsubs.push(
    onSnapshot(
      query(collection(db, 'leaderboard'), where('isPublic', '==', true)),
      (snap) => {
        const entries: RankingEntry[] = snap.docs
          .filter((docSnap) => docSnap.id !== uid)
          .map((docSnap) => {
            const d = docSnap.data();
            const cat = STUDY_CATEGORIES.includes(d.category as StudyCategory)
              ? (d.category as StudyCategory)
              : 'University & STEM';
            return {
              id: docSnap.id,
              name: String(d.name ?? 'Student'),
              category: cat,
              status:
                d.status === 'studying' || d.status === 'resting' || d.status === 'offline'
                  ? d.status
                  : 'resting',
              currentSubject: d.currentSubject ? String(d.currentSubject) : undefined,
              dailySeconds: Number(d.dailySeconds ?? 0),
              weeklySeconds: Number(d.weeklySeconds ?? 0),
              monthlySeconds: Number(d.monthlySeconds ?? 0),
              streakDays: Number(d.streakDays ?? 0),
            };
          });
        callbacks.onLeaderboard(entries);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, leaderboardPath)
    )
  );

  // 7. Public Study Groups + User's Owned Private Groups
  let publicGroupsMap = new Map<string, Omit<StudyGroup, 'joined' | 'members' | 'missions'>>();
  let ownGroupsMap = new Map<string, Omit<StudyGroup, 'joined' | 'members' | 'missions'>>();
  const subListeners = new Map<string, { unsubMembers: Unsubscribe; unsubMissions: Unsubscribe }>();
  const membersByGroup = new Map<string, { joined: boolean; others: GroupMember[] }>();
  const missionsByGroup = new Map<string, GroupMission[]>();

  const emitGroups = () => {
    const merged = new Map<string, Omit<StudyGroup, 'joined' | 'members' | 'missions'>>([
      ...publicGroupsMap.entries(),
      ...ownGroupsMap.entries(),
    ]);
    const list: StudyGroup[] = Array.from(merged.values()).map((base) => {
      const mInfo = membersByGroup.get(base.id) ?? { joined: false, others: [] };
      const missions = missionsByGroup.get(base.id) ?? [];
      return {
        ...base,
        joined: mInfo.joined,
        members: mInfo.others,
        missions,
      };
    });
    callbacks.onStudyGroups(list);
  };

  const syncSubListeners = () => {
    const activeIds = new Set<string>([
      ...publicGroupsMap.keys(),
      ...ownGroupsMap.keys(),
    ]);

    for (const [gId, listeners] of subListeners.entries()) {
      if (!activeIds.has(gId)) {
        listeners.unsubMembers();
        listeners.unsubMissions();
        subListeners.delete(gId);
        membersByGroup.delete(gId);
        missionsByGroup.delete(gId);
      }
    }

    for (const gId of activeIds) {
      if (subListeners.has(gId)) continue;
      const base = ownGroupsMap.get(gId) ?? publicGroupsMap.get(gId);
      if (!base) continue;

      const membersPath = `studyGroups/${gId}/members`;
      const membersQuery = base.isPrivate
        ? query(collection(db, 'studyGroups', gId, 'members'), where('userId', '==', uid))
        : query(collection(db, 'studyGroups', gId, 'members'), where('isPrivateGroup', '==', false));

      const unsubMembers = onSnapshot(
        membersQuery,
        (snap) => {
          let joined = false;
          const others: GroupMember[] = [];
          for (const docSnap of snap.docs) {
            const d = docSnap.data();
            const mUserId = String(d.userId ?? docSnap.id);
            if (mUserId === uid) {
              joined = true;
            } else {
              others.push({
                id: String(d.id ?? docSnap.id),
                name: String(d.name ?? 'Member'),
                avatarInitials: String(d.avatarInitials ?? 'ST'),
                status:
                  d.status === 'studying' || d.status === 'resting' || d.status === 'offline'
                    ? d.status
                    : 'resting',
                currentSubject: d.currentSubject ? String(d.currentSubject) : undefined,
                baseTodaySeconds: Number(d.baseTodaySeconds ?? 0),
                dailyGoalHours: Number(d.dailyGoalHours ?? 8),
                wakesReceived: Number(d.wakesReceived ?? 0),
              });
            }
          }
          membersByGroup.set(gId, { joined, others });
          emitGroups();
        },
        (error) => handleFirestoreError(error, OperationType.LIST, membersPath)
      );

      const missionsPath = `studyGroups/${gId}/missions`;
      const missionsQuery = base.isPrivate
        ? query(collection(db, 'studyGroups', gId, 'missions'), where('authorId', '==', uid))
        : query(collection(db, 'studyGroups', gId, 'missions'), where('isPrivateGroup', '==', false));

      const unsubMissions = onSnapshot(
        missionsQuery,
        (snap) => {
          const list: GroupMission[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: String(d.id ?? docSnap.id),
              authorName: String(d.authorName ?? 'Student'),
              title: String(d.title ?? ''),
              studyHoursLogged: String(d.studyHoursLogged ?? '0s'),
              timestampLabel: 'Synced',
              verified: true,
              cheers: Number(d.cheers ?? 0),
            };
          });
          missionsByGroup.set(gId, list);
          emitGroups();
        },
        (error) => handleFirestoreError(error, OperationType.LIST, missionsPath)
      );

      subListeners.set(gId, { unsubMembers, unsubMissions });
    }
    emitGroups();
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'studyGroups'), where('isPrivate', '==', false)),
      (snap) => {
        publicGroupsMap = new Map();
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          const cat = STUDY_CATEGORIES.includes(d.category as StudyCategory)
            ? (d.category as StudyCategory)
            : 'University & STEM';
          publicGroupsMap.set(docSnap.id, {
            id: String(d.id ?? docSnap.id),
            name: String(d.name ?? 'Study Room'),
            category: cat,
            description: String(d.description ?? ''),
            maxMembers: Number(d.maxMembers ?? 30),
            dailyMinHours: Number(d.dailyMinHours ?? 4),
            isPrivate: Boolean(d.isPrivate),
          });
        }
        syncSubListeners();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'studyGroups')
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'studyGroups'), where('ownerId', '==', uid)),
      (snap) => {
        ownGroupsMap = new Map();
        for (const docSnap of snap.docs) {
          const d = docSnap.data();
          const cat = STUDY_CATEGORIES.includes(d.category as StudyCategory)
            ? (d.category as StudyCategory)
            : 'University & STEM';
          ownGroupsMap.set(docSnap.id, {
            id: String(d.id ?? docSnap.id),
            name: String(d.name ?? 'Study Room'),
            category: cat,
            description: String(d.description ?? ''),
            maxMembers: Number(d.maxMembers ?? 30),
            dailyMinHours: Number(d.dailyMinHours ?? 4),
            isPrivate: Boolean(d.isPrivate),
          });
        }
        syncSubListeners();
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'studyGroups')
    )
  );

  return () => {
    for (const u of unsubs) u();
    for (const listeners of subListeners.values()) {
      listeners.unsubMembers();
      listeners.unsubMissions();
    }
  };
}
