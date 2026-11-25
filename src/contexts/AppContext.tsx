import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  isCapacitorNativeApp,
  signInWithGoogleAuto,
  signOutGoogleAuto,
  testConnection,
} from '../firebase';
import {
  ActiveAdModalState,
  ADMOB_CONFIG,
  hasNativeAndroidAdBridge,
  REWARDED_PLACEMENTS,
  RewardedPlacementId,
  showNativeInterstitialAd,
  showNativeRewardedAd,
  syncNativeBannerVisibility,
} from '../services/adMobService';
import {
  completeTournamentDoc,
  createDefaultProfile,
  createDefaultWallet,
  createMultiplayerRoom,
  createTournament,
  ensureUserDocs,
  fetchPublicLeaderboard,
  fetchPublicTournaments,
  findOrCreateQuickMatch,
  joinRoomByCode,
  joinTournamentDoc,
  leaveWaitingRoom,
  listOpenPublicRooms,
  sendRoomMessage,
  startMultiplayerRoom,
  subscribeProfile,
  subscribeRoom,
  subscribeRoomMessages,
  subscribeWallet,
  updateMultiplayerTurn,
  updateProfileCustomization,
  updateProfileStats,
  updateWalletAdReward,
  updateWalletEconomy,
  updateWalletRewardsAndChallenges,
} from '../services/firestoreService';
import {
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
  GameMode,
  LeagueTier,
  MatchSummary,
  PlayerColor,
  PlayerProfile,
  RoomDoc,
  TokenPositions,
  TournamentDoc,
  UserWallet,
} from '../types';

const GUEST_PROFILE_KEY = 'ludo_crown_guest_profile_v1';
const GUEST_WALLET_KEY = 'ludo_crown_guest_wallet_v1';

