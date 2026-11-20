import { useEffect, useMemo, useState } from 'react';
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
import { createDefaultWallet, createEmptyState } from './data/seedData';
import {
  AccentTheme,
  AppState,
  ChallengeStatus,
  FeaturePackId,
  FocusGuardSettings,
  PomodoroConfig,
  StudyCategory,
  StudySession,
  TabId,
  TimerMode,
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
  const [activeTab, setActiveTab] = useState<TabId>('timer');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [sessionStartMs, setSessionStartMs] = useState<number | null>(null);
  const [unlockPackId, setUnlockPackId] = useState<FeaturePackId | null>(null);
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  // Persist state to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

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

  // Handlers
  const handleToggleTheme = () => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
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
    const id = `subj-${Date.now()}`;
    setState((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          id,
          name,
          color,
          dailyTargetMinutes,
        },
      ],
    }));
    setQuickStartOpen(false);
    setActiveSubjectId(id);
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
    setState((prev) => ({
      ...prev,
      subjects: [
        ...prev.subjects,
        {
          id: `subj-${Date.now()}`,
          name,
          color,
          dailyTargetMinutes,
        },
      ],
    }));
  };

  const handleUpdateSubject = (
    id: string,
    name: string,
    color: string,
    dailyTargetMinutes: number
  ) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) =>
        s.id === id ? { ...s, name, color, dailyTargetMinutes } : s
      ),
    }));
  };

  const handleDeleteSubject = (id: string) => {
    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== id),
    }));
  };

  const handleAddDDay = (title: string, targetDate: string) => {
    setState((prev) => ({
      ...prev,
      ddays: [
        ...prev.ddays,
        {
          id: `dd-${Date.now()}`,
          title,
          targetDate,
          isPinned: prev.ddays.length === 0,
        },
      ],
    }));
  };

  const handleDeleteDDay = (id: string) => {
    setState((prev) => ({
      ...prev,
      ddays: prev.ddays.filter((d) => d.id !== id),
    }));
  };

  const handlePinDDay = (id: string) => {
    setState((prev) => ({
      ...prev,
      ddays: prev.ddays.map((d) => ({ ...d, isPinned: d.id === id })),
    }));
  };

  const handleAddTodo = (
    subjectId: string,
    title: string,
    studyDayKey: string,
    estimatedMinutes: number
  ) => {
    setState((prev) => ({
      ...prev,
      todos: [
        {
          id: `todo-${Date.now()}`,
          subjectId,
          title,
          completed: false,
          studyDayKey,
          estimatedMinutes,
        },
        ...prev.todos,
      ],
    }));
  };

  const handleToggleTodo = (todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: prev.todos.map((t) =>
        t.id === todoId ? { ...t, completed: !t.completed } : t
      ),
    }));
  };

  const handleDeleteTodo = (todoId: string) => {
    setState((prev) => ({
      ...prev,
      todos: prev.todos.filter((t) => t.id !== todoId),
    }));
  };

  const handleRolloverTodos = (targetDayKey: string): number => {
    const result = rolloverUnfinishedTodos(state.todos, targetDayKey);
    if (result.movedCount > 0) {
      setState((prev) => ({
        ...prev,
        todos: result.updatedTodos,
      }));
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
  };

  const handleJoinGroup = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, joined: true } : g
      ),
    }));
  };

  const handleLeaveGroup = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, joined: false } : g
      ),
    }));
  };

  const handleWakeMember = (groupId: string, memberId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              members: g.members.map((m) =>
                m.id === memberId
                  ? { ...m, wakesReceived: m.wakesReceived + 1 }
                  : m
              ),
            }
          : g
      ),
    }));
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
  };

  const handleSubmitCheckIn = (groupId: string, note: string) => {
    setState((prev) => ({
      ...prev,
      checkedInToday: true,
      groups: prev.groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              missions: [
                {
                  id: `mis-${Date.now()}`,
                  authorName: prev.profile.name,
                  title: note,
                  studyHoursLogged: formatDurationShort(todayTotalSeconds),
                  timestampLabel: 'Just now',
                  verified: true,
                  cheers: 1,
                },
                ...g.missions,
              ],
            }
          : g
      ),
    }));
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
  };

  const handleChangeTimerMode = (mode: TimerMode) => {
    setState((prev) => ({ ...prev, activeTimerMode: mode }));
  };

  const handleOpenUnlockModal = (packId: FeaturePackId) => {
    setUnlockPackId(packId);
  };

  const handleToggleFocusGuard = () => {
    if (!focusLockUnlocked) {
      handleOpenUnlockModal('focus_lock');
      return;
    }
    setState((prev) => ({
      ...prev,
      focusGuard: {
        ...prev.focusGuard,
        autoPauseOnTabSwitch: !prev.focusGuard.autoPauseOnTabSwitch,
      },
    }));
  };

  const handleUpdateProfile = (profile: UserProfile) => {
    setState((prev) => ({ ...prev, profile }));
  };

  const handleUpdatePomodoro = (pomodoro: PomodoroConfig) => {
    setState((prev) => ({ ...prev, pomodoro }));
  };

  const handleUpdateFocusGuard = (focusGuard: FocusGuardSettings) => {
    setState((prev) => ({ ...prev, focusGuard }));
  };

  const handleClaimChallenge = (challenge: ChallengeStatus) => {
    setState((prev) => ({
      ...prev,
      wallet: claimChallengeReward(prev.wallet, challenge),
    }));
  };

  const handleUnlockPack = (packId: FeaturePackId) => {
    setState((prev) => {
      const res = unlockPackWithCoins(prev.wallet, packId);
      if (!res.ok) return prev;
      return {
        ...prev,
        wallet: res.wallet,
      };
    });
  };

  const handleSelectAccentTheme = (accentTheme: AccentTheme) => {
    if (accentTheme !== 'orange' && !soundsThemesUnlocked) {
      handleOpenUnlockModal('sounds_themes');
      return;
    }
    setState((prev) => ({
      ...prev,
      wallet: {
        ...prev.wallet,
        accentTheme,
      },
    }));
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
    setState(createEmptyState());
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
      />

      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <TopBar
          activeTab={activeTab}
          todayKey={todayKey}
          resetHour={resetHour}
          pinnedDDay={pinnedDDay}
          focusGuardEnabled={focusLockUnlocked && state.focusGuard.autoPauseOnTabSwitch}
          coins={state.wallet.coins}
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
    </div>
  );
}
