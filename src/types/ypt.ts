export type TabId =
  | 'timer'
  | 'planner'
  | 'insights'
  | 'groups'
  | 'rankings'
  | 'vault'
  | 'settings';

export type TimerMode = 'stopwatch' | 'pomodoro';

export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export type FeaturePackId =
  | 'focus_lock'
  | 'study_groups'
  | 'advanced_insights'
  | 'sounds_themes'
  | 'custom_pomodoro';

export type AccentTheme = 'orange' | 'cobalt' | 'emerald' | 'violet';

export type ChallengePeriod = 'daily' | 'weekly' | 'monthly';

export interface FeaturePackDefinition {
  id: FeaturePackId;
  title: string;
  tagline: string;
  freeLimit: string;
  unlockedBenefit: string;
  coinCost: number;
}

export interface ChallengeDefinition {
  id: string;
  period: ChallengePeriod;
  title: string;
  description: string;
  targetValue: number;
  unit: 'hours' | 'tasks' | 'days' | 'streak8h';
  rewardCoins: number;
}

export interface ChallengeStatus extends ChallengeDefinition {
  currentValue: number;
  progressPct: number;
  periodClaimKey: string;
  completed: boolean;
  claimed: boolean;
}

export interface PurchaseReceipt {
  id: string;
  tranId: string;
  provider: string;
  offerId: string;
  label: string;
  priceBdt: number;
  priceLabel: string;
  coinsAdded: number;
  unlockedPro: boolean;
  timestampMs: number;
}

export interface WalletState {
  coins: number;
  unlockedPacks: FeaturePackId[];
  proAllAccess: boolean;
  claimedPeriodKeys: string[];
  accentTheme: AccentTheme;
  purchaseHistory: PurchaseReceipt[];
}

export const STUDY_CATEGORIES = [
  'High School',
  'Middle School',
  'SAT / ACT Prep',
  'College Entrance',
  'IELTS / TOEFL',
  'University & STEM',
  'Computer Science',
  'Pre-Med & Medical',
  'Law & Civil Service',
  'Grad School (GRE / GMAT)',
  'Self-Study & Coding',
] as const;

export type StudyCategory = (typeof STUDY_CATEGORIES)[number];

export interface Subject {
  id: string;
  name: string;
  color: string;
  dailyTargetMinutes: number;
  archived?: boolean;
}

export interface StudySession {
  id: string;
  subjectId: string;
  startTime: number; // Unix ms
  endTime: number; // Unix ms
  durationSeconds: number;
  mode: TimerMode;
  note?: string;
}

export interface TodoItem {
  id: string;
  subjectId: string;
  title: string;
  completed: boolean;
  studyDayKey: string; // YYYY-MM-DD aligned with reset hour
  repeatDays?: number[]; // 0=Sun..6=Sat
  estimatedMinutes?: number;
}

export interface DDayTarget {
  id: string;
  title: string;
  targetDate: string; // YYYY-MM-DD
  isPinned?: boolean;
}

export type MemberStatus = 'studying' | 'resting' | 'offline';

export interface GroupMember {
  id: string;
  name: string;
  avatarInitials: string;
  status: MemberStatus;
  currentSubject?: string;
  activeSinceMs?: number; // If studying live
  baseTodaySeconds: number;
  dailyGoalHours: number;
  wakesReceived: number;
  lastCheckInNote?: string;
}

export interface GroupMission {
  id: string;
  authorName: string;
  title: string;
  studyHoursLogged: string;
  timestampLabel: string;
  verified: boolean;
  cheers: number;
}

export interface StudyGroup {
  id: string;
  name: string;
  category: StudyCategory;
  description: string;
  maxMembers: number;
  dailyMinHours: number;
  isPrivate: boolean;
  joined: boolean;
  members: GroupMember[];
  missions: GroupMission[];
}

export interface RankingEntry {
  id: string;
  name: string;
  category: StudyCategory;
  status: MemberStatus;
  currentSubject?: string;
  dailySeconds: number;
  weeklySeconds: number;
  monthlySeconds: number;
  streakDays: number;
}

export interface PomodoroConfig {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
}

export interface FocusGuardSettings {
  autoPauseOnTabSwitch: boolean;
  allowedTools: string[];
  showFloatingGoalBar: boolean;
}

export interface UserProfile {
  name: string;
  category: StudyCategory;
  dailyGoalHours: number;
  resetHour: number; // Default 5 (5:00 AM YPT cycle)
  motto: string;
}

export interface TenMinuteSlot {
  hourIndex: number; // 0..23 relative to resetHour
  displayHour: number; // 5..23, 0..4
  minuteOffset: number; // 0, 10, 20, 30, 40, 50
  subjectId: string | null;
  subjectColor: string | null;
  subjectName: string | null;
  secondsInSlot: number;
}

export interface AppState {
  theme: 'light' | 'dark';
  profile: UserProfile;
  subjects: Subject[];
  sessions: StudySession[];
  todos: TodoItem[];
  ddays: DDayTarget[];
  groups: StudyGroup[];
  rankings: RankingEntry[];
  pomodoro: PomodoroConfig;
  focusGuard: FocusGuardSettings;
  activeTimerMode: TimerMode;
  checkedInToday: boolean;
  wallet: WalletState;
}
