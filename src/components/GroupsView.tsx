import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Flame,
  Lock,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { FeaturePackId, STUDY_CATEGORIES, StudyCategory, StudyGroup } from '../types/ypt';
import { formatDurationHMS, formatDurationShort } from '../utils/yptLogic';

interface GroupsViewProps {
  groups: StudyGroup[];
  currentUserName: string;
  currentUserTodaySeconds: number;
  currentUserGoalHours: number;
  isFocusing: boolean;
  checkedInToday: boolean;
  studyGroupsUnlocked: boolean;
  onJoinGroup: (groupId: string) => void;
  onLeaveGroup: (groupId: string) => void;
  onWakeMember: (groupId: string, memberId: string) => void;
  onCheerMission: (groupId: string, missionId: string) => void;
  onSubmitCheckIn: (groupId: string, note: string) => void;
  onCreateGroup: (payload: {
    name: string;
    category: StudyCategory;
    description: string;
    dailyMinHours: number;
    maxMembers: number;
    isPrivate: boolean;
  }) => void;
  onRequestUnlock: (packId: FeaturePackId) => void;
}

export const GroupsView: React.FC<GroupsViewProps> = ({
  groups,
  currentUserName,
  currentUserTodaySeconds,
  currentUserGoalHours,
  isFocusing,
  checkedInToday,
  studyGroupsUnlocked,
  onJoinGroup,
  onLeaveGroup,
  onWakeMember,
  onCheerMission,
  onSubmitCheckIn,
  onCreateGroup,
  onRequestUnlock,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups.find((g) => g.joined)?.id ?? groups[0]?.id ?? ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [roomSubTab, setRoomSubTab] = useState<'desks' | 'missions'>('desks');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [wokeFeedback, setWokeFeedback] = useState('');
  const [checkInNote, setCheckInNote] = useState('');

  // Create Group Form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCat, setNewGroupCat] = useState<StudyCategory>('Computer Science');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupMinHours, setNewGroupMinHours] = useState('4');
  const [newGroupMaxMembers, setNewGroupMaxMembers] = useState('30');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [createError, setCreateError] = useState('');

  // Tick every second so studying peers' timers visibly tick live on their desks
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  const activeGroup =
    groups.find((g) => g.id === selectedGroupId) ?? filteredGroups[0] ?? groups[0];

  const handleWake = (memberId: string, memberName: string) => {
    if (!activeGroup) return;
    onWakeMember(activeGroup.id, memberId);
    setWokeFeedback(`Sent wake-up study nudge to ${memberName}.`);
  };

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    onSubmitCheckIn(
      activeGroup.id,
      checkInNote.trim() || 'Completed daily desk check-in'
    );
    setCheckInNote('');
  };

  const joinedCount = useMemo(() => groups.filter((g) => g.joined).length, [groups]);

  const handleOpenCreateForm = () => {
    if (!studyGroupsUnlocked && groups.length >= 1) {
      onRequestUnlock('study_groups');
      return;
    }
    setShowCreateForm((v) => !v);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyGroupsUnlocked && groups.length >= 1) {
      onRequestUnlock('study_groups');
      return;
    }
    if (!newGroupName.trim()) {
      setCreateError('Enter a study group name.');
      return;
    }
    onCreateGroup({
      name: newGroupName.trim(),
      category: newGroupCat,
      description:
        newGroupDesc.trim() || 'Focused desktop accountability room.',
      dailyMinHours: Math.max(1, Number(newGroupMinHours) || 4),
      maxMembers: Math.max(5, Number(newGroupMaxMembers) || 30),
      isPrivate: studyGroupsUnlocked ? newGroupPrivate : false,
    });
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupPrivate(false);
    setCreateError('');
    setShowCreateForm(false);
  };

  return (
    <div className="max-w-[1240px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Sidebar: Group Directory */}
      <section className="lg:col-span-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D]">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Study Rooms
            </h2>
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
            >
              {!studyGroupsUnlocked && groups.length >= 1 ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create Group</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="group-search-input" className="sr-only">
              Search study groups
            </label>
            <input
              id="group-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search groups or categories..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-xs text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
            />
          </div>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateSubmit}
            className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                New Study Group
              </span>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close create group form"
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label htmlFor="new-group-name" className="sr-only">
                Group Name
              </label>
              <input
                id="new-group-name"
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name (e.g. Late Night Coders)"
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
              />
            </div>
            <div>
              <label htmlFor="new-group-cat" className="sr-only">
                Category
              </label>
              <select
                id="new-group-cat"
                value={newGroupCat}
                onChange={(e) => setNewGroupCat(e.target.value as StudyCategory)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
              >
                {STUDY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="new-group-desc" className="sr-only">
                Description
              </label>
              <input
                id="new-group-desc"
                type="text"
                value={newGroupDesc}
                onChange={(e) => setNewGroupDesc(e.target.value)}
                placeholder="Study rules or goal..."
                className="w-full px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="new-group-min" className="block text-[11px] text-neutral-500 mb-0.5">
                  Min Hours/Day
                </label>
                <input
                  id="new-group-min"
                  type="number"
                  min={1}
                  max={16}
                  value={newGroupMinHours}
                  onChange={(e) => setNewGroupMinHours(e.target.value)}
                  className="w-full px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="new-group-max" className="block text-[11px] text-neutral-500 mb-0.5">
                  Max Members
                </label>
                <input
                  id="new-group-max"
                  type="number"
                  min={5}
                  max={100}
                  value={newGroupMaxMembers}
                  onChange={(e) => setNewGroupMaxMembers(e.target.value)}
                  className="w-full px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-mono"
                />
              </div>
            </div>
            <label className="flex items-center justify-between gap-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={studyGroupsUnlocked ? newGroupPrivate : false}
                  onChange={(e) => {
                    if (!studyGroupsUnlocked) {
                      onRequestUnlock('study_groups');
                      return;
                    }
                    setNewGroupPrivate(e.target.checked);
                  }}
                />
                <span>Private room (invite-only)</span>
              </span>
              {!studyGroupsUnlocked && (
                <span className="inline-flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 font-medium">
                  <Lock className="w-3 h-3" />
                  <span>Locked</span>
                </span>
              )}
            </label>
            {createError && (
              <p className="text-xs text-red-600" role="alert">
                {createError}
              </p>
            )}
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
            >
              Create &amp; Join Room
            </button>
          </form>
        )}

        {filteredGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {groups.length === 0
              ? 'No study rooms yet. Create a room above to start studying with a group.'
              : 'No study rooms match your search.'}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {filteredGroups.map((grp) => {
              const studyingCount =
                grp.members.filter((m) => m.status === 'studying').length +
                (grp.joined && isFocusing ? 1 : 0);
              const selected = activeGroup?.id === grp.id;
              return (
                <li key={grp.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(grp.id);
                      setWokeFeedback('');
                    }}
                    className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                      selected
                        ? 'bg-orange-50/70 dark:bg-orange-500/10'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {grp.isPrivate && <Lock className="w-3 h-3 text-neutral-400 shrink-0" />}
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 truncate">
                          {grp.name}
                        </span>
                      </div>
                      {grp.joined && (
                        <span className="text-[11px] font-medium text-orange-600 dark:text-orange-400 shrink-0">
                          Joined
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{grp.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {studyingCount} studying
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {grp.members.length + (grp.joined ? 1 : 0)}/{grp.maxMembers}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Right Main Panel: Active Virtual Study Room or Empty State */}
      {!activeGroup ? (
        <section className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] p-10 text-center space-y-3">
          <Users className="w-8 h-8 mx-auto text-neutral-300 dark:text-neutral-600" />
          <h2 className="font-display font-semibold text-base text-neutral-900 dark:text-neutral-100">
            No Study Room Selected
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            Create your own virtual study room to track daily desk hours, check-in missions, and study accountability.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Study Group</span>
          </button>
        </section>
      ) : (
        <section className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#14171D] overflow-hidden">
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                <span>{activeGroup.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  Min {activeGroup.dailyMinHours}h/day
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {activeGroup.members.length + (activeGroup.joined ? 1 : 0)}/
                  {activeGroup.maxMembers} members
                </span>
              </div>
              <h2 className="font-display font-bold text-xl text-neutral-900 dark:text-neutral-100">
                {activeGroup.name}
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
                {activeGroup.description}
              </p>
            </div>

            <div className="shrink-0">
              {activeGroup.joined ? (
                <button
                  type="button"
                  onClick={() => onLeaveGroup(activeGroup.id)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 cursor-pointer whitespace-nowrap"
                >
                  Leave Group
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!studyGroupsUnlocked && joinedCount >= 1) {
                      onRequestUnlock('study_groups');
                      return;
                    }
                    onJoinGroup(activeGroup.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  {!studyGroupsUnlocked && joinedCount >= 1 && (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Join Study Group</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-tabs: Live Desks vs Check-in Missions */}
          <div className="px-6 py-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/30">
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <button
                type="button"
                onClick={() => setRoomSubTab('desks')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roomSubTab === 'desks'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Live Desks
              </button>
              <button
                type="button"
                onClick={() => setRoomSubTab('missions')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  roomSubTab === 'missions'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-600 dark:text-neutral-400'
                }`}
              >
                Check-In &amp; Missions ({activeGroup.missions.length})
              </button>
            </div>

            {wokeFeedback && (
              <span className="text-xs text-orange-600 dark:text-orange-400">
                {wokeFeedback}
              </span>
            )}
          </div>

          {roomSubTab === 'desks' ? (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Current User's Desk if joined */}
              {activeGroup.joined && (
                <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/40 dark:bg-orange-500/8 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                        ME
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {currentUserName} (You)
                        </div>
                        <div className="text-xs text-orange-600 dark:text-orange-400">
                          {isFocusing ? 'Studying live' : 'At desk · Idle'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="font-mono tabular-nums text-xl font-bold text-neutral-900 dark:text-neutral-100">
                    {formatDurationHMS(currentUserTodaySeconds)}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                    Goal: {currentUserGoalHours}h 00m
                  </div>
                </div>
              )}

              {/* Group Members */}
              {activeGroup.members.map((member) => {
                const liveExtra =
                  member.status === 'studying' && member.activeSinceMs
                    ? Math.max(0, Math.floor((nowMs - member.activeSinceMs) / 1000))
                    : 0;
                const totalSecs = member.baseTodaySeconds + liveExtra;

                return (
                  <div
                    key={member.id}
                    className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg text-xs font-semibold flex items-center justify-center shrink-0 ${
                            member.status === 'studying'
                              ? 'bg-orange-500 text-white'
                              : member.status === 'resting'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}
                        >
                          {member.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {member.name}
                          </div>
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                            {member.status === 'studying'
                              ? member.currentSubject || 'Studying'
                              : member.status === 'resting'
                                ? 'Resting'
                                : 'Offline'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="font-mono tabular-nums text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {formatDurationHMS(totalSecs)}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono tabular-nums">
                        Goal {member.dailyGoalHours}h · {member.wakesReceived}{' '}
                        {member.wakesReceived === 1 ? 'nudge' : 'nudges'}
                      </span>
                      {member.status !== 'studying' && (
                        <button
                          type="button"
                          onClick={() => handleWake(member.id, member.name)}
                          aria-label={`Send wake-up nudge to ${member.name}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline cursor-pointer whitespace-nowrap"
                        >
                          <BellRing className="w-3 h-3" />
                          <span>Wake</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {activeGroup.joined && (
                <form
                  onSubmit={handleCheckIn}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                >
                  <label htmlFor="mission-checkin-input" className="sr-only">
                    Daily Check-in Note
                  </label>
                  <input
                    id="mission-checkin-input"
                    type="text"
                    value={checkInNote}
                    onChange={(e) => setCheckInNote(e.target.value)}
                    placeholder={`Log your daily desk check-in (${formatDurationShort(
                      currentUserTodaySeconds
                    )} studied today)...`}
                    className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={checkedInToday}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{checkedInToday ? 'Checked In Today' : 'Post Check-In'}</span>
                  </button>
                </form>
              )}

              {activeGroup.missions.length === 0 ? (
                <div className="py-10 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  No daily missions posted in this room yet.
                </div>
              ) : (
                <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
                  {activeGroup.missions.map((mission) => (
                    <li
                      key={mission.id}
                      className="py-4 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                          {mission.title}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{mission.authorName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {mission.studyHoursLogged}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{mission.timestampLabel}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onCheerMission(activeGroup.id, mission.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer shrink-0"
                      >
                        <Flame className="w-3.5 h-3.5 text-orange-500" />
                        <span className="font-mono tabular-nums">{mission.cheers}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
