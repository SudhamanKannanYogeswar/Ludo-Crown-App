import React, { useMemo } from 'react';
import { getBoardThemeById, PLAYER_COLOR_META } from '../data/catalog';
import {
  ALL_COLORS,
  getTokenBoardCoord,
  HOME_COLUMNS,
  MAIN_TRACK,
  STAR_ONLY_INDICES,
  START_TRACK_INDEX,
  YARD_SLOTS,
} from '../game/ludoEngine';
import { PlayerColor, TokenPositions } from '../types';

interface LudoBoardProps {
  tokens: TokenPositions;
  activeColors: PlayerColor[];
  currentTurnColor: PlayerColor;
  movableTokenIndices: number[];
  canInteract: boolean;
  boardThemeId: string;
  onSelectToken: (tokenIndex: number) => void;
}

interface RenderedToken {
  color: PlayerColor;
  tokenIndex: number;
  step: number;
  row: number;
  col: number;
  isMovable: boolean;
}

export function LudoBoard({
  tokens,
  activeColors,
  currentTurnColor,
  movableTokenIndices,
  canInteract,
  boardThemeId,
  onSelectToken,
}: LudoBoardProps) {
  const theme = getBoardThemeById(boardThemeId);

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

  // Group overlapping tokens on the same cell so they fan out legibly
  const positionedTokens = useMemo(() => {
    const list: RenderedToken[] = [];
    for (const color of activeColors) {
      for (let i = 0; i < 4; i++) {
        const step = tokens[color][i];
        const [row, col] = getTokenBoardCoord(color, step, i);
        const isMovable =
          canInteract && color === currentTurnColor && movableTokenIndices.includes(i);
        list.push({ color, tokenIndex: i, step, row, col, isMovable });
      }
    }

    const groups = new Map<string, RenderedToken[]>();
    for (const item of list) {
      const key = `${item.row.toFixed(2)},${item.col.toFixed(2)}`;
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
        let scale = 1;
        if (count === 2) {
          offsetX = idx === 0 ? -0.18 : 0.18;
          scale = 0.88;
        } else if (count === 3) {
          const offsets = [
            [0, -0.18],
            [-0.2, 0.16],
            [0.2, 0.16],
          ];
          offsetX = offsets[idx][0];
          offsetY = offsets[idx][1];
          scale = 0.82;
        } else if (count >= 4) {
          const offsets = [
            [-0.18, -0.18],
            [0.18, -0.18],
            [-0.18, 0.18],
            [0.18, 0.18],
          ];
          const pair = offsets[idx % 4];
          offsetX = pair[0];
          offsetY = pair[1];
          scale = 0.78;
        }
        result.push({ ...item, offsetX, offsetY, scale });
      });
    });

    // Sort movable tokens to render on top for effortless touch selection
    result.sort((a, b) => Number(a.isMovable) - Number(b.isMovable));
    return result;
  }, [tokens, activeColors, canInteract, currentTurnColor, movableTokenIndices]);

  // 15x15 coordinate space: each cell is 40x40 units -> total viewBox 600x600
  const CELL = 40;

  const renderYard = (color: PlayerColor, originRow: number, originCol: number) => {
    const meta = PLAYER_COLOR_META[color];
    const isActiveTurn = currentTurnColor === color;
    const isPresent = activeColors.includes(color);
    const x = originCol * CELL;
    const y = originRow * CELL;
    const size = 6 * CELL;

    return (
      <g key={`yard-${color}`} opacity={isPresent ? 1 : 0.45}>
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          fill={meta.fill}
          stroke={theme.frameBg}
          strokeWidth={2}
        />
        {/* Active turn crisp inner gold rim */}
        {isActiveTurn && (
          <rect
            x={x + 4}
            y={y + 4}
            width={size - 8}
            height={size - 8}
            fill="none"
            stroke="#F6D37B"
            strokeWidth={3}
            rx={6}
          />
        )}
        {/* Inner cream courtyard */}
        <rect
          x={x + 30}
          y={y + 30}
          width={size - 60}
          height={size - 60}
          rx={14}
          fill={theme.tileBg}
          stroke={meta.dark}
          strokeWidth={2}
        />
        {/* 4 recessed token cradles */}
        {YARD_SLOTS[color].map(([r, c], idx) => (
          <circle
            key={`cradle-${color}-${idx}`}
            cx={(c + 0.5) * CELL}
            cy={(r + 0.5) * CELL}
            r={16}
            fill={meta.light}
            stroke={meta.fill}
            strokeWidth={2}
          />
        ))}
      </g>
    );
  };

  return (
    <div
      className="relative w-full max-w-[580px] aspect-square mx-auto rounded-2xl p-2.5 sm:p-3.5 shadow-2xl shadow-black/45 border border-[#D4A446]/30 select-none"
      style={{ backgroundColor: theme.frameBg }}
    >
      <svg
        viewBox="0 0 600 600"
        className="w-full h-full rounded-xl overflow-hidden block"
        role="img"
        aria-label="Ludo Crown 15 by 15 game board"
      >
        {/* Base board background */}
        <rect x={0} y={0} width={600} height={600} fill={theme.tileBg} />

        {/* Render Track and Home Column Tiles */}
        {Array.from({ length: 15 }).map((_, row) =>
          Array.from({ length: 15 }).map((__, col) => {
            // Skip 4 corner yards (6x6) and center finish (3x3)
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

            return (
              <g key={key}>
                <rect
                  x={cx}
                  y={cy}
                  width={CELL}
                  height={CELL}
                  fill={fill}
                  stroke={theme.tileBorder}
                  strokeWidth={1.2}
                />
                {/* Start square star marker */}
                {trackInfo?.startColor && (
                  <path
                    d={`M ${cx + 20} ${cy + 9} L ${cx + 23.2} ${cy + 16.2} L ${cx + 31} ${cy + 17} L ${cx + 25} ${cy + 22.2} L ${cx + 26.8} ${cy + 30} L ${cx + 20} ${cy + 25.8} L ${cx + 13.2} ${cy + 30} L ${cx + 15} ${cy + 22.2} L ${cx + 9} ${cy + 17} L ${cx + 16.8} ${cy + 16.2} Z`}
                    fill="#FFFFFF"
                    opacity={0.92}
                  />
                )}
                {/* Neutral star safe square */}
                {trackInfo?.isStar && (
                  <path
                    d={`M ${cx + 20} ${cy + 9} L ${cx + 23.2} ${cy + 16.2} L ${cx + 31} ${cy + 17} L ${cx + 25} ${cy + 22.2} L ${cx + 26.8} ${cy + 30} L ${cx + 20} ${cy + 25.8} L ${cx + 13.2} ${cy + 30} L ${cx + 15} ${cy + 22.2} L ${cx + 9} ${cy + 17} L ${cx + 16.8} ${cy + 16.2} Z`}
                    fill="#B08734"
                    opacity={0.85}
                  />
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
          <polygon points="240,240 240,360 300,300" fill={PLAYER_COLOR_META.red.fill} stroke={theme.frameBg} strokeWidth={1.5} />
          <polygon points="240,240 360,240 300,300" fill={PLAYER_COLOR_META.green.fill} stroke={theme.frameBg} strokeWidth={1.5} />
          <polygon points="360,240 360,360 300,300" fill={PLAYER_COLOR_META.yellow.fill} stroke={theme.frameBg} strokeWidth={1.5} />
          <polygon points="240,360 360,360 300,300" fill={PLAYER_COLOR_META.blue.fill} stroke={theme.frameBg} strokeWidth={1.5} />
          {/* Subtle brass center medallion */}
          <circle cx={300} cy={300} r={17} fill={theme.centerBg} stroke="#E5B95C" strokeWidth={2.2} />
          <path
            d="M 292 304 L 294 294 L 300 299 L 306 294 L 308 304 Z"
            fill="#E5B95C"
          />
        </g>

        {/* Render Game Tokens with Smooth CSS Transform Transitions */}
        {positionedTokens.map((token) => {
          const meta = PLAYER_COLOR_META[token.color];
          const x = (token.col + 0.5 + token.offsetX) * CELL;
          const y = (token.row + 0.5 + token.offsetY) * CELL;

          return (
            <g
              key={`${token.color}-${token.tokenIndex}`}
              style={{
                transform: `translate(${x}px, ${y}px) scale(${token.scale})`,
                transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                cursor: token.isMovable ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (token.isMovable) onSelectToken(token.tokenIndex);
              }}
              role={token.isMovable ? 'button' : undefined}
              tabIndex={token.isMovable ? 0 : undefined}
              aria-label={`${meta.label} token ${token.tokenIndex + 1}${token.isMovable ? ' (movable)' : ''}`}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (token.isMovable && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onSelectToken(token.tokenIndex);
                }
              }}
            >
              {/* Generous invisible hit area for mobile thumbs */}
              {token.isMovable && <circle cx={0} cy={0} r={24} fill="transparent" />}

              {/* Highlight halo when legal move */}
              {token.isMovable && (
                <circle
                  cx={0}
                  cy={0}
                  r={18}
                  fill="none"
                  stroke="#F7D77C"
                  strokeWidth={3.2}
                  className="animate-token-ready"
                />
              )}

              {/* Drop shadow */}
              <ellipse cx={0} cy={5} rx={12.5} ry={9} fill="rgba(0,0,0,0.32)" />

              {/* Enamel Pawn Base */}
              <circle
                cx={0}
                cy={0}
                r={13}
                fill={meta.fill}
                stroke="#FFFFFF"
                strokeWidth={2.4}
              />

              {/* Inner brass bevel ring */}
              <circle
                cx={0}
                cy={-1}
                r={7.5}
                fill={meta.dark}
                stroke="#F6E5B8"
                strokeWidth={1.3}
              />

              {/* Gloss specular highlight */}
              <circle cx={-3.5} cy={-4} r={2.5} fill="#FFFFFF" opacity={0.65} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
