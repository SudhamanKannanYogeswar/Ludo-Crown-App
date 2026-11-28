export type PlayerColor = 'red' | 'green' | 'yellow' | 'blue';

export type LeagueTier = 'bronze' | 'silver' | 'gold' | 'grandmaster';

export type GameMode = 'classic' | 'quick';

export type AiDifficulty = 'casual' | 'tactical' | 'grandmaster';

export type ActiveTab =
  | 'lobby'
  | 'friends'
  | 'play'
  | 'tournaments'
  | 'leaderboard'
  | 'rewards'
  | 'atelier';

export type PresenceStatus = 'online' | 'in_match' | 'offline';

export interface PlayerProfile {
  uid: string;
  displayName: string;
  avatarId: string;
  avatarFrame: string;
  boardTheme: string;
  diceTheme: string;
  elo: number;
  gamesPlayed: number;
  wins: number;
  captures: number;
  sixesRolled: number;
  winStreak: number;
  bestStreak: number;
  trophies: number;
  level: number;
  xp: number;
  league: LeagueTier;
  isPublic: boolean;
  presenceStatus?: PresenceStatus;
  lastActiveMs?: number;
}

export interface ChallengeProgressMap {
  rollSixes: number;
  captures: number;
  matchesPlayed: number;
  matchesWon: number;
}

export interface UserWallet {
  uid: string;
  coins: number;
  gems: number;
  unlockedCosmetics: string[];
  dailyStreak: number;
  lastDailyClaimDate: string;
  dailyChallengesDate: string;
  challengeProgress: ChallengeProgressMap;
  claimedChallenges: string[];
  adRewardedCountToday: number;
  adDate: string;
  freeTournamentTickets: number;
}

export interface RoomSeat {
  uid: string;
  name: string;
  avatarId: string;
  avatarFrame: string;
  color: PlayerColor;
  isBot: boolean;
  elo: number;
  autoPlay?: boolean;
  away?: boolean;
  lastSeenMs?: number;
  finishRank?: number;
  completedWithAutoPlay?: boolean;
  forfeited?: boolean;
  dryRolls?: number;
}

export type TokenPositions = Record<PlayerColor, number[]>;

export interface RoomDoc {
  id: string;
  roomCode: string;
  hostUid: string;
  visibility: 'public' | 'private';
  mode: GameMode;
  maxPlayers: 2 | 4;
  entryStake: number;
  status: 'waiting' | 'playing' | 'finished';
  openPublic: boolean;
  playerUids: string[];
  seats: RoomSeat[];
  tokens: TokenPositions;
  turnIndex: number;
  diceValue: number;
  turnPhase: 'roll' | 'move';
  consecutiveSixes: number;
  winnerColor: string;
  winnerUid: string;
  lastActionText: string;
  turnCount: number;
  updatedAtMs?: number;
}

export interface ChatMessageDoc {
  id: string;
  roomId: string;
  senderUid: string;
  senderName: string;
  senderColor: PlayerColor;
  text: string;
  kind: 'chat' | 'emote';
  visibility: 'public' | 'private';
  participantUids: string[];
  createdAtMs: number;
}

export interface TournamentEntrant {
  uid: string;
  name: string;
  avatarId: string;
  elo: number;
  seed: number;
}

export interface TournamentDoc {
  id: string;
  title: string;
  tier: LeagueTier;
  entryFee: number;
  prizePool: number;
  maxEntrants: 4 | 8;
  status: 'open' | 'active' | 'completed';
  creatorUid: string;
  entrantUids: string[];
  entrants: TournamentEntrant[];
  winnerUid: string;
  winnerName: string;
  isPublic: boolean;
}

export interface AvatarOption {
  id: string;
  name: string;
  title: string;
  imageUrl?: string;
  accentBg: string;
  initials: string;
}

export interface BoardThemeSpec {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  currency: 'coins' | 'gems';
  outerBezelGradient: string;
  frameBg: string;
  tileBg: string;
  tileBorder: string;
  safeBg: string;
  yardInnerBg: string;
  yardStroke: string;
  centerGradientStart: string;
  centerBg: string;
  starFill: string;
  starStroke: string;
  swatchHex: string;
  patternStyle: 'classic' | 'palace' | 'midnight' | 'crystal';
}

export interface BackdropThemeSpec {
  id: string;
  name: string;
  description: string;
  canvasGradient: string;
  dotColor: string;
  rayColor: string;
  bloomColors: [string, string, string, string];
  diePrimaryFill: string;
  diePrimaryStroke: string;
  diePrimaryPip: string;
  dieSecondaryFill: string;
  dieSecondaryStroke: string;
  starFill: string;
  starStroke: string;
  starAltFill: string;
  starAltStroke: string;
  swatchColors: [string, string, string];
  isDark?: boolean;
}

export interface DiceThemeSpec {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  currency: 'coins' | 'gems';
  faceBg: string;
  pipColor: string;
  borderColor: string;
}

export interface AvatarFrameSpec {
  id: string;
  name: string;
  description: string;
  priceCoins: number;
  currency: 'coins' | 'gems';
  ringClass: string;
  swatchHex: string;
}

export interface DailyChallengeDef {
  id: string;
  title: string;
  description: string;
  metric: keyof ChallengeProgressMap;
  target: number;
  rewardCoins: number;
  rewardGems: number;
}

export interface FinalStandingEntry {
  uid: string;
  name: string;
  avatarId: string;
  avatarFrame: string;
  color: PlayerColor;
  isBot: boolean;
  rank: number;
  finishedTokens: number;
}

export interface MatchSummary {
  won: boolean;
  winnerName: string;
  winnerColor: PlayerColor;
  isOnline: boolean;
  isTournament: boolean;
  tournamentId?: string;
  tournamentRound?: 'semifinal' | 'final';
  capturesByPlayer: number;
  sixesByPlayer: number;
  coinsEarned: number;
  xpEarned: number;
  eloDelta: number;
  turnsPlayed: number;
  doubledWithAd: boolean;
  finishRank?: number;
  isFinalResults?: boolean;
  standings?: FinalStandingEntry[];
  autoPlayForfeitedRewards?: boolean;
}

export interface FriendshipDoc {
  id: string;
  pairUids: string[];
  requesterUid: string;
  recipientUid: string;
  requesterName: string;
  requesterAvatarId: string;
  recipientName: string;
  recipientAvatarId: string;
  status: 'pending' | 'accepted';
  updatedAtMs: number;
}

export interface RoomInviteDoc {
  id: string;
  roomId: string;
  roomCode: string;
  fromUid: string;
  fromName: string;
  fromAvatarId: string;
  toUid: string;
  mode: GameMode;
  maxPlayers: 2 | 4;
  seatsCount: number;
  status: 'pending' | 'accepted' | 'declined';
  createdAtMs: number;
}