export interface OfflineMatchConfig {
  mode: GameMode;
  playerCount: 2 | 4;
  difficulty: AiDifficulty;
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
  // Multiplayer Rooms
  activeRoom: RoomDoc | null;
  roomMessages: ChatMessageDoc[];
  openRooms: RoomDoc[];
  refreshOpenRooms: () => Promise<void>;
  startQuickMatchmaking: (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => Promise<void>;
  createPrivateRoom: (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => Promise<void>;
  joinRoom: (code: string) => Promise<void>;
  hostStartRoom: (fillBots: boolean) => Promise<void>;
  submitMultiplayerTurn: (payload: {
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

  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomDoc | null>(null);
  const [roomMessages, setRoomMessages] = useState<ChatMessageDoc[]>([]);
  const [openRooms, setOpenRooms] = useState<RoomDoc[]>([]);
  const [offlineMatch, setOfflineMatch] = useState<OfflineMatchConfig | null>(null);

  const [leaderboard, setLeaderboard] = useState<PlayerProfile[]>([]);
  const [tournaments, setTournaments] = useState<TournamentDoc[]>([]);

  const [adModal, setAdModal] = useState<ActiveAdModalState | null>(null);
  const [matchesSinceLastInterstitial, setMatchesSinceLastInterstitial] = useState(0);
  const lastInterstitialAtRef = React.useRef<number>(0);
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
        setRoomMessages([]);
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
    return () => {
      unsubProfile();
      unsubWallet();
    };
  }, [user]);

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

  // Hide native Android banner during active Ludo board gameplay to avoid accidental mis-taps
  useEffect(() => {
    syncNativeBannerVisibility(activeTab !== 'play');
  }, [activeTab]);

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
          rawMsg === 'NATIVE_AUTH_PLUGIN_MISSING' ||
          lower.includes('default_web_client_id') ||
          lower.includes('developer_error') ||
          lower.includes('statuscode=10') ||
          lower.includes('apiexception: 10') ||
          lower.includes('no_id_token')
        ) {
          showToast(
            'Android Google Sign-In needs google-services.json + SHA-1 in Firebase Console & GitHub Secrets (see MOBILE_STORE_BUILD.md).',
            'error'
          );
          return;
        }
        showToast(`Google Sign-In failed: ${rawMsg || 'Please check network and try again.'}`, 'error');
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
    const nextWallet: UserWallet = {
      ...wallet,
      coins: wallet.coins + reward.coins,
      gems: wallet.gems + reward.gems,
      dailyStreak: nextStreak,
      lastDailyClaimDate: today,
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
    showToast(`Day ${nextStreak} reward claimed: ${reward.label}!`, 'success');
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
    [profile, wallet, user]
  );

  // =========================================================================
  // MULTIPLAYER & MATCHMAKING ACTIONS
  // =========================================================================

  const refreshOpenRooms = useCallback(async () => {
    if (!user) return;
    const rooms = await listOpenPublicRooms();
    setOpenRooms(rooms);
  }, [user]);

  const startQuickMatchmaking = useCallback(
    async (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => {
      if (!user) {
        showToast('Sign in with Google to join real-time multiplayer tables.', 'info');
        return;
      }
      const code = await findOrCreateQuickMatch(profile, opts);
      setOfflineMatch(null);
      setActiveRoomId(code);
      setActiveTab('play');
      showToast(`Connected to table ${code}.`, 'success');
    },
    [user, profile, showToast]
  );

  const createPrivateRoom = useCallback(
    async (opts: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }) => {
      if (!user) {
        showToast('Sign in with Google to host a private table for friends.', 'info');
        return;
      }
      const code = await createMultiplayerRoom(profile, { ...opts, visibility: 'private' });
      setOfflineMatch(null);
      setActiveRoomId(code);
      setActiveTab('play');
      showToast(`Private table ${code} created. Share the code with friends!`, 'success');
    },
    [user, profile, showToast]
  );

  const joinRoom = useCallback(
    async (code: string) => {
      if (!user) {
        showToast('Sign in with Google to join a friend’s table.', 'info');
        return;
      }
      try {
        const room = await joinRoomByCode(code, profile);
        setOfflineMatch(null);
        setActiveRoomId(room.id);
        setActiveTab('play');
        showToast(`Joined table ${room.roomCode}!`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Unable to join table.', 'error');
      }
    },
    [user, profile, showToast]
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
    if (activeRoom && user && activeRoom.status === 'waiting') {
      await leaveWaitingRoom(activeRoom, user.uid, profile.displayName).catch(() => {});
    }
    setActiveRoomId(null);
    setActiveRoom(null);
    setRoomMessages([]);
    setActiveTab('lobby');
  }, [activeRoom, user, profile.displayName]);

  const launchOfflinePractice = useCallback((config: OfflineMatchConfig) => {
    setActiveRoomId(null);
    setActiveRoom(null);
    setOfflineMatch(config);
    setActiveTab('play');
  }, []);

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
      const created = await createTournament(profile, title, tier, maxEntrants);
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

      const updated = await joinTournamentDoc(tournament, profile);
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
  // ANDROID ADMOB & REWARDED VIDEO PLACEMENTS
  // =========================================================================

  const creditAdQuotaAndGrant = useCallback(
    async (
      coinsDelta: number,
      ticketsDelta: number,
      onComplete: () => void
    ) => {
      const today = getTodayDateString();
      const countToday = wallet.adDate === today ? wallet.adRewardedCountToday + 1 : 1;
      const nextWallet: UserWallet = {
        ...wallet,
        coins: wallet.coins + coinsDelta,
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

      // If running inside Capacitor or Android WebView wrapper with native AdMob SDK
      if (hasNativeAndroidAdBridge()) {
        showNativeRewardedAd(placementId).then((earned) => {
          if (earned) {
            const bonusCoins = placementId === 'daily_bonus_coins' ? 250 : 0;
            const bonusTickets = placementId === 'free_tournament_ticket' ? 1 : 0;
            creditAdQuotaAndGrant(bonusCoins, bonusTickets, onRewardEarned);
          }
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
          const bonusCoins = placementId === 'daily_bonus_coins' ? 250 : 0;
          const bonusTickets = placementId === 'free_tournament_ticket' ? 1 : 0;
          creditAdQuotaAndGrant(bonusCoins, bonusTickets, onRewardEarned);
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
    setAdModal({
      kind: 'interstitial',
      placementId: 'post_match_break',
      title: 'Match Break Interstitial',
      rewardLabel: 'Frequency-capped (1 per 3 matches · 90s min gap)',
      unitId: ADMOB_CONFIG.interstitialUnitId,
      durationSeconds: 3,
      onComplete: () => setAdModal(null),
      onDismiss: () => setAdModal(null),
    });
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
      signInWithGoogle,
      signOutUser,
      saveCustomization,
      purchaseCosmetic,
      claimDailyStreak,
      claimDailyChallenge,
      grantWheelReward,
      recordGameplayEvent,
      recordMatchCompletion,
      activeRoom,
      roomMessages,
      openRooms,
      refreshOpenRooms,
      startQuickMatchmaking,
      createPrivateRoom,
      joinRoom,
      hostStartRoom,
      submitMultiplayerTurn,
      sendChat,
      exitActiveRoom,
      offlineMatch,
      launchOfflinePractice,
      closeOfflineMatch,
      leaderboard,
      refreshLeaderboard,
      tournaments,
      refreshTournaments,
      hostNewTournament,
      registerForTournament,
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
      signInWithGoogle,
      signOutUser,
      saveCustomization,
      purchaseCosmetic,
      claimDailyStreak,
      claimDailyChallenge,
      grantWheelReward,
      recordGameplayEvent,
      recordMatchCompletion,
      activeRoom,
      roomMessages,
      openRooms,
      refreshOpenRooms,
      startQuickMatchmaking,
      createPrivateRoom,
      joinRoom,
      hostStartRoom,
      submitMultiplayerTurn,
      sendChat,
      exitActiveRoom,
      offlineMatch,
      launchOfflinePractice,
      closeOfflineMatch,
      leaderboard,
      refreshLeaderboard,
      tournaments,
      refreshTournaments,
      hostNewTournament,
      registerForTournament,
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
