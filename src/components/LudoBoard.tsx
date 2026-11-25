import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBoardThemeById, PLAYER_COLOR_META } from '../data/catalog';
import {
  ALL_COLORS,
  getGlobalTrackIndex,
  getTokenBoardCoord,
  HOME_COLUMNS,
  MAIN_TRACK,
  SAFE_TRACK_INDICES,
  STAR_ONLY_INDICES,
  START_TRACK_INDEX,
  YARD_SLOTS,
} from '../game/ludoEngine';
import { tabletopAudio } from '../game/sound';
import { PlayerColor, TokenPositions } from '../types';

interface LudoBoardProps {
  tokens: TokenPositions;
  activeColors: PlayerColor[];
  currentTurnColor: PlayerColor;
  movableTokenIndices: number[];
  canInteract: boolean;
  boardThemeId: string;
  diceValue?: number;
  onSelectToken: (tokenIndex: number) => void;
  onAnimatingChange?: (animating: boolean) => void;
}

interface RenderedToken {
  color: PlayerColor;
  tokenIndex: number;
  step: number;
  row: number;
  col: number;
  hopLift: number;
  scaleBoost: number;
  shakeX: number;
  isRetreating: boolean;
  isAnimating: boolean;
  isMovable: boolean;
}

interface AnimOverride {
  row: number;
  col: number;
  hopLift: number;
  scaleBoost: number;
  shakeX: number;
  isRetreating: boolean;
}

interface TrailState {
  color: PlayerColor;
  points: [number, number][];
}

interface BurstState {
  id: number;
  row: number;
  col: number;
  color: PlayerColor;
}

function cloneTokens(t: TokenPositions): TokenPositions {
  return {
    red: [...t.red],
    green: [...t.green],
    yellow: [...t.yellow],
    blue: [...t.blue],
  };
}

function tokenKey(color: PlayerColor, idx: number) {
  return `${color}-${idx}`;
}

/** Directional entry arrows pointing into each player's 5-tile home column */
const HOME_ENTRY_ARROWS: {
  row: number;
  col: number;
  color: PlayerColor;
  rotation: number;
}[] = [
  { row: 7, col: 0, color: 'red', rotation: 0 }, // points right into Red home lane
  { row: 0, col: 7, color: 'green', rotation: 90 }, // points down into Green home lane
  { row: 7, col: 14, color: 'yellow', rotation: 180 }, // points left into Yellow home lane
  { row: 14, col: 7, color: 'blue', rotation: 270 }, // points up into Blue home lane
];

