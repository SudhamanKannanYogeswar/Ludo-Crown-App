import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  deleteCurrentAuthUser,
  formatGoogleSignInError,
  isCapacitorNativeApp,
  recoverPendingNativeSignIn,
  signInWithGoogleAuto,
  signOutGoogleAuto,
  testConnection,
} from '../firebase';
import {
  applyTokenMove,
  chooseAiTokenMove,
  findNextActiveTurnIndex,
  getMovableTokenIndices,
  isSeatFinished,
  resolveSeatFinishState,
  rollDiceWithPity,
  updateSeatDryRolls,
} from '../game/ludoEngine';
import {
  ActiveAdModalState,
  ADMOB_CONFIG,
  hasNativeAndroidAdBridge,
  initNativeAdMob,
  isTestAdUnitId,
  preloadNativeInterstitialAd,
  preloadNativeRewardedAd,
  REWARDED_PLACEMENTS,
  RewardedPlacementId,
  showNativeInterstitialAd,
  showNativeRewardedAd,
  syncNativeBannerVisibility,
} from '../services/adMobService';
import {
  initAnalytics,
  resetAnalyticsData,
  setAnalyticsUser,
  trackAnalyticsEvent,
  trackScreenView,
} from '../services/analyticsService';
import {
  getNotificationPermissionState,
  getStoredFcmToken,
  loadNotificationPrefs,
  markDailyResetAlertShown,
  NotificationPermissionState,
  NotificationPreferences,
  registerForPushNotifications,
  saveNotificationPrefsLocal,
  shouldTriggerDailyResetAlert,
  showDeviceNotificationAlert,
  syncPushIfAlreadyGranted,
} from '../services/pushNotificationService';
import { listenForIncomingDeepLinks } from '../services/shareService';
import {
  acceptFriendRequestDoc,
  cleanupOwnStaleWaitingRooms,
  completeTournamentDoc,
  createDefaultProfile,
  createDefaultWallet,
  createMultiplayerRoom,
  createTournament,
  deleteRoomInviteDoc,
  deleteUserAccountDocs,
  ensureUserDocs,
  fetchAllBlockingActiveRooms,
  fetchBlockingActiveRoom,
  fetchPublicLeaderboard,
  fetchPublicTournaments,
  findOrCreateQuickMatch,
  forfeitActiveRoomDoc,
  getInviteRemainingMs,
  isRoomActiveForUser,
  isRoomBlockingNewMatch,
  joinRoomByCode,
  joinTournamentDoc,
  leaveWaitingRoom,
  listOpenPublicRooms,
  removeFriendshipDoc,
  resolvePlayerPresence,
  respondToRoomInviteDoc,
  savePushSubscriptionDoc,
  sendFriendRequestDoc,
  sendRoomInviteDoc,
  sendRoomMessage,
  startMultiplayerRoom,
  subscribeFriendships,
  subscribeIncomingRoomInvites,
  subscribeProfile,
  subscribePublicProfiles,
  subscribeRoom,
  subscribeRoomMessages,
  subscribeUserActiveRooms,
  subscribeWallet,
  touchWaitingRoomHeartbeat,
  updateMultiplayerTurn,
  updateProfileCustomization,
  updateProfileStats,
  updateRoomSeatPresence,
  updateUserPresence,
  updateWalletAdReward,
  updateWalletEconomy,
  updateWalletRewardsAndChallenges,
} from '../services/firestoreService';
import {
  BACKDROP_THEMES,
  computeLeagueFromElo,
  DAILY_CHALLENGES,
  DAILY_STREAK_REWARDS,
  getTodayDateString,
} from '../data/catalog';
import { tabletopAudio } from '../game/sound';
import {
  ActiveTab,
  AiDifficulty,
  ChatMessageDoc,
  FriendshipDoc,
  GameMode,
  LeagueTier,
  MatchSummary,
  PlayerColor,
  PlayerProfile,
  RoomDoc,
  RoomInviteDoc,
  RoomSeat,
  TokenPositions,
  TournamentDoc,
  UserWallet,
} from '../types';

const GUEST_PROFILE_KEY = 'ludo_crown_guest_profile_v1';
const GUEST_WALLET_KEY = 'ludo_crown_guest_wallet_v1';
const BACKDROP_THEME_KEY = 'ludo_crown_backdrop_theme_v1';
const LAST_ACTIVE_ROOM_KEY = 'ludo_crown_last_active_room_v1';

export interface OfflineMatchConfig {
  mode: GameMode;
  playerCount: 2 | 4;
  difficulty: AiDifficulty;
  passAndPlay?: {
    playerCount: 2 | 3 | 4;
    playerNames: string[];
    seatIsBot?: boolean[];
  };
  tournamentContext?: {
    tournamentId: string;
    tournamentTitle: string;
    round: 'semifinal' | 'final';
    prizePool: number;
    opponentName: string;
  };
}

interface ToastMessage {
  id: number;
  text: string;
  tone: 'info' | 'success' | 'error';
}

