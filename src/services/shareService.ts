import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { GameMode, MatchSummary } from '../types';

export const PLAY_STORE_URL =
  (import.meta.env.VITE_PLAY_STORE_URL as string | undefined)?.trim() ||
  'https://play.google.com/store/apps/details?id=com.ludocrown.game';

export const DEEP_LINK_BASE_URL = (
  (import.meta.env.VITE_DEEP_LINK_BASE_URL as string | undefined)?.trim() ||
  'https://gen-lang-client-0829075952.web.app'
).replace(/\/+$/, '');

export function buildRoomDeepLinkUrl(roomCode: string): string {
  const clean = roomCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  return `${DEEP_LINK_BASE_URL}/join/${clean}`;
}

export function extractRoomCodeFromUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  // Match /join/XXXXXX or ludocrown://join/XXXXXX or ludocrown://room/XXXXXX
  const pathMatch = rawUrl.match(/(?:\/|\/\/)(?:join|room)\/([A-Za-z0-9]{6})(?:[/?#]|$)/i);
  if (pathMatch?.[1]) {
    return pathMatch[1].toUpperCase();
  }

  // Match query params ?room=XXXXXX, ?join=XXXXXX, ?code=XXXXXX
  try {
    const parsed = new URL(rawUrl);
    const param =
      parsed.searchParams.get('room') ||
      parsed.searchParams.get('join') ||
      parsed.searchParams.get('code');
    if (param) {
      const cleaned = param.trim().toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(cleaned)) {
        return cleaned;
      }
    }
  } catch {
    // ignore malformed URLs
  }

  return null;
}

export function listenForIncomingDeepLinks(onRoomCode: (code: string) => void): () => void {
  let active = true;

  const handleUrl = (url?: string | null) => {
    if (!active || !url) return;
    const code = extractRoomCodeFromUrl(url);
    if (code) {
      onRoomCode(code);
    }
  };

  // 1. Check current web browser URL (e.g. /join/K7M4P2 or ?room=K7M4P2)
  if (typeof window !== 'undefined' && window.location?.href) {
    const webCode = extractRoomCodeFromUrl(window.location.href);
    if (webCode) {
      handleUrl(window.location.href);
      // Clean URL without reloading so page refreshes don't re-trigger old joins
      try {
        window.history.replaceState({}, document.title, '/');
      } catch {
        // ignore history API errors in restricted iframes
      }
    }
  }

  // 2. Native Android / iOS deep link handling (cold launch + warm resume)
  let removeNativeListener: (() => void) | null = null;
  if (Capacitor.isNativePlatform()) {
    CapacitorApp.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) handleUrl(launch.url);
      })
      .catch(() => {});

    CapacitorApp.addListener('appUrlOpen', (event) => {
      handleUrl(event?.url);
    })
      .then((handle) => {
        if (!active) {
          handle.remove().catch(() => {});
        } else {
          removeNativeListener = () => {
            handle.remove().catch(() => {});
          };
        }
      })
      .catch(() => {});
  }

  return () => {
    active = false;
    if (removeNativeListener) removeNativeListener();
  };
}

export function buildRoomInviteShareText(opts: {
  roomCode: string;
  hostName: string;
  maxPlayers: 2 | 4;
  mode: GameMode;
}): string {
  const modeLabel = opts.mode === 'quick' ? 'Quick' : 'Classic';
  const joinUrl = buildRoomDeepLinkUrl(opts.roomCode);
  return [
    `🎲 ${opts.hostName} invited you to a ${opts.maxPlayers}P ${modeLabel} Ludo Crown match!`,
    '',
    `👉 Tap to join directly:`,
    joinUrl,
    '',
    `🔑 Room Code: ${opts.roomCode}`,
    `📲 Get Ludo Crown on Google Play: ${PLAY_STORE_URL}`,
  ].join('\n');
}

export function buildPostMatchShareText(opts: {
  summary: MatchSummary;
  playerName: string;
  isPassAndPlay?: boolean;
  roomCode?: string;
}): string {
  const { summary, playerName, isPassAndPlay, roomCode } = opts;
  const headline = isPassAndPlay
    ? `👑 ${summary.winnerName} won our Ludo Crown Pass & Play match in ${summary.turnsPlayed} turns!`
    : summary.won
      ? `👑 ${playerName} just won a Ludo Crown match in ${summary.turnsPlayed} turns (${summary.capturesByPlayer} captures)!`
      : `🎲 Great Ludo Crown battle (${summary.turnsPlayed} turns) — think you can beat me next round?`;

  const lines = [headline];
  if (roomCode) {
    lines.push(`Join my next table: ${buildRoomDeepLinkUrl(roomCode)}`);
  }
  lines.push('', 'Play Ludo Crown on Google Play:', PLAY_STORE_URL);
  return lines.join('\n');
}

export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function shareInviteOrResult(opts: {
  title: string;
  text: string;
  dialogTitle?: string;
}): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        title: opts.title,
        text: opts.text,
        dialogTitle: opts.dialogTitle || opts.title,
      });
      return 'shared';
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      if (msg.includes('cancel') || msg.includes('dismiss')) {
        return 'cancelled';
      }
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: opts.title,
        text: opts.text,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard?.writeText(opts.text);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}
