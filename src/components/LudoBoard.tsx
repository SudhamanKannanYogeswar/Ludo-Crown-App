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
  myColor?: PlayerColor | null;
  playerNames?: Partial<Record<PlayerColor, string>>;
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
  kind?: 'capture' | 'home' | 'ripple';
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
  { row: 7, col: 0, color: 'red', rotation: 0 },
  { row: 0, col: 7, color: 'green', rotation: 90 },
  { row: 7, col: 14, color: 'yellow', rotation: 180 },
  { row: 14, col: 7, color: 'blue', rotation: 270 },
];

export function LudoBoard({
  tokens,
  activeColors,
  currentTurnColor,
  myColor = null,
  playerNames,
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

  const tokensRef = useRef<TokenPositions>(tokens);
  tokensRef.current = tokens;
  const prevTokensRef = useRef<TokenPositions>(cloneTokens(tokens));
  const animRunIdRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onAnimChangeRef = useRef(onAnimatingChange);
  onAnimChangeRef.current = onAnimatingChange;

  const tokensSignature = useMemo(
    () => ALL_COLORS.map((c) => tokens[c].join(',')).join('|'),
    [tokens]
  );

  useEffect(() => {
    if (!canInteract) {
      setHoveredTokenIdx(null);
    }
  }, [canInteract, currentTurnColor, movableTokenIndices]);

  // Cancel any stray RAF only when the board component unmounts
  useEffect(() => {
    return () => {
      animRunIdRef.current++;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Step-by-step readable forward hop + capture impact + trace-back-to-home animation engine
  // Keyed strictly on tokensSignature so Firestore ack snapshots with unchanged positions never kill an active hop!
  useEffect(() => {
    const prev = prevTokensRef.current;
    const next = tokensRef.current;

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

    // If nothing actually moved, never interrupt an in-progress hop!
    if (totalChanged === 0) {
      return;
    }

    if (totalChanged > 4 || movers.length !== 1) {
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

      const forwardCoords: [number, number][] = [];
      if (mover.from === -1 && mover.to === 0) {
        forwardCoords.push(YARD_SLOTS[mover.color][mover.idx]);
        forwardCoords.push(getTokenBoardCoord(mover.color, 0, mover.idx));
      } else {
        for (let s = mover.from; s <= mover.to; s++) {
          forwardCoords.push(getTokenBoardCoord(mover.color, s, mover.idx));
        }
      }

      // Phase 1: Crisp, buoyant square-by-square hop so every single tile jump is unmistakable
      const isDeployment = mover.from === -1 && mover.to === 0;
      const hopDuration = isDeployment ? 320 : 195;
      const peakLift = isDeployment ? 30 : 20;

      for (let seg = 0; seg < forwardCoords.length - 1; seg++) {
        if (isCancelled()) return;
        const [r0, c0] = forwardCoords[seg];
        const [r1, c1] = forwardCoords[seg + 1];

        await animateFrameLoop(hopDuration, (t) => {
          const eased = 1 - Math.pow(1 - t, 2);
          const row = r0 + (r1 - r0) * eased;
          const col = c0 + (c1 - c0) * eased;
          const hopLift = Math.sin(t * Math.PI) * peakLift;
          const scaleBoost = 1 + Math.sin(t * Math.PI) * 0.22;

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
          kind: 'ripple',
        });
      }

      // Celebratory star burst when reaching Home Finish (step 56)
      if (mover.to === 56 && !isCancelled()) {
        const [hr, hc] = forwardCoords[forwardCoords.length - 1];
        setCaptureBurst({
          id: performance.now(),
          row: hr,
          col: hc,
          color: mover.color,
          kind: 'home',
        });
        await waitMs(440);
      }

      // Phase 2: Capture impact burst + trace backward box-by-box to home yard
      if (captured.length > 0 && !isCancelled()) {
        const [impactRow, impactCol] = forwardCoords[forwardCoords.length - 1];
        tabletopAudio.playCapture();
        setCaptureBurst({
          id: performance.now(),
          row: impactRow,
          col: impactCol,
          color: mover.color,
          kind: 'capture',
        });

        await animateFrameLoop(210, (t) => {
          const shake = Math.sin(t * Math.PI * 6) * 5 * (1 - t);
          const nextMap: Record<string, AnimOverride> = {};
          for (const cap of captured) {
            const [r, c] = getTokenBoardCoord(cap.color, cap.from, cap.idx);
            nextMap[tokenKey(cap.color, cap.idx)] = {
              row: r,
              col: c,
              hopLift: Math.sin(t * Math.PI) * 7,
              scaleBoost: 1.1,
              shakeX: shake,
              isRetreating: true,
            };
          }
          setAnimOverrides(nextMap);
        });

        for (const cap of captured) {
          if (isCancelled()) return;
          const capKey = tokenKey(cap.color, cap.idx);
          const retreatCoords: [number, number][] = [];
          for (let s = cap.from; s >= 0; s--) {
            retreatCoords.push(getTokenBoardCoord(cap.color, s, cap.idx));
          }
          retreatCoords.push(YARD_SLOTS[cap.color][cap.idx]);

          const totalSegments = Math.max(1, retreatCoords.length - 1);
          const stepMs = Math.max(24, Math.min(60, 1140 / totalSegments));
          const visited: [number, number][] = [retreatCoords[0]];

          for (let seg = 0; seg < retreatCoords.length - 1; seg++) {
            if (isCancelled()) return;
            const [r0, c0] = retreatCoords[seg];
            const [r1, c1] = retreatCoords[seg + 1];
            const isFinalYardJump = seg === retreatCoords.length - 2;
            const segMs = isFinalYardJump ? 220 : stepMs;
            const segLift = isFinalYardJump ? 20 : 8;

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
            setRetreatTrail({
              color: cap.color,
              points: visited.slice(-14),
            });
          }

          if (!isCancelled()) {
            const [yr, yc] = YARD_SLOTS[cap.color][cap.idx];
            setStepRipple({
              id: performance.now() + 99,
              row: yr,
              col: yc,
              color: cap.color,
              kind: 'ripple',
            });
            await waitMs(160);
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
  }, [tokensSignature]);

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
        let scale = item.step === 56 ? 0.8 : 1;
        if (count === 2) {
          offsetX = idx === 0 ? -0.24 : 0.24;
          offsetY = idx === 0 ? -0.05 : 0.08;
          scale = item.step === 56 ? 0.7 : 0.88;
        } else if (count === 3) {
          const offsets = [
            [0, -0.22],
            [-0.24, 0.15],
            [0.24, 0.15],
          ];
          offsetX = offsets[idx][0];
          offsetY = offsets[idx][1];
          scale = 0.8;
        } else if (count >= 4) {
          const offsets = [
            [-0.23, -0.19],
            [0.23, -0.19],
            [-0.23, 0.19],
            [0.23, 0.19],
          ];
          const pair = offsets[idx % 4];
          offsetX = pair[0];
          offsetY = pair[1];
          scale = 0.76;
        }
        result.push({ ...item, offsetX, offsetY, scale });
      });
    });

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
    const isMyYard = myColor === color;
    const x = originCol * CELL;
    const y = originRow * CELL;
    const size = 6 * CELL;
    const yardName = playerNames?.[color];

    return (
      <g key={`yard-${color}`} opacity={isPresent ? 1 : 0.45}>
        {/* Vivid classic solid colored yard base */}
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill={`url(#yard-grad-${color})`}
          stroke={theme.yardStroke}
          strokeWidth={1.8}
        />

        {/* Edition-specific subtle decorative corner motif */}
        {theme.patternStyle === 'palace' && (
          <rect
            x={x + 10}
            y={y + 10}
            width={size - 20}
            height={size - 20}
            rx={14}
            fill="none"
            stroke="#FDE68A"
            strokeOpacity={0.55}
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {theme.patternStyle === 'midnight' && (
          <rect
            x={x + 8}
            y={y + 8}
            width={size - 16}
            height={size - 16}
            rx={14}
            fill="none"
            stroke="#38BDF8"
            strokeOpacity={0.5}
            strokeWidth={2}
          />
        )}
        {theme.patternStyle === 'crystal' && (
          <g opacity={0.4} stroke="#FFFFFF" strokeWidth={1.5} fill="none">
            <polygon points={`${x + 16},${y + 8} ${x + 24},${y + 16} ${x + 16},${y + 24} ${x + 8},${y + 16}`} />
            <polygon points={`${x + size - 16},${y + 8} ${x + size - 8},${y + 16} ${x + size - 16},${y + 24} ${x + size - 24},${y + 16}`} />
          </g>
        )}

        {/* Pulsing golden spotlight border on the active player's corner yard */}
        {isActiveTurn && (
          <g className="animate-yard-pulse">
            <rect
              x={x + 5}
              y={y + 5}
              width={size - 10}
              height={size - 10}
              rx={14}
              fill="none"
              stroke="#FFE44D"
              strokeWidth={6}
            />
            <rect
              x={x + 11}
              y={y + 11}
              width={size - 22}
              height={size - 22}
              rx={10}
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity={0.9}
              strokeWidth={2}
            />
          </g>
        )}

        {/* Crisp player label right along the top edge of the yard */}
        {isPresent && yardName && (
          <text
            x={x + size / 2}
            y={y + 21}
            textAnchor="middle"
            fill={color === 'yellow' ? '#2B1600' : '#FFFFFF'}
            fontSize="12.5"
            fontWeight="800"
            fontFamily="Outfit, system-ui, sans-serif"
            style={{ letterSpacing: '0.02em' }}
          >
            {yardName.length > 13 ? `${yardName.slice(0, 12)}…` : yardName}
          </text>
        )}

        {/* Edition-tinted inner home yard courtyard */}
        <rect
          x={x + 28}
          y={y + 30}
          width={size - 56}
          height={size - 58}
          rx={18}
          fill={theme.yardInnerBg}
          stroke={meta.dark}
          strokeOpacity={0.5}
          strokeWidth={2.2}
        />

        {/* Active Turn Tag tucked on the bottom lip of the active yard */}
        {isActiveTurn && (
          <g transform={`translate(${x + size / 2}, ${y + size - 14})`}>
            <rect
              x={-44}
              y={-9.5}
              width={88}
              height={19}
              rx={9.5}
              fill="#FFE033"
              stroke="#7A4900"
              strokeWidth={1.5}
            />
            <text
              x={0}
              y={4}
              textAnchor="middle"
              fill="#2B1600"
              fontSize="10.5"
              fontWeight="900"
              fontFamily="Outfit, system-ui, sans-serif"
            >
              {isMyYard ? '★ YOUR TURN' : '● PLAYING'}
            </text>
          </g>
        )}

        {/* 4 vivid colored circular token pads inside the courtyard */}
        {YARD_SLOTS[color].map(([r, c], idx) => {
          const cx = (c + 0.5) * CELL;
          const cy = (r + 0.5) * CELL;
          return (
            <g key={`cradle-${color}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={20}
                fill={meta.fill}
                stroke={meta.dark}
                strokeWidth={2}
              />
              <circle
                cx={cx}
                cy={cy}
                r={14}
                fill="none"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth={1.6}
              />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div
      className="relative w-full h-full aspect-square mx-auto rounded-[22px] p-[8px] sm:p-[11px] shadow-[0_18px_48px_rgba(6,18,64,0.52)] select-none transition-all duration-300"
      style={{
        background: theme.outerBezelGradient,
      }}
    >
      <div
        className="w-full h-full rounded-[16px] p-[4px] shadow-inner transition-colors duration-300"
        style={{ backgroundColor: theme.frameBg }}
      >
        <svg
          viewBox="0 0 600 600"
          className="w-full h-full block overflow-visible"
          role="img"
          aria-label={`Ludo Crown 15 by 15 game board — ${theme.name}`}
        >
          <defs>
            <clipPath id="board-rounded-clip">
              <rect x={0} y={0} width={600} height={600} rx={12} ry={12} />
            </clipPath>
            {ALL_COLORS.map((c) => {
              const meta = PLAYER_COLOR_META[c];
              return (
                <React.Fragment key={`defs-${c}`}>
                  <linearGradient id={`yard-grad-${c}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={meta.fill} />
                    <stop offset="100%" stopColor={meta.dark} />
                  </linearGradient>
                  <radialGradient id={`pin-jewel-${c}`} cx="34%" cy="28%" r="70%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.78" />
                    <stop offset="28%" stopColor={meta.ring} />
                    <stop offset="68%" stopColor={meta.fill} />
                    <stop offset="100%" stopColor={meta.dark} />
                  </radialGradient>
                </React.Fragment>
              );
            })}
            <linearGradient id="pin-shell-metal" x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#F1F5F9" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <radialGradient id="center-crown-bg" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor={theme.centerGradientStart} />
              <stop offset="100%" stopColor={theme.centerBg} />
            </radialGradient>
          </defs>

          <g clipPath="url(#board-rounded-clip)">
          {/* Board edition track canvas */}
          <rect x={0} y={0} width={600} height={600} fill={theme.tileBg} />

          {/* 15x15 Track and Colored Home Column Tiles */}
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
                    strokeWidth={1.35}
                  />

                  {/* Start square bright white star badge */}
                  {trackInfo?.startColor && (
                    <g>
                      <circle
                        cx={cx + 20}
                        cy={cy + 20}
                        r={13.5}
                        fill="rgba(255,255,255,0.22)"
                        stroke="rgba(255,255,255,0.75)"
                        strokeWidth={1.5}
                      />
                      <path
                        d={`M ${cx + 20} ${cy + 9.5} L ${cx + 23.1} ${cy + 16.4} L ${cx + 30.6} ${cy + 17.2} L ${cx + 24.9} ${cy + 22.1} L ${cx + 26.6} ${cy + 29.6} L ${cx + 20} ${cy + 25.6} L ${cx + 13.4} ${cy + 29.6} L ${cx + 15.1} ${cy + 22.1} L ${cx + 9.4} ${cy + 17.2} L ${cx + 16.9} ${cy + 16.4} Z`}
                        fill="#FFFFFF"
                      />
                    </g>
                  )}

                  {/* Neutral Safe Star Tile */}
                  {trackInfo?.isStar && (
                    <g>
                      <path
                        d={`M ${cx + 20} ${cy + 8.5} L ${cx + 23.4} ${cy + 16} L ${cx + 31.6} ${cy + 16.9} L ${cx + 25.4} ${cy + 22.4} L ${cx + 27.2} ${cy + 30.5} L ${cx + 20} ${cy + 26.2} L ${cx + 12.8} ${cy + 30.5} L ${cx + 14.6} ${cy + 22.4} L ${cx + 8.4} ${cy + 16.9} L ${cx + 16.6} ${cy + 16} Z`}
                        fill={theme.starFill}
                        stroke={theme.starStroke}
                        strokeWidth={1.4}
                        strokeLinejoin="round"
                      />
                    </g>
                  )}

                  {/* Bold Colored Directional Home-Lane Entry Arrow */}
                  {entryArrow && (
                    <g transform={`translate(${cx + 20}, ${cy + 20}) rotate(${entryArrow.rotation})`}>
                      <path
                        d="M -10 -3.5 L 1 -3.5 L 1 -8.5 L 11 0 L 1 8.5 L 1 3.5 L -10 3.5 Z"
                        fill={PLAYER_COLOR_META[entryArrow.color].fill}
                        stroke={PLAYER_COLOR_META[entryArrow.color].dark}
                        strokeWidth={0.9}
                        strokeLinejoin="round"
                      />
                    </g>
                  )}
                </g>
              );
            })
          )}

          {/* Four Vivid Corner Yards */}
          {renderYard('red', 0, 0)}
          {renderYard('green', 0, 9)}
          {renderYard('yellow', 9, 9)}
          {renderYard('blue', 9, 0)}

          {/* Center Home Finish Sanctuary */}
          <g>
            <polygon
              points="240,240 240,360 300,300"
              fill={PLAYER_COLOR_META.red.fill}
              stroke="#1E293B"
              strokeWidth={1.6}
            />
            <polygon
              points="240,240 360,240 300,300"
              fill={PLAYER_COLOR_META.green.fill}
              stroke="#1E293B"
              strokeWidth={1.6}
            />
            <polygon
              points="360,240 360,360 300,300"
              fill={PLAYER_COLOR_META.yellow.fill}
              stroke="#1E293B"
              strokeWidth={1.6}
            />
            <polygon
              points="240,360 360,360 300,300"
              fill={PLAYER_COLOR_META.blue.fill}
              stroke="#1E293B"
              strokeWidth={1.6}
            />
            <rect
              x={240}
              y={240}
              width={120}
              height={120}
              fill="none"
              stroke="#FFE047"
              strokeWidth={2.4}
            />
            {/* Royal Gold Crown Center Medallion */}
            <circle
              cx={300}
              cy={300}
              r={21}
              fill="url(#center-crown-bg)"
              stroke="#FFE047"
              strokeWidth={3}
            />
            <path
              d="M 289.5 306 L 291.8 293.5 L 297.2 299 L 300 291.5 L 302.8 299 L 308.2 293.5 L 310.5 306 Z"
              fill="#FFE047"
              stroke="#9A5B00"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <rect x={289.5} y={307} width={21} height={2.6} rx={1.3} fill="#FFCA28" />
          </g>
          </g>

          {/* Interactive Hover / Focus Step-by-Step Path & Destination Preview */}
          {previewPath && (
            <g className="pointer-events-none">
              {previewPath.coords.slice(0, -1).map(([r, c], idx) => (
                <circle
                  key={`preview-step-${idx}`}
                  cx={(c + 0.5) * CELL}
                  cy={(r + 0.5) * CELL}
                  r={6}
                  fill={previewPath.willCapture ? '#EF4444' : '#FFB800'}
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                />
              ))}
              {previewPath.dest && (
                <g
                  transform={`translate(${(previewPath.dest[1] + 0.5) * CELL}, ${(previewPath.dest[0] + 0.5) * CELL})`}
                >
                  <circle
                    cx={0}
                    cy={0}
                    r={16}
                    fill={previewPath.willCapture ? 'rgba(239,68,68,0.28)' : 'rgba(255,184,0,0.32)'}
                    stroke={previewPath.willCapture ? '#EF4444' : '#FF9900'}
                    strokeWidth={3}
                    strokeDasharray="5 3"
                    className="animate-token-ready"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={5}
                    fill={previewPath.willCapture ? '#EF4444' : '#FFB800'}
                  />
                </g>
              )}
            </g>
          )}

          {/* Capture Retreat Trace Path */}
          {retreatTrail && retreatTrail.points.length > 1 && (
            <g className="pointer-events-none">
              <polyline
                points={retreatTrail.points
                  .map(([r, c]) => `${(c + 0.5) * CELL},${(r + 0.5) * CELL}`)
                  .join(' ')}
                fill="none"
                stroke={PLAYER_COLOR_META[retreatTrail.color].fill}
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="6 8"
                opacity={0.85}
              />
              {retreatTrail.points.map(([r, c], idx) => {
                const alpha = ((idx + 1) / retreatTrail.points.length) * 0.9;
                return (
                  <circle
                    key={`trail-dot-${idx}`}
                    cx={(c + 0.5) * CELL}
                    cy={(r + 0.5) * CELL}
                    r={3.5 + (idx / retreatTrail.points.length) * 3.5}
                    fill={PLAYER_COLOR_META[retreatTrail.color].ring}
                    opacity={alpha}
                  />
                );
              })}
            </g>
          )}

          {/* Crisp Tile Landing Ripple on each Hop */}
          {stepRipple && (
            <g
              key={`ripple-${stepRipple.id}`}
              transform={`translate(${(stepRipple.col + 0.5) * CELL}, ${(stepRipple.row + 0.5) * CELL})`}
              className="pointer-events-none"
            >
              <circle
                cx={0}
                cy={0}
                r={14}
                fill="none"
                stroke={PLAYER_COLOR_META[stepRipple.color].fill}
                strokeWidth={3.5}
                className="animate-tile-ripple"
              />
            </g>
          )}

          {/* Capture / Home Finish Starburst Shockwave */}
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
                  r={18}
                  fill={captureBurst.kind === 'home' ? 'rgba(43,226,114,0.42)' : 'rgba(255,210,38,0.45)'}
                  stroke="#FFE44D"
                  strokeWidth={4}
                />
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                  <g key={deg} transform={`rotate(${deg})`}>
                    <line
                      x1={0}
                      y1={-12}
                      x2={0}
                      y2={-26}
                      stroke={deg % 90 === 0 ? '#FFE44D' : '#FFFFFF'}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                    <circle cx={0} cy={-29} r={2.8} fill="#FFE44D" />
                  </g>
                ))}
              </g>
            </g>
          )}

          {/* Iconic Glossy Metallic Teardrop Pin Ludo Tokens */}
          {positionedTokens.map((token) => {
            const meta = PLAYER_COLOR_META[token.color];
            const x = (token.col + 0.5 + token.offsetX) * CELL + token.shakeX;
            const y = (token.row + 0.5 + token.offsetY) * CELL;
            const shadowScale = Math.max(0.55, 1 - token.hopLift / 48);
            const shadowOpacity = Math.max(0.16, 0.42 - token.hopLift / 65);
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
                {/* Generous touch target */}
                {token.isMovable && <circle cx={0} cy={-8} r={29} fill="transparent" />}

                {/* Bright pulsing golden ring beneath movable pawns */}
                {token.isMovable && (
                  <g transform="translate(0, 8)">
                    <ellipse
                      cx={0}
                      cy={0}
                      rx={20}
                      ry={13}
                      fill="rgba(255, 212, 38, 0.36)"
                      stroke="#FF9900"
                      strokeWidth={3.4}
                      className="animate-token-ready"
                    />
                  </g>
                )}

                {/* Grounded dark contact shadow */}
                <ellipse
                  cx={0}
                  cy={10.5}
                  rx={14.5 * shadowScale}
                  ry={6.2 * shadowScale}
                  fill={`rgba(12, 20, 45, ${shadowOpacity.toFixed(2)})`}
                />

                {/* Grounded colored concentric base ring */}
                {token.hopLift < 2 && (
                  <ellipse
                    cx={0}
                    cy={8.5}
                    rx={12.2}
                    ry={5.4}
                    fill="none"
                    stroke={meta.dark}
                    strokeWidth={2.4}
                    opacity={0.75}
                  />
                )}

                {/* Larger Glossy Teardrop Map-Pin Token (lifts vertically on hops) */}
                <g transform={`translate(0, ${-token.hopLift})`}>
                  <g className={token.isMovable ? 'animate-pawn-ready' : undefined}>
                    {/* Floating golden downward pointer arrow over movable pawns */}
                    {token.isMovable && (
                      <g transform="translate(0, -40)" className="animate-turn-drop">
                        <path
                          d="M -7 -7 L 7 -7 L 0 2.5 Z"
                          fill="#FFE033"
                          stroke="#8A4B00"
                          strokeWidth={1.8}
                          strokeLinejoin="round"
                        />
                      </g>
                    )}

                    {/* Larger bright metallic pearl-white teardrop silhouette (~22% bigger) */}
                    <path
                      d="M 0 9.5 C -4.8 2.2 -15.6 -6.8 -15.6 -16.4 C -15.6 -25.4 -8.6 -32.2 0 -32.2 C 8.6 -32.2 15.6 -25.4 15.6 -16.4 C 15.6 -6.8 4.8 2.2 0 9.5 Z"
                      fill="url(#pin-shell-metal)"
                      stroke="#111827"
                      strokeWidth={2.3}
                      strokeLinejoin="round"
                    />

                    {/* Crisp inner white highlight rim */}
                    <path
                      d="M 0 5.5 C -3.6 -0.8 -12.6 -8.4 -12.6 -16.4 C -12.6 -23.6 -6.9 -29.2 0 -29.2 C 6.9 -29.2 12.6 -23.6 12.6 -16.4 C 12.6 -8.4 3.6 -0.8 0 5.5 Z"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={1.6}
                    />

                    {/* Larger vivid jewel-colored center orb */}
                    <circle
                      cx={0}
                      cy={-16.6}
                      r={9.8}
                      fill={`url(#pin-jewel-${token.color})`}
                      stroke={meta.dark}
                      strokeWidth={1.8}
                    />

                    {/* Crisp glossy top-left specular gleam */}
                    <ellipse
                      cx={-3.3}
                      cy={-20.1}
                      rx={3.4}
                      ry={2}
                      transform="rotate(-30 -3.3 -20.1)"
                      fill="#FFFFFF"
                      opacity={0.94}
                    />

                    {/* Retreat dizzy ring when captured */}
                    {token.isRetreating && (
                      <circle
                        cx={0}
                        cy={-16.6}
                        r={13.8}
                        fill="none"
                        stroke="#FFE033"
                        strokeWidth={2.5}
                        strokeDasharray="4 3"
                      />
                    )}
                  </g>
                </g>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