export interface ActiveMatchConflict {
  actionLabel: string;
  room: RoomDoc;
  onConfirmNewMatch: () => Promise<void> | void;
}

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  signingIn: boolean;
  isSignedIn: boolean;
  presenceNowMs: number;
  profile: PlayerProfile;
  wallet: UserWallet;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  soundMuted: boolean;
  toggleSoundMuted: () => void;
  backdropThemeId: string;
  setBackdropThemeId: (id: string) => void;
  cycleBackdropTheme: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  deleteAccountAndData: () => Promise<{ ok: boolean; requiresRecentLogin?: boolean; message: string }>;
  resetGuestLocalData: () => void;
  // Profile & Cosmetics
  saveCustomization: (
    updates: Pick<PlayerProfile, 'displayName' | 'avatarId' | 'avatarFrame' | 'boardTheme' | 'diceTheme'>
  ) => Promise<void>;
  purchaseCosmetic: (itemId: string, price: number, currency: 'coins' | 'gems') => Promise<boolean>;
  // Rewards & Daily Challenges
  claimDailyStreak: () => Promise<boolean>;
  claimDailyChallenge: (challengeId: string) => Promise<boolean>;
  grantWheelReward: (coinsDelta: number, gemsDelta: number, ticketsDelta: number) => Promise<void>;
  recordGameplayEvent: (delta: { rollSixes?: number; captures?: number }) => void;
  recordMatchCompletion: (summary: MatchSummary) => Promise<void>;
  // Multiplayer Rooms & Network Resilience
  networkOnline: boolean;
  reconnecting: boolean;
  activeRoomId: string | null;
  activeRoom: RoomDoc | null;
  myActiveRooms: RoomDoc[];
  blockingActiveRoom: RoomDoc | null;
  activeMatchConflict: ActiveMatchConflict | null;
  dismissActiveMatchConflict: () => void;
  confirmExitAndStartNewMatch: () => Promise<void>;
  roomMessages: ChatMessageDoc[];
  openRooms: RoomDoc[];
  refreshOpenRooms: () => Promise<void>;
  startQuickMatchmaking: (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => Promise<void>;
  createPrivateRoom: (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  rejoinActiveRoom: (roomId: string) => Promise<void>;
  setMySeatAutoPlay: (enabled: boolean) => Promise<void>;
  hostStartRoom: (fillBots: boolean) => Promise<void>;
  submitMultiplayerTurn: (payload: {
    seats?: RoomSeat[];
    tokens: TokenPositions;
    turnIndex: number;
    diceValue: number;
    turnPhase: 'roll' | 'move';
    consecutiveSixes: number;
    status: 'playing' | 'finished';
    winnerColor: string;
    winnerUid: string;
    lastActionText: string;
    turnCount: number;
  }) => Promise<void>;
  sendChat: (text: string, kind: 'chat' | 'emote') => Promise<void>;
  exitActiveRoom: () => Promise<void>;
  forfeitActiveRoom: (roomId?: string) => Promise<void>;
  rematchOnlineRoom: (finishedRoom: RoomDoc) => Promise<void>;
  pendingDeepLinkRoomCode: string | null;
  clearPendingDeepLinkRoom: () => void;
  // Offline Practice & Tournament Matches
  offlineMatch: OfflineMatchConfig | null;
  launchOfflinePractice: (config: OfflineMatchConfig) => void;
  closeOfflineMatch: () => void;
  // Leaderboard & Tournaments
  leaderboard: PlayerProfile[];
  refreshLeaderboard: () => Promise<void>;
  tournaments: TournamentDoc[];
  refreshTournaments: () => Promise<void>;
  hostNewTournament: (title: string, tier: LeagueTier, maxEntrants: 4 | 8) => Promise<void>;
  registerForTournament: (tournament: TournamentDoc, useFreeTicket: boolean) => Promise<boolean>;
  // Friends & Real-Time Room Invites
  friendships: FriendshipDoc[];
  incomingInvites: RoomInviteDoc[];
  sendFriendRequest: (
    target: Pick<PlayerProfile, 'uid' | 'displayName' | 'avatarId'>
  ) => Promise<void>;
  acceptFriend: (friendshipId: string, friendName: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  inviteFriendToPlay: (friendUid: string, friendName: string) => Promise<void>;
  acceptRoomInvite: (invite: RoomInviteDoc) => Promise<void>;
  declineRoomInvite: (inviteId: string) => Promise<void>;
  // Push Notifications (FCM / Web Opt-In)
  notificationPrefs: NotificationPreferences;
  notificationPermission: NotificationPermissionState;
  enablePushNotifications: () => Promise<boolean>;
  updateNotificationPref: (
    key: keyof Omit<NotificationPreferences, 'enabled'>,
    value: boolean
  ) => Promise<void>;
  // AdMob Placements
  adModal: ActiveAdModalState | null;
  triggerRewardedAd: (placementId: RewardedPlacementId, onRewardEarned: () => void) => void;
  maybeShowInterstitialAfterMatch: () => void;
  doubleSummaryCoinsWithAd: (summary: MatchSummary, onDoubled: () => void) => void;
  matchesSinceLastInterstitial: number;
  // Toasts
  toast: ToastMessage | null;
  showToast: (text: string, tone?: 'info' | 'success' | 'error') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function loadGuestProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    if (raw) return JSON.parse(raw) as PlayerProfile;
  } catch {
    // ignore storage errors
  }
  return createDefaultProfile('guest_local', 'Guest Strategist');
}

function loadGuestWallet(): UserWallet {
  try {
    const raw = localStorage.getItem(GUEST_WALLET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserWallet;
      const today = getTodayDateString();
      if (parsed.dailyChallengesDate !== today) {
        parsed.dailyChallengesDate = today;
        parsed.challengeProgress = { rollSixes: 0, captures: 0, matchesPlayed: 0, matchesWon: 0 };
        parsed.claimedChallenges = [];
      }
      if (parsed.adDate !== today) {
        parsed.adDate = today;
        parsed.adRewardedCountToday = 0;
      }
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return createDefaultWallet('guest_local');
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [userDocsReadyUid, setUserDocsReadyUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadGuestProfile());
  const [wallet, setWallet] = useState<UserWallet>(() => loadGuestWallet());
  const [activeTab, setActiveTab] = useState<ActiveTab>('lobby');
  const [soundMuted, setSoundMuted] = useState(false);
  const [backdropThemeId, setBackdropThemeIdState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(BACKDROP_THEME_KEY);
      if (saved && BACKDROP_THEMES.some((t) => t.id === saved)) return saved;
    } catch {
      // ignore storage errors
    }
    return BACKDROP_THEMES[0].id;
  });

  const setBackdropThemeId = useCallback((id: string) => {
    if (!BACKDROP_THEMES.some((t) => t.id === id)) return;
    setBackdropThemeIdState(id);
    try {
      localStorage.setItem(BACKDROP_THEME_KEY, id);
    } catch {
      // ignore storage errors
    }
  }, []);

  const cycleBackdropTheme = useCallback(() => {
    setBackdropThemeIdState((prev) => {
      const idx = BACKDROP_THEMES.findIndex((t) => t.id === prev);
      const next = BACKDROP_THEMES[(idx + 1) % BACKDROP_THEMES.length];
      try {
        localStorage.setItem(BACKDROP_THEME_KEY, next.id);
      } catch {
        // ignore storage errors
      }
      return next.id;
    });
  }, []);

  const [networkOnline, setNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [reconnecting, setReconnecting] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomDoc | null>(null);
  const [subscribedActiveRooms, setSubscribedActiveRooms] = useState<RoomDoc[]>([]);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [pinnedRoomDocs, setPinnedRoomDocs] = useState<Record<string, RoomDoc>>({});
  const pinnedRoomIdsRef = React.useRef<string[]>([]);
  pinnedRoomIdsRef.current = pinnedRoomIds;
  const [activeMatchConflict, setActiveMatchConflict] = useState<ActiveMatchConflict | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessageDoc[]>([]);
  const [openRooms, setOpenRooms] = useState<RoomDoc[]>([]);
  const [offlineMatch, setOfflineMatch] = useState<OfflineMatchConfig | null>(null);
  const bypassActiveMatchGuardRef = React.useRef<boolean>(false);
  const blockingActiveRoomRef = React.useRef<RoomDoc | null>(null);
  const forfeitingRoomIdsRef = React.useRef<Set<string>>(new Set());
  const matchEntryLockRef = React.useRef<boolean>(false);

  const persistPinnedRoomIds = useCallback((uid: string, nextIds: string[]) => {
    const clean = Array.from(new Set(nextIds.filter(Boolean))).slice(0, 6);
    pinnedRoomIdsRef.current = clean;
    setPinnedRoomIds(clean);
    try {
      const storageKey = `${LAST_ACTIVE_ROOM_KEY}_${uid}`;
      if (clean.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(clean));
        localStorage.setItem(LAST_ACTIVE_ROOM_KEY, clean[0]);
      } else {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(LAST_ACTIVE_ROOM_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const pinActiveRoomId = useCallback(
    (uid: string | undefined, roomId: string | null | undefined) => {
      if (!uid || !roomId) return;
      forfeitingRoomIdsRef.current.delete(roomId);
      const next = [roomId, ...pinnedRoomIdsRef.current.filter((id) => id !== roomId)].slice(0, 6);
      persistPinnedRoomIds(uid, next);
    },
    [persistPinnedRoomIds]
  );

  const replacePinnedActiveRoomId = useCallback(
    (uid: string | undefined, roomId: string | null | undefined) => {
      if (!uid) return;
      if (!roomId) {
        persistPinnedRoomIds(uid, []);
        setPinnedRoomDocs({});
        return;
      }
      forfeitingRoomIdsRef.current.delete(roomId);
      persistPinnedRoomIds(uid, [roomId]);
      setPinnedRoomDocs((prev) => (roomId in prev ? { [roomId]: prev[roomId] } : {}));
    },
    [persistPinnedRoomIds]
  );

  const unpinActiveRoomId = useCallback(
    (uid: string | undefined, roomId: string | null | undefined) => {
      if (!uid || !roomId) return;
      const next = pinnedRoomIdsRef.current.filter((id) => id !== roomId);
      persistPinnedRoomIds(uid, next);
      setPinnedRoomDocs((prev) => {
        if (!(roomId in prev)) return prev;
        const copy = { ...prev };
        delete copy[roomId];
        return copy;
      });
    },
    [persistPinnedRoomIds]
  );

  // Authoritative merged active rooms list (direct pinned room listeners + collection query),
  // prioritizing the currently open room first, then active playing rooms, then newest updated.
  const rawActiveRooms = useMemo<RoomDoc[]>(() => {
    if (!user) return [];
    const now = Date.now();
    const byId = new Map<string, RoomDoc>();
    const consider = (room: RoomDoc | null | undefined) => {
      if (!room || forfeitingRoomIdsRef.current.has(room.id)) return;
      if (!isRoomActiveForUser(room, user.uid, now)) return;
      const prev = byId.get(room.id);
      if (
        !prev ||
        (room.turnCount || 0) > (prev.turnCount || 0) ||
        (room.updatedAtMs || 0) >= (prev.updatedAtMs || 0)
      ) {
        byId.set(room.id, room);
      }
    };
    for (const r of subscribedActiveRooms) consider(r);
    for (const r of Object.values(pinnedRoomDocs)) consider(r);
    return Array.from(byId.values()).sort((a, b) => {
      if (activeRoomId && a.id !== b.id) {
        if (a.id === activeRoomId) return -1;
        if (b.id === activeRoomId) return 1;
      }
      if (a.status !== b.status) return a.status === 'playing' ? -1 : 1;
      return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
    });
  }, [user, activeRoomId, subscribedActiveRooms, pinnedRoomDocs]);

  // Strict Single-Active-Match Invariant: expose at most 1 active room at any instant
  const myActiveRooms = useMemo<RoomDoc[]>(() => rawActiveRooms.slice(0, 1), [rawActiveRooms]);
  const [pendingDeepLinkRoomCode, setPendingDeepLinkRoomCode] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('ludo_crown_pending_join_code') || null;
    } catch {
      return null;
    }
  });

  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [tournaments, setTournaments] = useState<TournamentDoc[]>([]);
  const [friendships, setFriendships] = useState<FriendshipDoc[]>([]);
  const [rawIncomingInvites, setRawIncomingInvites] = useState<RoomInviteDoc[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());
  const cleanedExpiredInviteIdsRef = React.useRef<Set<string>>(new Set());
  const seenInviteIdsRef = React.useRef<Set<string>>(new Set());
  const seenFriendStatusRef = React.useRef<Map<string, string>>(new Map());
  const friendsInitializedRef = React.useRef<boolean>(false);
  const notifiedActiveRoomIdsRef = React.useRef<Set<string>>(new Set());
  const bgAutoPlayBusyRef = React.useRef<Set<string>>(new Set());
  const prevNetworkOnlineRef = React.useRef<boolean>(networkOnline);
  const activeTabRef = React.useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;
  const activeRoomRef = React.useRef<RoomDoc | null>(activeRoom);
  activeRoomRef.current = activeRoom;
  const profileDisplayNameRef = React.useRef<string>(profile.displayName);
  profileDisplayNameRef.current = profile.displayName;

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() =>
    loadNotificationPrefs()
  );
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('prompt');
  const notifPrefsRef = React.useRef<NotificationPreferences>(notificationPrefs);
  notifPrefsRef.current = notificationPrefs;

  const [adModal, setAdModal] = useState<ActiveAdModalState | null>(null);
  const [matchesSinceLastInterstitial, setMatchesSinceLastInterstitial] = useState(0);
  const lastInterstitialAtRef = React.useRef<number>(0);
  const rewardedLoadingRef = React.useRef<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now();
    setToast({ id, text, tone });
    setTimeout(() => {
      setToast((prev) => (prev && prev.id === id ? null : prev));
    }, 3600);
  }, []);

  // Persist guest state locally
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profile));
        localStorage.setItem(GUEST_WALLET_KEY, JSON.stringify(wallet));
      } catch {
        // ignore quota issues
      }
    }
  }, [user, profile, wallet]);

  // Live clock for friend online/offline staleness & incoming invite countdowns
  useEffect(() => {
    const tickMs = rawIncomingInvites.length > 0 ? 1000 : 15_000;
    const interval = setInterval(() => {
      setPresenceNowMs(Date.now());
    }, tickMs);
    return () => clearInterval(interval);
  }, [rawIncomingInvites.length]);

  // Filter incoming invites live by 2-minute TTL and clean up expired invites automatically
  const incomingInvites = useMemo(
    () => rawIncomingInvites.filter((inv) => getInviteRemainingMs(inv, presenceNowMs) > 0),
    [rawIncomingInvites, presenceNowMs]
  );

  useEffect(() => {
    if (!user || rawIncomingInvites.length === 0) return;
    for (const inv of rawIncomingInvites) {
      if (
        getInviteRemainingMs(inv, presenceNowMs) <= 0 &&
        !cleanedExpiredInviteIdsRef.current.has(inv.id)
      ) {
        cleanedExpiredInviteIdsRef.current.add(inv.id);
        deleteRoomInviteDoc(inv.id).catch(() => {});
      }
    }
  }, [user, rawIncomingInvites, presenceNowMs]);

  // Startup Firestore connectivity test + Auth state listener
  useEffect(() => {
    testConnection();
    recoverPendingNativeSignIn().catch(() => {});
    let cancelled = false;
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      setUser(firebaseUser);
      if (firebaseUser) {
        if (firebaseUser.emailVerified === false) {
          showToast(
            'Your Google account email is not verified yet. Please verify it to enable cloud saves & online tables.',
            'error'
          );
        }

        let synced = false;
        const retryDelays = [0, 450, 1200];
        for (let attempt = 0; attempt < retryDelays.length; attempt++) {
          if (cancelled) return;
          if (retryDelays[attempt] > 0) {
            await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
            if (cancelled) return;
          }
          try {
            // Attach fresh ID token (force-refresh on retry to resolve cold token propagation)
            await firebaseUser.getIdToken(attempt > 0).catch(() => {});
            const { profile: p, wallet: w } = await ensureUserDocs(
              firebaseUser.uid,
              firebaseUser.displayName || 'Club Player'
            );
            if (cancelled) return;
            setProfile(p);
            setWallet(w);
            setUserDocsReadyUid(firebaseUser.uid);
            synced = true;
            break;
          } catch (err) {
            if (attempt === retryDelays.length - 1) {
              console.error('Sign-in profile sync error:', err);
            }
          }
        }

        if (!synced && !cancelled) {
          // Still unblock subscriptions so existing docs can sync once connectivity stabilizes
          setUserDocsReadyUid(firebaseUser.uid);
          showToast('Signed in — finishing cloud profile sync...', 'info');
        }
      } else {
        setUserDocsReadyUid(null);
        setProfile(loadGuestProfile());
        setWallet(loadGuestWallet());
        setActiveRoomId(null);
        setActiveRoom(null);
        setSubscribedActiveRooms([]);
        setPinnedRoomIds([]);
        pinnedRoomIdsRef.current = [];
        setPinnedRoomDocs({});
        blockingActiveRoomRef.current = null;
        forfeitingRoomIdsRef.current.clear();
        setRoomMessages([]);
        setRawIncomingInvites([]);
        setFriendships([]);
        notifiedActiveRoomIdsRef.current.clear();
        cleanedExpiredInviteIdsRef.current.clear();
      }
      if (!cancelled) {
        setAuthReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsubAuth();
    };
  }, [showToast]);

  // Real-time Profile, Wallet, Friends, Public Presence, Invites & Active Rooms subscriptions
  useEffect(() => {
    if (!user || userDocsReadyUid !== user.uid) return;
    const unsubProfile = subscribeProfile(user.uid, (p) => setProfile(p));
    const unsubWallet = subscribeWallet(user.uid, (w) => {
      const today = getTodayDateString();
      if (w.dailyChallengesDate !== today) {
        updateWalletRewardsAndChallenges(user.uid, {
          coins: w.coins,
          gems: w.gems,
          dailyStreak: w.dailyStreak,
          lastDailyClaimDate: w.lastDailyClaimDate,
          dailyChallengesDate: today,
          challengeProgress: { rollSixes: 0, captures: 0, matchesPlayed: 0, matchesWon: 0 },
          claimedChallenges: [],
        }).catch(() => {});
      }
      setWallet(w);
    });
    const unsubPublicProfiles = subscribePublicProfiles((rows) => {
      setLeaderboard(rows);
    });
    friendsInitializedRef.current = false;
    seenFriendStatusRef.current.clear();

    const unsubFriends = subscribeFriendships(user.uid, (items) => {
      if (!friendsInitializedRef.current) {
        friendsInitializedRef.current = true;
        items.forEach((f) => seenFriendStatusRef.current.set(f.id, f.status));
      } else {
        for (const f of items) {
          const prevStatus = seenFriendStatusRef.current.get(f.id);
          if (!prevStatus && f.status === 'pending' && f.recipientUid === user.uid) {
            tabletopAudio.playSafeStar();
            showToast(`${f.requesterName} sent you a friend request!`, 'info');
            if (notifPrefsRef.current.enabled && notifPrefsRef.current.friendRequests) {
              showDeviceNotificationAlert(
                'New Friend Request · Ludo Crown',
                `${f.requesterName} wants to add you as a friend.`,
                `friend-req-${f.id}`
              );
            }
          } else if (
            prevStatus === 'pending' &&
            f.status === 'accepted' &&
            f.requesterUid === user.uid
          ) {
            tabletopAudio.playSafeStar();
            showToast(`${f.recipientName} accepted your friend request!`, 'success');
            if (notifPrefsRef.current.enabled && notifPrefsRef.current.friendRequests) {
              showDeviceNotificationAlert(
                'Friend Request Accepted!',
                `${f.recipientName} joined your Ludo Crown squad.`,
                `friend-acc-${f.id}`
              );
            }
          }
          seenFriendStatusRef.current.set(f.id, f.status);
        }
      }
      setFriendships(items);
    });
    const unsubInvites = subscribeIncomingRoomInvites(user.uid, (invites) => {
      setRawIncomingInvites(invites);
      setPresenceNowMs(Date.now());
      for (const inv of invites) {
        if (!seenInviteIdsRef.current.has(inv.id)) {
          seenInviteIdsRef.current.add(inv.id);
          if (Date.now() - inv.createdAtMs < 20000) {
            tabletopAudio.playSafeStar();
            showToast(`${inv.fromName} invited you to table ${inv.roomCode}!`, 'info');
            if (notifPrefsRef.current.enabled && notifPrefsRef.current.roomInvites) {
              showDeviceNotificationAlert(
                'Table Invite · Ludo Crown',
                `${inv.fromName} invited you to table ${inv.roomCode}!`,
                `room-invite-${inv.id}`
              );
            }
          }
        }
      }
    });
    const unsubMyActiveRooms = subscribeUserActiveRooms(user.uid, (rooms) => {
      const visible = rooms.filter((r) => !forfeitingRoomIdsRef.current.has(r.id));
      setSubscribedActiveRooms(visible);
      // Pin the single primary active room so direct per-room tracking survives indefinitely
      if (visible[0] && !pinnedRoomIdsRef.current.includes(visible[0].id)) {
        pinActiveRoomId(user.uid, visible[0].id);
      }
      // Notify player on Home/menus when a live running room is detected (e.g. after reload or reconnect)
      if (activeTabRef.current !== 'play') {
        const runningMatch = visible.find((r) => isRoomBlockingNewMatch(r, user.uid) && r.status === 'playing');
        if (runningMatch && !notifiedActiveRoomIdsRef.current.has(runningMatch.id)) {
          notifiedActiveRoomIdsRef.current.add(runningMatch.id);
          showToast(
            `Live match running in table ${runningMatch.roomCode}! Tap Rejoin on Home.`,
            'info'
          );
        }
      }
    });

    return () => {
      unsubProfile();
      unsubWallet();
      unsubPublicProfiles();
      unsubFriends();
      unsubInvites();
      unsubMyActiveRooms();
    };
  }, [user, userDocsReadyUid, pinActiveRoomId, showToast]);

  // Global Real-Time Friend Presence Heartbeat (online / in_match / offline)
  const desiredPresenceStatus =
    activeTab === 'play' && (activeRoom?.status === 'playing' || Boolean(offlineMatch))
      ? 'in_match'
      : 'online';

  useEffect(() => {
    if (!user || userDocsReadyUid !== user.uid || !networkOnline) return;
    const uid = user.uid;

    const sendOnlineHeartbeat = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      updateUserPresence(uid, desiredPresenceStatus);
    };

    const sendOfflineMark = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      updateUserPresence(uid, 'offline');
    };

    sendOnlineHeartbeat();
    const interval = setInterval(sendOnlineHeartbeat, 40_000);

    const handleVisibility = () => {
      if (document.hidden) {
        sendOfflineMark();
      } else {
        sendOnlineHeartbeat();
      }
    };
    const handleUnload = () => {
      sendOfflineMark();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    let capacitorPresenceHandle: { remove: () => Promise<void> } | null = null;
    if (isCapacitorNativeApp()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          sendOnlineHeartbeat();
        } else {
          sendOfflineMark();
        }
      })
        .then((handle) => {
          capacitorPresenceHandle = handle;
        })
        .catch(() => {});
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      capacitorPresenceHandle?.remove().catch(() => {});
    };
  }, [user, userDocsReadyUid, networkOnline, desiredPresenceStatus]);

  // Track browser/mobile network connectivity & automatic reconnection
  useEffect(() => {
    const handleOnline = () => setNetworkOnline(true);
    const handleOffline = () => setNetworkOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const wasOnline = prevNetworkOnlineRef.current;
    prevNetworkOnlineRef.current = networkOnline;
    if (wasOnline === networkOnline) return;

    if (!networkOnline) {
      if (activeRoomRef.current?.status === 'playing') {
        showToast('Network lost — Auto-Play will cover your turns until you reconnect.', 'error');
      }
      return;
    }

    // Recovered from network drop
    setReconnecting(true);
    const clearTimer = setTimeout(() => setReconnecting(false), 1800);
    const currentRoom = activeRoomRef.current;
    if (user && currentRoom && currentRoom.status === 'playing' && activeTabRef.current === 'play') {
      updateRoomSeatPresence(
        currentRoom.id,
        user.uid,
        { autoPlay: false, away: false, lastSeenMs: Date.now() },
        `${profileDisplayNameRef.current} reconnected!`
      ).catch(() => {});
      showToast(`Back online! Resumed live table ${currentRoom.roomCode}.`, 'success');
    } else if (user) {
      showToast('Back online! Cloud sync restored.', 'success');
    }
    return () => clearTimeout(clearTimer);
  }, [networkOnline, user, showToast]);

  // Load persisted pinned active room IDs for this signed-in player
  useEffect(() => {
    if (!user) return;
    try {
      const storedList = localStorage.getItem(`${LAST_ACTIVE_ROOM_KEY}_${user.uid}`);
      const legacySingle = localStorage.getItem(LAST_ACTIVE_ROOM_KEY);
      const parsed: string[] = [];
      if (storedList) {
        const arr = JSON.parse(storedList);
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (typeof item === 'string' && item.trim()) parsed.push(item.trim());
          }
        }
      }
      if (legacySingle && legacySingle.trim() && !parsed.includes(legacySingle.trim())) {
        parsed.push(legacySingle.trim());
      }
      if (parsed.length > 0) {
        persistPinnedRoomIds(user.uid, parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, [user, persistPinnedRoomIds]);

  // Direct per-room real-time listeners for pinned active rooms (100% immune to historical match count)
  useEffect(() => {
    if (!user || pinnedRoomIds.length === 0) return;
    const unsubs = pinnedRoomIds.map((roomId) =>
      subscribeRoom(roomId, (room) => {
        if (forfeitingRoomIdsRef.current.has(roomId) || !room || !isRoomActiveForUser(room, user.uid)) {
          unpinActiveRoomId(user.uid, roomId);
          return;
        }
        setPinnedRoomDocs((prev) => ({ ...prev, [roomId]: room }));
        if (
          activeTabRef.current !== 'play' &&
          room.status === 'playing' &&
          isRoomBlockingNewMatch(room, user.uid) &&
          !notifiedActiveRoomIdsRef.current.has(room.id)
        ) {
          notifiedActiveRoomIdsRef.current.add(room.id);
          showToast(
            `Live match running in table ${room.roomCode} (Auto-Play active)! Tap Rejoin anytime.`,
            'info'
          );
        }
      })
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user, pinnedRoomIds, unpinActiveRoomId, showToast]);

  // Self-Healing Single-Active-Match Reconciler:
  // If more than 1 active room is ever detected (e.g. legacy matches or multi-device play),
  // keep ONLY the primary room (activeRoomId or newest live match) and forfeit all older duplicates immediately.
  useEffect(() => {
    if (!user || rawActiveRooms.length <= 1) return;
    const primary = rawActiveRooms[0];
    const duplicates = rawActiveRooms
      .slice(1)
      .filter((r) => !forfeitingRoomIdsRef.current.has(r.id));
    if (duplicates.length === 0) return;

    const dupIds = new Set(duplicates.map((r) => r.id));
    for (const id of dupIds) {
      forfeitingRoomIdsRef.current.add(id);
      unpinActiveRoomId(user.uid, id);
    }
    setSubscribedActiveRooms((prev) => prev.filter((r) => !dupIds.has(r.id)));
    if (primary) {
      replacePinnedActiveRoomId(user.uid, primary.id);
    }
    const uid = user.uid;
    const displayName = profileDisplayNameRef.current || 'Player';
    Promise.allSettled(
      duplicates.map((dup) => forfeitActiveRoomDoc(dup, uid, displayName))
    ).catch(() => {});
  }, [user, rawActiveRooms, unpinActiveRoomId, replacePinnedActiveRoomId]);

  // Keep activeRoomId pinned whenever the player enters a live/waiting table; only unpin when finished
  useEffect(() => {
    if (!user || !activeRoomId) return;
    if (activeRoom && activeRoom.id === activeRoomId) {
      if (activeRoom.status === 'finished') {
        unpinActiveRoomId(user.uid, activeRoomId);
      } else if (isRoomActiveForUser(activeRoom, user.uid)) {
        pinActiveRoomId(user.uid, activeRoomId);
        setPinnedRoomDocs((prev) => ({ ...prev, [activeRoomId]: activeRoom }));
      }
    } else {
      pinActiveRoomId(user.uid, activeRoomId);
    }
  }, [user, activeRoomId, activeRoom, pinActiveRoomId, unpinActiveRoomId]);

  // Real-time Active Room subscription
  useEffect(() => {
    if (!user || !activeRoomId) {
      setActiveRoom(null);
      setRoomMessages([]);
      return;
    }
    const unsub = subscribeRoom(activeRoomId, (room) => {
      setActiveRoom(room);
      if (!room) {
        setActiveRoomId(null);
        unpinActiveRoomId(user.uid, activeRoomId);
      }
    });
    return () => unsub();
  }, [user, activeRoomId, unpinActiveRoomId]);

  // Waiting-room host heartbeat (every 15s) so live public lobbies stay fresh & abandoned ones auto-expire
  useEffect(() => {
    if (!user || !activeRoom || activeRoom.status !== 'waiting' || activeRoom.hostUid !== user.uid) {
      return;
    }
    const roomId = activeRoom.id;
    touchWaitingRoomHeartbeat(roomId);
    const interval = setInterval(() => {
      if (navigator.onLine) {
        touchWaitingRoomHeartbeat(roomId);
      }
    }, 15_000);

    const handlePageHide = () => {
      leaveWaitingRoom(activeRoom, user.uid, profile.displayName).catch(() => {});
    };
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [user, activeRoom?.id, activeRoom?.status, activeRoom?.hostUid, profile.displayName]);

  // Playing-room seat presence heartbeat + mobile background/foreground auto-play handover
  useEffect(() => {
    if (!user || !activeRoom || activeRoom.status !== 'playing' || activeTab !== 'play') {
      return;
    }
    const roomId = activeRoom.id;
    const uid = user.uid;

    const sendHeartbeat = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      updateRoomSeatPresence(roomId, uid, { away: false, lastSeenMs: Date.now() }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 12_000);

    const markBackgrounded = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const latestRoom = activeRoomRef.current;
      const mySeatNow = latestRoom?.seats.find((s) => !s.isBot && s.uid === uid);
      if (mySeatNow && latestRoom && isSeatFinished(mySeatNow, latestRoom.tokens)) return;
      updateRoomSeatPresence(
        roomId,
        uid,
        { away: true, autoPlay: true },
        `${profileDisplayNameRef.current} stepped away — Auto-Play active.`
      ).catch(() => {});
    };

    const markForegrounded = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const latestRoom = activeRoomRef.current;
      const mySeatNow = latestRoom?.seats.find((s) => !s.isBot && s.uid === uid);
      if (mySeatNow && latestRoom && isSeatFinished(mySeatNow, latestRoom.tokens)) {
        updateRoomSeatPresence(roomId, uid, { away: false, autoPlay: false, lastSeenMs: Date.now() }).catch(
          () => {}
        );
        return;
      }
      updateRoomSeatPresence(
        roomId,
        uid,
        { away: false, autoPlay: false, lastSeenMs: Date.now() },
        `${profileDisplayNameRef.current} is back in control!`
      ).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        markBackgrounded();
      } else {
        setNetworkOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
        markForegrounded();
      }
    };

    const handlePageHide = () => {
      markBackgrounded();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    let capacitorHandle: { remove: () => Promise<void> } | null = null;
    if (isCapacitorNativeApp()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          markBackgrounded();
        } else {
          setNetworkOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
          markForegrounded();
        }
      })
        .then((handle) => {
          capacitorHandle = handle;
        })
        .catch(() => {});
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      capacitorHandle?.remove().catch(() => {});
    };
  }, [user, activeRoom?.id, activeRoom?.status, activeTab]);

  // Background Online Auto-Play Keeper:
  // If the player left an active online match and stayed online on Home/other tabs,
  // keep the match progressing seamlessly until they tap Rejoin (even if no other human is inside the room).
  useEffect(() => {
    if (!user || !networkOnline || myActiveRooms.length === 0) return;

    const awayPlayingRooms = myActiveRooms.filter((room) => {
      if (room.status !== 'playing') return false;
      if (forfeitingRoomIdsRef.current.has(room.id)) return false;
      const isViewingThisRoom = activeTab === 'play' && activeRoomId === room.id;
      if (isViewingThisRoom) return false;
      const mySeat = room.seats.find((s) => !s.isBot && s.uid === user.uid);
      return Boolean(mySeat && !mySeat.forfeited);
    });

    if (awayPlayingRooms.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const room of awayPlayingRooms) {
      const currentSeat = room.seats[room.turnIndex] || room.seats[0];
      if (!currentSeat) continue;

      const currentAlreadyFinished = isSeatFinished(currentSeat, room.tokens);
      const now = Date.now();
      const seatStale =
        !currentSeat.isBot &&
        currentSeat.lastSeenMs !== undefined &&
        now - currentSeat.lastSeenMs > 22_000;
      const turnNeedsAutoPlay =
        currentAlreadyFinished ||
        currentSeat.isBot ||
        Boolean(currentSeat.autoPlay) ||
        Boolean(currentSeat.away) ||
        currentSeat.uid === user.uid ||
        seatStale;

      if (!turnNeedsAutoPlay) continue;

      const otherHumanActivelyInRoom = room.seats.some(
        (s) =>
          !s.isBot &&
          s.uid !== user.uid &&
          !s.away &&
          !s.autoPlay &&
          (s.lastSeenMs === undefined || now - s.lastSeenMs < 25_000)
      );

      // If another human is currently inside MatchArena, let them drive immediately;
      // otherwise this online background client keeps the game moving cleanly!
      const delayMs = otherHumanActivelyInRoom
        ? 7800
        : room.hostUid === user.uid
          ? 2100
          : 4400;

      const timer = setTimeout(async () => {
        if (forfeitingRoomIdsRef.current.has(room.id)) return;
        if (bgAutoPlayBusyRef.current.has(room.id)) return;
        if (activeTabRef.current === 'play' && activeRoomRef.current?.id === room.id) return;
        bgAutoPlayBusyRef.current.add(room.id);

        try {
          const activeColors = room.seats.map((s) => s.color);
          const preservedWinnerColor = room.winnerColor || '';
          const preservedWinnerUid = room.winnerUid || '';

          if (currentAlreadyFinished) {
            const nextIdx = findNextActiveTurnIndex(room.seats, room.tokens, room.turnIndex);
            await updateMultiplayerTurn(room.id, {
              tokens: room.tokens,
              turnIndex: nextIdx,
              diceValue: 0,
              turnPhase: 'roll',
              consecutiveSixes: 0,
              status: 'playing',
              winnerColor: preservedWinnerColor,
              winnerUid: preservedWinnerUid,
              lastActionText: `${room.seats[nextIdx]?.name || 'Next player'}'s turn!`,
              turnCount: room.turnCount + 1,
            });
            return;
          }

          const updatedSeatsForAuto: RoomSeat[] = room.seats.map((s) =>
            !s.isBot && s.uid === currentSeat.uid && !s.autoPlay && !isSeatFinished(s, room.tokens)
              ? { ...s, autoPlay: true, away: true }
              : s
          );
          const autoSeatsChanged = updatedSeatsForAuto.some((s, idx) => s !== room.seats[idx]);
          const actorLabel = currentSeat.isBot
            ? currentSeat.name
            : `${currentSeat.name} (Auto)`;

          if (room.turnPhase === 'roll') {
            const rolled = rollDiceWithPity(room.tokens, currentSeat.color, currentSeat.dryRolls || 0);
            const nextSixes = rolled === 6 ? room.consecutiveSixes + 1 : 0;

            if (nextSixes >= 3) {
              const dryReset = updateSeatDryRolls(updatedSeatsForAuto, currentSeat, 0);
              const nextIdx = findNextActiveTurnIndex(dryReset.seats, room.tokens, room.turnIndex);
              await updateMultiplayerTurn(room.id, {
                ...(autoSeatsChanged || dryReset.changed ? { seats: dryReset.seats } : {}),
                tokens: room.tokens,
                turnIndex: nextIdx,
                diceValue: 0,
                turnPhase: 'roll',
                consecutiveSixes: 0,
                status: 'playing',
                winnerColor: preservedWinnerColor,
                winnerUid: preservedWinnerUid,
                lastActionText: `${actorLabel} rolled three 6s — ${room.seats[nextIdx].name}'s turn.`,
                turnCount: room.turnCount + 1,
              });
              return;
            }

            const legal = getMovableTokenIndices(room.tokens, currentSeat.color, rolled);
            if (legal.length === 0) {
              const dryInc = updateSeatDryRolls(
                updatedSeatsForAuto,
                currentSeat,
                (currentSeat.dryRolls || 0) + 1
              );
              const nextIdx = findNextActiveTurnIndex(dryInc.seats, room.tokens, room.turnIndex);
              await updateMultiplayerTurn(room.id, {
                ...(autoSeatsChanged || dryInc.changed ? { seats: dryInc.seats } : {}),
                tokens: room.tokens,
                turnIndex: nextIdx,
                diceValue: 0,
                turnPhase: 'roll',
                consecutiveSixes: 0,
                status: 'playing',
                winnerColor: preservedWinnerColor,
                winnerUid: preservedWinnerUid,
                lastActionText: `${actorLabel} rolled ${rolled} (no move). ${room.seats[nextIdx].name}'s turn!`,
                turnCount: room.turnCount + 1,
              });
              return;
            }

            const dryReset = updateSeatDryRolls(updatedSeatsForAuto, currentSeat, 0);
            await updateMultiplayerTurn(room.id, {
              ...(autoSeatsChanged || dryReset.changed ? { seats: dryReset.seats } : {}),
              tokens: room.tokens,
              turnIndex: room.turnIndex,
              diceValue: rolled,
              turnPhase: 'move',
              consecutiveSixes: nextSixes,
              status: 'playing',
              winnerColor: preservedWinnerColor,
              winnerUid: preservedWinnerUid,
              lastActionText: `${actorLabel} rolled ${rolled} — moving pawn...`,
              turnCount: room.turnCount,
            });
          } else {
            const chosen = chooseAiTokenMove(
              room.tokens,
              currentSeat.color,
              room.diceValue,
              activeColors,
              'tactical'
            );
            if (chosen < 0) {
              const nextIdx = findNextActiveTurnIndex(updatedSeatsForAuto, room.tokens, room.turnIndex);
              await updateMultiplayerTurn(room.id, {
                ...(autoSeatsChanged ? { seats: updatedSeatsForAuto } : {}),
                tokens: room.tokens,
                turnIndex: nextIdx,
                diceValue: 0,
                turnPhase: 'roll',
                consecutiveSixes: 0,
                status: 'playing',
                winnerColor: preservedWinnerColor,
                winnerUid: preservedWinnerUid,
                lastActionText: `${actorLabel} had no legal move — ${room.seats[nextIdx].name}'s turn.`,
                turnCount: room.turnCount + 1,
              });
              return;
            }

            const outcome = applyTokenMove(
              room.tokens,
              currentSeat.color,
              chosen,
              room.diceValue,
              actorLabel,
              activeColors
            );

            const resolved = resolveSeatFinishState({
              seats: updatedSeatsForAuto,
              nextTokens: outcome.nextTokens,
              actorSeat: currentSeat,
              actorDisplayName: actorLabel,
              turnIndex: room.turnIndex,
              bonusTurn: outcome.bonusTurn,
              baseActionText: outcome.actionText,
              existingWinnerColor: preservedWinnerColor,
              existingWinnerUid: preservedWinnerUid,
              actorUsedAutoPlay: !currentSeat.isBot,
            });

            const shouldPatchSeats = autoSeatsChanged || resolved.seatsChanged;

            await updateMultiplayerTurn(room.id, {
              ...(shouldPatchSeats ? { seats: resolved.updatedSeats } : {}),
              tokens: outcome.nextTokens,
              turnIndex: resolved.nextTurnIndex,
              diceValue: 0,
              turnPhase: 'roll',
              consecutiveSixes:
                outcome.bonusTurn && !resolved.actorJustFinished && !resolved.matchCompleted
                  ? room.consecutiveSixes
                  : 0,
              status: resolved.matchCompleted ? 'finished' : 'playing',
              winnerColor: resolved.winnerColor,
              winnerUid: resolved.winnerUid,
              lastActionText: resolved.actionText,
              turnCount: room.turnCount + 1,
            });
          }
        } catch {
          // Benign if another player moved first or network flickered
        } finally {
          bgAutoPlayBusyRef.current.delete(room.id);
        }
      }, delayMs);

      timers.push(timer);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [user, networkOnline, myActiveRooms, activeTab, activeRoomId]);

  // Real-time Chat Messages subscription
  useEffect(() => {
    if (!user || !activeRoom) {
      setRoomMessages([]);
      return;
    }
    const unsub = subscribeRoomMessages(activeRoom, user.uid, (msgs) => {
      setRoomMessages(msgs);
    });
    return () => unsub();
  }, [user, activeRoom?.id, activeRoom?.visibility]);

  // Warm up native AdMob SDK, Firebase Analytics, pre-warm rewarded & interstitial ads, & inspect notification permission once on mount
  useEffect(() => {
    initAnalytics();
    initNativeAdMob();
    preloadNativeRewardedAd();
    preloadNativeInterstitialAd();
    getNotificationPermissionState()
      .then((perm) => setNotificationPermission(perm))
      .catch(() => {});
  }, []);

  // Track active tab screen views in Google / Firebase Analytics
  useEffect(() => {
    trackScreenView(activeTab);
  }, [activeTab]);

  // Sync non-PII analytics user ID & tier properties
  useEffect(() => {
    if (!authReady) return;
    setAnalyticsUser(user?.uid || null, {
      league: profile.league,
      isGuest: !user,
    });
  }, [authReady, user, profile.league]);

  // Automatically create Android FCM channel & refresh token when permission is already granted
  useEffect(() => {
    syncPushIfAlreadyGranted({
      onToken: (token, platform) => {
        if (user) {
          savePushSubscriptionDoc(user.uid, {
            token,
            platform,
            enabled: true,
            roomInvites: notifPrefsRef.current.roomInvites,
            friendRequests: notifPrefsRef.current.friendRequests,
            dailyRewards: notifPrefsRef.current.dailyRewards,
          }).catch(() => {});
        }
      },
      onForegroundMessage: (title, body) => {
        tabletopAudio.playSafeStar();
        showToast(`${title}: ${body}`, 'info');
      },
      onNotificationTap: (targetTab) => {
        setActiveTab(targetTab);
      },
    }).catch(() => {});
  }, [user, showToast]);

  // Once-per-day alert when Daily Gift / Free Lucky Spin has reset (opt-in only)
  useEffect(() => {
    const today = getTodayDateString();
    if (
      notificationPrefs.enabled &&
      notificationPrefs.dailyRewards &&
      wallet.lastDailyClaimDate !== today &&
      shouldTriggerDailyResetAlert(today)
    ) {
      markDailyResetAlertShown(today);
      showDeviceNotificationAlert(
        'Daily Gift & Lucky Spin Ready!',
        'Claim your 7-Day Streak bonus and spin the Lucky Wheel in Ludo Crown.',
        `daily-reset-${today}`
      );
    }
  }, [notificationPrefs.enabled, notificationPrefs.dailyRewards, wallet.lastDailyClaimDate]);

  // Policy-compliant Adaptive Banner anchored at TOP_CENTER (margin 0) across EVERY screen:
  // - Immediately visible above the header bar on Home, Menu tabs, Waiting Room, and Active Gameplay.
  // - Never needs to destroy & reload when navigating between Home -> Waiting Room -> Match -> Home.
  // - Maximizes above-the-fold viewability & impressions while keeping 100% separation from bottom tabs,
  //   board tiles, and the bottom ROLL DICE controls (zero accidental clicks).
  useEffect(() => {
    syncNativeBannerVisibility(true, { position: 'top', marginPx: 0 });
  }, [activeTab, activeRoom?.status]);

  const toggleSoundMuted = useCallback(() => {
    setSoundMuted((prev) => {
      tabletopAudio.muted = !prev;
      return !prev;
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setSigningIn(true);
    try {
      await signInWithGoogleAuto();
      trackAnalyticsEvent('login', { method: 'google' });
      showToast('Signed in with Google. Online play & cloud sync enabled.', 'success');
    } catch (err) {
      const formatted = formatGoogleSignInError(err);
      if (formatted.silent) return;
      console.error('Google Sign-In failed:', err);
      showToast(formatted.message, 'error');
    } finally {
      setSigningIn(false);
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    try {
      if (user) {
        await updateUserPresence(user.uid, 'offline');
      }
      await signOutGoogleAuto();
      setActiveRoomId(null);
      setActiveRoom(null);
      showToast('Signed out. You can still play Offline Practice anytime.', 'info');
    } catch {
      showToast('Could not sign out right now.', 'error');
    }
  }, [user, showToast]);

  const resetGuestLocalData = useCallback(() => {
    try {
      localStorage.removeItem(GUEST_PROFILE_KEY);
      localStorage.removeItem(GUEST_WALLET_KEY);
      localStorage.removeItem(LAST_ACTIVE_ROOM_KEY);
      localStorage.removeItem(BACKDROP_THEME_KEY);
    } catch {
      // ignore storage errors
    }
    if (!user) {
      setProfile(createDefaultProfile('guest_local', 'Guest Strategist'));
      setWallet(createDefaultWallet('guest_local'));
    }
    setBackdropThemeIdState(BACKDROP_THEMES[0].id);
    showToast('Local guest data cleared on this device.', 'success');
  }, [user, showToast]);

  const deleteAccountAndData = useCallback(async (): Promise<{
    ok: boolean;
    requiresRecentLogin?: boolean;
    message: string;
  }> => {
    if (!user) {
      resetGuestLocalData();
      return { ok: true, message: 'Local guest data cleared.' };
    }
    const uid = user.uid;
    try {
      // Forfeit or leave any active rooms first so other players aren't blocked
      for (const room of myActiveRooms) {
        await forfeitActiveRoomDoc(room, uid, profile.displayName).catch(() => {});
      }
      await deleteUserAccountDocs(uid);
      await deleteCurrentAuthUser();
      resetAnalyticsData();
      try {
        localStorage.removeItem(GUEST_PROFILE_KEY);
        localStorage.removeItem(GUEST_WALLET_KEY);
        localStorage.removeItem(LAST_ACTIVE_ROOM_KEY);
        localStorage.removeItem(`${LAST_ACTIVE_ROOM_KEY}_${uid}`);
      } catch {
        // ignore storage errors
      }
      setActiveRoomId(null);
      setActiveRoom(null);
      setSubscribedActiveRooms([]);
      setPinnedRoomIds([]);
      pinnedRoomIdsRef.current = [];
      setPinnedRoomDocs({});
      blockingActiveRoomRef.current = null;
      forfeitingRoomIdsRef.current.clear();
      setActiveTab('lobby');
      showToast('Your account and cloud data have been permanently deleted.', 'info');
      return {
        ok: true,
        message: 'Your Ludo Crown account and cloud data have been permanently deleted.',
      };
    } catch (err) {
      const code = String((err as { code?: string } | null)?.code || '').toLowerCase();
      if (code === 'auth/requires-recent-login') {
        showToast(
          'For security, please sign out and sign back in with Google before deleting your account.',
          'error'
        );
        return {
          ok: false,
          requiresRecentLogin: true,
          message:
            'For security, Google requires a fresh sign-in before deleting an account. Please sign out, sign back in, and try again.',
        };
      }
      console.error('Account deletion error:', err);
      showToast('Could not complete account deletion right now. Please check your connection and retry.', 'error');
      return {
        ok: false,
        message: 'Could not complete account deletion right now. Please check your internet connection and retry.',
      };
    }
  }, [user, myActiveRooms, profile.displayName, resetGuestLocalData, showToast]);

  const saveCustomization = useCallback(
    async (
      updates: Pick<PlayerProfile, 'displayName' | 'avatarId' | 'avatarFrame' | 'boardTheme' | 'diceTheme'>
    ) => {
      const cleanName = updates.displayName.trim().slice(0, 32);
      const next = { ...profile, ...updates, displayName: cleanName.length >= 2 ? cleanName : profile.displayName };
      setProfile(next);
      if (user) {
        await updateProfileCustomization(user.uid, {
          displayName: next.displayName,
          avatarId: next.avatarId,
          avatarFrame: next.avatarFrame,
          boardTheme: next.boardTheme,
          diceTheme: next.diceTheme,
        });
      }
      showToast('Player profile and loadout saved.', 'success');
    },
    [profile, user, showToast]
  );

  const purchaseCosmetic = useCallback(
    async (itemId: string, price: number, currency: 'coins' | 'gems'): Promise<boolean> => {
      if (wallet.unlockedCosmetics.includes(itemId)) return true;
      if (currency === 'coins' && wallet.coins < price) {
        showToast('Not enough coins. Complete daily challenges or watch a bonus video.', 'error');
        return false;
      }
      if (currency === 'gems' && wallet.gems < price) {
        showToast('Not enough gems. Earn gems from daily streaks and challenges.', 'error');
        return false;
      }
      const nextWallet: UserWallet = {
        ...wallet,
        coins: currency === 'coins' ? wallet.coins - price : wallet.coins,
        gems: currency === 'gems' ? wallet.gems - price : wallet.gems,
        unlockedCosmetics: [...wallet.unlockedCosmetics, itemId],
      };
      setWallet(nextWallet);
      tabletopAudio.playCoinReward();
      if (user) {
        await updateWalletEconomy(user.uid, {
          coins: nextWallet.coins,
          gems: nextWallet.gems,
          unlockedCosmetics: nextWallet.unlockedCosmetics,
          freeTournamentTickets: nextWallet.freeTournamentTickets,
        });
      }
      trackAnalyticsEvent('cosmetic_unlock', { item_id: itemId, currency, price });
      showToast('Cosmetic unlocked and added to your atelier!', 'success');
      return true;
    },
    [wallet, user, showToast]
  );

  const claimDailyStreak = useCallback(async (): Promise<boolean> => {
    const today = getTodayDateString();
    if (wallet.lastDailyClaimDate === today) {
      showToast('Today’s daily reward is already claimed.', 'info');
      return false;
    }
    const nextStreak = (wallet.dailyStreak % 7) + 1;
    const reward = DAILY_STREAK_REWARDS[nextStreak - 1];

    let unlockedCosmetics = wallet.unlockedCosmetics;
    let bonusGems = 0;
    let extraNote = '';

    if (nextStreak === 7 && reward.cosmeticId) {
      if (!unlockedCosmetics.includes(reward.cosmeticId)) {
        unlockedCosmetics = [...unlockedCosmetics, reward.cosmeticId];
        extraNote = ` + Unlocked ${reward.cosmeticLabel || 'Golden Crown Dice'}!`;
      } else if (
        reward.fallbackCosmeticId &&
        !unlockedCosmetics.includes(reward.fallbackCosmeticId)
      ) {
        unlockedCosmetics = [...unlockedCosmetics, reward.fallbackCosmeticId];
        extraNote = ' + Unlocked Crystal Pearl Board!';
      } else {
        bonusGems = 25;
        extraNote = ' + 25 Bonus Gems!';
      }
    }

    const nextWallet: UserWallet = {
      ...wallet,
      coins: wallet.coins + reward.coins,
      gems: wallet.gems + reward.gems + bonusGems,
      dailyStreak: nextStreak,
      lastDailyClaimDate: today,
      unlockedCosmetics,
    };
    setWallet(nextWallet);
    tabletopAudio.playCoinReward();
    if (user) {
      await updateWalletRewardsAndChallenges(user.uid, {
        coins: nextWallet.coins,
        gems: nextWallet.gems,
        dailyStreak: nextWallet.dailyStreak,
        lastDailyClaimDate: nextWallet.lastDailyClaimDate,
        dailyChallengesDate: nextWallet.dailyChallengesDate,
        challengeProgress: nextWallet.challengeProgress,
        claimedChallenges: nextWallet.claimedChallenges,
        ...(unlockedCosmetics !== wallet.unlockedCosmetics ? { unlockedCosmetics } : {}),
      });
    }
    trackAnalyticsEvent('daily_streak_claim', {
      streak_day: nextStreak,
      coins: reward.coins,
      gems: reward.gems + bonusGems,
    });
    showToast(
      extraNote
        ? `Day 7 Grand Reward! +${reward.coins} Coins, +${reward.gems} Gems${extraNote}`
        : `Day ${nextStreak} reward claimed: ${reward.label}!`,
      'success'
    );
    return true;
  }, [wallet, user, showToast]);

  const claimDailyChallenge = useCallback(
    async (challengeId: string): Promise<boolean> => {
      const def = DAILY_CHALLENGES.find((c) => c.id === challengeId);
      if (!def) return false;
      if (wallet.claimedChallenges.includes(challengeId)) return false;
      if (wallet.challengeProgress[def.metric] < def.target) {
        showToast('Keep playing to finish this challenge first.', 'info');
        return false;
      }
      const nextWallet: UserWallet = {
        ...wallet,
        coins: wallet.coins + def.rewardCoins,
        gems: wallet.gems + def.rewardGems,
        claimedChallenges: [...wallet.claimedChallenges, challengeId],
      };
      setWallet(nextWallet);
      tabletopAudio.playCoinReward();
      if (user) {
        await updateWalletRewardsAndChallenges(user.uid, {
          coins: nextWallet.coins,
          gems: nextWallet.gems,
          dailyStreak: nextWallet.dailyStreak,
          lastDailyClaimDate: nextWallet.lastDailyClaimDate,
          dailyChallengesDate: nextWallet.dailyChallengesDate,
          challengeProgress: nextWallet.challengeProgress,
          claimedChallenges: nextWallet.claimedChallenges,
        });
      }
      showToast(`Claimed ${def.rewardCoins} Coins & ${def.rewardGems} Gems!`, 'success');
      return true;
    },
    [wallet, user, showToast]
  );

  const grantWheelReward = useCallback(
    async (coinsDelta: number, gemsDelta: number, ticketsDelta: number) => {
      const nextWallet: UserWallet = {
        ...wallet,
        coins: wallet.coins + coinsDelta,
        gems: wallet.gems + gemsDelta,
        freeTournamentTickets: Math.min(20, wallet.freeTournamentTickets + ticketsDelta),
      };
      setWallet(nextWallet);
      if (user) {
        await updateWalletEconomy(user.uid, {
          coins: nextWallet.coins,
          gems: nextWallet.gems,
          unlockedCosmetics: nextWallet.unlockedCosmetics,
          freeTournamentTickets: nextWallet.freeTournamentTickets,
        }).catch(() => {});
      }
    },
    [wallet, user]
  );

  const recordGameplayEvent = useCallback(
    (delta: { rollSixes?: number; captures?: number }) => {
      const today = getTodayDateString();
      setWallet((prev) => {
        const baseProgress =
          prev.dailyChallengesDate === today
            ? prev.challengeProgress
            : { rollSixes: 0, captures: 0, matchesPlayed: 0, matchesWon: 0 };
        const nextProgress = {
          ...baseProgress,
          rollSixes: baseProgress.rollSixes + (delta.rollSixes || 0),
          captures: baseProgress.captures + (delta.captures || 0),
        };
        const updated: UserWallet = {
          ...prev,
          dailyChallengesDate: today,
          challengeProgress: nextProgress,
        };
        if (user) {
          updateWalletRewardsAndChallenges(user.uid, {
            coins: updated.coins,
            gems: updated.gems,
            dailyStreak: updated.dailyStreak,
            lastDailyClaimDate: updated.lastDailyClaimDate,
            dailyChallengesDate: updated.dailyChallengesDate,
            challengeProgress: updated.challengeProgress,
            claimedChallenges: updated.claimedChallenges,
          }).catch(() => {});
        }
        return updated;
      });
    },
    [user]
  );

  const recordMatchCompletion = useCallback(
    async (summary: MatchSummary) => {
      if (summary.autoPlayForfeitedRewards) {
        setMatchesSinceLastInterstitial((c) => c + 1);
        trackAnalyticsEvent('match_complete', {
          won: summary.won,
          turns: summary.turnsPlayed,
          auto_play: true,
        });
        showToast('No rewards earned — match completed in Auto-Play mode.', 'info');
        return;
      }

      const today = getTodayDateString();
      const nextGames = profile.gamesPlayed + 1;
      const nextWins = profile.wins + (summary.won ? 1 : 0);
      const nextStreak = summary.won ? profile.winStreak + 1 : 0;
      const nextBestStreak = Math.max(profile.bestStreak, nextStreak);
      const nextXp = profile.xp + summary.xpEarned;
      const nextLevel = Math.max(1, Math.floor(nextXp / 250) + 1);
      const nextElo = Math.max(100, Math.min(5000, profile.elo + summary.eloDelta));
      const nextTrophies =
        profile.trophies + (summary.isTournament && summary.tournamentRound === 'final' && summary.won ? 1 : 0);

      const nextProfile: PlayerProfile = {
        ...profile,
        elo: nextElo,
        gamesPlayed: nextGames,
        wins: nextWins,
        captures: profile.captures + summary.capturesByPlayer,
        sixesRolled: profile.sixesRolled + summary.sixesByPlayer,
        winStreak: nextStreak,
        bestStreak: nextBestStreak,
        trophies: nextTrophies,
        level: nextLevel,
        xp: nextXp,
        league: computeLeagueFromElo(nextElo),
      };
      setProfile(nextProfile);

      const baseProgress =
        wallet.dailyChallengesDate === today
          ? wallet.challengeProgress
          : { rollSixes: 0, captures: 0, matchesPlayed: 0, matchesWon: 0 };

      const nextWallet: UserWallet = {
        ...wallet,
        coins: wallet.coins + summary.coinsEarned,
        dailyChallengesDate: today,
        challengeProgress: {
          ...baseProgress,
          matchesPlayed: baseProgress.matchesPlayed + 1,
          matchesWon: baseProgress.matchesWon + (summary.won ? 1 : 0),
        },
      };
      setWallet(nextWallet);
      setMatchesSinceLastInterstitial((c) => c + 1);
      trackAnalyticsEvent('match_complete', {
        won: summary.won,
        turns: summary.turnsPlayed,
        captures: summary.capturesByPlayer,
        sixes: summary.sixesByPlayer,
        coins_earned: summary.coinsEarned,
        is_tournament: Boolean(summary.isTournament),
        auto_play: false,
      });

      if (user) {
        await updateProfileStats(user.uid, nextProfile);
        await updateWalletRewardsAndChallenges(user.uid, {
          coins: nextWallet.coins,
          gems: nextWallet.gems,
          dailyStreak: nextWallet.dailyStreak,
          lastDailyClaimDate: nextWallet.lastDailyClaimDate,
          dailyChallengesDate: nextWallet.dailyChallengesDate,
          challengeProgress: nextWallet.challengeProgress,
          claimedChallenges: nextWallet.claimedChallenges,
        });
        if (summary.isTournament && summary.tournamentId && summary.tournamentRound === 'final' && summary.won) {
          await completeTournamentDoc(summary.tournamentId, {
            uid: user.uid,
            name: profile.displayName,
          }).catch(() => {});
        }
      }
    },
    [profile, wallet, user, showToast]
  );

  // =========================================================================
  // MULTIPLAYER & MATCHMAKING ACTIONS
  // =========================================================================

  // Enforce at most 1 active online match per player at any time
  const blockingActiveRoom = useMemo<RoomDoc | null>(() => {
    if (!user) return null;
    const candidates: RoomDoc[] = [];
    if (activeRoom) candidates.push(activeRoom);
    for (const r of myActiveRooms) {
      if (!candidates.some((c) => c.id === r.id)) {
        candidates.push(r);
      }
    }
    const now = Date.now();
    for (const room of candidates) {
      if (isRoomBlockingNewMatch(room, user.uid, now)) {
        return room;
      }
    }
    return null;
  }, [user, activeRoom, myActiveRooms]);
  blockingActiveRoomRef.current = blockingActiveRoom;

  const forfeitAllBlockingActiveRooms = useCallback(
    async (exceptRoomId?: string) => {
      if (!user) return;
      const candidateMap = new Map<string, RoomDoc>();
      const addCandidate = (r: RoomDoc | null | undefined) => {
        if (!r || (exceptRoomId && r.id === exceptRoomId)) return;
        candidateMap.set(r.id, r);
      };
      addCandidate(activeRoom);
      addCandidate(blockingActiveRoomRef.current);
      for (const r of rawActiveRooms) addCandidate(r);
      for (const r of Object.values(pinnedRoomDocs)) addCandidate(r);

      try {
        const liveRooms = await fetchAllBlockingActiveRooms(user.uid, pinnedRoomIdsRef.current);
        for (const r of liveRooms) addCandidate(r);
      } catch {
        // Proceed with locally known rooms if offline
      }

      const targets = Array.from(candidateMap.values()).filter((r) => r.status !== 'finished');
      if (targets.length === 0) return;

      const targetIds = new Set(targets.map((r) => r.id));
      for (const id of targetIds) {
        forfeitingRoomIdsRef.current.add(id);
        unpinActiveRoomId(user.uid, id);
      }
      setSubscribedActiveRooms((prev) => prev.filter((r) => !targetIds.has(r.id)));
      if (blockingActiveRoomRef.current && targetIds.has(blockingActiveRoomRef.current.id)) {
        blockingActiveRoomRef.current = null;
      }
      if ((activeRoomId && targetIds.has(activeRoomId)) || (activeRoom && targetIds.has(activeRoom.id))) {
        setActiveRoomId(null);
        setActiveRoom(null);
        setRoomMessages([]);
        if (activeTabRef.current === 'play') {
          setActiveTab('lobby');
        }
      }

      await Promise.allSettled(
        targets.map((r) => forfeitActiveRoomDoc(r, user.uid, profile.displayName))
      );
    },
    [user, activeRoom, activeRoomId, rawActiveRooms, pinnedRoomDocs, unpinActiveRoomId, profile.displayName]
  );

  const forfeitActiveRoom = useCallback(
    async (roomId?: string) => {
      if (!user) return;
      const target =
        (roomId
          ? activeRoom?.id === roomId
            ? activeRoom
            : rawActiveRooms.find((r) => r.id === roomId) || pinnedRoomDocs[roomId]
          : activeRoom || blockingActiveRoomRef.current) || null;
      if (!target) return;

      forfeitingRoomIdsRef.current.add(target.id);
      unpinActiveRoomId(user.uid, target.id);
      setSubscribedActiveRooms((prev) => prev.filter((r) => r.id !== target.id));
      if (blockingActiveRoomRef.current?.id === target.id) {
        blockingActiveRoomRef.current = null;
      }
      if (activeRoomId === target.id || activeRoom?.id === target.id) {
        setActiveRoomId(null);
        setActiveRoom(null);
        setRoomMessages([]);
        if (activeTabRef.current === 'play') {
          setActiveTab('lobby');
        }
      }

      try {
        await forfeitActiveRoomDoc(target, user.uid, profile.displayName);
      } catch {
        // Proceed with local cleanup even on transient network hiccup
      }

      showToast(
        target.status === 'waiting'
          ? `Closed waiting table ${target.roomCode}.`
          : `Exited match ${target.roomCode} (no rewards earned).`,
        'info'
      );
    },
    [user, activeRoom, activeRoomId, rawActiveRooms, pinnedRoomDocs, unpinActiveRoomId, profile.displayName, showToast]
  );

  const dismissActiveMatchConflict = useCallback(() => {
    setActiveMatchConflict(null);
  }, []);

  const confirmExitAndStartNewMatch = useCallback(async () => {
    const conflict = activeMatchConflict;
    if (!conflict || matchEntryLockRef.current) return;
    matchEntryLockRef.current = true;
    setActiveMatchConflict(null);
    try {
      // Exit EVERY active match before entering the new one (never leaves leftover rooms behind)
      await forfeitAllBlockingActiveRooms();
      bypassActiveMatchGuardRef.current = true;
      try {
        await conflict.onConfirmNewMatch();
      } finally {
        bypassActiveMatchGuardRef.current = false;
      }
    } finally {
      matchEntryLockRef.current = false;
    }
  }, [activeMatchConflict, forfeitAllBlockingActiveRooms]);

  const guardSingleActiveMatch = useCallback(
    async (
      actionLabel: string,
      onConfirmNewMatch: () => Promise<void> | void,
      allowedRoomCode?: string
    ): Promise<boolean> => {
      if (bypassActiveMatchGuardRef.current) return false;
      const cleanAllowed = allowedRoomCode?.trim().toUpperCase();

      // 1. Instant synchronous check against pinned + active rooms
      let existingRoom = blockingActiveRoomRef.current;

      // 2. Live server safety check (catches active rooms even across devices or before snapshots settle)
      if (!existingRoom && user) {
        try {
          const liveBlocking = await fetchBlockingActiveRoom(user.uid, pinnedRoomIdsRef.current);
          if (liveBlocking && !forfeitingRoomIdsRef.current.has(liveBlocking.id)) {
            existingRoom = liveBlocking;
            replacePinnedActiveRoomId(user.uid, liveBlocking.id);
            setPinnedRoomDocs({ [liveBlocking.id]: liveBlocking });
            blockingActiveRoomRef.current = liveBlocking;
          }
        } catch {
          // Proceed with local state if offline
        }
      }

      if (!existingRoom) return false;
      if (cleanAllowed && existingRoom.roomCode === cleanAllowed) {
        return false;
      }

      setActiveMatchConflict({
        actionLabel,
        room: existingRoom,
        onConfirmNewMatch,
      });
      return true;
    },
    [user, replacePinnedActiveRoomId]
  );

  const refreshOpenRooms = useCallback(async () => {
    if (!user) return;
    await cleanupOwnStaleWaitingRooms(user.uid, activeRoomId);
    const rooms = await listOpenPublicRooms();
    setOpenRooms(rooms);
  }, [user, activeRoomId]);

  const startQuickMatchmaking = useCallback(
    async (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => {
      if (!user) {
        showToast('Sign in with Google to join real-time multiplayer tables.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      const run = async () => {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        const code = await findOrCreateQuickMatch(effectiveProfile, opts);
        replacePinnedActiveRoomId(user.uid, code);
        setOfflineMatch(null);
        setActiveRoomId(code);
        setActiveTab('play');
        showToast(`Connected to table ${code}.`, 'success');
      };
      matchEntryLockRef.current = true;
      try {
        if (await guardSingleActiveMatch(`Start ${opts.maxPlayers}P Online Match`, run)) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, profile, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const createPrivateRoom = useCallback(
    async (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => {
      if (!user) {
        showToast('Sign in with Google to host a private table for friends.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      const run = async () => {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        const code = await createMultiplayerRoom(effectiveProfile, { ...opts, visibility: 'private' });
        replacePinnedActiveRoomId(user.uid, code);
        setOfflineMatch(null);
        setActiveRoomId(code);
        setActiveTab('play');
        showToast(`Private table ${code} created. Share the code with friends!`, 'success');
      };
      matchEntryLockRef.current = true;
      try {
        if (await guardSingleActiveMatch('Create Private Room', run)) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, profile, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const joinRoom = useCallback(
    async (code: string) => {
      if (!user) {
        showToast('Sign in with Google to join a friend’s table.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          const room = await joinRoomByCode(code, effectiveProfile);
          replacePinnedActiveRoomId(user.uid, room.id);
          setOfflineMatch(null);
          setActiveRoomId(room.id);
          setActiveTab('play');
          showToast(`Joined table ${room.roomCode}!`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Unable to join table.', 'error');
        }
      };
      matchEntryLockRef.current = true;
      try {
        if (await guardSingleActiveMatch(`Join Table ${code.trim().toUpperCase()}`, run, code)) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, profile, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const clearPendingDeepLinkRoom = useCallback(() => {
    setPendingDeepLinkRoomCode(null);
    try {
      sessionStorage.removeItem('ludo_crown_pending_join_code');
    } catch {
      // ignore
    }
  }, []);

  // Capture incoming WhatsApp / native deep links (/join/ROOMCODE or ludocrown://join/ROOMCODE)
  useEffect(() => {
    return listenForIncomingDeepLinks((code) => {
      setPendingDeepLinkRoomCode(code);
      try {
        sessionStorage.setItem('ludo_crown_pending_join_code', code);
      } catch {
        // ignore
      }
    });
  }, []);

  // Auto-join pending deep-link table once auth is ready (or prompt sign-in if guest)
  useEffect(() => {
    if (!authReady || !pendingDeepLinkRoomCode) return;
    if (!user) {
      showToast(`Sign in with Google to jump straight into table ${pendingDeepLinkRoomCode}!`, 'info');
      return;
    }
    if (profile.uid !== user.uid) return;
    const codeToJoin = pendingDeepLinkRoomCode;
    clearPendingDeepLinkRoom();
    joinRoom(codeToJoin).catch(() => {});
  }, [authReady, user, profile.uid, pendingDeepLinkRoomCode, clearPendingDeepLinkRoom, joinRoom, showToast]);

  const rejoinActiveRoom = useCallback(
    async (roomId: string) => {
      if (!user) {
        showToast('Sign in with Google to rejoin your live table.', 'info');
        return;
      }
      replacePinnedActiveRoomId(user.uid, roomId);
      forfeitAllBlockingActiveRooms(roomId).catch(() => {});
      setOfflineMatch(null);
      setActiveRoomId(roomId);
      setActiveTab('play');
      notifiedActiveRoomIdsRef.current.add(roomId);
      const target = rawActiveRooms.find((r) => r.id === roomId) || pinnedRoomDocs[roomId];
      const mySeatInTarget = target?.seats.find((s) => !s.isBot && s.uid === user.uid);
      const alreadyFinished = Boolean(target && mySeatInTarget && isSeatFinished(mySeatInTarget, target.tokens));
      if (!target || target.status === 'playing') {
        await updateRoomSeatPresence(
          roomId,
          user.uid,
          { autoPlay: false, away: false, lastSeenMs: Date.now() },
          alreadyFinished ? undefined : `${profile.displayName} rejoined the table!`
        ).catch(() => {});
      }
      showToast(
        alreadyFinished
          ? `Rejoined table ${roomId} — spectating the live finish!`
          : `Rejoined table ${roomId} — you're back in control!`,
        'success'
      );
    },
    [
      user,
      rawActiveRooms,
      pinnedRoomDocs,
      replacePinnedActiveRoomId,
      forfeitAllBlockingActiveRooms,
      profile.displayName,
      showToast,
    ]
  );

  const setMySeatAutoPlay = useCallback(
    async (enabled: boolean) => {
      if (!activeRoom || !user || activeRoom.status !== 'playing') return;
      await updateRoomSeatPresence(
        activeRoom.id,
        user.uid,
        { autoPlay: enabled, away: enabled, lastSeenMs: Date.now() },
        enabled
          ? `${profile.displayName} enabled Auto-Play.`
          : `${profile.displayName} took back manual control!`
      );
      showToast(
        enabled ? 'Auto-Play enabled for your turns.' : "You're back in manual control!",
        enabled ? 'info' : 'success'
      );
    },
    [activeRoom, user, profile.displayName, showToast]
  );

  const hostStartRoom = useCallback(
    async (fillBots: boolean) => {
      if (!activeRoom || !user) return;
      await startMultiplayerRoom(activeRoom, fillBots);
    },
    [activeRoom, user]
  );

  const submitMultiplayerTurn = useCallback(
    async (payload: {
      seats?: RoomSeat[];
      tokens: TokenPositions;
      turnIndex: number;
      diceValue: number;
      turnPhase: 'roll' | 'move';
      consecutiveSixes: number;
      status: 'playing' | 'finished';
      winnerColor: string;
      winnerUid: string;
      lastActionText: string;
      turnCount: number;
    }) => {
      if (!activeRoom) return;
      await updateMultiplayerTurn(activeRoom.id, payload);
    },
    [activeRoom]
  );

  const sendChat = useCallback(
    async (text: string, kind: 'chat' | 'emote') => {
      if (!activeRoom || !user) return;
      const mySeat = activeRoom.seats.find((s) => s.uid === user.uid);
      const color: PlayerColor = mySeat ? mySeat.color : 'red';
      await sendRoomMessage(
        activeRoom,
        { uid: user.uid, name: profile.displayName, color },
        text,
        kind
      );
    },
    [activeRoom, user, profile.displayName]
  );

  const exitActiveRoom = useCallback(async () => {
    const roomToExit = activeRoom;
    if (roomToExit && user) {
      if (roomToExit.status === 'waiting') {
        unpinActiveRoomId(user.uid, roomToExit.id);
        setSubscribedActiveRooms((prev) => prev.filter((r) => r.id !== roomToExit.id));
        if (blockingActiveRoomRef.current?.id === roomToExit.id) {
          blockingActiveRoomRef.current = null;
        }
        await leaveWaitingRoom(roomToExit, user.uid, profile.displayName).catch(() => {});
      } else if (roomToExit.status === 'playing') {
        notifiedActiveRoomIdsRef.current.add(roomToExit.id);
        const mySeatInExit = roomToExit.seats.find((s) => !s.isBot && s.uid === user.uid);
        const alreadyFinished = Boolean(mySeatInExit && isSeatFinished(mySeatInExit, roomToExit.tokens));
        if (!alreadyFinished) {
          // Immediately pin & seed optimistic Auto-Play state BEFORE clearing activeRoom
          // so Lobby banner, Global Resume strip, and Single-Match Guard stay 100% active with 0ms gap!
          const optimisticAutoPlayRoom: RoomDoc = {
            ...roomToExit,
            updatedAtMs: Date.now(),
            seats: roomToExit.seats.map((s) =>
              !s.isBot && s.uid === user.uid
                ? { ...s, away: true, autoPlay: true, lastSeenMs: Date.now() }
                : s
            ),
          };
          replacePinnedActiveRoomId(user.uid, roomToExit.id);
          setPinnedRoomDocs({ [roomToExit.id]: optimisticAutoPlayRoom });
          blockingActiveRoomRef.current = optimisticAutoPlayRoom;

          await updateRoomSeatPresence(
            roomToExit.id,
            user.uid,
            { away: true, autoPlay: true, lastSeenMs: Date.now() },
            `${profile.displayName} stepped out — Auto-Play active.`
          ).catch(() => {});

          showToast(
            `Auto-Play is running in table ${roomToExit.roomCode}. Tap Rejoin anytime (no rewards if completed on Auto-Play).`,
            'info'
          );
          if (notifPrefsRef.current.enabled) {
            showDeviceNotificationAlert(
              `Match Running on Auto-Play · Table ${roomToExit.roomCode}`,
              'Auto-Play is covering your turns in Ludo Crown. Return anytime to take back control.',
              `autoplay-running-${roomToExit.id}`
            );
          }
        }
      } else if (roomToExit.status === 'finished') {
        unpinActiveRoomId(user.uid, roomToExit.id);
      }
    }
    setActiveRoomId(null);
    setActiveRoom(null);
    setRoomMessages([]);
    setActiveTab('lobby');
  }, [activeRoom, user, replacePinnedActiveRoomId, unpinActiveRoomId, profile.displayName, showToast]);

  const rematchOnlineRoom = useCallback(
    async (finishedRoom: RoomDoc) => {
      if (!user) {
        showToast('Sign in with Google to start an online rematch.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          if (finishedRoom.visibility === 'public') {
            const code = await findOrCreateQuickMatch(effectiveProfile, {
              mode: finishedRoom.mode,
              maxPlayers: finishedRoom.maxPlayers,
              entryStake: finishedRoom.entryStake,
            });
            replacePinnedActiveRoomId(user.uid, code);
            setOfflineMatch(null);
            setActiveRoomId(code);
            setActiveTab('play');
            showToast(`Rematch table ${code} ready!`, 'success');
            return;
          }

          const code = await createMultiplayerRoom(effectiveProfile, {
            visibility: 'private',
            mode: finishedRoom.mode,
            maxPlayers: finishedRoom.maxPlayers,
            entryStake: finishedRoom.entryStake,
          });
          replacePinnedActiveRoomId(user.uid, code);
          const freshRoom: RoomDoc = {
            id: code,
            roomCode: code,
            hostUid: effectiveProfile.uid,
            visibility: 'private',
            mode: finishedRoom.mode,
            maxPlayers: finishedRoom.maxPlayers,
            entryStake: finishedRoom.entryStake,
            status: 'waiting',
            openPublic: false,
            playerUids: [effectiveProfile.uid],
            seats: [
              {
                uid: effectiveProfile.uid,
                name: effectiveProfile.displayName,
                avatarId: effectiveProfile.avatarId,
                avatarFrame: effectiveProfile.avatarFrame,
                color: 'red',
                isBot: false,
                elo: effectiveProfile.elo,
              },
            ],
            tokens: {
              red: [-1, -1, -1, -1],
              green: [-1, -1, -1, -1],
              yellow: [-1, -1, -1, -1],
              blue: [-1, -1, -1, -1],
            },
            turnIndex: 0,
            diceValue: 0,
            turnPhase: 'roll',
            consecutiveSixes: 0,
            winnerColor: '',
            winnerUid: '',
            lastActionText: '',
            turnCount: 0,
          };

          setOfflineMatch(null);
          setActiveRoomId(code);
          setActiveTab('play');

          const otherHumans = finishedRoom.seats.filter(
            (s) => !s.isBot && s.uid !== effectiveProfile.uid
          );
          if (otherHumans.length > 0) {
            await Promise.allSettled(
              otherHumans.map((seat) => sendRoomInviteDoc(freshRoom, effectiveProfile, seat.uid))
            );
            showToast(
              `Rematch table ${code} open! Invited ${otherHumans.length} friend${otherHumans.length > 1 ? 's' : ''}.`,
              'success'
            );
          } else {
            showToast(`Fresh rematch table ${code} created!`, 'success');
          }
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Unable to create rematch table.', 'error');
        }
      };

      matchEntryLockRef.current = true;
      try {
        if (await guardSingleActiveMatch('Start Rematch', run)) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, profile, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const launchOfflinePractice = useCallback(
    (config: OfflineMatchConfig) => {
      const run = () => {
        setActiveRoomId(null);
        setActiveRoom(null);
        setOfflineMatch(config);
        setActiveTab('play');
      };
      const label = config.passAndPlay
        ? 'Start Pass & Play'
        : config.tournamentContext
          ? 'Start Cup Match'
          : 'Start VS Computer';

      if (bypassActiveMatchGuardRef.current) {
        run();
        return;
      }

      // Immediate synchronous guard if a blocking online match is already known
      if (blockingActiveRoomRef.current) {
        setActiveMatchConflict({
          actionLabel: label,
          room: blockingActiveRoomRef.current,
          onConfirmNewMatch: run,
        });
        return;
      }

      // Also verify live if signed in so an active match on Auto-Play can never be bypassed
      if (user) {
        guardSingleActiveMatch(label, run)
          .then((blocked) => {
            if (!blocked) run();
          })
          .catch(() => {
            run();
          });
        return;
      }

      run();
    },
    [user, guardSingleActiveMatch]
  );

  const closeOfflineMatch = useCallback(() => {
    setOfflineMatch(null);
    setActiveTab('lobby');
  }, []);

  // =========================================================================
  // LEADERBOARD & TOURNAMENTS
  // =========================================================================

  const refreshLeaderboard = useCallback(async () => {
    if (!user) return;
    const rows = await fetchPublicLeaderboard();
    setLeaderboard(rows);
  }, [user]);

  const refreshTournaments = useCallback(async () => {
    if (!user) return;
    const rows = await fetchPublicTournaments();
    setTournaments(rows);
  }, [user]);

  const hostNewTournament = useCallback(
    async (title: string, tier: LeagueTier, maxEntrants: 4 | 8) => {
      if (!user) {
        showToast('Sign in with Google to organize competitive tournaments.', 'info');
        return;
      }
      const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
      const created = await createTournament(effectiveProfile, title, tier, maxEntrants);
      setTournaments((prev) => [created, ...prev]);
      showToast(`Tournament "${created.title}" is now open for registration.`, 'success');
    },
    [user, profile, showToast]
  );

  const registerForTournament = useCallback(
    async (tournament: TournamentDoc, useFreeTicket: boolean): Promise<boolean> => {
      if (!user) {
        showToast('Sign in with Google to register for competitive leagues.', 'info');
        return false;
      }
      if (tournament.entrantUids.includes(user.uid)) return true;

      if (useFreeTicket) {
        if (wallet.freeTournamentTickets < 1) {
          showToast('No free tournament tickets available. Watch a rewarded video to earn one!', 'info');
          return false;
        }
      } else if (wallet.coins < tournament.entryFee) {
        showToast('Not enough coins for entry fee. Use a free Ad Ticket instead!', 'error');
        return false;
      }

      const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
      const updated = await joinTournamentDoc(tournament, effectiveProfile);
      const nextWallet: UserWallet = {
        ...wallet,
        coins: useFreeTicket ? wallet.coins : wallet.coins - tournament.entryFee,
        freeTournamentTickets: useFreeTicket
          ? wallet.freeTournamentTickets - 1
          : wallet.freeTournamentTickets,
      };
      setWallet(nextWallet);
      await updateWalletEconomy(user.uid, {
        coins: nextWallet.coins,
        gems: nextWallet.gems,
        unlockedCosmetics: nextWallet.unlockedCosmetics,
        freeTournamentTickets: nextWallet.freeTournamentTickets,
      });
      setTournaments((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showToast(`Registered for ${tournament.title}!`, 'success');
      return true;
    },
    [user, wallet, profile, showToast]
  );

  // =========================================================================
  // REAL-TIME FRIENDS & ROOM INVITATIONS
  // =========================================================================

  const sendFriendRequest = useCallback(
    async (target: Pick<PlayerProfile, 'uid' | 'displayName' | 'avatarId'>) => {
      if (!user) {
        showToast('Sign in with Google to add friends and send invites.', 'info');
        return;
      }
      try {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        const outcome = await sendFriendRequestDoc(effectiveProfile, target);
        if (outcome === 'accepted') {
          tabletopAudio.playSafeStar();
          showToast(`${target.displayName} joined your squad!`, 'success');
        } else {
          showToast(`Friend request sent to ${target.displayName}!`, 'success');
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to send friend request.', 'error');
      }
    },
    [user, profile, showToast]
  );

  const acceptFriend = useCallback(
    async (friendshipId: string, friendName: string) => {
      if (!user) return;
      await acceptFriendRequestDoc(friendshipId);
      tabletopAudio.playSafeStar();
      showToast(`${friendName} joined your squad!`, 'success');
    },
    [user, showToast]
  );

  const removeFriend = useCallback(
    async (friendshipId: string) => {
      if (!user) return;
      await removeFriendshipDoc(friendshipId);
      showToast('Updated your friends list.', 'info');
    },
    [user, showToast]
  );

  const inviteFriendToPlay = useCallback(
    async (friendUid: string, friendName: string) => {
      if (!user) {
        showToast('Sign in with Google to invite friends to a table.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          let targetRoom = activeRoom && activeRoom.status === 'waiting' ? activeRoom : null;
          if (!targetRoom) {
            const code = await createMultiplayerRoom(effectiveProfile, {
              visibility: 'private',
              mode: 'quick',
              maxPlayers: 4,
              entryStake: 100,
            });
            replacePinnedActiveRoomId(user.uid, code);
            setOfflineMatch(null);
            setActiveRoomId(code);
            setActiveTab('play');
            targetRoom = {
              id: code,
              roomCode: code,
              hostUid: effectiveProfile.uid,
              visibility: 'private',
              mode: 'quick',
              maxPlayers: 4,
              entryStake: 100,
              status: 'waiting',
              openPublic: false,
              playerUids: [effectiveProfile.uid],
              seats: [
                {
                  uid: effectiveProfile.uid,
                  name: effectiveProfile.displayName,
                  avatarId: effectiveProfile.avatarId,
                  avatarFrame: effectiveProfile.avatarFrame,
                  color: 'red',
                  isBot: false,
                  elo: effectiveProfile.elo,
                },
              ],
              tokens: { red: [-1, -1, -1, -1], green: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], blue: [-1, -1, -1, -1] },
              turnIndex: 0,
              diceValue: 0,
              turnPhase: 'roll',
              consecutiveSixes: 0,
              winnerColor: '',
              winnerUid: '',
              lastActionText: '',
              turnCount: 0,
            };
          }
          await sendRoomInviteDoc(targetRoom, effectiveProfile, friendUid);
          tabletopAudio.playTokenMove();
          const targetProfile = leaderboard.find((p) => p.uid === friendUid);
          const friendPresence = resolvePlayerPresence(targetProfile, Date.now());
          if (!friendPresence.isOnline) {
            showToast(
              `Invite sent to ${friendName} (currently offline) — auto-expires in 2 min.`,
              'info'
            );
          } else if (friendPresence.status === 'in_match') {
            showToast(
              `Invite sent to ${friendName} (in a match) — expires in 2 min.`,
              'info'
            );
          } else {
            showToast(`Table invite (${targetRoom.roomCode}) sent to ${friendName}!`, 'success');
          }
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not send table invite.', 'error');
        }
      };

      matchEntryLockRef.current = true;
      try {
        const hasOpenWaitingRoom = Boolean(activeRoom && activeRoom.status === 'waiting');
        if (!hasOpenWaitingRoom && (await guardSingleActiveMatch(`Invite ${friendName} to New Table`, run))) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, activeRoom, profile, leaderboard, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const acceptRoomInvite = useCallback(
    async (invite: RoomInviteDoc) => {
      if (!user) {
        showToast('Sign in with Google to accept table invites.', 'info');
        return;
      }
      if (matchEntryLockRef.current) return;
      if (getInviteRemainingMs(invite, Date.now()) <= 0) {
        await deleteRoomInviteDoc(invite.id).catch(() => {});
        showToast('This table invite has expired.', 'info');
        return;
      }
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          const room = await joinRoomByCode(invite.roomCode, effectiveProfile);
          replacePinnedActiveRoomId(user.uid, room.id);
          await respondToRoomInviteDoc(invite.id, 'accepted').catch(() => {});
          setOfflineMatch(null);
          setActiveRoomId(room.id);
          setActiveTab('play');
          tabletopAudio.playSafeStar();
          showToast(`Joined ${invite.fromName}'s table (${room.roomCode})!`, 'success');
        } catch (err) {
          // Room already started, closed, or full — clear stale invite cleanly
          await deleteRoomInviteDoc(invite.id).catch(() => {});
          showToast(
            err instanceof Error
              ? err.message
              : 'This table invite has expired or the match already started.',
            'error'
          );
        }
      };
      matchEntryLockRef.current = true;
      try {
        if (await guardSingleActiveMatch(`Join ${invite.fromName}'s Table`, run, invite.roomCode)) {
          return;
        }
        await run();
      } finally {
        matchEntryLockRef.current = false;
      }
    },
    [user, profile, replacePinnedActiveRoomId, showToast, guardSingleActiveMatch]
  );

  const declineRoomInvite = useCallback(
    async (inviteId: string) => {
      if (!user) return;
      await deleteRoomInviteDoc(inviteId).catch(() => {});
    },
    [user]
  );

  // =========================================================================
  // PUSH NOTIFICATIONS (FCM + WEB OPT-IN)
  // =========================================================================

  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    const nextPrefs: NotificationPreferences = {
      ...notificationPrefs,
      enabled: true,
    };
    const res = await registerForPushNotifications({
      onToken: (token, platform) => {
        if (user) {
          savePushSubscriptionDoc(user.uid, {
            token,
            platform,
            enabled: true,
            roomInvites: notifPrefsRef.current.roomInvites,
            friendRequests: notifPrefsRef.current.friendRequests,
            dailyRewards: notifPrefsRef.current.dailyRewards,
          }).catch(() => {});
        }
      },
      onForegroundMessage: (title, body) => {
        tabletopAudio.playSafeStar();
        showToast(`${title}: ${body}`, 'info');
      },
      onNotificationTap: (targetTab) => {
        setActiveTab(targetTab);
      },
    });

    if (res.granted) {
      setNotificationPermission('granted');
      setNotificationPrefs(nextPrefs);
      saveNotificationPrefsLocal(nextPrefs);
      if (user) {
        savePushSubscriptionDoc(user.uid, {
          token: res.token || getStoredFcmToken() || 'web_browser_opt_in',
          platform: isCapacitorNativeApp() ? 'android' : 'web',
          ...nextPrefs,
        }).catch(() => {});
      }
      showToast('Push notifications enabled for invites, friends & daily gifts!', 'success');
      return true;
    }

    const refreshedPerm = await getNotificationPermissionState();
    setNotificationPermission(refreshedPerm);
    showToast(res.reason || 'Notifications were not enabled.', 'info');
    return false;
  }, [notificationPrefs, user, showToast]);

  const updateNotificationPref = useCallback(
    async (key: keyof Omit<NotificationPreferences, 'enabled'>, value: boolean) => {
      const next: NotificationPreferences = {
        ...notificationPrefs,
        [key]: value,
      };
      setNotificationPrefs(next);
      saveNotificationPrefsLocal(next);
      if (user && next.enabled) {
        await savePushSubscriptionDoc(user.uid, {
          token: getStoredFcmToken() || 'web_browser_opt_in',
          platform: isCapacitorNativeApp() ? 'android' : 'web',
          ...next,
        }).catch(() => {});
      }
    },
    [notificationPrefs, user]
  );

  // =========================================================================
  // ANDROID ADMOB & REWARDED VIDEO PLACEMENTS
  // =========================================================================

  const creditAdQuotaAndGrant = useCallback(
    async (
      coinsDelta: number,
      gemsDelta: number,
      ticketsDelta: number,
      onComplete: () => void
    ) => {
      const today = getTodayDateString();
      const countToday = wallet.adDate === today ? wallet.adRewardedCountToday + 1 : 1;
      const nextWallet: UserWallet = {
        ...wallet,
        coins: wallet.coins + coinsDelta,
        gems: wallet.gems + gemsDelta,
        freeTournamentTickets: Math.min(20, wallet.freeTournamentTickets + ticketsDelta),
        adRewardedCountToday: Math.min(50, countToday),
        adDate: today,
      };
      setWallet(nextWallet);
      tabletopAudio.playCoinReward();
      if (user) {
        await updateWalletAdReward(user.uid, {
          coins: nextWallet.coins,
          gems: nextWallet.gems,
          adRewardedCountToday: nextWallet.adRewardedCountToday,
          adDate: nextWallet.adDate,
          freeTournamentTickets: nextWallet.freeTournamentTickets,
        }).catch(() => {});
      }
      onComplete();
    },
    [wallet, user]
  );

  const triggerRewardedAd = useCallback(
    (placementId: RewardedPlacementId, onRewardEarned: () => void) => {
      const today = getTodayDateString();
      const countToday = wallet.adDate === today ? wallet.adRewardedCountToday : 0;
      if (countToday >= ADMOB_CONFIG.dailyRewardedCap) {
        showToast('Daily rewarded video limit reached. Check back tomorrow!', 'info');
        return;
      }

      const spec = REWARDED_PLACEMENTS[placementId];
      const bonusCoins =
        placementId === 'low_coin_rescue'
          ? 300
          : placementId === 'daily_bonus_coins'
            ? 250
            : 0;
      const bonusGems = placementId === 'bonus_gems' ? 5 : 0;
      const bonusTickets = placementId === 'free_tournament_ticket' ? 1 : 0;

      // If running inside Capacitor or Android WebView wrapper with native AdMob SDK
      if (hasNativeAndroidAdBridge()) {
        if (rewardedLoadingRef.current) return;
        rewardedLoadingRef.current = true;
        showToast('Loading rewarded video...', 'info');
        showNativeRewardedAd(placementId)
          .then((res) => {
            if (res?.earned) {
              trackAnalyticsEvent('ad_reward_earned', {
                placement_id: placementId,
                coins: bonusCoins,
                gems: bonusGems,
                tickets: bonusTickets,
              });
              creditAdQuotaAndGrant(bonusCoins, bonusGems, bonusTickets, onRewardEarned);
            } else if (res?.error) {
              showToast('No video ad ready right now. Please try again shortly.', 'info');
            }
          })
          .finally(() => {
            rewardedLoadingRef.current = false;
          });
        return;
      }

      // Smooth cross-platform web preview placement modal
      setAdModal({
        kind: 'rewarded',
        placementId,
        title: spec.title,
        rewardLabel: spec.rewardLabel,
        unitId: ADMOB_CONFIG.rewardedUnitId,
        durationSeconds: spec.durationSeconds,
        onComplete: () => {
          setAdModal(null);
          trackAnalyticsEvent('ad_reward_earned', {
            placement_id: placementId,
            coins: bonusCoins,
            gems: bonusGems,
            tickets: bonusTickets,
          });
          creditAdQuotaAndGrant(bonusCoins, bonusGems, bonusTickets, onRewardEarned);
        },
        onDismiss: () => setAdModal(null),
      });
    },
    [wallet.adDate, wallet.adRewardedCountToday, showToast, creditAdQuotaAndGrant]
  );

  const doubleSummaryCoinsWithAd = useCallback(
    (summary: MatchSummary, onDoubled: () => void) => {
      triggerRewardedAd('double_match_reward', () => {
        const extraCoins = summary.coinsEarned;
        setWallet((prev) => {
          const next = { ...prev, coins: prev.coins + extraCoins };
          if (user) {
            updateWalletEconomy(user.uid, {
              coins: next.coins,
              gems: next.gems,
              unlockedCosmetics: next.unlockedCosmetics,
              freeTournamentTickets: next.freeTournamentTickets,
            }).catch(() => {});
          }
          return next;
        });
        showToast(`2x Reward applied! +${extraCoins} extra coins credited.`, 'success');
        onDoubled();
      });
    },
    [triggerRewardedAd, user, showToast]
  );

  const maybeShowInterstitialAfterMatch = useCallback(() => {
    // Player-first monetization: keep ads strictly opt-in rewarded early on unless
    // a dedicated production interstitial unit ID is explicitly configured.
    if (isTestAdUnitId(ADMOB_CONFIG.interstitialUnitId)) {
      return;
    }
    const now = Date.now();
    if (matchesSinceLastInterstitial < ADMOB_CONFIG.interstitialEveryNMatches) {
      return;
    }
    if (now - lastInterstitialAtRef.current < ADMOB_CONFIG.minInterstitialCooldownMs) {
      return;
    }
    lastInterstitialAtRef.current = now;
    setMatchesSinceLastInterstitial(0);
    if (hasNativeAndroidAdBridge()) {
      showNativeInterstitialAd().catch(() => {});
      return;
    }
  }, [matchesSinceLastInterstitial]);

  const value = useMemo<AppContextValue>(
    () => ({
      user,
      authReady,
      signingIn,
      isSignedIn: Boolean(user),
      presenceNowMs,
      profile,
      wallet,
      activeTab,
      setActiveTab,
      soundMuted,
      toggleSoundMuted,
      backdropThemeId,
      setBackdropThemeId,
      cycleBackdropTheme,
      signInWithGoogle,
      signOutUser,
      deleteAccountAndData,
      resetGuestLocalData,
      saveCustomization,
      purchaseCosmetic,
      claimDailyStreak,
      claimDailyChallenge,
      grantWheelReward,
      recordGameplayEvent,
      recordMatchCompletion,
      networkOnline,
      reconnecting,
      activeRoomId,
      activeRoom,
      myActiveRooms,
      blockingActiveRoom,
      activeMatchConflict,
      dismissActiveMatchConflict,
      confirmExitAndStartNewMatch,
      roomMessages,
      openRooms,
      refreshOpenRooms,
      startQuickMatchmaking,
      createPrivateRoom,
      joinRoom,
      rejoinActiveRoom,
      setMySeatAutoPlay,
      hostStartRoom,
      submitMultiplayerTurn,
      sendChat,
      exitActiveRoom,
      forfeitActiveRoom,
      rematchOnlineRoom,
      pendingDeepLinkRoomCode,
      clearPendingDeepLinkRoom,
      offlineMatch,
      launchOfflinePractice,
      closeOfflineMatch,
      leaderboard,
      refreshLeaderboard,
      tournaments,
      refreshTournaments,
      hostNewTournament,
      registerForTournament,
      friendships,
      incomingInvites,
      sendFriendRequest,
      acceptFriend,
      removeFriend,
      inviteFriendToPlay,
      acceptRoomInvite,
      declineRoomInvite,
      notificationPrefs,
      notificationPermission,
      enablePushNotifications,
      updateNotificationPref,
      adModal,
      triggerRewardedAd,
      maybeShowInterstitialAfterMatch,
      doubleSummaryCoinsWithAd,
      matchesSinceLastInterstitial,
      toast,
      showToast,
    }),
    [
      user,
      authReady,
      signingIn,
      presenceNowMs,
      profile,
      wallet,
      activeTab,
      soundMuted,
      toggleSoundMuted,
      backdropThemeId,
      setBackdropThemeId,
      cycleBackdropTheme,
      signInWithGoogle,
      signOutUser,
      deleteAccountAndData,
      resetGuestLocalData,
      saveCustomization,
      purchaseCosmetic,
      claimDailyStreak,
      claimDailyChallenge,
      grantWheelReward,
      recordGameplayEvent,
      recordMatchCompletion,
      networkOnline,
      reconnecting,
      activeRoomId,
      activeRoom,
      myActiveRooms,
      blockingActiveRoom,
      activeMatchConflict,
      dismissActiveMatchConflict,
      confirmExitAndStartNewMatch,
      roomMessages,
      openRooms,
      refreshOpenRooms,
      startQuickMatchmaking,
      createPrivateRoom,
      joinRoom,
      rejoinActiveRoom,
      setMySeatAutoPlay,
      hostStartRoom,
      submitMultiplayerTurn,
      sendChat,
      exitActiveRoom,
      forfeitActiveRoom,
      rematchOnlineRoom,
      pendingDeepLinkRoomCode,
      clearPendingDeepLinkRoom,
      offlineMatch,
      launchOfflinePractice,
      closeOfflineMatch,
      leaderboard,
      refreshLeaderboard,
      tournaments,
      refreshTournaments,
      hostNewTournament,
      registerForTournament,
      friendships,
      incomingInvites,
      sendFriendRequest,
      acceptFriend,
      removeFriend,
      inviteFriendToPlay,
      acceptRoomInvite,
      declineRoomInvite,
      notificationPrefs,
      notificationPermission,
      enablePushNotifications,
      updateNotificationPref,
      adModal,
      triggerRewardedAd,
      maybeShowInterstitialAfterMatch,
      doubleSummaryCoinsWithAd,
      matchesSinceLastInterstitial,
      toast,
      showToast,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
