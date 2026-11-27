import {
  AiDifficulty,
  FinalStandingEntry,
  GameMode,
  PlayerColor,
  RoomSeat,
  TokenPositions,
} from '../types';

export const ALL_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

/**
 * 52-tile clockwise outer track on a 15x15 classic Ludo grid (row, col from 0..14).
 * Index 0 is Red's starting tile (row 6, col 1).
 * Index 13 is Green's starting tile (row 1, col 8).
 * Index 26 is Yellow's starting tile (row 8, col 13).
 * Index 39 is Blue's starting tile (row 13, col 6).
 */
export const MAIN_TRACK: [number, number][] = [
  // Red arm top (left -> right)
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  // Green arm left (bottom -> top)
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  // Top turn
  [0, 7], [0, 8],
  // Green arm right (top -> bottom)
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  // Yellow arm top (left -> right)
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  // Right turn
  [7, 14], [8, 14],
  // Yellow arm bottom (right -> left)
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  // Blue arm right (top -> bottom)
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  // Bottom turn
  [14, 7], [14, 6],
  // Blue arm left (bottom -> top)
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  // Red arm bottom (right -> left)
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  // Left turn
  [7, 0], [6, 0],
];

export const START_TRACK_INDEX: Record<PlayerColor, number> = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39,
};

/** Safe squares on MAIN_TRACK: 4 color starts + 4 star safe tiles */
export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

/** Star-marked non-start safe cells */
export const STAR_ONLY_INDICES = new Set<number>([8, 21, 34, 47]);

/** Colored 5-tile home columns (steps 51..55) leading into Home Finish (step 56) */
export const HOME_COLUMNS: Record<PlayerColor, [number, number][]> = {
  red: [
    [7, 1], [7, 2], [7, 3], [7, 4], [7, 5],
  ],
  green: [
    [1, 7], [2, 7], [3, 7], [4, 7], [5, 7],
  ],
  yellow: [
    [7, 13], [7, 12], [7, 11], [7, 10], [7, 9],
  ],
  blue: [
    [13, 7], [12, 7], [11, 7], [10, 7], [9, 7],
  ],
};

/** Yard resting coordinates (row, col) for each token index 0..3 when step === -1 */
export const YARD_SLOTS: Record<PlayerColor, [number, number][]> = {
  red: [
    [1.8, 1.8], [1.8, 3.6], [3.6, 1.8], [3.6, 3.6],
  ],
  green: [
    [1.8, 10.4], [1.8, 12.2], [3.6, 10.4], [3.6, 12.2],
  ],
  yellow: [
    [10.4, 10.4], [10.4, 12.2], [12.2, 10.4], [12.2, 12.2],
  ],
  blue: [
    [10.4, 1.8], [10.4, 3.6], [12.2, 1.8], [12.2, 3.6],
  ],
};

/** Center triangle finish resting coordinates (step === 56) */
export const HOME_FINISH_POS: Record<PlayerColor, [number, number]> = {
  red: [7, 6.25],
  green: [6.25, 7],
  yellow: [7, 7.75],
  blue: [7.75, 7],
};

export function createInitialTokens(_mode: GameMode, _activeColors: PlayerColor[]): TokenPositions {
  return {
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1],
  };
}

/**
 * Converts a player's relative token step (-1..56) to global MAIN_TRACK index (0..51),
 * or null if token is in yard (-1), home column (51..55), or finished (56).
 */
export function getGlobalTrackIndex(color: PlayerColor, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (START_TRACK_INDEX[color] + step) % 52;
}

/**
 * Converts a player's token step to exact [row, col] center coordinates on the 15x15 board.
 */
export function getTokenBoardCoord(
  color: PlayerColor,
  step: number,
  tokenIndex: number
): [number, number] {
  if (step === -1) {
    return YARD_SLOTS[color][tokenIndex];
  }
  if (step >= 0 && step <= 50) {
    const trackIdx = (START_TRACK_INDEX[color] + step) % 52;
    return MAIN_TRACK[trackIdx];
  }
  if (step >= 51 && step <= 55) {
    return HOME_COLUMNS[color][step - 51];
  }
  return HOME_FINISH_POS[color];
}

