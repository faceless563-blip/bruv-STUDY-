import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  FIREBASE_PROJECT_ID,
  isEmbeddedIframe,
  resolveGoogleRedirectResult,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  cheerGroupMissionDoc,
  createSessionDoc,
  createStudyGroupDoc,
  deleteDDayDoc,
  deleteSubjectDoc,
  deleteTodoDoc,
  ensureUserWorkspaceInitialized,
  joinStudyGroupDoc,
  leaveStudyGroupDoc,
  postGroupMissionDoc,
  saveWorkspaceDoc,
  subscribeUserWorkspace,
  syncLeaderboardDoc,
  upsertDDayDoc,
  upsertSubjectDoc,
  upsertTodoDoc,
  wakeGroupMemberDoc,
} from './services/firestoreSync';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TimerHomeView } from './components/TimerHomeView';
import { ActiveFocusOverlay } from './components/ActiveFocusOverlay';
import { PlannerView } from './components/PlannerView';
import { InsightsView } from './components/InsightsView';
import { GroupsView } from './components/GroupsView';
import { RankingsView } from './components/RankingsView';
import { SettingsView } from './components/SettingsView';
import { VaultView } from './components/VaultView';
import { UnlockModal } from './components/UnlockModal';
import { QuickStartModal } from './components/QuickStartModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthErrorModal } from './components/AuthErrorModal';
import {
  DesktopWidgetController,
  DesktopWidgetMode,
  openDocumentPipWindow,
} from './components/DesktopWidget';
import { ParsedAuthError, parseFirebaseAuthError } from './utils/authErrorLogic';
import { createDefaultWallet, createEmptyState } from './data/seedData';
import {
  AccentTheme,
  AppState,
  ChallengeStatus,
  DDayTarget,
  FeaturePackId,
  FocusGuardSettings,
  PomodoroConfig,
  StudyCategory,
  StudySession,
  Subject,
  TabId,
  TimerMode,
  TodoItem,
  UserProfile,
} from './types/ypt';
import {
  buildSessionsCsv,
  claimChallengeReward,
  evaluateChallenges,
  isPackUnlocked,
  unlockPackWithCoins,
} from './utils/economyLogic';
import {
  computeStreakDays,
  computeSubjectTotals,
  formatDurationShort,
  getStudyDayKey,
  getWeekDayKeys,
  rolloverUnfinishedTodos,
} from './utils/yptLogic';

const STORAGE_KEY = 'ypt_desktop_state_v4';
const SIDEBAR_COLLAPSED_KEY = 'ypt_sidebar_collapsed_v1';

function loadInitialSidebarCollapsed(): boolean {
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }
  return false;
}

function loadInitialState(): AppState {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && Array.isArray(parsed.subjects) && Array.isArray(parsed.sessions)) {
          return {
            ...parsed,
            wallet: parsed.wallet ?? createDefaultWallet(),
          };
        }
      }
    } catch {
      // fall back to empty state
    }
  }
  return createEmptyState();
}

