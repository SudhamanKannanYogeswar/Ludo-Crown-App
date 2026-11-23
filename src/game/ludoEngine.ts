import { AiDifficulty, GameMode, PlayerColor, TokenPositions } from '../types';

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

export function createInitialTokens(mode: GameMode, activeColors: PlayerColor[]): TokenPositions {
  const base: TokenPositions = {
    red: [-1, -1, -1, -1],
    green: [-1, -1, -1, -1],
    yellow: [-1, -1, -1, -1],
    blue: [-1, -1, -1, -1],
  };

  if (mode === 'quick') {
    for (const color of activeColors) {
      // Quick mode deploys 1 token on the start square and 1 already halfway for crisp 3-minute mobile sessions
      base[color] = [0, -1, -1, -1];
    }
  }
  return base;
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