/**
 * Returns array of movable token indices (0..3) for a player given a dice roll (1..6).
 */
export function getMovableTokenIndices(
  tokens: TokenPositions,
  color: PlayerColor,
  dice: number
): number[] {
  const playerTokens = tokens[color];
  const movable: number[] = [];

  for (let i = 0; i < 4; i++) {
    const step = playerTokens[i];
    if (step === -1) {
      if (dice === 6) movable.push(i);
    } else if (step < 56 && step + dice <= 56) {
      movable.push(i);
    }
  }
  return movable;
}

/**
 * Smart Pity Timer dice roller:
 * - Preserves standard 1-in-6 fair odds normally (dryRolls < 2 or when all faces are legal).
 * - If a player has 0 legal moves for consecutive turns, gently boosts legal-move odds on dry
 *   turns 3-4 (preferring a 6 when stranded in the yard) and guarantees a legal move by the 5th dry turn.
 */
export function rollDiceWithPity(
  tokens: TokenPositions,
  color: PlayerColor,
  dryRolls = 0
): number {
  const safeDryRolls = Math.max(0, Math.floor(dryRolls));
  const legalFaces: number[] = [];
  for (let d = 1; d <= 6; d++) {
    if (getMovableTokenIndices(tokens, color, d).length > 0) {
      legalFaces.push(d);
    }
  }

  if (legalFaces.length === 0 || legalFaces.length === 6 || safeDryRolls < 2) {
    return Math.floor(Math.random() * 6) + 1;
  }

  const pickLegalFace = (): number => {
    const allUnfinishedInYard = tokens[color].every((s) => s === -1 || s === 56);
    if (allUnfinishedInYard && legalFaces.includes(6)) {
      return 6;
    }
    return legalFaces[Math.floor(Math.random() * legalFaces.length)];
  };

  if (safeDryRolls >= 4) {
    return pickLegalFace();
  }

  const boostChance = safeDryRolls === 3 ? 0.65 : 0.35;
  if (Math.random() < boostChance) {
    return pickLegalFace();
  }

  return Math.floor(Math.random() * 6) + 1;
}

export function updateSeatDryRolls(
  seats: RoomSeat[],
  actorSeat: RoomSeat,
  nextDryRolls: number
): { seats: RoomSeat[]; changed: boolean } {
  let changed = false;
  const clamped = Math.max(0, Math.min(10, Math.floor(nextDryRolls)));
  const updated = seats.map((s) => {
    if (s.uid === actorSeat.uid && s.color === actorSeat.color) {
      const prev = s.dryRolls || 0;
      if (prev !== clamped) {
        changed = true;
        return { ...s, dryRolls: clamped };
      }
    }
    return s;
  });
  return { seats: changed ? updated : seats, changed };
}

export interface MoveOutcome {
  nextTokens: TokenPositions;
  capturedColors: PlayerColor[];
  landedSafe: boolean;
  reachedHome: boolean;
  wonGame: boolean;
  bonusTurn: boolean;
  actionText: string;
}