export default function App() {
  const [state, setState] = useState<AppState>(loadInitialState);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(loadInitialSidebarCollapsed);
  const [activeTab, setActiveTab] = useState<TabId>('timer');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [unlockPackId, setUnlockPackId] = useState<FeaturePackId | null>(null);
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [liveFocusSeconds, setLiveFocusSeconds] = useState(0);
  const [widgetMode, setWidgetMode] = useState<DesktopWidgetMode>('closed');
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [pipContainer, setPipContainer] = useState<HTMLElement | null>(null);
  const [selectedWidgetDDayId, setSelectedWidgetDDayId] = useState<string | null>(
    null
  );
  const [authUser, setAuthUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
  } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<ParsedAuthError | null>(null);
  const [syncError, setSyncError] = useState<Error | null>(null);

  if (syncError) {
    throw syncError;
  }

  const stateRef = useRef(state);
  stateRef.current = state;

  const runCloudTask = (task: () => Promise<unknown>) => {
    task().catch((err) => {
      setSyncError(err instanceof Error ? err : new Error(String(err)));
    });
  };

  // Persist state to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // Listen to Firebase Auth state & attach Firestore onSnapshot listeners only when authenticated
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    if (!isEmbeddedIframe()) {
      void resolveGoogleRedirectResult().catch((err) => {
        if (cancelled) return;
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          parseFirebaseAuthError(err, {
            hostname,
            inIframe: false,
            firebaseProjectId: FIREBASE_PROJECT_ID,
          })
        );
      });
    }

    const unsubAuth = onAuthStateChanged(auth, async (user: User | null) => {
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }

      if (!user) {
        if (!cancelled) {
          setAuthUser(null);
          setAuthReady(true);
        }
        return;
      }

      if (!cancelled) {
        setAuthError(null);
        setIsSigningIn(false);
        setAuthUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
        });
        setAuthReady(true);
      }

      try {
        await ensureUserWorkspaceInitialized(user.uid, stateRef.current, user.displayName);
        if (cancelled) return;
        unsubFirestore = subscribeUserWorkspace(user.uid, {
          onWorkspace: (partial) => {
            setState((prev) => ({
              ...prev,
              ...partial,
            }));
          },
          onSubjects: (subjects) => {
            setState((prev) => ({ ...prev, subjects }));
          },
          onSessions: (sessions) => {
            setState((prev) => ({ ...prev, sessions }));
          },
          onTodos: (todos) => {
            setState((prev) => ({ ...prev, todos }));
          },
          onDDays: (ddays) => {
            setState((prev) => ({ ...prev, ddays }));
          },
          onLeaderboard: (rankings) => {
            setState((prev) => ({ ...prev, rankings }));
          },
          onStudyGroups: (groups) => {
            setState((prev) => ({ ...prev, groups }));
          },
        });
      } catch (err) {
        if (!cancelled) {
          setSyncError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubFirestore) {
        unsubFirestore();
      }
    };
  }, []);

  // Sync dark mode class and accent theme on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const accent = state.wallet?.accentTheme ?? 'orange';
    if (accent === 'orange') {
      root.removeAttribute('data-accent');
    } else {
      root.setAttribute('data-accent', accent);
    }
  }, [state.theme, state.wallet?.accentTheme]);

  const resetHour = state.profile.resetHour;
  const todayKey = getStudyDayKey(Date.now(), resetHour);

  const todaySet = useMemo(() => new Set([todayKey]), [todayKey]);
  const weekSet = useMemo(() => new Set(getWeekDayKeys(todayKey)), [todayKey]);

  const monthSet = useMemo(() => {
    const prefix = todayKey.slice(0, 7);
    const keys = new Set<string>();
    for (const s of state.sessions) {
      const k = getStudyDayKey(s.startTime, resetHour);
      if (k.startsWith(prefix)) keys.add(k);
    }
    keys.add(todayKey);
    return keys;
  }, [state.sessions, todayKey, resetHour]);

  const subjectTodayTotalsList = useMemo(
    () => computeSubjectTotals(state.sessions, state.subjects, todaySet, resetHour),
    [state.sessions, state.subjects, todaySet, resetHour]
  );

  const subjectTodaySecondsMap = useMemo(
    () =>
      new Map(
        subjectTodayTotalsList.map((item) => [item.subject.id, item.totalSeconds])
      ),
    [subjectTodayTotalsList]
  );

  const todayTotalSeconds = useMemo(
    () => subjectTodayTotalsList.reduce((acc, item) => acc + item.totalSeconds, 0),
    [subjectTodayTotalsList]
  );

  const weekTotalSeconds = useMemo(
    () =>
      state.sessions
        .filter((s) => weekSet.has(getStudyDayKey(s.startTime, resetHour)))
        .reduce((acc, s) => acc + s.durationSeconds, 0),
    [state.sessions, weekSet, resetHour]
  );

  const monthTotalSeconds = useMemo(
    () =>
      state.sessions
        .filter((s) => monthSet.has(getStudyDayKey(s.startTime, resetHour)))
        .reduce((acc, s) => acc + s.durationSeconds, 0),
    [state.sessions, monthSet, resetHour]
  );

  const streakDays = useMemo(
    () => computeStreakDays(state.sessions, todayKey, resetHour),
    [state.sessions, todayKey, resetHour]
  );

  const pinnedDDay = useMemo(
    () => state.ddays.find((d) => d.isPinned) ?? state.ddays[0],
    [state.ddays]
  );

  const activeSubject = useMemo(
    () => state.subjects.find((s) => s.id === activeSubjectId) ?? null,
    [state.subjects, activeSubjectId]
  );

  const challenges = useMemo(() => evaluateChallenges(state), [state]);
  const claimableCount = useMemo(
    () => challenges.filter((c) => c.completed && !c.claimed).length,
    [challenges]
  );

  const focusLockUnlocked = isPackUnlocked(state.wallet, 'focus_lock');
  const studyGroupsUnlocked = isPackUnlocked(state.wallet, 'study_groups');
  const advancedInsightsUnlocked = isPackUnlocked(state.wallet, 'advanced_insights');
  const soundsThemesUnlocked = isPackUnlocked(state.wallet, 'sounds_themes');
  const customPomodoroUnlocked = isPackUnlocked(state.wallet, 'custom_pomodoro');

  // Sync public non-PII leaderboard standing whenever signed in and stats/focus change
  useEffect(() => {
    if (!authReady || !authUser) return;
    runCloudTask(() =>
      syncLeaderboardDoc(authUser.uid, {
        name: state.profile.name,
        category: state.profile.category,
        status: activeSubject ? 'studying' : 'resting',
        currentSubject: activeSubject?.name,
        dailySeconds: todayTotalSeconds,
        weeklySeconds: weekTotalSeconds,
        monthlySeconds: monthTotalSeconds,
        streakDays,
      })
    );
  }, [
    authReady,
    authUser,
    state.profile.name,
    state.profile.category,
    activeSubject,
    todayTotalSeconds,
    weekTotalSeconds,
    monthTotalSeconds,
    streakDays,
  ]);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      const parsed = parseFirebaseAuthError(err, {
        hostname,
        inIframe: isEmbeddedIframe(),
        firebaseProjectId: FIREBASE_PROJECT_ID,
      });
      console.error('Google sign-in error:', parsed.code, err);
      setAuthError(parsed);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = () => {
    setAuthError(null);
    void signOutUser().then(() => {
      setActiveSubjectId(null);
      setSessionStartMs(null);
    });
  };

  // Handlers
  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleCloseWidget = () => {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
    setPipWindow(null);
    setPipContainer(null);
    setWidgetMode('closed');
  };

  const handleToggleWidget = async () => {
    if (widgetMode !== 'closed') {
      handleCloseWidget();
      return;
    }

    const pip = await openDocumentPipWindow(
      state.theme,
      state.wallet?.accentTheme ?? 'orange'
    );
    if (pip) {
      pip.pipWindow.addEventListener('pagehide', () => {
        setPipWindow(null);
        setPipContainer(null);
        setWidgetMode('closed');
      });
      setPipWindow(pip.pipWindow);
      setPipContainer(pip.container);
      setWidgetMode('pip');
      return;
    }

    setWidgetMode('floating');
  };

  const handleToggleTheme = () => {
    const nextState: AppState = {
      ...state,
      theme: state.theme === 'light' ? 'dark' : 'light',
    };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleStartSubject = (subjectId: string) => {
    setQuickStartOpen(false);
    setActiveSubjectId(subjectId);
    setSessionStartMs(Date.now());
  };

  const handleQuickStart = () => {
    if (state.subjects.length === 1) {
      handleStartSubject(state.subjects[0].id);
      return;
    }
    setQuickStartOpen(true);
  };

  const handleCreateSubjectAndStart = (
    name: string,
    color: string,
    dailyTargetMinutes: number
  ) => {
    const newSubj: Subject = {
      id: `subj-${Date.now()}`,
      name,
      color,
      dailyTargetMinutes,
    };
    setState((prev) => ({
      ...prev,
      subjects: [...prev.subjects, newSubj],
    }));
    if (authUser) runCloudTask(() => upsertSubjectDoc(authUser.uid, newSubj));
    setQuickStartOpen(false);
    setActiveSubjectId(newSubj.id);
    setSessionStartMs(Date.now());
  };

  const handleCompleteSession = (elapsedFocusSeconds: number, note: string) => {
    if (!activeSubjectId) return;
    const endTime = Date.now();
    const durationSeconds = Math.max(1, elapsedFocusSeconds);
    const startTime = sessionStartMs ?? endTime - durationSeconds * 1000;

    const newSession: StudySession = {
      id: `sess-${endTime}`,
      subjectId: activeSubjectId,
      startTime,
      endTime,
      durationSeconds,
      mode: state.activeTimerMode,
      note: note || undefined,
    };

    setState((prev) => ({
      ...prev,
      sessions: [...prev.sessions, newSession],
    }));
    if (authUser) runCloudTask(() => createSessionDoc(authUser.uid, newSession));
    setActiveSubjectId(null);
    setSessionStartMs(null);
  };

  const handleDiscardSession = () => {
    setActiveSubjectId(null);
    setSessionStartMs(null);
  };

  const handleAddSubject = (
    name: string,
    color: string,
    dailyTargetMinutes: number
  ) => {
    const newSubj: Subject = {
      id: `subj-${Date.now()}`,
      name,
      color,
      dailyTargetMinutes,
    };
    setState((prev) => ({
      ...prev,
      subjects: [...prev.subjects, newSubj],
    }));
    if (authUser) runCloudTask(() => upsertSubjectDoc(authUser.uid, newSubj));
  };

  const handleUpdateSubject = (
    id: string,
    name: string,
    color: string,
    dailyTargetMinutes: number
  ) => {
    const updated: Subject = { id, name, color, dailyTargetMinutes };
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === id ? updated : s)),
    }));
    if (authUser) runCloudTask(() => upsertSubjectDoc(authUser.uid, updated));
  };

  const handleDeleteSubject = (id: string) => {
    const affectedTodos = state.todos
      .filter((t) => t.subjectId === id)
      .map((t) => ({ ...t, subjectId: 'general' }));
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
      todos: prev.todos.map((t) => (t.subjectId === id ? { ...t, subjectId: 'general' } : t)),
    }));
    if (authUser) {
      for (const todo of affectedTodos) {
        runCloudTask(() => upsertTodoDoc(authUser.uid, todo));
      }
      runCloudTask(() => deleteSubjectDoc(authUser.uid, id));
    }
  };

  const handleAddDDay = (title: string, targetDate: string) => {
    const newDDay: DDayTarget = {
      id: `dd-${Date.now()}`,
      title,
      targetDate,
      isPinned: state.ddays.length === 0,
    };
    setState((prev) => ({
      ...prev,
      ddays: [...prev.ddays, newDDay],
    }));
    if (authUser) runCloudTask(() => upsertDDayDoc(authUser.uid, newDDay));
  };

  const handleDeleteDDay = (id: string) => {
    setState((prev) => ({
      ...prev,
      ddays: prev.ddays.filter((d) => d.id !== id),
    }));
    if (authUser) runCloudTask(() => deleteDDayDoc(authUser.uid, id));
  };

  const handlePinDDay = (id: string) => {
    const updated = state.ddays.map((d) => ({ ...d, isPinned: d.id === id }));
    setState((prev) => ({
      ...prev,
      ddays: updated,
    }));
    if (authUser) {
      for (const d of updated) {
        runCloudTask(() => upsertDDayDoc(authUser.uid, d));
      }
    }
  };

  const handleAddTodo = (
    subjectId: string,
    title: string,
    studyDayKey: string,
    estimatedMinutes: number
  ) => {
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      subjectId,
      title,
      completed: false,
      studyDayKey,
      estimatedMinutes,
    };
    setState((prev) => ({
      ...prev,
      todos: [newTodo, ...prev.todos],
    }));
    if (authUser) runCloudTask(() => upsertTodoDoc(authUser.uid, newTodo));
  };

  const handleToggleTodo = (todoId: string) => {
    const target = state.todos.find((t) => t.id === todoId);
    if (!target) return;
    const toggled: TodoItem = { ...target, completed: !target.completed };
    setState((prev) => ({
      ...prev,
      todos: prev.todos.map((t) => (t.id === todoId ? toggled : t)),
    }));
    if (authUser) runCloudTask(() => upsertTodoDoc(authUser.uid, toggled));
  };

  const handleDeleteTodo = (todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: prev.todos.filter((t) => t.id !== todoId),
    }));
    if (authUser) runCloudTask(() => deleteTodoDoc(authUser.uid, todoId));
  };

  const handleRolloverTodos = (targetDayKey: string): number => {
    const result = rolloverUnfinishedTodos(state.todos, targetDayKey);
    if (result.movedCount > 0) {
      setState((prev) => ({
        ...prev,
        todos: result.updatedTodos,
      }));
      if (authUser) {
        for (const t of result.updatedTodos) {
          if (t.studyDayKey === targetDayKey && !t.completed) {
            runCloudTask(() => upsertTodoDoc(authUser.uid, t));
          }
        }
      }
    }
    return result.movedCount;
  };

  const handleLogManualSession = (
    subjectId: string,
    startTimeMs: number,
    durationMinutes: number,
    note: string
  ) => {
    const durationSeconds = durationMinutes * 60;
    const newSession: StudySession = {
      id: `sess-manual-${Date.now()}`,
      subjectId,
      startTime: startTimeMs,
      endTime: startTimeMs + durationSeconds * 1000,
      durationSeconds,
      mode: 'stopwatch',
      note,
    };
    setState((prev) => ({
      ...prev,
      sessions: [...prev.sessions, newSession],
    }));
    if (authUser) runCloudTask(() => createSessionDoc(authUser.uid, newSession));
  };

  const handleJoinGroup = (groupId: string) => {
    const grp = state.groups.find((g) => g.id === groupId);
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, joined: true } : g)),
    }));
    if (authUser && grp) {
      runCloudTask(() =>
        joinStudyGroupDoc(
          authUser.uid,
          groupId,
          grp.isPrivate,
          state.profile.name,
          state.profile.dailyGoalHours,
          todayTotalSeconds
        )
      );
    }
  };

  const handleLeaveGroup = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === groupId ? { ...g, joined: false } : g)),
    }));
    if (authUser) runCloudTask(() => leaveStudyGroupDoc(authUser.uid, groupId));
  };

  const handleWakeMember = (groupId: string, memberId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              members: g.members.map((m) =>
                m.id === memberId ? { ...m, wakesReceived: m.wakesReceived + 1 } : m
              ),
            }
          : g
      ),
    }));
    if (authUser) runCloudTask(() => wakeGroupMemberDoc(groupId, memberId));
  };

  const handleCheerMission = (groupId: string, missionId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              missions: g.missions.map((m) =>
                m.id === missionId ? { ...m, cheers: m.cheers + 1 } : m
              ),
            }
          : g
      ),
    }));
    if (authUser) runCloudTask(() => cheerGroupMissionDoc(groupId, missionId));
  };

  const handleSubmitCheckIn = (groupId: string, note: string) => {
    const grp = state.groups.find((g) => g.id === groupId);
    const hoursLabel = formatDurationShort(todayTotalSeconds);
    const nextState: AppState = {
      ...state,
      checkedInToday: true,
      groups: state.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              missions: [
                {
                  id: `mis-${Date.now()}`,
                  authorName: state.profile.name,
                  title: note,
                  studyHoursLogged: hoursLabel,
                  timestampLabel: 'Just now',
                  verified: true,
                  cheers: 1,
                },
                ...g.missions,
              ],
            }
          : g
      ),
    };
    setState(nextState);
    if (authUser && grp) {
      runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
      runCloudTask(() =>
        postGroupMissionDoc(
          authUser.uid,
          groupId,
          grp.isPrivate,
          state.profile.name,
          note,
          hoursLabel
        )
      );
    }
  };

  const handleCreateGroup = (payload: {
    name: string;
    category: StudyCategory;
    description: string;
    dailyMinHours: number;
    maxMembers: number;
    isPrivate: boolean;
  }) => {
    const newGroup = {
      id: `grp-${Date.now()}`,
      name: payload.name,
      category: payload.category,
      description: payload.description,
      maxMembers: payload.maxMembers,
      dailyMinHours: payload.dailyMinHours,
      isPrivate: payload.isPrivate,
      joined: true,
      members: [],
      missions: [],
    };
    setState((prev) => ({
      ...prev,
      groups: [newGroup, ...prev.groups],
    }));
    if (authUser) {
      runCloudTask(() =>
        createStudyGroupDoc(
          authUser.uid,
          state.profile.name,
          state.profile.dailyGoalHours,
          todayTotalSeconds,
          newGroup
        )
      );
    }
  };

  const handleChangeTimerMode = (mode: TimerMode) => {
    const nextState: AppState = { ...state, activeTimerMode: mode };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleOpenUnlockModal = (packId: FeaturePackId) => {
    setUnlockPackId(packId);
  };

  const handleToggleFocusGuard = () => {
    if (!focusLockUnlocked) {
      handleOpenUnlockModal('focus_lock');
      return;
    }
    const nextState: AppState = {
      ...state,
      focusGuard: {
        ...state.focusGuard,
        autoPauseOnTabSwitch: !state.focusGuard.autoPauseOnTabSwitch,
      },
    };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    const nextState: AppState = { ...state, profile };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleUpdatePomodoro = (pomodoro: PomodoroConfig) => {
    const nextState: AppState = { ...state, pomodoro };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleUpdateFocusGuard = (focusGuard: FocusGuardSettings) => {
    const nextState: AppState = { ...state, focusGuard };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleClaimChallenge = (challenge: ChallengeStatus) => {
    const nextState: AppState = {
      ...state,
      wallet: claimChallengeReward(state.wallet, challenge),
    };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleUnlockPack = (packId: FeaturePackId) => {
    const res = unlockPackWithCoins(state.wallet, packId);
    if (!res.ok) return;
    const nextState: AppState = {
      ...state,
      wallet: res.wallet,
    };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleSelectAccentTheme = (accentTheme: AccentTheme) => {
    if (accentTheme !== 'orange' && !soundsThemesUnlocked) {
      handleOpenUnlockModal('sounds_themes');
      return;
    }
    const nextState: AppState = {
      ...state,
      wallet: {
        ...state.wallet,
        accentTheme,
      },
    };
    setState(nextState);
    if (authUser) runCloudTask(() => saveWorkspaceDoc(authUser.uid, nextState));
  };

  const handleExportCsv = () => {
    if (!advancedInsightsUnlocked) {
      handleOpenUnlockModal('advanced_insights');
      return;
    }
    const csv = buildSessionsCsv(state.sessions, state.subjects, resetHour);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bruv-study-sessions-${todayKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleResetAllData = () => {
    setActiveSubjectId(null);
    setSessionStartMs(null);
    const fresh = createEmptyState();
    if (authUser) {
      for (const s of state.subjects) {
        runCloudTask(() => deleteSubjectDoc(authUser.uid, s.id));
      }
      for (const t of state.todos) {
        runCloudTask(() => deleteTodoDoc(authUser.uid, t.id));
      }
      for (const d of state.ddays) {
        runCloudTask(() => deleteDDayDoc(authUser.uid, d.id));
      }
      runCloudTask(() => saveWorkspaceDoc(authUser.uid, fresh));
    }
    setState(fresh);
  };

  return (
    <div className="h-screen overflow-hidden flex bg-[#F8F9FA] text-[#111827] dark:bg-[#0B0D11] dark:text-[#F3F4F6]">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        theme={state.theme}
        onToggleTheme={handleToggleTheme}
        profile={state.profile}
        todaySeconds={todayTotalSeconds}
        streakDays={streakDays}
        coins={state.wallet.coins}
        claimableCount={claimableCount}
        isFocusing={Boolean(activeSubject)}
        authUser={authUser}
        authReady={authReady}
        isSigningIn={isSigningIn}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          todayKey={todayKey}
          resetHour={resetHour}
          pinnedDDay={pinnedDDay}
          focusGuardEnabled={focusLockUnlocked && state.focusGuard.autoPauseOnTabSwitch}
          coins={state.wallet.coins}
          widgetOpen={widgetMode !== 'closed'}
          onToggleWidget={() => {
            void handleToggleWidget();
          }}
          onOpenVault={() => setActiveTab('vault')}
          onQuickStart={handleQuickStart}
        />

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">

          {activeTab === 'timer' && (
            <TimerHomeView
              todayKey={todayKey}
              todayTotalSeconds={todayTotalSeconds}
              dailyGoalHours={state.profile.dailyGoalHours}
              subjects={state.subjects}
              subjectTodaySeconds={subjectTodaySecondsMap}
              todos={state.todos}
              ddays={state.ddays}
              activeTimerMode={state.activeTimerMode}
              focusGuard={state.focusGuard}
              focusLockUnlocked={focusLockUnlocked}
              motto={state.profile.motto}
              onChangeTimerMode={handleChangeTimerMode}
              onStartSubject={handleStartSubject}
              onAddSubject={handleAddSubject}
              onUpdateSubject={handleUpdateSubject}
              onDeleteSubject={handleDeleteSubject}
              onAddDDay={handleAddDDay}
              onDeleteDDay={handleDeleteDDay}
              onPinDDay={handlePinDDay}
              onToggleFocusGuard={handleToggleFocusGuard}
              onNavigateTab={(t) => setActiveTab(t)}
              onRequestUnlock={handleOpenUnlockModal}
            />
          )}

          {activeTab === 'planner' && (
            <PlannerView
              todayKey={todayKey}
              resetHour={resetHour}
              subjects={state.subjects}
              sessions={state.sessions}
              todos={state.todos}
              onAddTodo={handleAddTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onRolloverTodos={handleRolloverTodos}
              onLogManualSession={handleLogManualSession}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsView
              todayKey={todayKey}
              resetHour={resetHour}
              dailyGoalHours={state.profile.dailyGoalHours}
              subjects={state.subjects}
              sessions={state.sessions}
              advancedInsightsUnlocked={advancedInsightsUnlocked}
              onRequestUnlock={handleOpenUnlockModal}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'groups' && (
            <GroupsView
              groups={state.groups}
              currentUserName={state.profile.name}
              currentUserTodaySeconds={todayTotalSeconds}
              currentUserGoalHours={state.profile.dailyGoalHours}
              isFocusing={Boolean(activeSubject)}
              checkedInToday={state.checkedInToday}
              studyGroupsUnlocked={studyGroupsUnlocked}
              onJoinGroup={handleJoinGroup}
              onLeaveGroup={handleLeaveGroup}
              onWakeMember={handleWakeMember}
              onCheerMission={handleCheerMission}
              onSubmitCheckIn={handleSubmitCheckIn}
              onCreateGroup={handleCreateGroup}
              onRequestUnlock={handleOpenUnlockModal}
            />
          )}

          {activeTab === 'rankings' && (
            <RankingsView
              entries={state.rankings}
              userName={state.profile.name}
              userCategory={state.profile.category}
              userDailySeconds={todayTotalSeconds}
              userWeeklySeconds={weekTotalSeconds}
              userMonthlySeconds={monthTotalSeconds}
              userStreakDays={streakDays}
              isFocusing={Boolean(activeSubject)}
            />
          )}

          {activeTab === 'vault' && (
            <VaultView
              wallet={state.wallet}
              challenges={challenges}
              onClaimChallenge={handleClaimChallenge}
              onUnlockPack={handleUnlockPack}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              profile={state.profile}
              pomodoro={state.pomodoro}
              focusGuard={state.focusGuard}
              theme={state.theme}
              wallet={state.wallet}
              focusLockUnlocked={focusLockUnlocked}
              customPomodoroUnlocked={customPomodoroUnlocked}
              soundsThemesUnlocked={soundsThemesUnlocked}
              onUpdateProfile={handleUpdateProfile}
              onUpdatePomodoro={handleUpdatePomodoro}
              onUpdateFocusGuard={handleUpdateFocusGuard}
              onSelectAccentTheme={handleSelectAccentTheme}
              onRequestUnlock={handleOpenUnlockModal}
              onToggleTheme={handleToggleTheme}
              onResetAllData={handleResetAllData}
              authUser={authUser}
              isSigningIn={isSigningIn}
              authError={authError}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          )}
        </main>
      </div>

      {activeSubject && (
        <ActiveFocusOverlay
          subject={activeSubject}
          allSubjects={state.subjects}
          mode={state.activeTimerMode}
          pomodoroConfig={state.pomodoro}
          focusGuard={state.focusGuard}
          todayTotalBeforeSession={todayTotalSeconds}
          subjectTodos={state.todos.filter(
            (t) => t.studyDayKey === todayKey && t.subjectId === activeSubject.id
          )}
          soundsThemesUnlocked={soundsThemesUnlocked}
          customPomodoroUnlocked={customPomodoroUnlocked}
          focusLockUnlocked={focusLockUnlocked}
          onSwitchSubject={(nextId) => setActiveSubjectId(nextId)}
          onToggleTodo={handleToggleTodo}
          onCompleteSession={handleCompleteSession}
          onDiscardSession={handleDiscardSession}
          onRequestUnlock={handleOpenUnlockModal}
          onTickFocusSeconds={setLiveFocusSeconds}
        />
      )}

      {quickStartOpen && (
        <QuickStartModal
          subjects={state.subjects}
          activeTimerMode={state.activeTimerMode}
          onClose={() => setQuickStartOpen(false)}
          onStartSubject={handleStartSubject}
          onCreateAndStart={handleCreateSubjectAndStart}
        />
      )}

      {unlockPackId && (
        <UnlockModal
          packId={unlockPackId}
          wallet={state.wallet}
          onClose={() => setUnlockPackId(null)}
          onUnlockWithCoins={handleUnlockPack}
          onOpenChallenges={() => setActiveTab('vault')}
        />
      )}

      {authError && !authUser && (
        <AuthErrorModal
          error={authError}
          onRetry={() => {
            void handleSignIn();
          }}
          onClose={() => setAuthError(null)}
        />
      )}

      <DesktopWidgetController
        mode={widgetMode}
        pipContainer={pipContainer}
        pipWindow={pipWindow}
        state={state}
        liveFocusSeconds={activeSubject ? liveFocusSeconds : 0}
        activeSubject={activeSubject}
        selectedDDayId={selectedWidgetDDayId}
        onSelectDDayId={setSelectedWidgetDDayId}
        onAddDDay={handleAddDDay}
        onStartSubject={handleStartSubject}
        onOpenQuickStart={handleQuickStart}
        onToggleTheme={handleToggleTheme}
        onClose={handleCloseWidget}
      />

      <OfflineIndicator />
    </div>
  );
}
