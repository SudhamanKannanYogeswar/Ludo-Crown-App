import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BOT_ROSTER,
  computeLeagueFromElo,
  getTodayDateString,
  LEAGUE_META,
} from '../data/catalog';
import { computeSeatProgressScore, createInitialTokens, isSeatFinished } from '../game/ludoEngine';
import {
  ChallengeProgressMap,
  ChatMessageDoc,
  GameMode,
  LeagueTier,
  PlayerColor,
  PlayerProfile,
  PresenceStatus,
  RoomDoc,
  RoomInviteDoc,
  RoomSeat,
  TokenPositions,
  TournamentDoc,
  UserWallet,
} from '../types';

function clampString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function generateDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function createDefaultProfile(uid: string, rawName: string): PlayerProfile {
  const cleanName = clampString(rawName || 'Club Player', 32);
  const displayName = cleanName.length >= 2 ? cleanName : 'Club Player';
  return {
    uid,
    displayName,
    avatarId: 'maharaja',
    avatarFrame: 'frame_brass',
    boardTheme: 'board_emerald',
    diceTheme: 'dice_ivory',
    elo: 1050,
    gamesPlayed: 0,
    wins: 0,
    captures: 0,
    sixesRolled: 0,
    winStreak: 0,
    bestStreak: 0,
    trophies: 0,
    level: 1,
    xp: 0,
    league: 'bronze',
    isPublic: true,
    presenceStatus: 'online',
    lastActiveMs: Date.now(),
  };
}

export const FRIEND_ONLINE_STALE_MS = 90_000;

export interface PlayerPresenceInfo {
  isOnline: boolean;
  status: PresenceStatus;
  label: string;
  lastSeenText: string;
}

export function resolvePlayerPresence(
  profile: PlayerProfile | undefined,
  nowMs: number = Date.now()
): PlayerPresenceInfo {
  const lastActive =
    typeof profile?.lastActiveMs === 'number' && Number.isFinite(profile.lastActiveMs)
      ? profile.lastActiveMs
      : 0;
  const ageMs = lastActive > 0 ? Math.max(0, nowMs - lastActive) : Number.POSITIVE_INFINITY;
  const isFresh = ageMs <= FRIEND_ONLINE_STALE_MS;

  if (profile && profile.presenceStatus !== 'offline' && isFresh) {
    if (profile.presenceStatus === 'in_match') {
      return {
        isOnline: true,
        status: 'in_match',
        label: 'In a match',
        lastSeenText: 'In a match',
      };
    }
    return {
      isOnline: true,
      status: 'online',
      label: 'In lobby',
      lastSeenText: 'Online now',
    };
  }

  let lastSeenText = 'Offline';
  if (lastActive > 0 && Number.isFinite(ageMs)) {
    const mins = Math.floor(ageMs / 60_000);
    if (mins < 1) {
      lastSeenText = 'Offline · just now';
    } else if (mins < 60) {
      lastSeenText = `Offline · ${mins}m ago`;
    } else {
      const hours = Math.floor(mins / 60);
      if (hours < 24) {
        lastSeenText = `Offline · ${hours}h ago`;
      } else {
        const days = Math.floor(hours / 24);
        lastSeenText = `Offline · ${days}d ago`;
      }
    }
  }

  return {
    isOnline: false,
    status: 'offline',
    label: lastSeenText,
    lastSeenText,
  };
}

export async function updateUserPresence(
  uid: string,
  presenceStatus: PresenceStatus
): Promise<void> {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      presenceStatus,
      lastActiveMs: Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Best-effort heartbeat — never interrupt gameplay or sign-out if offline/transitioning
  }
}

export function createDefaultWallet(uid: string): UserWallet {
  const today = getTodayDateString();
  return {
    uid,
    coins: 1200,
    gems: 15,
    unlockedCosmetics: ['board_emerald', 'dice_ivory', 'frame_brass'],
    dailyStreak: 0,
    lastDailyClaimDate: '',
    dailyChallengesDate: today,
    challengeProgress: {
      rollSixes: 0,
      captures: 0,
      matchesPlayed: 0,
      matchesWon: 0,
    },
    claimedChallenges: [],
    adRewardedCountToday: 0,
    adDate: today,
    freeTournamentTickets: 1,
  };
}

export async function ensureUserDocs(
  uid: string,
  displayName: string
): Promise<{ profile: PlayerProfile; wallet: UserWallet }> {
  const profilePath = `profiles/${uid}`;
  const walletPath = `userWallets/${uid}`;

  let profile: PlayerProfile;
  try {
    const pSnap = await getDoc(doc(db, 'profiles', uid));
    if (pSnap.exists()) {
      profile = pSnap.data() as PlayerProfile;
    } else {
      profile = createDefaultProfile(uid, displayName);
      await setDoc(doc(db, 'profiles', uid), {
        ...profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  let wallet: UserWallet;
  try {
    const wSnap = await getDoc(doc(db, 'userWallets', uid));
    if (wSnap.exists()) {
      wallet = wSnap.data() as UserWallet;
    } else {
      wallet = createDefaultWallet(uid);
      await setDoc(doc(db, 'userWallets', uid), {
        ...wallet,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, walletPath);
  }

  return { profile, wallet };
}

export function subscribeProfile(
  uid: string,
  onData: (profile: PlayerProfile) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'profiles', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as PlayerProfile);
      }
    },
    (error) => {
      console.warn('Profile subscription warning:', error?.message || error);
    }
  );
}

export function subscribeWallet(
  uid: string,
  onData: (wallet: UserWallet) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'userWallets', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserWallet);
      }
    },
    (error) => {
      console.warn('Wallet subscription warning:', error?.message || error);
    }
  );
}