export function applyTokenMove(
  tokens: TokenPositions,
  color: PlayerColor,
  tokenIndex: number,
  dice: number,
  playerName: string,
  activeColors: PlayerColor[]
): MoveOutcome {
  const nextTokens: TokenPositions = {
    red: [...tokens.red],
    green: [...tokens.green],
    yellow: [...tokens.yellow],
    blue: [...tokens.blue],
  };

  const currentStep = nextTokens[color][tokenIndex];
  const newStep = currentStep === -1 ? 0 : currentStep + dice;
  nextTokens[color][tokenIndex] = newStep;

  const capturedColors: PlayerColor[] = [];
  let landedSafe = false;
  const reachedHome = newStep === 56;

  const globalIdx = getGlobalTrackIndex(color, newStep);
  if (globalIdx !== null) {
    if (SAFE_TRACK_INDICES.has(globalIdx)) {
      landedSafe = true;
    } else {
      for (const oppColor of activeColors) {
        if (oppColor === color) continue;
        for (let t = 0; t < 4; t++) {
          const oppGlobal = getGlobalTrackIndex(oppColor, nextTokens[oppColor][t]);
          if (oppGlobal === globalIdx) {
            nextTokens[oppColor][t] = -1;
            capturedColors.push(oppColor);
          }
        }
      }
    }
  }

  const wonGame = nextTokens[color].every((s) => s === 56);
  const bonusTurn = !wonGame && (dice === 6 || capturedColors.length > 0 || reachedHome);

  let actionText = `${playerName} moved token ${tokenIndex + 1} by ${dice}.`;
  if (currentStep === -1) {
    actionText = `${playerName} deployed a token onto the board!`;
  }
  if (capturedColors.length > 0) {
    actionText = `${playerName} captured ${capturedColors[0].toUpperCase()} and earned a bonus roll!`;
  } else if (reachedHome) {
    actionText = wonGame
      ? `${playerName} brought all four tokens home to claim the Crown!`
      : `${playerName} reached Home Finish and earned a bonus roll!`;
  } else if (landedSafe && currentStep !== -1) {
    actionText = `${playerName} secured a Star Safe square.`;
  }

  return {
    nextTokens,
    capturedColors,
    landedSafe,
    reachedHome,
    wonGame,
    bonusTurn,
    actionText,
  };
}

/**
 * Strategic offline & fill-seat AI move selector supporting Casual, Tactical, and Grandmaster tiers.
 */
export function chooseAiTokenMove(
  tokens: TokenPositions,
  color: PlayerColor,
  dice: number,
  activeColors: PlayerColor[],
  difficulty: AiDifficulty = 'tactical'
): number {
  const movable = getMovableTokenIndices(tokens, color, dice);
  if (movable.length <= 1) return movable[0] ?? -1;

  if (difficulty === 'casual') {
    return movable[Math.floor(Math.random() * movable.length)];
  }

  let bestIndex = movable[0];
  let bestScore = -Infinity;

  for (const idx of movable) {
    const curStep = tokens[color][idx];
    const nextStep = curStep === -1 ? 0 : curStep + dice;
    let score = 0;

    // 1. Exact Home Finish is top priority
    if (nextStep === 56) score += 120;

    // 2. Entering Home Column protects token permanently
    if (curStep <= 50 && nextStep >= 51) score += 75;

    // 3. Capturing an opponent token
    const nextGlobal = getGlobalTrackIndex(color, nextStep);
    if (nextGlobal !== null && !SAFE_TRACK_INDICES.has(nextGlobal)) {
      for (const opp of activeColors) {
        if (opp === color) continue;
        for (let t = 0; t < 4; t++) {
          if (getGlobalTrackIndex(opp, tokens[opp][t]) === nextGlobal) {
            score += difficulty === 'grandmaster' ? 115 : 90;
          }
        }
      }
    }

    // 4. Deploying from yard on 6
    if (curStep === -1) score += 65;

    // 5. Landing on a safe star square
    if (nextGlobal !== null && SAFE_TRACK_INDICES.has(nextGlobal)) {
      score += 48;
    }

    // 6. Grandmaster danger evaluation: avoid landing 1..6 tiles ahead of an opponent
    if (difficulty === 'grandmaster' && nextGlobal !== null && !SAFE_TRACK_INDICES.has(nextGlobal)) {
      let threatCount = 0;
      for (const opp of activeColors) {
        if (opp === color) continue;
        for (let t = 0; t < 4; t++) {
          const oppGlobal = getGlobalTrackIndex(opp, tokens[opp][t]);
          if (oppGlobal === null) continue;
          const dist = (nextGlobal - oppGlobal + 52) % 52;
          if (dist >= 1 && dist <= 6) threatCount++;
        }
      }
      score -= threatCount * 28;
    }

    // 7. Escape danger if currently exposed
    const curGlobal = getGlobalTrackIndex(color, curStep);
    if (curGlobal !== null && !SAFE_TRACK_INDICES.has(curGlobal)) {
      for (const opp of activeColors) {
        if (opp === color) continue;
        for (let t = 0; t < 4; t++) {
          const oppGlobal = getGlobalTrackIndex(opp, tokens[opp][t]);
          if (oppGlobal === null) continue;
          const dist = (curGlobal - oppGlobal + 52) % 52;
          if (dist >= 1 && dist <= 6) score += 26;
        }
      }
    }

    // 8. Slight preference to advance leading tokens
    score += nextStep * 0.45 + Math.random() * 4;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = idx;
    }
  }

  return bestIndex;
}