export function LudoBoard({
  tokens,
  activeColors,
  currentTurnColor,
  movableTokenIndices,
  canInteract,
  boardThemeId,
  diceValue = 0,
  onSelectToken,
  onAnimatingChange,
}: LudoBoardProps) {
  const theme = getBoardThemeById(boardThemeId);
  const CELL = 40;

  const [hoveredTokenIdx, setHoveredTokenIdx] = useState<number | null>(null);
  const [animOverrides, setAnimOverrides] = useState<Record<string, AnimOverride>>({});
  const [retreatTrail, setRetreatTrail] = useState<TrailState | null>(null);
  const [captureBurst, setCaptureBurst] = useState<BurstState | null>(null);
  const [stepRipple, setStepRipple] = useState<BurstState | null>(null);

  const prevTokensRef = useRef<TokenPositions>(cloneTokens(tokens));
  const animRunIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onAnimChangeRef = useRef(onAnimatingChange);
  onAnimChangeRef.current = onAnimatingChange;

  // Clear hover preview when turn/interaction changes
  useEffect(() => {
    if (!canInteract) {
      setHoveredTokenIdx(null);
    }
  }, [canInteract, currentTurnColor, movableTokenIndices]);

  // Step-by-step forward hop + capture impact + trace-back-to-home animation engine
  useEffect(() => {
    const prev = prevTokensRef.current;
    const next = tokens;

    const movers: { color: PlayerColor; idx: number; from: number; to: number }[] = [];
    const captured: { color: PlayerColor; idx: number; from: number }[] = [];
    let totalChanged = 0;

    for (const color of ALL_COLORS) {
      for (let i = 0; i < 4; i++) {
        const oldStep = prev[color][i];
        const newStep = next[color][i];
        if (oldStep !== newStep) {
          totalChanged++;
          if (newStep > oldStep) {
            movers.push({ color, idx: i, from: oldStep, to: newStep });
          } else if (oldStep >= 0 && newStep === -1) {
            captured.push({ color, idx: i, from: oldStep });
          }
        }
      }
    }

    prevTokensRef.current = cloneTokens(next);

    // Reduced motion check or bulk match reset -> snap immediately
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (
      totalChanged === 0 ||
      totalChanged > 4 ||
      movers.length !== 1 ||
      prefersReduced
    ) {
      animRunIdRef.current++;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setAnimOverrides({});
      setRetreatTrail(null);
      setCaptureBurst(null);
      setStepRipple(null);
      onAnimChangeRef.current?.(false);
      return;
    }

    const runId = ++animRunIdRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const isCancelled = () => animRunIdRef.current !== runId;

    const animateFrameLoop = (
      durationMs: number,
      onProgress: (t: number) => void
    ): Promise<void> =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          if (isCancelled()) {
            resolve();
            return;
          }
          const t = Math.min(1, (now - start) / Math.max(1, durationMs));
          onProgress(t);
          if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
          } else {
            resolve();
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

    const waitMs = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    const runSequence = async () => {
      onAnimChangeRef.current?.(true);
      const mover = movers[0];
      const moverKey = tokenKey(mover.color, mover.idx);

      // Freeze captured pawns visually at their collision tile until the attacker arrives
      const frozenCaptured: Record<string, AnimOverride> = {};
      for (const cap of captured) {
        const [r, c] = getTokenBoardCoord(cap.color, cap.from, cap.idx);
        frozenCaptured[tokenKey(cap.color, cap.idx)] = {
          row: r,
          col: c,
          hopLift: 0,
          scaleBoost: 1,
          shakeX: 0,
          isRetreating: false,
        };
      }

      // Build forward hop waypoints box-by-box
      const forwardCoords: [number, number][] = [];
      if (mover.from === -1 && mover.to === 0) {
        forwardCoords.push(YARD_SLOTS[mover.color][mover.idx]);
        forwardCoords.push(getTokenBoardCoord(mover.color, 0, mover.idx));
      } else {
        for (let s = mover.from; s <= mover.to; s++) {
          forwardCoords.push(getTokenBoardCoord(mover.color, s, mover.idx));
        }
      }

      // Phase 1: Hop box by box with parabolic arc + landing tap sound + tile ripple
      const isDeployment = mover.from === -1 && mover.to === 0;
      const hopDuration = isDeployment ? 230 : 122;
      const peakLift = isDeployment ? 22 : 14.5;

      for (let seg = 0; seg < forwardCoords.length - 1; seg++) {
        if (isCancelled()) return;
        const [r0, c0] = forwardCoords[seg];
        const [r1, c1] = forwardCoords[seg + 1];

        await animateFrameLoop(hopDuration, (t) => {
          // Smooth ease-out horizontal glide + crisp parabolic vertical hop arc
          const eased = 1 - Math.pow(1 - t, 2);
          const row = r0 + (r1 - r0) * eased;
          const col = c0 + (c1 - c0) * eased;
          const hopLift = Math.sin(t * Math.PI) * peakLift;
          const scaleBoost = 1 + Math.sin(t * Math.PI) * 0.14;

          setAnimOverrides({
            ...frozenCaptured,
            [moverKey]: {
              row,
              col,
              hopLift,
              scaleBoost,
              shakeX: 0,
              isRetreating: false,
            },
          });
        });

        if (isCancelled()) return;
        tabletopAudio.playHopStep(seg);
        setStepRipple({
          id: performance.now() + seg,
          row: r1,
          col: c1,
          color: mover.color,
        });
      }

      // Phase 2: If opponent piece(s) were captured, impact burst + trace backward box-by-box to home yard!
      if (captured.length > 0 && !isCancelled()) {
        const [impactRow, impactCol] = forwardCoords[forwardCoords.length - 1];
        tabletopAudio.playCapture();
        setCaptureBurst({
          id: performance.now(),
          row: impactRow,
          col: impactCol,
          color: mover.color,
        });

        // Impact wobble on captured pawn before retreat begins
        await animateFrameLoop(160, (t) => {
          const shake = Math.sin(t * Math.PI * 5) * 4.5 * (1 - t);
          const nextMap: Record<string, AnimOverride> = {};
          for (const cap of captured) {
            const [r, c] = getTokenBoardCoord(cap.color, cap.from, cap.idx);
            nextMap[tokenKey(cap.color, cap.idx)] = {
              row: r,
              col: c,
              hopLift: Math.sin(t * Math.PI) * 6,
              scaleBoost: 1.08,
              shakeX: shake,
              isRetreating: true,
            };
          }
          setAnimOverrides(nextMap);
        });

        // Trace each captured piece backwards along its own path all the way home to its yard cradle
        for (const cap of captured) {
          if (isCancelled()) return;
          const capKey = tokenKey(cap.color, cap.idx);
          const retreatCoords: [number, number][] = [];
          for (let s = cap.from; s >= 0; s--) {
            retreatCoords.push(getTokenBoardCoord(cap.color, s, cap.idx));
          }
          retreatCoords.push(YARD_SLOTS[cap.color][cap.idx]);

          const totalSegments = Math.max(1, retreatCoords.length - 1);
          // Clamp total retreat time to ~0.45s - 1.15s so even long 45-tile retreats feel thrilling & brisk
          const stepMs = Math.max(20, Math.min(54, 1020 / totalSegments));
          const visited: [number, number][] = [retreatCoords[0]];

          for (let seg = 0; seg < retreatCoords.length - 1; seg++) {
            if (isCancelled()) return;
            const [r0, c0] = retreatCoords[seg];
            const [r1, c1] = retreatCoords[seg + 1];
            const isFinalYardJump = seg === retreatCoords.length - 2;
            const segMs = isFinalYardJump ? 185 : stepMs;
            const segLift = isFinalYardJump ? 18 : 7.5;

            if (seg % Math.max(1, Math.floor(totalSegments / 12)) === 0) {
              tabletopAudio.playRetreatTick(seg / totalSegments);
            }

            await animateFrameLoop(segMs, (t) => {
              const row = r0 + (r1 - r0) * t;
              const col = c0 + (c1 - c0) * t;
              const hopLift = Math.sin(t * Math.PI) * segLift;
              setAnimOverrides({
                [capKey]: {
                  row,
                  col,
                  hopLift,
                  scaleBoost: isFinalYardJump ? 1 - t * 0.08 : 0.94,
                  shakeX: 0,
                  isRetreating: true,
                },
              });
            });

            visited.push([r1, c1]);
            // Keep a crisp trailing tail behind the retreating pawn
            setRetreatTrail({
              color: cap.color,
              points: visited.slice(-14),
            });
          }

          // Flash yard socket ripple when captured pawn returns home
          if (!isCancelled()) {
            const [yr, yc] = YARD_SLOTS[cap.color][cap.idx];
            setStepRipple({
              id: performance.now() + 99,
              row: yr,
              col: yc,
              color: cap.color,
            });
            await waitMs(130);
          }
        }
      }

      if (!isCancelled()) {
        setAnimOverrides({});
        setRetreatTrail(null);
        setCaptureBurst(null);
        onAnimChangeRef.current?.(false);
      }
    };

    runSequence();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tokens]);

  // Build tile cell lookup for the 15x15 grid
  const trackMap = useMemo(() => {
    const map = new Map<string, { trackIdx: number; startColor?: PlayerColor; isStar: boolean }>();
    MAIN_TRACK.forEach(([r, c], idx) => {
      let startColor: PlayerColor | undefined;
      for (const color of ALL_COLORS) {
        if (START_TRACK_INDEX[color] === idx) startColor = color;
      }
      map.set(`${r},${c}`, {
        trackIdx: idx,
        startColor,
        isStar: STAR_ONLY_INDICES.has(idx),
      });
    });
    return map;
  }, []);

  const homeColMap = useMemo(() => {
    const map = new Map<string, PlayerColor>();
    for (const color of ALL_COLORS) {
      HOME_COLUMNS[color].forEach(([r, c]) => {
        map.set(`${r},${c}`, color);
      });
    }
    return map;
  }, []);

  // Compute interactive hover path preview for the currently hovered movable pawn
  const previewPath = useMemo(() => {
    if (
      !canInteract ||
      hoveredTokenIdx === null ||
      !movableTokenIndices.includes(hoveredTokenIdx) ||
      diceValue < 1
    ) {
      return null;
    }
    const curStep = tokens[currentTurnColor][hoveredTokenIdx];
    const targetStep = curStep === -1 ? 0 : curStep + diceValue;
    if (targetStep > 56) return null;

    const coords: [number, number][] = [];
    if (curStep === -1) {
      coords.push(getTokenBoardCoord(currentTurnColor, 0, hoveredTokenIdx));
    } else {
      for (let s = curStep + 1; s <= targetStep; s++) {
        coords.push(getTokenBoardCoord(currentTurnColor, s, hoveredTokenIdx));
      }
    }

    // Check if landing here captures an opponent
    let willCapture = false;
    const destGlobal = getGlobalTrackIndex(currentTurnColor, targetStep);
    if (destGlobal !== null && !SAFE_TRACK_INDICES.has(destGlobal)) {
      for (const opp of activeColors) {
        if (opp === currentTurnColor) continue;
        for (let t = 0; t < 4; t++) {
          if (getGlobalTrackIndex(opp, tokens[opp][t]) === destGlobal) {
            willCapture = true;
          }
        }
      }
    }

    return {
      coords,
      dest: coords[coords.length - 1],
      willCapture,
    };
  }, [canInteract, hoveredTokenIdx, movableTokenIndices, diceValue, tokens, currentTurnColor, activeColors]);

  // Group overlapping stationary tokens on the same cell so they fan out cleanly
  const positionedTokens = useMemo(() => {
    const list: RenderedToken[] = [];
    for (const color of activeColors) {
      for (let i = 0; i < 4; i++) {
        const key = tokenKey(color, i);
        const override = animOverrides[key];
        const step = tokens[color][i];
        const [baseRow, baseCol] = getTokenBoardCoord(color, step, i);
        const isMovable =
          canInteract &&
          Object.keys(animOverrides).length === 0 &&
          color === currentTurnColor &&
          movableTokenIndices.includes(i);

        list.push({
          color,
          tokenIndex: i,
          step,
          row: override ? override.row : baseRow,
          col: override ? override.col : baseCol,
          hopLift: override ? override.hopLift : 0,
          scaleBoost: override ? override.scaleBoost : 1,
          shakeX: override ? override.shakeX : 0,
          isRetreating: Boolean(override?.isRetreating),
          isAnimating: Boolean(override),
          isMovable,
        });
      }
    }

    const groups = new Map<string, RenderedToken[]>();
    for (const item of list) {
      // Animating pieces float independently without crowding stationary groups
      const key = item.isAnimating
        ? `anim-${item.color}-${item.tokenIndex}`
        : `${item.row.toFixed(2)},${item.col.toFixed(2)}`;
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    }

    const result: (RenderedToken & { offsetX: number; offsetY: number; scale: number })[] = [];
    groups.forEach((group) => {
      const count = group.length;
      group.forEach((item, idx) => {
        let offsetX = 0;
        let offsetY = 0;
        let scale = item.step === 56 ? 0.78 : 1;
        if (count === 2) {
          offsetX = idx === 0 ? -0.22 : 0.22;
          offsetY = idx === 0 ? -0.05 : 0.08;
          scale = item.step === 56 ? 0.68 : 0.86;
        } else if (count === 3) {
          const offsets = [
            [0, -0.2],
            [-0.22, 0.14],
            [0.22, 0.14],
          ];
          offsetX = offsets[idx][0];
          offsetY = offsets[idx][1];
          scale = 0.78;
        } else if (count >= 4) {
          const offsets = [
            [-0.21, -0.18],
            [0.21, -0.18],
            [-0.21, 0.18],
            [0.21, 0.18],
          ];
          const pair = offsets[idx % 4];
          offsetX = pair[0];
          offsetY = pair[1];
          scale = 0.74;
        }
        result.push({ ...item, offsetX, offsetY, scale });
      });
    });

    // Draw back-to-front by Y coordinate so sculpted standing pawns overlap with authentic 3D depth;
    // keep animating & movable pawns clearly on top
    result.sort((a, b) => {
      if (a.isAnimating !== b.isAnimating) return Number(a.isAnimating) - Number(b.isAnimating);
      if (a.isMovable !== b.isMovable) return Number(a.isMovable) - Number(b.isMovable);
      return a.row + a.offsetY - (b.row + b.offsetY);
    });
    return result;
  }, [tokens, activeColors, animOverrides, canInteract, currentTurnColor, movableTokenIndices]);

  const renderYard = (color: PlayerColor, originRow: number, originCol: number) => {
    const meta = PLAYER_COLOR_META[color];
    const isActiveTurn = currentTurnColor === color;
    const isPresent = activeColors.includes(color);
    const x = originCol * CELL;
    const y = originRow * CELL;
    const size = 6 * CELL;

    return (
      <g key={`yard-${color}`} opacity={isPresent ? 1 : 0.42}>
        {/* Colored lacquered outer yard base */}
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill={`url(#yard-grad-${color})`}
          stroke={theme.frameBg}
          strokeWidth={2}
        />

        {/* Delicate inlaid hairline corner border */}
        <rect
          x={x + 8}
          y={y + 8}
          width={size - 16}
          height={size - 16}
          rx={12}
          fill="none"
          stroke={isActiveTurn ? '#F3D17A' : 'rgba(255,253,245,0.28)'}
          strokeWidth={isActiveTurn ? 3.2 : 1.2}
        />

        {/* Subtle warm glow pulse inside the active player's yard */}
        {isActiveTurn && (
          <rect
            x={x + 11}
            y={y + 11}
            width={size - 22}
            height={size - 22}
            rx={10}
            fill="none"
            stroke="#FFF4CC"
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
        )}

        {/* Inner ivory courtyard recessed panel */}
        <rect
          x={x + 28}
          y={y + 28}
          width={size - 56}
          height={size - 56}
          rx={16}
          fill={theme.tileBg}
          stroke={meta.dark}
          strokeWidth={2.2}
        />
        <rect
          x={x + 33}
          y={y + 33}
          width={size - 66}
          height={size - 66}
          rx={12}
          fill="none"
          stroke={meta.fill}
          strokeOpacity={0.22}
          strokeWidth={1}
        />

        {/* 4 recessed circular pawn cradles with inner rim shadow */}
        {YARD_SLOTS[color].map(([r, c], idx) => {
          const cx = (c + 0.5) * CELL;
          const cy = (r + 0.5) * CELL;
          return (
            <g key={`cradle-${color}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={17.5}
                fill={meta.light}
                stroke={meta.fill}
                strokeWidth={2.2}
              />
              <circle
                cx={cx}
                cy={cy}
                r={12.5}
                fill="none"
                stroke={meta.dark}
                strokeOpacity={0.22}
                strokeWidth={1.2}
              />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div
      className="relative w-full h-full aspect-square mx-auto rounded-2xl p-2 sm:p-3 shadow-[0_22px_50px_rgba(0,0,0,0.62)] border-2 border-[#C89F4F]/45 select-none"
      style={{
        background: `linear-gradient(145deg, ${theme.frameBg} 0%, #0C1713 100%)`,
      }}
    >
      {/* 4 subtle antique brass frame studs */}
      <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#D9B05B]/75" />
      <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D9B05B]/75" />
      <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-[#D9B05B]/75" />
      <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#D9B05B]/75" />

      <svg
        viewBox="0 0 600 600"
        className="w-full h-full rounded-xl overflow-hidden block shadow-inner"
        role="img"
        aria-label="Ludo Crown 15 by 15 game board"
      >
        <defs>
          {/* Rich lacquered gradients for the 4 Ludo faction yards & pawns */}
          {ALL_COLORS.map((c) => {
            const meta = PLAYER_COLOR_META[c];
            return (
              <React.Fragment key={`defs-${c}`}>
                <linearGradient id={`yard-grad-${c}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={meta.fill} />
                  <stop offset="100%" stopColor={meta.dark} />
                </linearGradient>
                <linearGradient id={`pawn-body-${c}`} x1="0.15" y1="0" x2="0.9" y2="1">
                  <stop offset="0%" stopColor={meta.ring} />
                  <stop offset="45%" stopColor={meta.fill} />
                  <stop offset="100%" stopColor={meta.dark} />
                </linearGradient>
                <radialGradient id={`pawn-head-${c}`} cx="35%" cy="30%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                  <stop offset="28%" stopColor={meta.ring} />
                  <stop offset="68%" stopColor={meta.fill} />
                  <stop offset="100%" stopColor={meta.dark} />
                </radialGradient>
              </React.Fragment>
            );
          })}
          <radialGradient id="center-medallion" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#3B3122" />
            <stop offset="100%" stopColor={theme.centerBg} />
          </radialGradient>
        </defs>

        {/* Base warm parchment board surface */}
        <rect x={0} y={0} width={600} height={600} fill={theme.tileBg} />

        {/* Render 15x15 Track and Colored Home Column Tiles */}
        {Array.from({ length: 15 }).map((_, row) =>
          Array.from({ length: 15 }).map((__, col) => {
            const inTop = row < 6;
            const inBottom = row > 8;
            const inLeft = col < 6;
            const inRight = col > 8;
            if ((inTop || inBottom) && (inLeft || inRight)) return null;
            if (row >= 6 && row <= 8 && col >= 6 && col <= 8) return null;

            const key = `${row},${col}`;
            const trackInfo = trackMap.get(key);
            const homeColor = homeColMap.get(key);

            let fill = theme.tileBg;
            if (homeColor) {
              fill = PLAYER_COLOR_META[homeColor].fill;
            } else if (trackInfo?.startColor) {
              fill = PLAYER_COLOR_META[trackInfo.startColor].fill;
            } else if (trackInfo?.isStar) {
              fill = theme.safeBg;
            }

            const cx = col * CELL;
            const cy = row * CELL;
            const entryArrow = HOME_ENTRY_ARROWS.find((a) => a.row === row && a.col === col);

            return (
              <g key={key}>
                <rect
                  x={cx}
                  y={cy}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                  stroke={theme.tileBorder}
                  strokeWidth={1.15}
                />
                {/* Subtle tactile tile top inner highlight */}
                <line
                  x1={cx + 1.5}
                  y1={cy + 1.5}
                  x2={cx + CELL - 1.5}
                  y2={cy + 1.5}
                  stroke={homeColor || trackInfo?.startColor ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.6)'}
                  strokeWidth={1}
                />

                {/* Start square star emblem */}
                {trackInfo?.startColor && (
                  <g>
                    <circle
                      cx={cx + 20}
                      cy={cy + 20}
                      r={13}
                      fill="none"
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth={1.2}
                    />
                    <path
                      d={`M ${cx + 20} ${cy + 9.5} L ${cx + 23.1} ${cy + 16.4} L ${cx + 30.6} ${cy + 17.2} L ${cx + 24.9} ${cy + 22.1} L ${cx + 26.6} ${cy + 29.6} L ${cx + 20} ${cy + 25.6} L ${cx + 13.4} ${cy + 29.6} L ${cx + 15.1} ${cy + 22.1} L ${cx + 9.4} ${cy + 17.2} L ${cx + 16.9} ${cy + 16.4} Z`}
                      fill="#FFFDF7"
                      opacity={0.94}
                    />
                  </g>
                )}

                {/* Neutral Star Safe Square */}
                {trackInfo?.isStar && (
                  <g>
                    <circle
                      cx={cx + 20}
                      cy={cy + 20}
                      r={13}
                      fill="none"
                      stroke="#B88E38"
                      strokeOpacity={0.35}
                      strokeWidth={1.2}
                    />
                    <path
                      d={`M ${cx + 20} ${cy + 9.5} L ${cx + 23.1} ${cy + 16.4} L ${cx + 30.6} ${cy + 17.2} L ${cx + 24.9} ${cy + 22.1} L ${cx + 26.6} ${cy + 29.6} L ${cx + 20} ${cy + 25.6} L ${cx + 13.4} ${cy + 29.6} L ${cx + 15.1} ${cy + 22.1} L ${cx + 9.4} ${cy + 17.2} L ${cx + 16.9} ${cy + 16.4} Z`}
                      fill="#B5892E"
                      opacity={0.9}
                    />
                  </g>
                )}

                {/* Directional Home-Lane Entry Arrow */}
                {entryArrow && (
                  <g transform={`translate(${cx + 20}, ${cy + 20}) rotate(${entryArrow.rotation})`}>
                    <path
                      d="M -8 -6 L 4 0 L -8 6 L -4 0 Z"
                      fill={PLAYER_COLOR_META[entryArrow.color].fill}
                      opacity={0.85}
                    />
                  </g>
                )}
              </g>
            );
          })
        )}

        {/* Four Corner Yards */}
        {renderYard('red', 0, 0)}
        {renderYard('green', 0, 9)}
        {renderYard('yellow', 9, 9)}
        {renderYard('blue', 9, 0)}

        {/* Center Home Finish Triangles (rows 6..8, cols 6..8 -> x:240..360, y:240..360) */}
        <g>
          <polygon
            points="240,240 240,360 300,300"
            fill="url(#yard-grad-red)"
            stroke={theme.frameBg}
            strokeWidth={1.8}
          />
          <polygon
            points="240,240 360,240 300,300"
            fill="url(#yard-grad-green)"
            stroke={theme.frameBg}
            strokeWidth={1.8}
          />
          <polygon
            points="360,240 360,360 300,300"
            fill="url(#yard-grad-yellow)"
            stroke={theme.frameBg}
            strokeWidth={1.8}
          />
          <polygon
            points="240,360 360,360 300,300"
            fill="url(#yard-grad-blue)"
            stroke={theme.frameBg}
            strokeWidth={1.8}
          />
          {/* Inner inlaid border around finish sanctuary */}
          <rect
            x={240}
            y={240}
            width={120}
            height={120}
            fill="none"
            stroke="#D9B05B"
            strokeOpacity={0.65}
            strokeWidth={2}
          />
          {/* Sculpted Brass Crown Medallion */}
          <circle
            cx={300}
            cy={300}
            r={20}
            fill="url(#center-medallion)"
            stroke="#E5B95C"
            strokeWidth={2.5}
          />
          <circle
            cx={300}
            cy={300}
            r={15.5}
            fill="none"
            stroke="#F6DF9D"
            strokeOpacity={0.45}
            strokeWidth={1}
          />
          <path
            d="M 290.5 305.5 L 292.5 294 L 297.5 299 L 300 292.5 L 302.5 299 L 307.5 294 L 309.5 305.5 Z"
            fill="#EBC46A"
          />
          <rect x={290.5} y={306.5} width={19} height={2.4} rx={1.2} fill="#D49A2A" />
        </g>

        {/* Interactive Hover / Focus Step-by-Step Path & Destination Preview */}
        {previewPath && (
          <g className="pointer-events-none">
            {previewPath.coords.slice(0, -1).map(([r, c], idx) => (
              <circle
                key={`preview-step-${idx}`}
                cx={(c + 0.5) * CELL}
                cy={(r + 0.5) * CELL}
                r={5.5}
                fill={previewPath.willCapture ? '#EF4444' : '#EAB957'}
                fillOpacity={0.8}
                stroke="#1F1302"
                strokeWidth={1.2}
              />
            ))}
            {previewPath.dest && (
              <g
                transform={`translate(${(previewPath.dest[1] + 0.5) * CELL}, ${(previewPath.dest[0] + 0.5) * CELL})`}
              >
                <circle
                  cx={0}
                  cy={0}
                  r={15}
                  fill={previewPath.willCapture ? 'rgba(220,38,38,0.22)' : 'rgba(234,185,87,0.24)'}
                  stroke={previewPath.willCapture ? '#EF4444' : '#EAB957'}
                  strokeWidth={2.6}
                  strokeDasharray="5 3"
                  className="animate-token-ready"
                />
                <circle
                  cx={0}
                  cy={0}
                  r={4.5}
                  fill={previewPath.willCapture ? '#EF4444' : '#F5D27B'}
                />
              </g>
            )}
          </g>
        )}

        {/* Capture Retreat Trace Path (glowing trail behind captured piece returning to yard) */}
        {retreatTrail && retreatTrail.points.length > 1 && (
          <g className="pointer-events-none">
            <polyline
              points={retreatTrail.points
                .map(([r, c]) => `${(c + 0.5) * CELL},${(r + 0.5) * CELL}`)
                .join(' ')}
              fill="none"
              stroke={PLAYER_COLOR_META[retreatTrail.color].ring}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="6 8"
              opacity={0.78}
            />
            {retreatTrail.points.map(([r, c], idx) => {
              const alpha = ((idx + 1) / retreatTrail.points.length) * 0.85;
              return (
                <circle
                  key={`trail-dot-${idx}`}
                  cx={(c + 0.5) * CELL}
                  cy={(r + 0.5) * CELL}
                  r={3.5 + (idx / retreatTrail.points.length) * 3}
                  fill={PLAYER_COLOR_META[retreatTrail.color].ring}
                  opacity={alpha}
                />
              );
            })}
          </g>
        )}

        {/* Subtle Tile Landing Ripple on each Hop */}
        {stepRipple && (
          <g
            key={`ripple-${stepRipple.id}`}
            transform={`translate(${(stepRipple.col + 0.5) * CELL}, ${(stepRipple.row + 0.5) * CELL})`}
            className="pointer-events-none"
          >
            <circle
              cx={0}
              cy={0}
              r={13}
              fill="none"
              stroke={PLAYER_COLOR_META[stepRipple.color].ring}
              strokeWidth={2.8}
              className="animate-tile-ripple"
            />
          </g>
        )}

        {/* Capture Impact Shockwave Burst */}
        {captureBurst && (
          <g
            key={`burst-${captureBurst.id}`}
            transform={`translate(${(captureBurst.col + 0.5) * CELL}, ${(captureBurst.row + 0.5) * CELL})`}
            className="pointer-events-none"
          >
            <g className="animate-capture-burst">
              <circle
                cx={0}
                cy={0}
                r={15}
                fill="rgba(245,190,72,0.35)"
                stroke="#FDE68A"
                strokeWidth={3.5}
              />
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <line
                  key={deg}
                  x1={0}
                  y1={-12}
                  x2={0}
                  y2={-22}
                  stroke="#FFF7D6"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  transform={`rotate(${deg})`}
                />
              ))}
            </g>
          </g>
        )}

        {/* Sculpted 3D Classic Ludo Pawn Pieces */}
        {positionedTokens.map((token) => {
          const meta = PLAYER_COLOR_META[token.color];
          const x = (token.col + 0.5 + token.offsetX) * CELL + token.shakeX;
          const y = (token.row + 0.5 + token.offsetY) * CELL;
          const shadowScale = Math.max(0.55, 1 - token.hopLift / 48);
          const shadowOpacity = Math.max(0.14, 0.38 - token.hopLift / 65);
          const finalScale = token.scale * token.scaleBoost;

          return (
            <g
              key={tokenKey(token.color, token.tokenIndex)}
              transform={`translate(${x}, ${y}) scale(${finalScale})`}
              style={{
                cursor: token.isMovable ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (token.isMovable) {
                  setHoveredTokenIdx(null);
                  onSelectToken(token.tokenIndex);
                }
              }}
              onMouseEnter={() => {
                if (token.isMovable) setHoveredTokenIdx(token.tokenIndex);
              }}
              onMouseLeave={() => {
                if (hoveredTokenIdx === token.tokenIndex) setHoveredTokenIdx(null);
              }}
              onFocus={() => {
                if (token.isMovable) setHoveredTokenIdx(token.tokenIndex);
              }}
              onBlur={() => {
                if (hoveredTokenIdx === token.tokenIndex) setHoveredTokenIdx(null);
              }}
              role={token.isMovable ? 'button' : undefined}
              tabIndex={token.isMovable ? 0 : undefined}
              aria-label={`${meta.label} pawn ${token.tokenIndex + 1}${token.isMovable ? ' (tap to move)' : ''}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (token.isMovable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setHoveredTokenIdx(null);
                  onSelectToken(token.tokenIndex);
                }
              }}
            >
              {/* Generous invisible thumb touch hit target */}
              {token.isMovable && <circle cx={0} cy={-4} r={25} fill="transparent" />}

              {/* Animated golden targeting ring on tile beneath movable pawns */}
              {token.isMovable && (
                <g transform="translate(0, 5)">
                  <ellipse
                    cx={0}
                    cy={0}
                    rx={17}
                    ry={11}
                    fill="rgba(234, 185, 87, 0.22)"
                    stroke="#F5D073"
                    strokeWidth={2.6}
                    className="animate-token-ready"
                  />
                </g>
              )}

              {/* Grounded elliptical drop shadow (shrinks dynamically as pawn hops into the air!) */}
              <ellipse
                cx={0}
                cy={7}
                rx={12.5 * shadowScale}
                ry={5.6 * shadowScale}
                fill={`rgba(10, 8, 6, ${shadowOpacity.toFixed(2)})`}
              />

              {/* Sculpted 3D Pawn Silhouette (lifts vertically along parabolic arc during hops) */}
              <g transform={`translate(0, ${-token.hopLift})`}>
                <g className={token.isMovable ? 'animate-pawn-ready' : undefined}>
                  {/* Outer bright ivory silhouette halo so matching-color squares NEVER hide the piece */}
                  <ellipse
                    cx={0}
                    cy={4.2}
                    rx={12.4}
                    ry={5.2}
                    fill="#FFFDF7"
                    stroke="#1D1610"
                    strokeWidth={1.3}
                  />

                  {/* Pedestal base */}
                  <ellipse
                    cx={0}
                    cy={3.2}
                    rx={10.8}
                    ry={4.2}
                    fill={meta.dark}
                    stroke="#FFFDF7"
                    strokeWidth={1}
                  />

                  {/* Tapered sculpted pawn body */}
                  <path
                    d="M -9.8 2.6 C -8.6 -4.5 -5.8 -8.8 -4.4 -12.6 L 4.4 -12.6 C 5.8 -8.8 8.6 -4.5 9.8 2.6 C 6.2 5.4 -6.2 5.4 -9.8 2.6 Z"
                    fill={`url(#pawn-body-${token.color})`}
                    stroke="#FFFDF7"
                    strokeWidth={1.65}
                    strokeLinejoin="round"
                  />

                  {/* Left vertical specular sheen on torso */}
                  <path
                    d="M -6.2 1.2 C -5.5 -3.6 -3.8 -7.4 -2.8 -10.5"
                    fill="none"
                    stroke="rgba(255,255,255,0.48)"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                  />

                  {/* Classic antique-ivory collar ring */}
                  <ellipse
                    cx={0}
                    cy={-11.2}
                    rx={5.8}
                    ry={2.1}
                    fill="#FAF3DF"
                    stroke={meta.dark}
                    strokeWidth={0.9}
                  />

                  {/* Glossy spherical pawn head */}
                  <circle
                    cx={0}
                    cy={-17.2}
                    r={6.9}
                    fill={`url(#pawn-head-${token.color})`}
                    stroke="#FFFDF7"
                    strokeWidth={1.7}
                  />

                  {/* Crisp specular highlight glint */}
                  <ellipse
                    cx={-2.3}
                    cy={-19.5}
                    rx={2.1}
                    ry={1.3}
                    transform="rotate(-28 -2.3 -19.5)"
                    fill="#FFFFFF"
                    opacity={0.85}
                  />

                  {/* Retreat dizzy/alert indicator ring when knocked back to home */}
                  {token.isRetreating && (
                    <circle
                      cx={0}
                      cy={-17.2}
                      r={9.5}
                      fill="none"
                      stroke="#FDE68A"
                      strokeWidth={1.8}
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
