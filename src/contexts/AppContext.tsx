import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  isCapacitorNativeApp,
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
  ensureUserDocs,
  fetchPublicLeaderboard,
  fetchPublicTournaments,
  findOrCreateQuickMatch,
  forfeitActiveRoomDoc,
  joinRoomByCode,
  joinTournamentDoc,
  leaveWaitingRoom,
  listOpenPublicRooms,
  removeFriendshipDoc,
  respondToRoomInviteDoc,
  savePushSubscriptionDoc,
  sendFriendRequestDoc,
  sendRoomInviteDoc,
  sendRoomMessage,
  startMultiplayerRoom,
  subscribeFriendships,
  subscribeIncomingRoomInvites,
  subscribeProfile,
  subscribeRoom,
  subscribeRoomMessages,
  subscribeUserActiveRooms,
  subscribeWallet,
  touchWaitingRoomHeartbeat,
  updateMultiplayerTurn,
  updateProfileCustomization,
  updateProfileStats,
  updateRoomSeatPresence,
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
  isSignedIn: boolean;
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
  const [myActiveRooms, setMyActiveRooms] = useState<RoomDoc[]>([]);
  const [activeMatchConflict, setActiveMatchConflict] = useState<ActiveMatchConflict | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessageDoc[]>([]);
  const [openRooms, setOpenRooms] = useState<RoomDoc[]>([]);
  const [offlineMatch, setOfflineMatch] = useState<OfflineMatchConfig | null>(null);
  const bypassActiveMatchGuardRef = React.useRef<boolean>(false);
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
  const [incomingInvites, setIncomingInvites] = useState<RoomInviteDoc[]>([]);
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

  // Startup Firestore connectivity test + Auth state listener
  useEffect(() => {
    testConnection();
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const { profile: p, wallet: w } = await ensureUserDocs(
            firebaseUser.uid,
            firebaseUser.displayName || 'Club Player'
          );
          setProfile(p);
          setWallet(w);
        } catch (err) {
          console.error(err);
          showToast('Signed in, syncing profile...', 'info');
        }
      } else {
        setProfile(loadGuestProfile());
        setWallet(loadGuestWallet());
        setActiveRoomId(null);
        setActiveRoom(null);
        setMyActiveRooms([]);
        setRoomMessages([]);
        notifiedActiveRoomIdsRef.current.clear();
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, [showToast]);

  // Real-time Profile & Wallet subscriptions when signed in
  useEffect(() => {
    if (!user) return;
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
      setIncomingInvites(invites);
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
      setMyActiveRooms(rooms);
      // Notify player on Home/menus when a live running room is detected (e.g. after reload or reconnect)
      if (activeTabRef.current !== 'play') {
        const runningMatch = rooms.find((r) => {
          if (r.status !== 'playing') return false;
          const mySeat = r.seats.find((s) => !s.isBot && s.uid === user.uid);
          return Boolean(mySeat && !isSeatFinished(mySeat, r.tokens));
        });
        if (runningMatch && !notifiedActiveRoomIdsRef.current.has(runningMatch.id)) {
          notifiedActiveRoomIdsRef.current.add(runningMatch.id);
          showToast(
            `Live match running in table ${runningMatch.roomCode}! Tap Rejoin on Home.`,
            'info'
          );
        }
      }
    });

    // Pre-fetch public players for Friends & Ranks
    fetchPublicLeaderboard()
      .then((rows) => setLeaderboard(rows))
      .catch(() => {});

    return () => {
      unsubProfile();
      unsubWallet();
      unsubFriends();
      unsubInvites();
      unsubMyActiveRooms();
    };
  }, [user, showToast]);

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

  // Persist last active room ID locally for fast mobile recovery
  useEffect(() => {
    try {
      if (activeRoomId && activeRoom?.status !== 'finished') {
        localStorage.setItem(LAST_ACTIVE_ROOM_KEY, activeRoomId);
      } else if (!activeRoomId || activeRoom?.status === 'finished') {
        localStorage.removeItem(LAST_ACTIVE_ROOM_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [activeRoomId, activeRoom?.status]);

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
      }
    });
    return () => unsub();
  }, [user, activeRoomId]);

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
      const isViewingThisRoom = activeTab === 'play' && activeRoomId === room.id;
      if (isViewingThisRoom) return false;
      const mySeat = room.seats.find((s) => !s.isBot && s.uid === user.uid);
      return Boolean(mySeat);
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

  // Warm up native AdMob SDK, pre-warm rewarded & interstitial ads, & inspect notification permission once on mount
  useEffect(() => {
    initNativeAdMob();
    preloadNativeRewardedAd();
    preloadNativeInterstitialAd();
    getNotificationPermissionState()
      .then((perm) => setNotificationPermission(perm))
      .catch(() => {});
  }, []);

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
    try {
      await signInWithGoogleAuto();
      showToast('Signed in with Google. Online play & cloud sync enabled.', 'success');
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err ?? '');
      const lower = rawMsg.toLowerCase();
      if (
        lower.includes('popup-closed-by-user') ||
        lower.includes('cancel') ||
        lower.includes('12501') ||
        lower.includes('dismissed')
      ) {
        return;
      }

      if (isCapacitorNativeApp()) {
        if (
          lower.includes('default_web_client_id') ||
          lower.includes('developer_error') ||
          lower.includes('statuscode=10') ||
          lower.includes('apiexception: 10') ||
          rawMsg === 'NATIVE_AUTH_NO_ID_TOKEN'
        ) {
          showToast(
            `Google Sign-In config error (${rawMsg || 'code 10'}). Check SHA-1 in Firebase Console & re-download google-services.json.`,
            'error'
          );
          return;
        }
        showToast(
          `Google Sign-In error: ${rawMsg || 'Please check internet connection and try again.'}`,
          'error'
        );
        return;
      }

      showToast('Unable to complete Google Sign-In. Please allow popups and try again.', 'error');
    }
  }, [showToast]);

  const signOutUser = useCallback(async () => {
    try {
      await signOutGoogleAuto();
      setActiveRoomId(null);
      setActiveRoom(null);
      showToast('Signed out. You can still play Offline Practice anytime.', 'info');
    } catch {
      showToast('Could not sign out right now.', 'error');
    }
  }, [showToast]);

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
    for (const room of candidates) {
      if (room.status === 'finished') continue;
      const mySeat = room.seats.find((s) => !s.isBot && s.uid === user.uid);
      if (mySeat?.forfeited) continue;
      if (room.status === 'waiting') return room;
      if (room.status === 'playing' && mySeat && !isSeatFinished(mySeat, room.tokens)) {
        return room;
      }
    }
    return null;
  }, [user, activeRoom, myActiveRooms]);

  const forfeitActiveRoom = useCallback(
    async (roomId?: string) => {
      if (!user) return;
      const target =
        (roomId
          ? activeRoom?.id === roomId
            ? activeRoom
            : myActiveRooms.find((r) => r.id === roomId)
          : activeRoom || blockingActiveRoom) || null;
      if (!target) return;

      try {
        await forfeitActiveRoomDoc(target, user.uid, profile.displayName);
      } catch {
        // Proceed with local cleanup even on transient network hiccup
      }

      setMyActiveRooms((prev) => prev.filter((r) => r.id !== target.id));
      if (activeRoomId === target.id || activeRoom?.id === target.id) {
        setActiveRoomId(null);
        setActiveRoom(null);
        setRoomMessages([]);
        if (activeTabRef.current === 'play') {
          setActiveTab('lobby');
        }
      }
      showToast(
        target.status === 'waiting'
          ? `Closed waiting table ${target.roomCode}.`
          : `Exited match ${target.roomCode} (no rewards earned).`,
        'info'
      );
    },
    [user, activeRoom, activeRoomId, myActiveRooms, blockingActiveRoom, profile.displayName, showToast]
  );

  const dismissActiveMatchConflict = useCallback(() => {
    setActiveMatchConflict(null);
  }, []);

  const confirmExitAndStartNewMatch = useCallback(async () => {
    const conflict = activeMatchConflict;
    if (!conflict) return;
    setActiveMatchConflict(null);
    await forfeitActiveRoom(conflict.room.id);
    bypassActiveMatchGuardRef.current = true;
    try {
      await conflict.onConfirmNewMatch();
    } finally {
      bypassActiveMatchGuardRef.current = false;
    }
  }, [activeMatchConflict, forfeitActiveRoom]);

  const guardSingleActiveMatch = useCallback(
    (
      actionLabel: string,
      onConfirmNewMatch: () => Promise<void> | void,
      allowedRoomCode?: string
    ): boolean => {
      if (bypassActiveMatchGuardRef.current) return false;
      if (!blockingActiveRoom) return false;
      const cleanAllowed = allowedRoomCode?.trim().toUpperCase();
      if (cleanAllowed && blockingActiveRoom.roomCode === cleanAllowed) {
        return false;
      }
      setActiveMatchConflict({
        actionLabel,
        room: blockingActiveRoom,
        onConfirmNewMatch,
      });
      return true;
    },
    [blockingActiveRoom]
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
      const run = async () => {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        const code = await findOrCreateQuickMatch(effectiveProfile, opts);
        setOfflineMatch(null);
        setActiveRoomId(code);
        setActiveTab('play');
        showToast(`Connected to table ${code}.`, 'success');
      };
      if (guardSingleActiveMatch(`Start ${opts.maxPlayers}P Online Match`, run)) {
        return;
      }
      await run();
    },
    [user, profile, showToast, guardSingleActiveMatch]
  );

  const createPrivateRoom = useCallback(
    async (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => {
      if (!user) {
        showToast('Sign in with Google to host a private table for friends.', 'info');
        return;
      }
      const run = async () => {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        const code = await createMultiplayerRoom(effectiveProfile, { ...opts, visibility: 'private' });
        setOfflineMatch(null);
        setActiveRoomId(code);
        setActiveTab('play');
        showToast(`Private table ${code} created. Share the code with friends!`, 'success');
      };
      if (guardSingleActiveMatch('Create Private Room', run)) {
        return;
      }
      await run();
    },
    [user, profile, showToast, guardSingleActiveMatch]
  );

  const joinRoom = useCallback(
    async (code: string) => {
      if (!user) {
        showToast('Sign in with Google to join a friend’s table.', 'info');
        return;
      }
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          const room = await joinRoomByCode(code, effectiveProfile);
          setOfflineMatch(null);
          setActiveRoomId(room.id);
          setActiveTab('play');
          showToast(`Joined table ${room.roomCode}!`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Unable to join table.', 'error');
        }
      };
      if (guardSingleActiveMatch(`Join Table ${code.trim().toUpperCase()}`, run, code)) {
        return;
      }
      await run();
    },
    [user, profile, showToast, guardSingleActiveMatch]
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
      setOfflineMatch(null);
      setActiveRoomId(roomId);
      setActiveTab('play');
      notifiedActiveRoomIdsRef.current.add(roomId);
      const target = myActiveRooms.find((r) => r.id === roomId);
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
    [user, myActiveRooms, profile.displayName, showToast]
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
        await leaveWaitingRoom(roomToExit, user.uid, profile.displayName).catch(() => {});
      } else if (roomToExit.status === 'playing') {
        notifiedActiveRoomIdsRef.current.add(roomToExit.id);
        const mySeatInExit = roomToExit.seats.find((s) => !s.isBot && s.uid === user.uid);
        const alreadyFinished = Boolean(mySeatInExit && isSeatFinished(mySeatInExit, roomToExit.tokens));
        if (!alreadyFinished) {
          await updateRoomSeatPresence(
            roomToExit.id,
            user.uid,
            { away: true, autoPlay: true },
            `${profile.displayName} stepped out — Auto-Play active.`
          ).catch(() => {});
          showToast(
            `Auto-Play is covering your turns in ${roomToExit.roomCode}. Tap Rejoin anytime!`,
            'info'
          );
        }
      }
    }
    setActiveRoomId(null);
    setActiveRoom(null);
    setRoomMessages([]);
    setActiveTab('lobby');
  }, [activeRoom, user, profile.displayName, showToast]);

  const rematchOnlineRoom = useCallback(
    async (finishedRoom: RoomDoc) => {
      if (!user) {
        showToast('Sign in with Google to start an online rematch.', 'info');
        return;
      }
      try {
        const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
        if (finishedRoom.visibility === 'public') {
          const code = await findOrCreateQuickMatch(effectiveProfile, {
            mode: finishedRoom.mode,
            maxPlayers: finishedRoom.maxPlayers,
            entryStake: finishedRoom.entryStake,
          });
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
    },
    [user, profile, showToast]
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
      if (guardSingleActiveMatch(label, run)) {
        return;
      }
      run();
    },
    [guardSingleActiveMatch]
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
          showToast(`Table invite (${targetRoom.roomCode}) sent to ${friendName}!`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Could not send table invite.', 'error');
        }
      };

      const hasOpenWaitingRoom = Boolean(activeRoom && activeRoom.status === 'waiting');
      if (!hasOpenWaitingRoom && guardSingleActiveMatch(`Invite ${friendName} to New Table`, run)) {
        return;
      }
      await run();
    },
    [user, activeRoom, profile, showToast, guardSingleActiveMatch]
  );

  const acceptRoomInvite = useCallback(
    async (invite: RoomInviteDoc) => {
      if (!user) {
        showToast('Sign in with Google to accept table invites.', 'info');
        return;
      }
      const run = async () => {
        try {
          const effectiveProfile = profile.uid === user.uid ? profile : { ...profile, uid: user.uid };
          await respondToRoomInviteDoc(invite.id, 'accepted').catch(() => {});
          const room = await joinRoomByCode(invite.roomCode, effectiveProfile);
          setOfflineMatch(null);
          setActiveRoomId(room.id);
          setActiveTab('play');
          tabletopAudio.playSafeStar();
          showToast(`Joined ${invite.fromName}'s table (${room.roomCode})!`, 'success');
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'This table is no longer open.', 'error');
        }
      };
      if (guardSingleActiveMatch(`Join ${invite.fromName}'s Table`, run, invite.roomCode)) {
        return;
      }
      await run();
    },
    [user, profile, showToast, guardSingleActiveMatch]
  );

  const declineRoomInvite = useCallback(
    async (inviteId: string) => {
      if (!user) return;
      await respondToRoomInviteDoc(inviteId, 'declined').catch(() => {});
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
      isSignedIn: Boolean(user),
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