export function formatOrdinalRank(rank: number): string {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

export function isColorFinished(tokens: TokenPositions, color: PlayerColor): boolean {
  return tokens[color].every((s) => s === 56);
}

export function isSeatFinished(seat: RoomSeat, tokens: TokenPositions): boolean {
  return typeof seat.finishRank === 'number' || isColorFinished(tokens, seat.color);
}

export function computeSeatProgressScore(tokens: TokenPositions, color: PlayerColor): number {
  let finishedCount = 0;
  let stepSum = 0;
  for (const step of tokens[color]) {
    if (step === 56) {
      finishedCount += 1;
      stepSum += 57;
    } else if (step >= 0) {
      stepSum += step + 1;
    }
  }
  return finishedCount * 1000 + stepSum;
}

/**
 * Finds the next seat index after `fromIndex` that has not yet finished all 4 tokens.
 */
export function findNextActiveTurnIndex(
  seats: RoomSeat[],
  tokens: TokenPositions,
  fromIndex: number
): number {
  if (seats.length === 0) return 0;
  for (let offset = 1; offset <= seats.length; offset++) {
    const idx = (fromIndex + offset) % seats.length;
    if (!isSeatFinished(seats[idx], tokens)) {
      return idx;
    }
  }
  return (fromIndex + 1) % seats.length;
}

export function buildFinalStandings(
  seats: RoomSeat[],
  tokens: TokenPositions
): FinalStandingEntry[] {
  const sorted = [...seats].sort((a, b) => {
    const aRank = typeof a.finishRank === 'number' ? a.finishRank : Number.POSITIVE_INFINITY;
    const bRank = typeof b.finishRank === 'number' ? b.finishRank : Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    return computeSeatProgressScore(tokens, b.color) - computeSeatProgressScore(tokens, a.color);
  });

  return sorted.map((seat, idx) => ({
    uid: seat.uid,
    name: seat.name,
    avatarId: seat.avatarId,
    avatarFrame: seat.avatarFrame,
    color: seat.color,
    isBot: seat.isBot,
    rank: typeof seat.finishRank === 'number' ? seat.finishRank : idx + 1,
    finishedTokens: tokens[seat.color].filter((s) => s === 56).length,
  }));
}

export interface MultiFinishResolution {
  updatedSeats: RoomSeat[];
  seatsChanged: boolean;
  actorJustFinished: boolean;
  actorFinishRank: number | null;
  matchCompleted: boolean;
  nextTurnIndex: number;
  winnerColor: string;
  winnerUid: string;
  winnerName: string;
  actionText: string;
}

/**
 * Resolves multi-player podium finishes so the match continues until all real (non-bot)
 * players complete it (or only 1 active seat remains on the board).
 */
export function resolveSeatFinishState(params: {
  seats: RoomSeat[];
  nextTokens: TokenPositions;
  actorSeat: RoomSeat;
  actorDisplayName: string;
  turnIndex: number;
  bonusTurn: boolean;
  baseActionText: string;
  existingWinnerColor: string;
  existingWinnerUid: string;
  existingWinnerName?: string;
  actorUsedAutoPlay?: boolean;
}): MultiFinishResolution {
  const {
    seats,
    nextTokens,
    actorSeat,
    actorDisplayName,
    turnIndex,
    bonusTurn,
    baseActionText,
    existingWinnerColor,
    existingWinnerUid,
    existingWinnerName,
    actorUsedAutoPlay = false,
  } = params;

  const actorJustFinished =
    typeof actorSeat.finishRank !== 'number' && isColorFinished(nextTokens, actorSeat.color);

  let nextRank =
    seats.reduce(
      (max, s) => (typeof s.finishRank === 'number' && s.finishRank > max ? s.finishRank : max),
      0
    ) + 1;

  let actorFinishRank: number | null =
    typeof actorSeat.finishRank === 'number' ? actorSeat.finishRank : null;

  let updatedSeats = seats.map((s) => {
    if (actorJustFinished && s.uid === actorSeat.uid && s.color === actorSeat.color) {
      actorFinishRank = nextRank;
      nextRank += 1;
      const finishedViaAutoPlay =
        !s.isBot &&
        Boolean(s.completedWithAutoPlay || s.autoPlay || s.forfeited || actorUsedAutoPlay);
      return {
        ...s,
        finishRank: actorFinishRank,
        completedWithAutoPlay: finishedViaAutoPlay,
        away: false,
        autoPlay: false,
        dryRolls: 0,
      };
    }
    return s;
  });

  const remainingSeats = updatedSeats.filter((s) => !isSeatFinished(s, nextTokens));
  const remainingHumans = remainingSeats.filter((s) => !s.isBot && !s.forfeited);
  const matchCompleted = remainingSeats.length <= 1 || remainingHumans.length === 0;

  if (matchCompleted && remainingSeats.length > 0) {
    // Assign final ranks to remaining unfinished seats (non-forfeited ordered by progress first, forfeited last)
    const orderedRemaining = [...remainingSeats].sort((a, b) => {
      const aForf = a.forfeited ? 1 : 0;
      const bForf = b.forfeited ? 1 : 0;
      if (aForf !== bForf) return aForf - bForf;
      return (
        computeSeatProgressScore(nextTokens, b.color) -
        computeSeatProgressScore(nextTokens, a.color)
      );
    });
    const assignedRankMap = new Map<string, number>();
    for (const s of orderedRemaining) {
      assignedRankMap.set(`${s.uid}:${s.color}`, nextRank);
      nextRank += 1;
    }
    updatedSeats = updatedSeats.map((s) => {
      const assigned = assignedRankMap.get(`${s.uid}:${s.color}`);
      if (assigned !== undefined) {
        const finishedViaAutoPlay =
          !s.isBot && Boolean(s.completedWithAutoPlay || s.autoPlay || s.away || s.forfeited);
        return {
          ...s,
          finishRank: assigned,
          completedWithAutoPlay: finishedViaAutoPlay,
          away: false,
          autoPlay: false,
          dryRolls: 0,
        };
      }
      return s;
    });
  }

  const seatsChanged = updatedSeats.some((s, idx) => s !== seats[idx]);

  const firstPlaceSeat =
    updatedSeats.find((s) => s.finishRank === 1) ||
    (actorJustFinished && actorFinishRank === 1 ? actorSeat : undefined);

  const winnerColor = existingWinnerColor || firstPlaceSeat?.color || '';
  const winnerUid = existingWinnerUid || firstPlaceSeat?.uid || '';
  const winnerName = existingWinnerName || firstPlaceSeat?.name || '';

  const nextTurnIndex = matchCompleted
    ? turnIndex
    : bonusTurn && !actorJustFinished
      ? turnIndex
      : findNextActiveTurnIndex(updatedSeats, nextTokens, turnIndex);

  let actionText = baseActionText;
  if (actorJustFinished && actorFinishRank !== null) {
    const rankLabel = formatOrdinalRank(actorFinishRank);
    if (matchCompleted) {
      actionText =
        actorFinishRank === 1
          ? `${actorDisplayName} claimed 1st place and won the match!`
          : `${actorDisplayName} finished ${rankLabel} — match complete!`;
    } else if (actorFinishRank === 1) {
      actionText = `${actorDisplayName} finished 1st to claim the Crown! Match continues for remaining players.`;
    } else {
      actionText = `${actorDisplayName} finished ${rankLabel}! Match continues for remaining players.`;
    }
  }

  return {
    updatedSeats,
    seatsChanged,
    actorJustFinished,
    actorFinishRank,
    matchCompleted,
    nextTurnIndex,
    winnerColor,
    winnerUid,
    winnerName,
    actionText,
  };
}