export function subscribePublicProfiles(
  onData: (profiles: PlayerProfile[]) => void
): Unsubscribe {
  const q = query(collection(db, 'profiles'), where('isPublic', '==', true), limit(80));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as PlayerProfile));
    },
    (error) => {
      console.warn('Public profiles subscription warning:', error?.message || error);
    }
  );
}

export async function updateProfileCustomization(
  uid: string,
  updates: Pick<PlayerProfile, 'displayName' | 'avatarId' | 'avatarFrame' | 'boardTheme' | 'diceTheme'>
) {
  const path = `profiles/${uid}`;
  const cleanName = clampString(updates.displayName, 32);
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      displayName: cleanName.length >= 2 ? cleanName : 'Club Player',
      avatarId: clampString(updates.avatarId, 64),
      avatarFrame: clampString(updates.avatarFrame, 64),
      boardTheme: clampString(updates.boardTheme, 64),
      diceTheme: clampString(updates.diceTheme, 64),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateProfileStats(
  uid: string,
  stats: Pick<
    PlayerProfile,
    'elo' | 'gamesPlayed' | 'wins' | 'captures' | 'sixesRolled' | 'winStreak' | 'bestStreak' | 'trophies' | 'level' | 'xp'
  >
) {
  const path = `profiles/${uid}`;
  const clampedElo = Math.max(100, Math.min(5000, Math.round(stats.elo)));
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      elo: clampedElo,
      gamesPlayed: Math.max(0, Math.floor(stats.gamesPlayed)),
      wins: Math.max(0, Math.min(Math.floor(stats.gamesPlayed), Math.floor(stats.wins))),
      captures: Math.max(0, Math.floor(stats.captures)),
      sixesRolled: Math.max(0, Math.floor(stats.sixesRolled)),
      winStreak: Math.max(0, Math.floor(stats.winStreak)),
      bestStreak: Math.max(0, Math.floor(stats.bestStreak)),
      trophies: Math.max(0, Math.floor(stats.trophies)),
      level: Math.max(1, Math.min(500, Math.floor(stats.level))),
      xp: Math.max(0, Math.floor(stats.xp)),
      league: computeLeagueFromElo(clampedElo),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWalletEconomy(
  uid: string,
  payload: Pick<UserWallet, 'coins' | 'gems' | 'unlockedCosmetics' | 'freeTournamentTickets'>
) {
  const path = `userWallets/${uid}`;
  try {
    await updateDoc(doc(db, 'userWallets', uid), {
      coins: Math.max(0, Math.min(10000000, Math.floor(payload.coins))),
      gems: Math.max(0, Math.min(1000000, Math.floor(payload.gems))),
      unlockedCosmetics: payload.unlockedCosmetics.slice(0, 50),
      freeTournamentTickets: Math.max(0, Math.min(20, Math.floor(payload.freeTournamentTickets))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWalletRewardsAndChallenges(
  uid: string,
  payload: Pick<
    UserWallet,
    'coins' | 'gems' | 'dailyStreak' | 'lastDailyClaimDate' | 'dailyChallengesDate' | 'challengeProgress' | 'claimedChallenges'
  > & { unlockedCosmetics?: string[] }
) {
  const path = `userWallets/${uid}`;
  const cleanProgress: ChallengeProgressMap = {
    rollSixes: Math.max(0, Math.floor(payload.challengeProgress.rollSixes)),
    captures: Math.max(0, Math.floor(payload.challengeProgress.captures)),
    matchesPlayed: Math.max(0, Math.floor(payload.challengeProgress.matchesPlayed)),
    matchesWon: Math.max(0, Math.floor(payload.challengeProgress.matchesWon)),
  };
  const updateBody: Record<string, unknown> = {
    coins: Math.max(0, Math.min(10000000, Math.floor(payload.coins))),
    gems: Math.max(0, Math.min(1000000, Math.floor(payload.gems))),
    dailyStreak: Math.max(0, Math.min(365, Math.floor(payload.dailyStreak))),
    lastDailyClaimDate: clampString(payload.lastDailyClaimDate, 16),
    dailyChallengesDate: clampString(payload.dailyChallengesDate, 16),
    challengeProgress: cleanProgress,
    claimedChallenges: payload.claimedChallenges.slice(0, 10),
    updatedAt: serverTimestamp(),
  };
  if (Array.isArray(payload.unlockedCosmetics)) {
    updateBody.unlockedCosmetics = payload.unlockedCosmetics.slice(0, 50);
  }
  try {
    await updateDoc(doc(db, 'userWallets', uid), updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWalletAdReward(
  uid: string,
  payload: Pick<UserWallet, 'coins' | 'gems' | 'adRewardedCountToday' | 'adDate' | 'freeTournamentTickets'>
) {
  const path = `userWallets/${uid}`;
  try {
    await updateDoc(doc(db, 'userWallets', uid), {
      coins: Math.max(0, Math.min(10000000, Math.floor(payload.coins))),
      gems: Math.max(0, Math.min(1000000, Math.floor(payload.gems))),
      adRewardedCountToday: Math.max(0, Math.min(50, Math.floor(payload.adRewardedCountToday))),
      adDate: clampString(payload.adDate, 16),
      freeTournamentTickets: Math.max(0, Math.min(20, Math.floor(payload.freeTournamentTickets))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// REAL-TIME MULTIPLAYER ROOMS & SECURE MATCHMAKING
// ============================================================================

function seatColorsForMax(maxPlayers: 2 | 4): PlayerColor[] {
  return maxPlayers === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];
}

export async function createMultiplayerRoom(
  profile: PlayerProfile,
  options: { visibility: 'public' | 'private'; mode: GameMode; maxPlayers: 2 | 4; entryStake: number }
): Promise<string> {
  const roomCode = generateRoomCode();
  const roomPath = `rooms/${roomCode}`;
  const activeColors = seatColorsForMax(options.maxPlayers);
  const hostSeat: RoomSeat = {
    uid: profile.uid,
    name: clampString(profile.displayName, 32),
    avatarId: profile.avatarId,
    avatarFrame: profile.avatarFrame,
    color: activeColors[0],
    isBot: false,
    elo: profile.elo,
    autoPlay: false,
    away: false,
    lastSeenMs: Date.now(),
    completedWithAutoPlay: false,
    forfeited: false,
    dryRolls: 0,
  };

  try {
    await setDoc(doc(db, 'rooms', roomCode), {
      roomCode,
      hostUid: profile.uid,
      visibility: options.visibility,
      mode: options.mode,
      maxPlayers: options.maxPlayers,
      entryStake: Math.max(0, Math.min(10000, Math.floor(options.entryStake))),
      status: 'waiting',
      openPublic: options.visibility === 'public',
      playerUids: [profile.uid],
      seats: [hostSeat],
      tokens: createInitialTokens(options.mode, activeColors),
      turnIndex: 0,
      diceValue: 0,
      turnPhase: 'roll',
      consecutiveSixes: 0,
      winnerColor: '',
      winnerUid: '',
      lastActionText: clampString(`${profile.displayName} opened table ${roomCode}.`, 120),
      turnCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return roomCode;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, roomPath);
  }
}

export const PUBLIC_ROOM_STALE_MS = 45_000;

export async function listOpenPublicRooms(): Promise<RoomDoc[]> {
  const path = 'rooms';
  try {
    const q = query(collection(db, 'rooms'), where('openPublic', '==', true), limit(25));
    const snap = await getDocs(q);
    const now = Date.now();
    return snap.docs
      .map((d) => {
        const data = d.data();
        const updatedAtMs =
          data.updatedAt instanceof Timestamp
            ? data.updatedAt.toMillis()
            : data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : 0;
        return {
          ...(data as Omit<RoomDoc, 'id'>),
          id: d.id,
          updatedAtMs,
        };
      })
      .filter(
        (r) =>
          r.status === 'waiting' &&
          r.openPublic === true &&
          r.updatedAtMs > 0 &&
          now - r.updatedAtMs <= PUBLIC_ROOM_STALE_MS
      )
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function cleanupOwnStaleWaitingRooms(
  uid: string,
  keepRoomId?: string | null
): Promise<void> {
  if (!uid) return;
  try {
    const q = query(collection(db, 'rooms'), where('openPublic', '==', true), limit(25));
    const snap = await getDocs(q);
    const staleOwnDocs = snap.docs.filter((d) => {
      if (keepRoomId && d.id === keepRoomId) return false;
      const data = d.data();
      return data.hostUid === uid && data.status === 'waiting';
    });
    if (staleOwnDocs.length > 0) {
      await Promise.allSettled(staleOwnDocs.map((d) => deleteDoc(doc(db, 'rooms', d.id))));
    }
  } catch {
    // Best-effort cleanup of abandoned rooms owned by the current user
  }
}

export async function touchWaitingRoomHeartbeat(roomId: string): Promise<void> {
  if (!roomId) return;
  try {
    await updateDoc(doc(db, 'rooms', roomId), {
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Benign if room already started or closed
  }
}

export async function joinRoomByCode(roomCodeRaw: string, profile: PlayerProfile): Promise<RoomDoc> {
  const roomCode = roomCodeRaw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (roomCode.length !== 6) {
    throw new Error('Enter a valid 6-character table code.');
  }
  const path = `rooms/${roomCode}`;
  try {
    const ref = doc(db, 'rooms', roomCode);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      throw new Error(`Table ${roomCode} was not found.`);
    }
    const room = { ...(snap.data() as Omit<RoomDoc, 'id'>), id: snap.id };
    if (room.playerUids.includes(profile.uid)) {
      return room;
    }
    if (room.status !== 'waiting') {
      throw new Error('This table has already started playing.');
    }
    if (room.seats.length >= room.maxPlayers) {
      throw new Error('This table is full.');
    }

    const palette = seatColorsForMax(room.maxPlayers);
    const takenColors = new Set(room.seats.map((s) => s.color));
    const nextColor = palette.find((c) => !takenColors.has(c)) || 'yellow';

    const newSeat: RoomSeat = {
      uid: profile.uid,
      name: clampString(profile.displayName, 32),
      avatarId: profile.avatarId,
      avatarFrame: profile.avatarFrame,
      color: nextColor,
      isBot: false,
      elo: profile.elo,
      autoPlay: false,
      away: false,
      lastSeenMs: Date.now(),
      completedWithAutoPlay: false,
      forfeited: false,
      dryRolls: 0,
    };

    const nextPlayerUids = [...room.playerUids, profile.uid];
    const nextSeats = [...room.seats, newSeat];

    await updateDoc(ref, {
      playerUids: nextPlayerUids,
      seats: nextSeats,
      lastActionText: clampString(`${profile.displayName} joined the table.`, 120),
      updatedAt: serverTimestamp(),
    });

    return { ...room, playerUids: nextPlayerUids, seats: nextSeats };
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Table ') || error.message.includes('This table'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function findOrCreateQuickMatch(
  profile: PlayerProfile,
  options: { mode: GameMode; maxPlayers: 2 | 4; entryStake: number }
): Promise<string> {
  // Clean up any abandoned waiting rooms left behind by this user first
  await cleanupOwnStaleWaitingRooms(profile.uid);

  // Only match into actively heartbeating public waiting rooms (updated within the last 45s)
  const openRooms = await listOpenPublicRooms();
  const candidates = openRooms.filter(
    (r) =>
      r.status === 'waiting' &&
      r.mode === options.mode &&
      r.maxPlayers === options.maxPlayers &&
      r.seats.length < r.maxPlayers &&
      !r.playerUids.includes(profile.uid) &&
      r.hostUid !== profile.uid
  );

  for (const candidate of candidates) {
    try {
      await joinRoomByCode(candidate.roomCode, profile);
      return candidate.roomCode;
    } catch {
      // Room may have just started, filled, or closed — try next candidate or open a fresh room
    }
  }

  return createMultiplayerRoom(profile, {
    visibility: 'public',
    mode: options.mode,
    maxPlayers: options.maxPlayers,
    entryStake: options.entryStake,
  });
}

export async function startMultiplayerRoom(room: RoomDoc, fillEmptyWithBots: boolean) {
  const path = `rooms/${room.id}`;
  const ref = doc(db, 'rooms', room.id);

  let latestRoom = room;
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const fresh = snap.data() as Omit<RoomDoc, 'id'>;
      if (fresh.status !== 'waiting') return;
      latestRoom = { ...fresh, id: snap.id };
    }
  } catch {
    // Fall back to provided snapshot
  }

  const palette = seatColorsForMax(latestRoom.maxPlayers);
  const takenColors = new Set(latestRoom.seats.map((s) => s.color));
  const nowMs = Date.now();
  const seats: RoomSeat[] = latestRoom.seats.map((s) => ({
    ...s,
    isBot: Boolean(s.isBot),
    autoPlay: false,
    away: false,
    lastSeenMs: nowMs,
    completedWithAutoPlay: false,
    forfeited: false,
    dryRolls: 0,
  }));

  if (fillEmptyWithBots || seats.length < 2) {
    let botIdx = 0;
    for (const color of palette) {
      if (seats.length >= latestRoom.maxPlayers) break;
      if (!takenColors.has(color)) {
        const bot = BOT_ROSTER[botIdx % BOT_ROSTER.length];
        botIdx++;
        seats.push({
          uid: `bot_${bot.uid}_${color}`,
          name: bot.name,
          avatarId: bot.avatarId,
          avatarFrame: bot.avatarFrame,
          color,
          isBot: true,
          elo: bot.elo,
          dryRolls: 0,
        });
        takenColors.add(color);
      }
    }
  }

  const activeColors = seats.map((s) => s.color);
  try {
    await updateDoc(ref, {
      status: 'playing',
      openPublic: false,
      seats,
      tokens: createInitialTokens(latestRoom.mode, activeColors),
      turnIndex: 0,
      diceValue: 0,
      turnPhase: 'roll',
      lastActionText: clampString(`Match started! ${seats[0].name} rolls first.`, 120),
      updatedAt: serverTimestamp(),
    });
    // Expire any pending outgoing invites sent for this waiting room now that the match started
    expireOutgoingInvitesForRoom(latestRoom.hostUid, latestRoom.roomCode).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateMultiplayerTurn(
  roomId: string,
  payload: {
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
  }
) {
  const path = `rooms/${roomId}`;
  try {
    const updateBody: Record<string, unknown> = {
      tokens: payload.tokens,
      turnIndex: payload.turnIndex,
      diceValue: payload.diceValue,
      turnPhase: payload.turnPhase,
      consecutiveSixes: payload.consecutiveSixes,
      status: payload.status,
      winnerColor: clampString(payload.winnerColor, 16),
      winnerUid: clampString(payload.winnerUid, 128),
      lastActionText: clampString(payload.lastActionText, 120),
      turnCount: payload.turnCount,
      updatedAt: serverTimestamp(),
    };
    if (Array.isArray(payload.seats) && payload.seats.length > 0) {
      updateBody.seats = payload.seats;
    }
    await updateDoc(doc(db, 'rooms', roomId), updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRoomSeatPresence(
  roomId: string,
  targetUid: string,
  updates: { autoPlay?: boolean; away?: boolean; lastSeenMs?: number },
  actionText?: string
): Promise<boolean> {
  if (!roomId || !targetUid) return false;
  try {
    const ref = doc(db, 'rooms', roomId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as Omit<RoomDoc, 'id'>;
    if (data.status !== 'playing' || !Array.isArray(data.seats)) return false;

    let changed = false;
    const nextSeats: RoomSeat[] = data.seats.map((seat) => {
      if (seat.uid !== targetUid || seat.isBot) return seat;
      const nextSeat: RoomSeat = {
        ...seat,
        ...(updates.autoPlay !== undefined ? { autoPlay: updates.autoPlay } : {}),
        ...(updates.away !== undefined ? { away: updates.away } : {}),
        ...(updates.lastSeenMs !== undefined ? { lastSeenMs: updates.lastSeenMs } : {}),
      };
      if (
        nextSeat.autoPlay !== seat.autoPlay ||
        nextSeat.away !== seat.away ||
        nextSeat.lastSeenMs !== seat.lastSeenMs
      ) {
        changed = true;
      }
      return nextSeat;
    });

    if (!changed) return false;

    const updateBody: Record<string, unknown> = {
      seats: nextSeats,
      updatedAt: serverTimestamp(),
    };
    if (actionText) {
      updateBody.lastActionText = clampString(actionText, 120);
    }
    await updateDoc(ref, updateBody);
    return true;
  } catch {
    // Benign if offline, room already finished, or concurrent write occurred
    return false;
  }
}

export const ACTIVE_PLAYING_ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export const PRIVATE_WAITING_ROOM_TTL_MS = 10 * 60 * 1000;

export function subscribeUserActiveRooms(
  uid: string,
  onData: (rooms: RoomDoc[]) => void
): Unsubscribe {
  const path = 'rooms';
  const q = query(collection(db, 'rooms'), where('playerUids', 'array-contains', uid), limit(15));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const active = snap.docs
        .map((d) => {
          const data = d.data();
          const updatedAtMs =
            data.updatedAt instanceof Timestamp
              ? data.updatedAt.toMillis()
              : data.createdAt instanceof Timestamp
                ? data.createdAt.toMillis()
                : now;
          return {
            ...(data as Omit<RoomDoc, 'id'>),
            id: d.id,
            updatedAtMs,
          };
        })
        .filter((room) => {
          if (room.status === 'finished') return false;
          const mySeat = room.seats?.find((s) => !s.isBot && s.uid === uid);
          if (mySeat?.forfeited) return false;
          const age = now - (room.updatedAtMs || 0);
          if (room.status === 'playing') {
            return age <= ACTIVE_PLAYING_ROOM_TTL_MS;
          }
          if (room.status === 'waiting') {
            return room.visibility === 'public'
              ? age <= PUBLIC_ROOM_STALE_MS * 2
              : age <= PRIVATE_WAITING_ROOM_TTL_MS;
          }
          return false;
        })
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'playing' ? -1 : 1;
          return (b.updatedAtMs || 0) - (a.updatedAtMs || 0);
        });
      onData(active);
    },
    (error) => {
      console.warn('Active rooms subscription warning:', error?.message || error);
    }
  );
}

export async function leaveWaitingRoom(room: RoomDoc, uid: string, playerName: string) {
  const path = `rooms/${room.id}`;
  try {
    if (room.hostUid === uid && room.status === 'waiting') {
      await deleteDoc(doc(db, 'rooms', room.id));
      expireOutgoingInvitesForRoom(uid, room.roomCode).catch(() => {});
    } else if (room.status === 'waiting' && room.playerUids.includes(uid)) {
      const nextUids = room.playerUids.filter((id) => id !== uid);
      const nextSeats = room.seats.filter((s) => s.uid !== uid);
      await updateDoc(doc(db, 'rooms', room.id), {
        playerUids: nextUids,
        seats: nextSeats,
        lastActionText: clampString(`${playerName} left the table.`, 120),
        updatedAt: serverTimestamp(),
      });
      expireOutgoingInvitesForRoom(uid, room.roomCode).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function forfeitActiveRoomDoc(
  room: RoomDoc,
  uid: string,
  playerName: string
): Promise<void> {
  if (!room?.id || !uid) return;
  const ref = doc(db, 'rooms', room.id);

  let latestRoom = room;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    latestRoom = { ...(snap.data() as Omit<RoomDoc, 'id'>), id: snap.id };
  } catch {
    // Fall back to passed snapshot
  }

  if (latestRoom.status === 'finished') return;

  if (latestRoom.status === 'waiting') {
    await leaveWaitingRoom(latestRoom, uid, playerName);
    return;
  }

  if (latestRoom.status !== 'playing') return;

  const updatedSeats: RoomSeat[] = latestRoom.seats.map((seat) => {
    if (!seat.isBot && seat.uid === uid) {
      return {
        ...seat,
        forfeited: true,
        autoPlay: true,
        away: true,
        completedWithAutoPlay: true,
      };
    }
    return seat;
  });

  const remainingActiveHumans = updatedSeats.filter(
    (s) => !s.isBot && !s.forfeited && !isSeatFinished(s, latestRoom.tokens)
  );

  if (remainingActiveHumans.length === 0) {
    let nextRank =
      updatedSeats.reduce(
        (max, s) => (typeof s.finishRank === 'number' && s.finishRank > max ? s.finishRank : max),
        0
      ) + 1;
    const unfinished = updatedSeats
      .filter((s) => !isSeatFinished(s, latestRoom.tokens))
      .sort((a, b) => {
        const aForf = a.forfeited ? 1 : 0;
        const bForf = b.forfeited ? 1 : 0;
        if (aForf !== bForf) return aForf - bForf;
        return (
          computeSeatProgressScore(latestRoom.tokens, b.color) -
          computeSeatProgressScore(latestRoom.tokens, a.color)
        );
      });
    const rankMap = new Map<string, number>();
    for (const s of unfinished) {
      rankMap.set(`${s.uid}:${s.color}`, nextRank);
      nextRank += 1;
    }
    const finalSeats: RoomSeat[] = updatedSeats.map((s) => {
      const assigned = rankMap.get(`${s.uid}:${s.color}`);
      if (assigned !== undefined) {
        return {
          ...s,
          finishRank: assigned,
          completedWithAutoPlay:
            !s.isBot && Boolean(s.completedWithAutoPlay || s.autoPlay || s.away || s.forfeited),
          away: false,
          autoPlay: false,
        };
      }
      return s;
    });
    const champion = finalSeats.find((s) => s.finishRank === 1) || finalSeats[0];
    await updateMultiplayerTurn(latestRoom.id, {
      seats: finalSeats,
      tokens: latestRoom.tokens,
      turnIndex: latestRoom.turnIndex,
      diceValue: 0,
      turnPhase: 'roll',
      consecutiveSixes: 0,
      status: 'finished',
      winnerColor: latestRoom.winnerColor || champion?.color || '',
      winnerUid: latestRoom.winnerUid || champion?.uid || '',
      lastActionText: clampString(`${playerName} exited — match ended.`, 120),
      turnCount: latestRoom.turnCount + 1,
    });
    return;
  }

  // Other real players are still playing — mark this seat forfeited/Auto-Play so they continue smoothly
  const path = `rooms/${latestRoom.id}`;
  try {
    await updateDoc(ref, {
      seats: updatedSeats,
      lastActionText: clampString(`${playerName} exited the match — Auto-Play taking over.`, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeRoom(
  roomId: string,
  onData: (room: RoomDoc | null) => void
): Unsubscribe {
  const path = `rooms/${roomId}`;
  return onSnapshot(
    doc(db, 'rooms', roomId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      onData({
        ...(data as Omit<RoomDoc, 'id'>),
        id: snap.id,
        updatedAtMs: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now(),
      });
    },
    (error) => {
      console.warn(`Room subscription warning (${path}):`, error?.message || error);
    }
  );
}

// ============================================================================
// REAL-TIME TABLE CHAT
// ============================================================================

export function subscribeRoomMessages(
  room: RoomDoc,
  currentUid: string,
  onMessages: (messages: ChatMessageDoc[]) => void
): Unsubscribe {
  const path = `rooms/${room.id}/messages`;
  const colRef = collection(db, 'rooms', room.id, 'messages');
  // Single-field where queries guarantee zero missing-index errors while enforcing rules
  const q =
    room.visibility === 'public'
      ? query(colRef, where('visibility', '==', 'public'), limit(60))
      : query(colRef, where('participantUids', 'array-contains', currentUid), limit(60));

  return onSnapshot(
    q,
    (snap) => {
      const msgs: ChatMessageDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          roomId: data.roomId,
          senderUid: data.senderUid,
          senderName: data.senderName,
          senderColor: data.senderColor,
          text: data.text,
          kind: data.kind,
          visibility: data.visibility,
          participantUids: data.participantUids || [],
          createdAtMs: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
        };
      });
      msgs.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onMessages(msgs);
    },
    (error) => {
      console.warn(`Chat subscription warning (${path}):`, error?.message || error);
    }
  );
}

export async function sendRoomMessage(
  room: RoomDoc,
  sender: { uid: string; name: string; color: PlayerColor },
  text: string,
  kind: 'chat' | 'emote'
) {
  const cleanText = clampString(text, 160);
  if (!cleanText) return;
  const messageId = generateDocId('msg');
  const path = `rooms/${room.id}/messages/${messageId}`;
  try {
    await setDoc(doc(db, 'rooms', room.id, 'messages', messageId), {
      roomId: room.id,
      senderUid: sender.uid,
      senderName: clampString(sender.name, 32) || 'Player',
      senderColor: sender.color,
      text: cleanText,
      kind,
      visibility: room.visibility,
      participantUids: room.playerUids.slice(0, 4),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ============================================================================
// LEADERBOARD & COMPETITIVE TOURNAMENTS
// ============================================================================

export async function fetchPublicLeaderboard(): Promise<PlayerProfile[]> {
  const path = 'profiles';
  try {
    const q = query(collection(db, 'profiles'), where('isPublic', '==', true), limit(80));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PlayerProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchPublicTournaments(): Promise<TournamentDoc[]> {
  const path = 'tournaments';
  try {
    const q = query(collection(db, 'tournaments'), where('isPublic', '==', true), limit(25));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<TournamentDoc, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createTournament(
  profile: PlayerProfile,
  title: string,
  tier: LeagueTier,
  maxEntrants: 4 | 8
): Promise<TournamentDoc> {
  const tournamentId = generateDocId('trn');
  const path = `tournaments/${tournamentId}`;
  const meta = LEAGUE_META[tier];
  const cleanTitle = clampString(title, 64);
  const entrant = {
    uid: profile.uid,
    name: clampString(profile.displayName, 32),
    avatarId: profile.avatarId,
    elo: profile.elo,
    seed: 1,
  };

  const payload: Omit<TournamentDoc, 'id'> = {
    title: cleanTitle.length >= 3 ? cleanTitle : `${meta.name} Cup`,
    tier,
    entryFee: meta.entryFee,
    prizePool: meta.prizePool,
    maxEntrants,
    status: 'open',
    creatorUid: profile.uid,
    entrantUids: [profile.uid],
    entrants: [entrant],
    winnerUid: '',
    winnerName: '',
    isPublic: true,
  };

  try {
    await setDoc(doc(db, 'tournaments', tournamentId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...payload, id: tournamentId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function joinTournamentDoc(
  tournament: TournamentDoc,
  profile: PlayerProfile
): Promise<TournamentDoc> {
  const path = `tournaments/${tournament.id}`;
  if (tournament.entrantUids.includes(profile.uid)) return tournament;
  if (tournament.entrantUids.length >= tournament.maxEntrants) {
    throw new Error('This tournament bracket is already full.');
  }

  const nextUids = [...tournament.entrantUids, profile.uid];
  const nextEntrants = [
    ...tournament.entrants,
    {
      uid: profile.uid,
      name: clampString(profile.displayName, 32),
      avatarId: profile.avatarId,
      elo: profile.elo,
      seed: nextUids.length,
    },
  ];
  const nextStatus = nextUids.length >= tournament.maxEntrants ? 'active' : 'open';

  try {
    await updateDoc(doc(db, 'tournaments', tournament.id), {
      entrantUids: nextUids,
      entrants: nextEntrants,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    return { ...tournament, entrantUids: nextUids, entrants: nextEntrants, status: nextStatus };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function completeTournamentDoc(
  tournamentId: string,
  winner: { uid: string; name: string }
) {
  const path = `tournaments/${tournamentId}`;
  try {
    await updateDoc(doc(db, 'tournaments', tournamentId), {
      status: 'completed',
      winnerUid: winner.uid,
      winnerName: clampString(winner.name, 32),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// REAL-TIME FRIENDS & ROOM INVITATIONS
// ============================================================================

export function makeFriendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

export function subscribeFriendships(
  uid: string,
  onData: (items: import('../types').FriendshipDoc[]) => void
): Unsubscribe {
  const path = 'friendships';
  const q = query(collection(db, 'friendships'), where('pairUids', 'array-contains', uid), limit(60));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          pairUids: data.pairUids || [],
          requesterUid: data.requesterUid,
          recipientUid: data.recipientUid,
          requesterName: data.requesterName,
          requesterAvatarId: data.requesterAvatarId,
          recipientName: data.recipientName,
          recipientAvatarId: data.recipientAvatarId,
          status: data.status,
          updatedAtMs: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now(),
        } as import('../types').FriendshipDoc;
      });
      list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(list);
    },
    (error) => {
      console.warn(`Friendships subscription warning (${path}):`, error?.message || error);
    }
  );
}

export type FriendTarget = Pick<PlayerProfile, 'uid' | 'displayName' | 'avatarId'>;

export async function sendFriendRequestDoc(
  me: PlayerProfile,
  target: FriendTarget
): Promise<'sent' | 'accepted'> {
  if (me.uid === target.uid) {
    throw new Error('You cannot add yourself as a friend.');
  }
  const friendshipId = makeFriendshipId(me.uid, target.uid);
  const path = `friendships/${friendshipId}`;
  const ref = doc(db, 'friendships', friendshipId);
  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      if (existingData.status === 'accepted') {
        throw new Error(`${target.displayName} is already in your squad.`);
      }
      if (existingData.recipientUid === me.uid) {
        await updateDoc(ref, {
          status: 'accepted',
          updatedAt: serverTimestamp(),
        });
        return 'accepted';
      }
      throw new Error(`Friend request already sent to ${target.displayName}.`);
    }

    await setDoc(ref, {
      pairUids: [me.uid, target.uid].sort(),
      requesterUid: me.uid,
      recipientUid: target.uid,
      requesterName: clampString(me.displayName, 32) || 'Player',
      requesterAvatarId: clampString(me.avatarId, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'maharaja',
      recipientName: clampString(target.displayName, 32) || 'Player',
      recipientAvatarId: clampString(target.avatarId, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'maharaja',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return 'sent';
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('already') || error.message.includes('yourself'))
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function acceptFriendRequestDoc(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeFriendshipDoc(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export const ROOM_INVITE_TTL_MS = 2 * 60 * 1000;

export function getInviteRemainingMs(invite: RoomInviteDoc, nowMs: number = Date.now()): number {
  return Math.max(0, invite.createdAtMs + ROOM_INVITE_TTL_MS - nowMs);
}

export function formatInviteCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function deleteRoomInviteDoc(inviteId: string): Promise<void> {
  if (!inviteId) return;
  try {
    await deleteDoc(doc(db, 'roomInvites', inviteId));
  } catch {
    // Benign if already removed or expired
  }
}

export async function expireOutgoingInvitesForRoom(
  fromUid: string,
  roomCode: string
): Promise<void> {
  if (!fromUid || !roomCode) return;
  try {
    const q = query(collection(db, 'roomInvites'), where('fromUid', '==', fromUid), limit(30));
    const snap = await getDocs(q);
    const matching = snap.docs.filter((d) => {
      const data = d.data();
      return data.roomCode === roomCode && data.status === 'pending';
    });
    if (matching.length > 0) {
      await Promise.allSettled(matching.map((d) => deleteDoc(doc(db, 'roomInvites', d.id))));
    }
  } catch {
    // Best-effort cleanup of outgoing invites
  }
}

export function subscribeIncomingRoomInvites(
  uid: string,
  onData: (invites: RoomInviteDoc[]) => void
): Unsubscribe {
  const path = 'roomInvites';
  const q = query(collection(db, 'roomInvites'), where('toUid', '==', uid), limit(30));
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now();
      const allMapped: RoomInviteDoc[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          roomId: data.roomId,
          roomCode: data.roomCode,
          fromUid: data.fromUid,
          fromName: data.fromName,
          fromAvatarId: data.fromAvatarId,
          toUid: data.toUid,
          mode: data.mode,
          maxPlayers: data.maxPlayers,
          seatsCount: data.seatsCount,
          status: data.status,
          createdAtMs: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : now,
        };
      });

      const active: RoomInviteDoc[] = [];
      for (const inv of allMapped) {
        if (inv.status !== 'pending') continue;
        if (now - inv.createdAtMs < ROOM_INVITE_TTL_MS) {
          active.push(inv);
        } else {
          // Silently clean up expired invites so offline/stale invites never accumulate
          deleteRoomInviteDoc(inv.id).catch(() => {});
        }
      }

      active.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(active);
    },
    (error) => {
      console.warn(`Room invites subscription warning (${path}):`, error?.message || error);
    }
  );
}

export async function sendRoomInviteDoc(
  room: RoomDoc,
  fromProfile: PlayerProfile,
  toUid: string
): Promise<string> {
  // Replace any older pending invite from this host to this friend for the same room
  try {
    const q = query(collection(db, 'roomInvites'), where('fromUid', '==', fromProfile.uid), limit(30));
    const snap = await getDocs(q);
    const stale = snap.docs.filter((d) => {
      const data = d.data();
      const createdAtMs = data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : 0;
      const isExpired = createdAtMs > 0 && Date.now() - createdAtMs >= ROOM_INVITE_TTL_MS;
      return (
        data.status === 'pending' &&
        (isExpired || (data.toUid === toUid && data.roomCode === room.roomCode))
      );
    });
    if (stale.length > 0) {
      await Promise.allSettled(stale.map((d) => deleteDoc(doc(db, 'roomInvites', d.id))));
    }
  } catch {
    // Non-blocking pre-cleanup
  }

  const inviteId = generateDocId('inv');
  const path = `roomInvites/${inviteId}`;
  try {
    await setDoc(doc(db, 'roomInvites', inviteId), {
      roomId: room.roomCode,
      roomCode: room.roomCode,
      fromUid: fromProfile.uid,
      fromName: clampString(fromProfile.displayName, 32) || 'Player',
      fromAvatarId: clampString(fromProfile.avatarId, 64).replace(/[^a-zA-Z0-9_-]/g, '') || 'maharaja',
      toUid,
      mode: room.mode,
      maxPlayers: room.maxPlayers,
      seatsCount: Math.max(1, Math.min(4, room.seats.length)),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToRoomInviteDoc(
  inviteId: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  const path = `roomInvites/${inviteId}`;
  try {
    await updateDoc(doc(db, 'roomInvites', inviteId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function savePushSubscriptionDoc(
  uid: string,
  payload: {
    token: string;
    platform: 'android' | 'ios' | 'web';
    enabled: boolean;
    roomInvites: boolean;
    friendRequests: boolean;
    dailyRewards: boolean;
  }
): Promise<void> {
  const path = `pushSubscriptions/${uid}`;
  try {
    await setDoc(doc(db, 'pushSubscriptions', uid), {
      uid,
      token: clampString(payload.token, 512),
      platform: payload.platform,
      enabled: Boolean(payload.enabled),
      roomInvites: Boolean(payload.roomInvites),
      friendRequests: Boolean(payload.friendRequests),
      dailyRewards: Boolean(payload.dailyRewards),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserAccountDocs(uid: string): Promise<void> {
  if (!uid) return;

  // Clean up any waiting rooms hosted by this user first
  await cleanupOwnStaleWaitingRooms(uid);

  // Best-effort removal of user's friendships and room invites
  try {
    const friendsSnap = await getDocs(
      query(collection(db, 'friendships'), where('pairUids', 'array-contains', uid), limit(60))
    );
    if (friendsSnap.docs.length > 0) {
      await Promise.allSettled(friendsSnap.docs.map((d) => deleteDoc(doc(db, 'friendships', d.id))));
    }
  } catch {
    // Best-effort cleanup
  }

  try {
    const sentInvites = await getDocs(
      query(collection(db, 'roomInvites'), where('fromUid', '==', uid), limit(40))
    );
    const recvInvites = await getDocs(
      query(collection(db, 'roomInvites'), where('toUid', '==', uid), limit(40))
    );
    const allInvites = [...sentInvites.docs, ...recvInvites.docs];
    if (allInvites.length > 0) {
      await Promise.allSettled(allInvites.map((d) => deleteDoc(doc(db, 'roomInvites', d.id))));
    }
  } catch {
    // Best-effort cleanup
  }

  // Delete core account documents (owner-only Firestore rules enforced)
  await Promise.allSettled([
    deleteDoc(doc(db, 'pushSubscriptions', uid)),
    deleteDoc(doc(db, 'userWallets', uid)),
    deleteDoc(doc(db, 'profiles', uid)),
  ]);
}


