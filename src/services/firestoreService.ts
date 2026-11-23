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
import { createInitialTokens } from '../game/ludoEngine';
import {
  ChallengeProgressMap,
  ChatMessageDoc,
  GameMode,
  LeagueTier,
  PlayerColor,
  PlayerProfile,
  RoomDoc,
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
  };
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
  const path = `profiles/${uid}`;
  return onSnapshot(
    doc(db, 'profiles', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as PlayerProfile);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeWallet(
  uid: string,
  onData: (wallet: UserWallet) => void
): Unsubscribe {
  const path = `userWallets/${uid}`;
  return onSnapshot(
    doc(db, 'userWallets', uid),
    (snap) => {
      if (snap.exists()) {
        onData(snap.data() as UserWallet);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
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
  >
) {
  const path = `userWallets/${uid}`;
  const cleanProgress: ChallengeProgressMap = {
    rollSixes: Math.max(0, Math.floor(payload.challengeProgress.rollSixes)),
    captures: Math.max(0, Math.floor(payload.challengeProgress.captures)),
    matchesPlayed: Math.max(0, Math.floor(payload.challengeProgress.matchesPlayed)),
    matchesWon: Math.max(0, Math.floor(payload.challengeProgress.matchesWon)),
  };
  try {
    await updateDoc(doc(db, 'userWallets', uid), {
      coins: Math.max(0, Math.min(10000000, Math.floor(payload.coins))),
      gems: Math.max(0, Math.min(1000000, Math.floor(payload.gems))),
      dailyStreak: Math.max(0, Math.min(365, Math.floor(payload.dailyStreak))),
      lastDailyClaimDate: clampString(payload.lastDailyClaimDate, 16),
      dailyChallengesDate: clampString(payload.dailyChallengesDate, 16),
      challengeProgress: cleanProgress,
      claimedChallenges: payload.claimedChallenges.slice(0, 10),
      updatedAt: serverTimestamp(),
    });
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

export async function listOpenPublicRooms(): Promise<RoomDoc[]> {
  const path = 'rooms';
  try {
    const q = query(collection(db, 'rooms'), where('openPublic', '==', true), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        ...(data as Omit<RoomDoc, 'id'>),
        id: d.id,
        updatedAtMs: data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : Date.now(),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
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
  const openRooms = await listOpenPublicRooms();
  const candidate = openRooms.find(
    (r) =>
      r.status === 'waiting' &&
      r.mode === options.mode &&
      r.maxPlayers === options.maxPlayers &&
      r.seats.length < r.maxPlayers &&
      !r.playerUids.includes(profile.uid)
  );

  if (candidate) {
    await joinRoomByCode(candidate.roomCode, profile);
    return candidate.roomCode;
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
  const palette = seatColorsForMax(room.maxPlayers);
  const takenColors = new Set(room.seats.map((s) => s.color));
  const seats: RoomSeat[] = [...room.seats];

  if (fillEmptyWithBots || seats.length < 2) {
    let botIdx = 0;
    for (const color of palette) {
      if (seats.length >= room.maxPlayers) break;
      if (!takenColors.has(color)) {
        const bot = BOT_ROSTER[botIdx % BOT_ROSTER.length];
        botIdx++;
        seats.push({
          uid: `${bot.uid}_${color}`,
          name: bot.name,
          avatarId: bot.avatarId,
          avatarFrame: bot.avatarFrame,
          color,
          isBot: true,
          elo: bot.elo,
        });
        takenColors.add(color);
      }
    }
  }

  const activeColors = seats.map((s) => s.color);
  try {
    await updateDoc(doc(db, 'rooms', room.id), {
      status: 'playing',
      openPublic: false,
      seats,
      tokens: createInitialTokens(room.mode, activeColors),
      turnIndex: 0,
      diceValue: 0,
      turnPhase: 'roll',
      lastActionText: clampString(`Match started! ${seats[0].name} rolls first.`, 120),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateMultiplayerTurn(
  roomId: string,
  payload: {
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
    await updateDoc(doc(db, 'rooms', roomId), {
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
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function leaveWaitingRoom(room: RoomDoc, uid: string, playerName: string) {
  const path = `rooms/${room.id}`;
  try {
    if (room.hostUid === uid && room.status === 'waiting') {
      await deleteDoc(doc(db, 'rooms', room.id));
    } else if (room.status === 'waiting' && room.playerUids.includes(uid)) {
      const nextUids = room.playerUids.filter((id) => id !== uid);
      const nextSeats = room.seats.filter((s) => s.uid !== uid);
      await updateDoc(doc(db, 'rooms', room.id), {
        playerUids: nextUids,
        seats: nextSeats,
        lastActionText: clampString(`${playerName} left the table.`, 120),
        updatedAt: serverTimestamp(),
      });
    }
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
      handleFirestoreError(error, OperationType.GET, path);
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
      handleFirestoreError(error, OperationType.LIST, path);
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
    const q = query(collection(db, 'profiles'), where('isPublic', '==', true), limit(50));
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
