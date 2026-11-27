import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Coins,
  Copy,
  Crown,
  Dices,
  Eye,
  Hand,
  LogOut,
  MessageSquare,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Send,
  Share2,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { isCapacitorNativeApp } from '../firebase';
import {
  BACKDROP_THEMES,
  BOARD_THEMES,
  BOT_ROSTER,
  getBackdropThemeById,
  PLAYER_COLOR_META,
  QUICK_CHAT_EMOTES,
} from '../data/catalog';
import {
  applyTokenMove,
  buildFinalStandings,
  chooseAiTokenMove,
  createInitialTokens,
  findNextActiveTurnIndex,
  formatOrdinalRank,
  getMovableTokenIndices,
  isSeatFinished,
  resolveSeatFinishState,
  rollDiceWithPity,
  updateSeatDryRolls,
} from '../game/ludoEngine';
import { tabletopAudio } from '../game/sound';
import { hasCapacitorAdMobPlugin } from '../services/adMobService';
import {
  buildPostMatchShareText,
  buildRoomInviteShareText,
  buildWhatsAppShareUrl,
  shareInviteOrResult,
} from '../services/shareService';
import { MatchSummary, PlayerColor, RoomSeat, TokenPositions } from '../types';
import { AdaptiveBannerAd } from './AdMobOverlays';
import { DiceControl } from './DiceControl';
import { FriendActionButton } from './FriendActionButton';
import { LudoBoard } from './LudoBoard';
import { PlayerAvatar } from './PlayerAvatar';

interface LocalGameState {
  seats: RoomSeat[];
  tokens: TokenPositions;
  turnIndex: number;
  diceValue: number;
  turnPhase: 'roll' | 'move';
  consecutiveSixes: number;
  status: 'playing' | 'finished';
  winnerColor: PlayerColor | '';
  winnerName: string;
  lastActionText: string;
  turnCount: number;
}

interface BoardBanner {
  id: number;
  title: string;
  subtitle?: string;
  tone: 'start' | 'six' | 'capture' | 'home' | 'turn';
}

interface RemotePlaybackState {
  active: boolean;
  actorColor: PlayerColor;
  actorName: string;
  rolling: boolean;
  diceValue: number;
  statusText: string;
}

type RemoteQueueItem =
  | {
      type: 'roll';
      actorColor: PlayerColor;
      actorName: string;
      rolled: number;
    }
  | {
      type: 'no-move';
      actorColor: PlayerColor;
      actorName: string;
      rolled: number;
      isTripleSix: boolean;
      statusText: string;
    }
  | {
      type: 'move';
      actorColor: PlayerColor;
      actorName: string;
      nextTokens: TokenPositions;
      capturedCount: number;
      reachedHome: boolean;
      statusText: string;
    };

const PUBLIC_MATCH_WAIT_SECONDS = 30;
const ONLINE_TURN_TIMEOUT_SECONDS = 18;
const SEAT_STALE_MS = 22_000;
const ALL_TOKEN_COLORS: PlayerColor[] = ['red', 'green', 'yellow', 'blue'];

function withWriteTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function cloneTokenPositions(t: TokenPositions): TokenPositions {
  return {
    red: [...t.red],
    green: [...t.green],
    yellow: [...t.yellow],
    blue: [...t.blue],
  };
}

function getTokensSig(t: TokenPositions): string {
  return ALL_TOKEN_COLORS.map((c) => t[c].join(',')).join('|');
}

function buildTurnSig(state: {
  tokens: TokenPositions;
  turnIndex: number;
  turnPhase: 'roll' | 'move';
  diceValue: number;
  turnCount: number;
}): string {
  return `${getTokensSig(state.tokens)}#${state.turnIndex}#${state.turnPhase}#${state.diceValue}#${state.turnCount}`;
}

function parseRolledValueFromText(text: string): { rolled: number; isTripleSix: boolean } {
  if (/three\s+6s/i.test(text)) {
    return { rolled: 6, isTripleSix: true };
  }
  const match = text.match(/rolled\s+([1-6])/i);
  if (match) {
    return { rolled: Number(match[1]), isTripleSix: false };
  }
  return { rolled: 1, isTripleSix: false };
}

const CONFETTI_PIECES = [
  { left: '8%', color: '#FFE033', delay: '0s' },
  { left: '18%', color: '#EC1C24', delay: '0.2s' },
  { left: '30%', color: '#00C853', delay: '0.45s' },
  { left: '44%', color: '#38BDF8', delay: '0.1s' },
  { left: '58%', color: '#FFE033', delay: '0.35s' },
  { left: '72%', color: '#FF6B9A', delay: '0.55s' },
  { left: '84%', color: '#00C853', delay: '0.15s' },
  { left: '92%', color: '#38BDF8', delay: '0.4s' },
];

export function MatchArena() {
  const {
    user,
    profile,
    networkOnline,
    reconnecting,
    activeRoomId,
    activeRoom,
    roomMessages,
    offlineMatch,
    soundMuted,
    toggleSoundMuted,
    backdropThemeId,
    setBackdropThemeId,
    cycleBackdropTheme,
    hostStartRoom,
    submitMultiplayerTurn,
    setMySeatAutoPlay,
    sendChat,
    exitActiveRoom,
    forfeitActiveRoom,
    rematchOnlineRoom,
    launchOfflinePractice,
    closeOfflineMatch,
    recordGameplayEvent,
    recordMatchCompletion,
    triggerRewardedAd,
    doubleSummaryCoinsWithAd,
    maybeShowInterstitialAfterMatch,
    setActiveTab,
    showToast,
    friendships,
    inviteFriendToPlay,
    saveCustomization,
    wallet,
  } = useApp();

  const isOnline = Boolean(activeRoom);
  const isPassAndPlay = !isOnline && Boolean(offlineMatch?.passAndPlay);
  const myUid = user?.uid || profile.uid;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const myUidRef = useRef(myUid);
  myUidRef.current = myUid;

  const buildInitialOfflineState = useCallback((): LocalGameState => {
    const currentProfile = profileRef.current;
    const currentMyUid = myUidRef.current;
    const mode = offlineMatch?.mode || 'classic';

    if (offlineMatch?.passAndPlay) {
      const ppCount = offlineMatch.passAndPlay.playerCount;
      const ppColors: PlayerColor[] =
        ppCount === 2
          ? ['red', 'yellow']
          : ppCount === 3
            ? ['red', 'green', 'yellow']
            : ['red', 'green', 'yellow', 'blue'];

      const seats: RoomSeat[] = ppColors.map((color, idx) => {
        const isBotSeat = idx > 0 && Boolean(offlineMatch.passAndPlay?.seatIsBot?.[idx]);
        if (isBotSeat) {
          const bot = BOT_ROSTER[(idx - 1) % BOT_ROSTER.length];
          return {
            uid: `bot_pp_${bot.uid}_${idx}`,
            name: bot.name,
            avatarId: bot.avatarId,
            avatarFrame: bot.avatarFrame,
            color,
            isBot: true,
            elo: bot.elo,
          };
        }
        const customName =
          offlineMatch.passAndPlay!.playerNames[idx]?.trim() ||
          (idx === 0 ? currentProfile.displayName : `Player ${idx + 1}`);
        const avatarId =
          idx === 0
            ? currentProfile.avatarId
            : BOT_ROSTER[(idx - 1) % BOT_ROSTER.length]?.avatarId || currentProfile.avatarId;
        return {
          uid: idx === 0 ? currentMyUid : `local_p${idx + 1}`,
          name: customName,
          avatarId,
          avatarFrame: idx === 0 ? currentProfile.avatarFrame : 'frame_brass',
          color,
          isBot: false,
          elo: currentProfile.elo,
        };
      });

      return {
        seats,
        tokens: createInitialTokens(mode, ppColors),
        turnIndex: 0,
        diceValue: 0,
        turnPhase: 'roll',
        consecutiveSixes: 0,
        status: 'playing',
        winnerColor: '',
        winnerName: '',
        lastActionText: `${seats[0].name}'s turn! Tap ROLL DICE to begin.`,
        turnCount: 0,
      };
    }

    const count = offlineMatch?.playerCount || 4;
    const colors: PlayerColor[] = count === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

    const seats: RoomSeat[] = [
      {
        uid: currentMyUid,
        name: currentProfile.displayName,
        avatarId: currentProfile.avatarId,
        avatarFrame: currentProfile.avatarFrame,
        color: colors[0],
        isBot: false,
        elo: currentProfile.elo,
      },
    ];

    for (let i = 1; i < colors.length; i++) {
      const bot = BOT_ROSTER[(i - 1) % BOT_ROSTER.length];
      const overrideName =
        i === 1 && offlineMatch?.tournamentContext?.opponentName
          ? offlineMatch.tournamentContext.opponentName
          : bot.name;
      seats.push({
        uid: `bot_${bot.uid}_${i}`,
        name: overrideName,
        avatarId: bot.avatarId,
        avatarFrame: bot.avatarFrame,
        color: colors[i],
        isBot: true,
        elo: bot.elo,
      });
    }

    return {
      seats,
      tokens: createInitialTokens(mode, colors),
      turnIndex: 0,
      diceValue: 0,
      turnPhase: 'roll',
      consecutiveSixes: 0,
      status: 'playing',
      winnerColor: '',
      winnerName: '',
      lastActionText: `Your turn! Tap ROLL DICE to begin.`,
      turnCount: 0,
    };
  }, [offlineMatch]);

  const [localGame, setLocalGame] = useState<LocalGameState>(() => buildInitialOfflineState());
  const [onlineDisplayTokens, setOnlineDisplayTokens] = useState<TokenPositions | null>(() =>
    activeRoom ? cloneTokenPositions(activeRoom.tokens) : null
  );
  const [remotePlayback, setRemotePlayback] = useState<RemotePlaybackState>({
    active: false,
    actorColor: 'red',
    actorName: '',
    rolling: false,
    diceValue: 0,
    statusText: '',
  });
  const [rollingAnim, setRollingAnim] = useState(false);
  const [boardAnimating, setBoardAnimating] = useState(false);
  const [holdPause, setHoldPause] = useState(false);
  const [holdDiceOverride, setHoldDiceOverride] = useState<number | null>(null);
  const [holdStatusOverride, setHoldStatusOverride] = useState<string | null>(null);
  const [boardBanner, setBoardBanner] = useState<BoardBanner | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitingUid, setInvitingUid] = useState<string | null>(null);
  const [rerollUsedThisMatch, setRerollUsedThisMatch] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [personalFinishSummary, setPersonalFinishSummary] = useState<MatchSummary | null>(null);
  const [isSpectating, setIsSpectating] = useState(false);
  const [seatReaction, setSeatReaction] = useState<{ color: PlayerColor; text: string } | null>(null);
  const [autoFillSeconds, setAutoFillSeconds] = useState(PUBLIC_MATCH_WAIT_SECONDS);
  const [autoFillPaused, setAutoFillPaused] = useState(false);
  const [guestWaitSeconds, setGuestWaitSeconds] = useState(0);
  const [turnIdleSeconds, setTurnIdleSeconds] = useState(0);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [rematchLoading, setRematchLoading] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktopViewport(e.matches);
    setIsDesktopViewport(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const activeBackdropTheme = getBackdropThemeById(backdropThemeId);

  const handleCycleBackdrop = () => {
    const idx = BACKDROP_THEMES.findIndex((t) => t.id === backdropThemeId);
    const next = BACKDROP_THEMES[(idx + 1) % BACKDROP_THEMES.length];
    cycleBackdropTheme();
    showToast(`Backdrop: ${next.name}`, 'info');
  };

  const playerCapturesRef = useRef(0);
  const playerSixesRef = useRef(0);
  const summaryRecordedRef = useRef(false);
  const finalSummaryShownRef = useRef(false);
  const doubledRewardRef = useRef(false);
  const prevSeatRanksRef = useRef<Record<string, number>>({});
  const autoFillFiredRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastMsgCountRef = useRef(0);
  const prevIsMyTurnRef = useRef(false);
  const prevTurnIndexRef = useRef(-1);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchSessionRef = useRef(0);
  const turnActionLockRef = useRef(false);
  const activeTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const prevRoomMetaRef = useRef<{ id: string | null; status: string | null }>({
    id: null,
    status: null,
  });
  const prevObservedRoomRef = useRef<{
    roomId: string;
    turnIndex: number;
    turnPhase: 'roll' | 'move';
    diceValue: number;
    turnCount: number;
    tokensSig: string;
    tokens: TokenPositions;
  } | null>(null);
  const localSubmittedSigsRef = useRef<Set<string>>(new Set());
  const remoteQueueRef = useRef<RemoteQueueItem[]>([]);
  const remoteProcessingRef = useRef(false);
  const lastRemoteRollRef = useRef(0);
  const boardAnimatingRef = useRef(false);
  const boardAnimIdleResolversRef = useRef<Array<() => void>>([]);
  const latestOnlineTokensRef = useRef<TokenPositions | null>(null);
  latestOnlineTokensRef.current = activeRoom ? activeRoom.tokens : null;

  const handleBoardAnimatingChange = useCallback((animating: boolean) => {
    boardAnimatingRef.current = animating;
    setBoardAnimating(animating);
    if (!animating && boardAnimIdleResolversRef.current.length > 0) {
      const resolvers = boardAnimIdleResolversRef.current.splice(0);
      resolvers.forEach((resolve) => resolve());
    }
  }, []);

  const waitForBoardIdle = useCallback((maxWaitMs: number): Promise<void> => {
    return new Promise((resolve) => {
      if (!boardAnimatingRef.current) {
        resolve();
        return;
      }
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        const idx = boardAnimIdleResolversRef.current.indexOf(done);
        if (idx >= 0) boardAnimIdleResolversRef.current.splice(idx, 1);
        resolve();
      };
      boardAnimIdleResolversRef.current.push(done);
      const timeoutId = setTimeout(done, maxWaitMs);
      activeTimersRef.current.add(timeoutId);
    });
  }, []);

  const clearAllTimers = useCallback(() => {
    activeTimersRef.current.forEach((id) => clearTimeout(id));
    activeTimersRef.current.clear();
    if (boardAnimIdleResolversRef.current.length > 0) {
      const resolvers = boardAnimIdleResolversRef.current.splice(0);
      resolvers.forEach((resolve) => resolve());
    }
  }, []);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      activeTimersRef.current.delete(id);
      fn();
    }, ms);
    activeTimersRef.current.add(id);
    return id;
  }, []);

  const sleepSession = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        scheduleTimer(resolve, ms);
      }),
    [scheduleTimer]
  );

  const flashBanner = useCallback(
    (title: string, tone: BoardBanner['tone'], subtitle?: string, durationMs = 1450) => {
      const id = Date.now() + Math.random();
      setBoardBanner({ id, title, subtitle, tone });
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = setTimeout(() => {
        setBoardBanner((prev) => (prev?.id === id ? null : prev));
      }, durationMs);
    },
    []
  );

  useEffect(() => {
    return () => {
      matchSessionRef.current += 1;
      turnActionLockRef.current = false;
      remoteQueueRef.current = [];
      remoteProcessingRef.current = false;
      clearAllTimers();
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [clearAllTimers]);

  const triggerSeatBubble = useCallback((color: PlayerColor, text: string) => {
    setSeatReaction({ color, text });
    setTimeout(() => {
      setSeatReaction((prev) => (prev && prev.text === text ? null : prev));
    }, 2200);
  }, []);

  // Keep Seat 0 uid synced in offline matches if auth resolves mid-match without resetting progress
  useEffect(() => {
    if (isOnline || !offlineMatch) return;
    setLocalGame((prev) => {
      if (prev.seats.length === 0 || prev.seats[0].isBot || prev.seats[0].uid === myUid) {
        return prev;
      }
      const nextSeats = [...prev.seats];
      nextSeats[0] = { ...nextSeats[0], uid: myUid };
      return { ...prev, seats: nextSeats };
    });
  }, [isOnline, offlineMatch, myUid]);

  useEffect(() => {
    if (!isOnline && offlineMatch) {
      matchSessionRef.current += 1;
      turnActionLockRef.current = false;
      clearAllTimers();
      setLocalGame(buildInitialOfflineState());
      setMatchSummary(null);
      setPersonalFinishSummary(null);
      setIsSpectating(false);
      setRerollUsedThisMatch(false);
      setRollingAnim(false);
      setBoardAnimating(false);
      setHoldPause(false);
      setHoldDiceOverride(null);
      setHoldStatusOverride(null);
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
      finalSummaryShownRef.current = false;
      doubledRewardRef.current = false;
      prevSeatRanksRef.current = {};
      prevIsMyTurnRef.current = false;
      prevTurnIndexRef.current = 0;
      const firstPlayerName = offlineMatch.passAndPlay?.playerNames[0]?.trim() || 'Player 1';
      flashBanner(
        offlineMatch.passAndPlay ? 'PASS & PLAY!' : 'GAME START!',
        'start',
        offlineMatch.passAndPlay
          ? `${firstPlayerName} goes first — Roll the Dice!`
          : 'Your Turn — Roll the Dice!',
        1450
      );
    }
  }, [isOnline, offlineMatch, buildInitialOfflineState, flashBanner, clearAllTimers]);

  useEffect(() => {
    if (!activeRoom?.id) {
      prevRoomMetaRef.current = { id: null, status: null };
      prevObservedRoomRef.current = null;
      remoteQueueRef.current = [];
      remoteProcessingRef.current = false;
      setOnlineDisplayTokens(null);
      setRemotePlayback({
        active: false,
        actorColor: 'red',
        actorName: '',
        rolling: false,
        diceValue: 0,
        statusText: '',
      });
      return;
    }

    const prevMeta = prevRoomMetaRef.current;
    const roomChanged = prevMeta.id !== activeRoom.id;
    const enteredPlayingFromWaiting =
      prevMeta.id === activeRoom.id &&
      prevMeta.status === 'waiting' &&
      activeRoom.status === 'playing';

    prevRoomMetaRef.current = { id: activeRoom.id, status: activeRoom.status };

    // Only reset timers/animations when joining a new room or transitioning waiting -> playing.
    // Never interrupt an active winning hop when status changes playing -> finished!
    if (!roomChanged && !enteredPlayingFromWaiting) {
      return;
    }

    matchSessionRef.current += 1;
    turnActionLockRef.current = false;
    clearAllTimers();
    remoteQueueRef.current = [];
    remoteProcessingRef.current = false;
    localSubmittedSigsRef.current.clear();
    lastRemoteRollRef.current = 0;
    playerCapturesRef.current = 0;
    playerSixesRef.current = 0;
    summaryRecordedRef.current = false;
    finalSummaryShownRef.current = false;
    doubledRewardRef.current = false;
    const initialRanks: Record<string, number> = {};
    for (const s of activeRoom.seats) {
      if (typeof s.finishRank === 'number') {
        initialRanks[`${s.uid}:${s.color}`] = s.finishRank;
      }
    }
    prevSeatRanksRef.current = initialRanks;
    const myRejoinedSeat = activeRoom.seats.find((s) => !s.isBot && s.uid === myUid);
    const rejoinedAlreadyFinished = Boolean(
      myRejoinedSeat &&
        activeRoom.status === 'playing' &&
        isSeatFinished(myRejoinedSeat, activeRoom.tokens)
    );
    autoFillFiredRef.current = false;
    setAutoFillSeconds(PUBLIC_MATCH_WAIT_SECONDS);
    setAutoFillPaused(false);
    setGuestWaitSeconds(0);
    setMatchSummary(null);
    setPersonalFinishSummary(null);
    setIsSpectating(rejoinedAlreadyFinished);
    setUnreadChat(0);
    setRollingAnim(false);
    boardAnimatingRef.current = false;
    setBoardAnimating(false);
    setHoldPause(false);
    setHoldDiceOverride(null);
    setHoldStatusOverride(null);
    setRemotePlayback({
      active: false,
      actorColor: 'red',
      actorName: '',
      rolling: false,
      diceValue: 0,
      statusText: '',
    });
    setOnlineDisplayTokens(cloneTokenPositions(activeRoom.tokens));
    prevObservedRoomRef.current = {
      roomId: activeRoom.id,
      turnIndex: activeRoom.turnIndex,
      turnPhase: activeRoom.turnPhase,
      diceValue: activeRoom.diceValue,
      turnCount: activeRoom.turnCount,
      tokensSig: getTokensSig(activeRoom.tokens),
      tokens: cloneTokenPositions(activeRoom.tokens),
    };
    lastMsgCountRef.current = 0;
    prevIsMyTurnRef.current = false;
    if (activeRoom.status === 'playing') {
      flashBanner(
        rejoinedAlreadyFinished ? 'SPECTATING LIVE' : 'GAME START!',
        'start',
        rejoinedAlreadyFinished
          ? `You finished #${myRejoinedSeat?.finishRank || 1} — watching remaining players`
          : 'Live Multiplayer Table',
        1450
      );
    }
  }, [activeRoom?.id, activeRoom?.status, activeRoom, myUid, flashBanner, clearAllTimers]);

  const drainRemoteQueue = useCallback(async () => {
    if (remoteProcessingRef.current) return;
    remoteProcessingRef.current = true;
    const sessionId = matchSessionRef.current;

    try {
      while (remoteQueueRef.current.length > 0) {
        if (sessionId !== matchSessionRef.current) return;

        // If the board is still finishing an earlier hop, wait smoothly before starting the next remote event
        if (boardAnimatingRef.current) {
          await waitForBoardIdle(2600);
          if (sessionId !== matchSessionRef.current) return;
        }

        const item = remoteQueueRef.current.shift()!;

        if (item.type === 'roll') {
          lastRemoteRollRef.current = item.rolled;
          setRemotePlayback({
            active: true,
            actorColor: item.actorColor,
            actorName: item.actorName,
            rolling: true,
            diceValue: 0,
            statusText: `${item.actorName} is rolling...`,
          });
          tabletopAudio.playDiceRoll();
          await sleepSession(540);
          if (sessionId !== matchSessionRef.current) return;

          setRemotePlayback({
            active: true,
            actorColor: item.actorColor,
            actorName: item.actorName,
            rolling: false,
            diceValue: item.rolled,
            statusText: `${item.actorName} rolled ${item.rolled}!`,
          });

          if (item.rolled === 6) {
            tabletopAudio.playSixFanfare();
            triggerSeatBubble(item.actorColor, 'Rolled a SIX!');
            flashBanner('LUCKY 6!', 'six', `${item.actorName} gets a bonus roll!`, 1100);
          } else {
            triggerSeatBubble(item.actorColor, `Rolled ${item.rolled}!`);
          }

          await sleepSession(item.rolled === 6 ? 420 : 280);
          if (sessionId !== matchSessionRef.current) return;
        } else if (item.type === 'no-move') {
          lastRemoteRollRef.current = item.rolled;
          setRemotePlayback({
            active: true,
            actorColor: item.actorColor,
            actorName: item.actorName,
            rolling: true,
            diceValue: 0,
            statusText: `${item.actorName} is rolling...`,
          });
          tabletopAudio.playDiceRoll();
          await sleepSession(540);
          if (sessionId !== matchSessionRef.current) return;

          setRemotePlayback({
            active: true,
            actorColor: item.actorColor,
            actorName: item.actorName,
            rolling: false,
            diceValue: item.rolled,
            statusText: item.isTripleSix
              ? `${item.actorName} rolled three 6s — turn passes!`
              : `${item.actorName} rolled ${item.rolled} — no legal moves.`,
          });
          triggerSeatBubble(
            item.actorColor,
            item.isTripleSix ? 'Three 6s!' : `Rolled ${item.rolled} · No move`
          );

          await sleepSession(780);
          if (sessionId !== matchSessionRef.current) return;
        } else if (item.type === 'move') {
          setRemotePlayback({
            active: true,
            actorColor: item.actorColor,
            actorName: item.actorName,
            rolling: false,
            diceValue: lastRemoteRollRef.current,
            statusText: `${item.actorName} moving pawn...`,
          });

          // Feed new token positions to LudoBoard so its hop & capture-trace engine runs visibly
          setOnlineDisplayTokens(cloneTokenPositions(item.nextTokens));
          // Allow React commit + LudoBoard's useEffect to raise boardAnimatingRef.current = true
          await sleepSession(90);
          if (sessionId !== matchSessionRef.current) return;

          if (boardAnimatingRef.current) {
            await waitForBoardIdle(item.capturedCount > 0 ? 4600 : 2600);
            if (sessionId !== matchSessionRef.current) return;
          }

          if (item.capturedCount > 0) {
            triggerSeatBubble(item.actorColor, 'CAPTURED! +1 Roll');
            flashBanner('CAPTURED!', 'capture', `${item.actorName} earns a bonus roll!`, 1300);
          } else if (item.reachedHome) {
            tabletopAudio.playSafeStar();
            triggerSeatBubble(item.actorColor, 'Home Finish!');
            flashBanner('HOME FINISH!', 'home', `${item.actorName} scored a pawn!`, 1250);
          }

          await sleepSession(180);
          if (sessionId !== matchSessionRef.current) return;
        }
      }
    } finally {
      remoteProcessingRef.current = false;
      if (sessionId === matchSessionRef.current) {
        if (remoteQueueRef.current.length > 0) {
          drainRemoteQueue();
        } else {
          if (latestOnlineTokensRef.current) {
            setOnlineDisplayTokens(cloneTokenPositions(latestOnlineTokensRef.current));
          }
          setRemotePlayback({
            active: false,
            actorColor: 'red',
            actorName: '',
            rolling: false,
            diceValue: 0,
            statusText: '',
          });
        }
      }
    }
  }, [waitForBoardIdle, sleepSession, triggerSeatBubble, flashBanner]);

  // Watch live Firestore room updates and replay OTHER real players' dice rolls & pawn hops smoothly!
  useEffect(() => {
    if (!isOnline || !activeRoom || (activeRoom.status !== 'playing' && activeRoom.status !== 'finished')) {
      return;
    }

    const nextSig = getTokensSig(activeRoom.tokens);
    const prev = prevObservedRoomRef.current;

    if (!prev || prev.roomId !== activeRoom.id) {
      prevObservedRoomRef.current = {
        roomId: activeRoom.id,
        turnIndex: activeRoom.turnIndex,
        turnPhase: activeRoom.turnPhase,
        diceValue: activeRoom.diceValue,
        turnCount: activeRoom.turnCount,
        tokensSig: nextSig,
        tokens: cloneTokenPositions(activeRoom.tokens),
      };
      setOnlineDisplayTokens(cloneTokenPositions(activeRoom.tokens));
      return;
    }

    const somethingChanged =
      prev.tokensSig !== nextSig ||
      prev.turnIndex !== activeRoom.turnIndex ||
      prev.turnPhase !== activeRoom.turnPhase ||
      prev.diceValue !== activeRoom.diceValue ||
      prev.turnCount !== activeRoom.turnCount;

    if (!somethingChanged) return;

    const fullTurnSig = buildTurnSig({
      tokens: activeRoom.tokens,
      turnIndex: activeRoom.turnIndex,
      turnPhase: activeRoom.turnPhase,
      diceValue: activeRoom.diceValue,
      turnCount: activeRoom.turnCount,
    });

    // Update observed snapshot right away
    prevObservedRoomRef.current = {
      roomId: activeRoom.id,
      turnIndex: activeRoom.turnIndex,
      turnPhase: activeRoom.turnPhase,
      diceValue: activeRoom.diceValue,
      turnCount: activeRoom.turnCount,
      tokensSig: nextSig,
      tokens: cloneTokenPositions(activeRoom.tokens),
    };

    // If THIS device submitted this exact turn state (my own move or a bot I drove locally), sync immediately without re-animating
    if (localSubmittedSigsRef.current.has(fullTurnSig)) {
      localSubmittedSigsRef.current.delete(fullTurnSig);
      if (prev.tokensSig !== nextSig) {
        setOnlineDisplayTokens(cloneTokenPositions(activeRoom.tokens));
      }
      return;
    }

    const actorSeat = activeRoom.seats[prev.turnIndex] || activeRoom.seats[0];
    const actorName = (actorSeat?.name || 'Player').replace(' (Bot)', '');
    const actorColor: PlayerColor = actorSeat?.color || 'red';

    // Case 1: Remote player rolled dice and entered 'move' phase
    if (prev.turnPhase === 'roll' && activeRoom.turnPhase === 'move' && activeRoom.diceValue >= 1) {
      remoteQueueRef.current.push({
        type: 'roll',
        actorColor,
        actorName,
        rolled: activeRoom.diceValue,
      });
      drainRemoteQueue();
      return;
    }

    // Case 2: Remote player rolled dice and had NO legal moves (or rolled three 6s)
    if (activeRoom.turnCount > prev.turnCount && prev.tokensSig === nextSig) {
      const parsed = parseRolledValueFromText(activeRoom.lastActionText || '');
      remoteQueueRef.current.push({
        type: 'no-move',
        actorColor,
        actorName,
        rolled: parsed.rolled,
        isTripleSix: parsed.isTripleSix,
        statusText: activeRoom.lastActionText,
      });
      drainRemoteQueue();
      return;
    }

    // Case 3: Remote player moved a pawn!
    if (prev.tokensSig !== nextSig) {
      let movedColor: PlayerColor = actorColor;
      let movedFrom = -1;
      let movedTo = -1;
      let capturedCount = 0;

      for (const c of ALL_TOKEN_COLORS) {
        for (let i = 0; i < 4; i++) {
          const oldS = prev.tokens[c][i];
          const newS = activeRoom.tokens[c][i];
          if (newS > oldS) {
            movedColor = c;
            movedFrom = oldS;
            movedTo = newS;
          } else if (oldS >= 0 && newS === -1) {
            capturedCount++;
          }
        }
      }

      const moverSeat = activeRoom.seats.find((s) => s.color === movedColor) || actorSeat;
      const moverName = (moverSeat?.name || actorName).replace(' (Bot)', '');

      // If network coalesced roll + move into a single snapshot, synthesize the dice tumble right before the hop!
      if (prev.turnPhase === 'roll' && movedTo >= 0) {
        const inferredRoll =
          movedFrom === -1 && movedTo === 0
            ? 6
            : Math.max(1, Math.min(6, movedTo - movedFrom));
        remoteQueueRef.current.push({
          type: 'roll',
          actorColor: movedColor,
          actorName: moverName,
          rolled: inferredRoll,
        });
      }

      remoteQueueRef.current.push({
        type: 'move',
        actorColor: movedColor,
        actorName: moverName,
        nextTokens: cloneTokenPositions(activeRoom.tokens),
        capturedCount,
        reachedHome: movedTo === 56,
        statusText: activeRoom.lastActionText,
      });
      drainRemoteQueue();
    }
  }, [isOnline, activeRoom, drainRemoteQueue]);

  // Track wait duration for non-host guests in a public waiting room so they are never stuck
  useEffect(() => {
    if (
      !activeRoom ||
      activeRoom.status !== 'waiting' ||
      activeRoom.visibility !== 'public' ||
      activeRoom.hostUid === myUid
    ) {
      setGuestWaitSeconds(0);
      return;
    }
    const id = setInterval(() => {
      setGuestWaitSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [activeRoom?.id, activeRoom?.status, activeRoom?.visibility, activeRoom?.hostUid, myUid]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
    if (roomMessages.length > lastMsgCountRef.current) {
      const latest = roomMessages[roomMessages.length - 1];
      if (latest && Date.now() - latest.createdAtMs < 5000) {
        triggerSeatBubble(latest.senderColor, latest.text);
        if (!chatSheetOpen) {
          setUnreadChat((c) => Math.min(9, c + 1));
        }
      }
      lastMsgCountRef.current = roomMessages.length;
    }
  }, [roomMessages, chatSheetOpen, triggerSeatBubble]);

  const seats: RoomSeat[] = isOnline ? activeRoom!.seats : localGame.seats;
  const tokens: TokenPositions = isOnline ? activeRoom!.tokens : localGame.tokens;
  const boardTokens: TokenPositions = isOnline
    ? onlineDisplayTokens ?? activeRoom!.tokens
    : localGame.tokens;
  const turnIndex = isOnline ? activeRoom!.turnIndex : localGame.turnIndex;
  const rawDiceValue = isOnline ? activeRoom!.diceValue : localGame.diceValue;
  const diceValue = remotePlayback.active
    ? remotePlayback.diceValue
    : holdDiceOverride ?? rawDiceValue;
  const effectiveRollingAnim = rollingAnim || remotePlayback.rolling;
  const turnPhase = isOnline ? activeRoom!.turnPhase : localGame.turnPhase;
  const consecutiveSixes = isOnline ? activeRoom!.consecutiveSixes : localGame.consecutiveSixes;
  const gameStatus = isOnline ? activeRoom!.status : localGame.status;
  const rawActionText = isOnline ? activeRoom!.lastActionText : localGame.lastActionText;
  const lastActionText = remotePlayback.active
    ? remotePlayback.statusText
    : holdStatusOverride ?? rawActionText;
  const turnCount = isOnline ? activeRoom!.turnCount : localGame.turnCount;

  const activeColors = useMemo(() => seats.map((s) => s.color), [seats]);
  const currentSeat = seats[turnIndex] || seats[0];
  const displayActiveColor: PlayerColor = remotePlayback.active
    ? remotePlayback.actorColor
    : currentSeat?.color || 'red';
  const mySeat = useMemo(
    () => seats.find((s) => !s.isBot && s.uid === myUid) || null,
    [seats, myUid]
  );
  const myFinished = Boolean(mySeat && !isPassAndPlay && isSeatFinished(mySeat, tokens));
  const myFinishRank = mySeat?.finishRank;
  const remainingActiveSeatsCount = useMemo(
    () => seats.filter((s) => !isSeatFinished(s, tokens)).length,
    [seats, tokens]
  );
  const existingWinnerColor = isOnline ? activeRoom?.winnerColor || '' : localGame.winnerColor;
  const existingWinnerUid = isOnline ? activeRoom?.winnerUid || '' : '';
  const existingWinnerName = isOnline
    ? activeRoom?.seats.find((s) => s.color === activeRoom.winnerColor)?.name || ''
    : localGame.winnerName;

  const playerNamesMap = useMemo(() => {
    const map: Partial<Record<PlayerColor, string>> = {};
    for (const seat of seats) {
      map[seat.color] = isPassAndPlay
        ? seat.name
        : seat.uid === myUid && !seat.isBot
          ? 'YOU'
          : seat.name.replace(' (Bot)', '');
    }
    return map;
  }, [seats, myUid, isPassAndPlay]);

  const isMyTurn =
    gameStatus === 'playing' &&
    !holdPause &&
    !remotePlayback.active &&
    !(isOnline && !networkOnline) &&
    Boolean(currentSeat) &&
    !isSeatFinished(currentSeat, tokens) &&
    !currentSeat.isBot &&
    !(isOnline && currentSeat.autoPlay) &&
    (isPassAndPlay || currentSeat.uid === myUid);

  // Track online human turn inactivity seconds so players see a clear countdown before Auto-Play steps in
  useEffect(() => {
    setTurnIdleSeconds(0);
    if (
      !isOnline ||
      gameStatus !== 'playing' ||
      !currentSeat ||
      isSeatFinished(currentSeat, tokens) ||
      currentSeat.isBot ||
      currentSeat.autoPlay
    ) {
      return;
    }
    const id = setInterval(() => {
      setTurnIdleSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [
    isOnline,
    gameStatus,
    turnIndex,
    turnPhase,
    turnCount,
    tokens,
    currentSeat,
  ]);

  // Intercept Android hardware back button during a live online match to offer graceful Auto-Play exit
  useEffect(() => {
    if (!isCapacitorNativeApp() || !isOnline || gameStatus !== 'playing' || Boolean(matchSummary)) {
      return;
    }
    let handle: { remove: () => Promise<void> } | null = null;
    CapacitorApp.addListener('backButton', () => {
      if (myFinished || isSpectating) {
        exitActiveRoom();
        return;
      }
      setExitConfirmOpen((prev) => !prev);
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {});
    return () => {
      handle?.remove().catch(() => {});
    };
  }, [isOnline, gameStatus, matchSummary, myFinished, isSpectating, exitActiveRoom]);

  // Auto-Fill Quick Match After ~10 Seconds (Public tables only; private friend rooms never auto-fill)
  const isPublicWaitingHost =
    isOnline &&
    Boolean(activeRoom) &&
    activeRoom!.status === 'waiting' &&
    activeRoom!.visibility === 'public' &&
    activeRoom!.hostUid === myUid;

  const waitingSeatsCount = activeRoom?.seats.length ?? 0;
  const waitingMaxPlayers = activeRoom?.maxPlayers ?? 4;

  useEffect(() => {
    if (!isPublicWaitingHost || !activeRoom) return;

    // If real players already filled every seat, start right away!
    if (waitingSeatsCount >= waitingMaxPlayers) {
      if (autoFillFiredRef.current) return;
      const startTimer = setTimeout(() => {
        if (!autoFillFiredRef.current) {
          autoFillFiredRef.current = true;
          hostStartRoom(false).catch(() => {
            autoFillFiredRef.current = false;
          });
        }
      }, 900);
      return () => clearTimeout(startTimer);
    }

    if (autoFillPaused) return;

    if (autoFillSeconds <= 0) {
      if (!autoFillFiredRef.current) {
        autoFillFiredRef.current = true;
        hostStartRoom(true).catch(() => {
          autoFillFiredRef.current = false;
        });
      }
      return;
    }

    const tick = setTimeout(() => {
      setAutoFillSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearTimeout(tick);
  }, [
    isPublicWaitingHost,
    activeRoom,
    waitingSeatsCount,
    waitingMaxPlayers,
    autoFillPaused,
    autoFillSeconds,
    hostStartRoom,
  ]);

  // Play crisp turn-ready chime & flash turn banner (waits until remote animations finish!)
  useEffect(() => {
    if (isMyTurn && turnPhase === 'roll' && !boardAnimating && !effectiveRollingAnim && !remotePlayback.active) {
      if (isPassAndPlay) {
        if (prevTurnIndexRef.current !== turnIndex && turnCount > 0 && currentSeat) {
          tabletopAudio.playTurnReady();
          flashBanner(
            `${currentSeat.name.toUpperCase()}'S TURN`,
            'turn',
            `Pass phone to ${currentSeat.name} (${PLAYER_COLOR_META[currentSeat.color].label})`,
            1250
          );
        }
        prevTurnIndexRef.current = turnIndex;
      } else if (!prevIsMyTurnRef.current && turnCount > 0) {
        tabletopAudio.playTurnReady();
        flashBanner('YOUR TURN!', 'turn', 'Tap ROLL DICE to play', 1100);
      }
      prevIsMyTurnRef.current = true;
    } else if (!isMyTurn) {
      prevIsMyTurnRef.current = false;
    }
  }, [
    isMyTurn,
    isPassAndPlay,
    turnIndex,
    currentSeat,
    turnPhase,
    boardAnimating,
    effectiveRollingAnim,
    remotePlayback.active,
    turnCount,
    flashBanner,
  ]);

  const movableTokenIndices = useMemo(() => {
    if (
      gameStatus !== 'playing' ||
      turnPhase !== 'move' ||
      rawDiceValue < 1 ||
      !currentSeat ||
      holdPause ||
      remotePlayback.active
    ) {
      return [];
    }
    return getMovableTokenIndices(tokens, currentSeat.color, rawDiceValue);
  }, [gameStatus, turnPhase, rawDiceValue, currentSeat, tokens, holdPause, remotePlayback.active]);

  // Auto-play when human player has only 1 legal move (still allows immediate manual tap!)
  const shouldAutoPlayOnlyMove = useMemo(() => {
    if (!isMyTurn || gameStatus !== 'playing' || turnPhase !== 'move' || rollingAnim || boardAnimating || holdPause) {
      return false;
    }
    if (movableTokenIndices.length === 1) return true;
    if (movableTokenIndices.length > 1 && currentSeat) {
      const colorTokens = tokens[currentSeat.color];
      const firstStep = colorTokens[movableTokenIndices[0]];
      return movableTokenIndices.every((idx) => colorTokens[idx] === firstStep);
    }
    return false;
  }, [isMyTurn, gameStatus, turnPhase, rollingAnim, boardAnimating, holdPause, movableTokenIndices, currentSeat, tokens]);

  const buildPlayerMatchSummary = useCallback(
    (opts: {
      seatsList: RoomSeat[];
      tokensSnapshot: TokenPositions;
      turns: number;
      isFinalResults: boolean;
      focusSeat?: RoomSeat | null;
      winnerColorOverride?: string;
    }): MatchSummary => {
      const standings = buildFinalStandings(opts.seatsList, opts.tokensSnapshot);
      const champion = standings[0];
      const focus =
        opts.focusSeat ||
        opts.seatsList.find((s) => !s.isBot && s.uid === myUid) ||
        opts.seatsList[0];
      const focusStanding =
        standings.find((st) => st.uid === focus?.uid && st.color === focus?.color) || standings[0];
      const myRank = focusStanding?.rank ?? 1;
      const won = isPassAndPlay
        ? Boolean(champion && !champion.isBot)
        : myRank === 1;
      const isTournament = !isOnline && Boolean(offlineMatch?.tournamentContext);

      let coinsEarned = 60;
      let xpEarned = 55;
      let eloDelta = 0;

      if (isOnline && activeRoom) {
        if (myRank === 1) {
          coinsEarned = Math.max(200, activeRoom.entryStake * 2 + 120);
          xpEarned = 140;
          eloDelta = 28;
        } else if (myRank === 2) {
          coinsEarned = Math.max(120, Math.round(activeRoom.entryStake * 1.1) + 60);
          xpEarned = 95;
          eloDelta = 10;
        } else if (myRank === 3) {
          coinsEarned = 80;
          xpEarned = 70;
          eloDelta = -6;
        } else {
          coinsEarned = 55;
          xpEarned = 55;
          eloDelta = -14;
        }
      } else if (isPassAndPlay) {
        coinsEarned = 100;
        xpEarned = 75;
        eloDelta = 0;
      } else if (myRank === 1) {
        coinsEarned = isTournament
          ? offlineMatch!.tournamentContext!.round === 'final'
            ? offlineMatch!.tournamentContext!.prizePool
            : 300
          : 160;
        xpEarned = 110;
        eloDelta = isTournament ? 35 : 12;
      } else if (myRank === 2) {
        coinsEarned = 95;
        xpEarned = 75;
        eloDelta = isTournament ? -4 : 4;
      } else if (myRank === 3) {
        coinsEarned = 65;
        xpEarned = 55;
        eloDelta = isTournament ? -8 : -2;
      } else {
        coinsEarned = 45;
        xpEarned = 40;
        eloDelta = isTournament ? -10 : -4;
      }

      const usedAutoPlayAtFinish =
        !isPassAndPlay &&
        Boolean(focus && (focus.completedWithAutoPlay || focus.autoPlay || focus.forfeited));

      if (usedAutoPlayAtFinish) {
        coinsEarned = 0;
        xpEarned = 0;
        eloDelta = 0;
      }

      const winnerColor =
        ((opts.winnerColorOverride || champion?.color || 'red') as PlayerColor) || 'red';
      const winnerName =
        (isPassAndPlay && !opts.isFinalResults && opts.focusSeat
          ? opts.focusSeat.name
          : champion?.name || opts.seatsList.find((s) => s.color === winnerColor)?.name) ||
        winnerColor.toUpperCase();

      return {
        won,
        winnerName,
        winnerColor,
        isOnline,
        isTournament,
        tournamentId: offlineMatch?.tournamentContext?.tournamentId,
        tournamentRound: offlineMatch?.tournamentContext?.round,
        capturesByPlayer: playerCapturesRef.current,
        sixesByPlayer: playerSixesRef.current,
        coinsEarned,
        xpEarned,
        eloDelta,
        turnsPlayed: opts.turns,
        doubledWithAd: doubledRewardRef.current,
        finishRank: myRank,
        isFinalResults: opts.isFinalResults,
        standings,
        autoPlayForfeitedRewards: usedAutoPlayAtFinish,
      };
    },
    [isOnline, isPassAndPlay, activeRoom, myUid, offlineMatch]
  );

  // Observe podium finishes while the match continues so winners can celebrate & choose Spectate Match!
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    for (const seat of seats) {
      if (typeof seat.finishRank !== 'number') continue;
      const key = `${seat.uid}:${seat.color}`;
      if (prevSeatRanksRef.current[key] === seat.finishRank) continue;
      prevSeatRanksRef.current[key] = seat.finishRank;

      const cleanName = seat.name.replace(' (Bot)', '');
      const ordinal = formatOrdinalRank(seat.finishRank);
      if (seat.finishRank === 1) {
        tabletopAudio.playVictory();
      } else {
        tabletopAudio.playSafeStar();
      }
      triggerSeatBubble(seat.color, `Finished ${ordinal}!`);
      flashBanner(
        `${ordinal.toUpperCase()} PLACE!`,
        'home',
        `${cleanName} finished ${ordinal} — match continues!`,
        1800
      );

      const isMySeatFinished = !isPassAndPlay && !seat.isBot && seat.uid === myUid;
      const isPassAndPlayHumanFinished = isPassAndPlay && !seat.isBot;

      if (isMySeatFinished || isPassAndPlayHumanFinished) {
        const earlySummary = buildPlayerMatchSummary({
          seatsList: seats,
          tokensSnapshot: tokens,
          turns: turnCount,
          isFinalResults: false,
          focusSeat: seat,
          winnerColorOverride: existingWinnerColor || seat.color,
        });
        if (isMySeatFinished && !summaryRecordedRef.current) {
          summaryRecordedRef.current = true;
          recordMatchCompletion(earlySummary);
        }
        setPersonalFinishSummary(earlySummary);
        setMatchSummary(earlySummary);
      }
    }
  }, [
    gameStatus,
    seats,
    tokens,
    turnCount,
    myUid,
    isPassAndPlay,
    existingWinnerColor,
    buildPlayerMatchSummary,
    recordMatchCompletion,
    flashBanner,
    triggerSeatBubble,
  ]);

  // Final Match Results screen once ALL real players complete the match (or only 1 active player remains)
  useEffect(() => {
    if (gameStatus !== 'finished' || finalSummaryShownRef.current) {
      return;
    }
    finalSummaryShownRef.current = true;
    setIsSpectating(false);

    const finalSummary = buildPlayerMatchSummary({
      seatsList: seats,
      tokensSnapshot: tokens,
      turns: turnCount,
      isFinalResults: true,
      winnerColorOverride: existingWinnerColor,
    });

    setMatchSummary(finalSummary);
    if (finalSummary.won) {
      tabletopAudio.playVictory();
    } else {
      tabletopAudio.playSafeStar();
    }

    if (!summaryRecordedRef.current) {
      summaryRecordedRef.current = true;
      recordMatchCompletion(finalSummary);
    }
  }, [
    gameStatus,
    seats,
    tokens,
    turnCount,
    existingWinnerColor,
    buildPlayerMatchSummary,
    recordMatchCompletion,
  ]);

  const executeDiceRoll = useCallback(
    async (
      actorSeat: RoomSeat | undefined,
      source: 'human' | 'bot' | 'autoplay' = 'human',
      overrideRoll?: number
    ) => {
      if (
        !actorSeat ||
        isSeatFinished(actorSeat, tokens) ||
        turnActionLockRef.current ||
        rollingAnim ||
        boardAnimating ||
        holdPause ||
        remotePlayback.active ||
        gameStatus !== 'playing' ||
        turnPhase !== 'roll'
      ) {
        return;
      }

      if (isOnline && !networkOnline) {
        if (source === 'human') {
          showToast('Network disconnected — waiting to reconnect...', 'error');
        }
        return;
      }

      // Strict human vs bot vs auto-play ownership guard
      if (source === 'human') {
        if (actorSeat.isBot) return;
        if (!isPassAndPlay && actorSeat.uid !== myUid) return;
      } else if (source === 'bot') {
        if (!actorSeat.isBot) return;
      } else {
        if (!isOnline || actorSeat.isBot) return;
      }

      const sessionId = matchSessionRef.current;
      turnActionLockRef.current = true;
      setRollingAnim(true);
      tabletopAudio.playDiceRoll();

      const rolled = overrideRoll ?? rollDiceWithPity(tokens, actorSeat.color, actorSeat.dryRolls || 0);
      const actorDisplayName =
        source === 'autoplay' ? `${actorSeat.name} (Auto)` : actorSeat.name;
      const autoPlaySeatsPatch: RoomSeat[] | undefined =
        isOnline && source === 'autoplay' && !actorSeat.autoPlay && !isSeatFinished(actorSeat, tokens)
          ? seats.map((s) =>
              !s.isBot && s.uid === actorSeat.uid ? { ...s, autoPlay: true, away: true } : s
            )
          : undefined;
      const baseRollSeats = autoPlaySeatsPatch || seats;

      // Comfortable 620ms dice tumble so players clearly feel and watch every roll
      scheduleTimer(async () => {
        if (sessionId !== matchSessionRef.current) {
          turnActionLockRef.current = false;
          return;
        }
        setRollingAnim(false);
        const isHumanMe =
          source === 'human' && !actorSeat.isBot && (isPassAndPlay || actorSeat.uid === myUid);
        if (rolled === 6) {
          tabletopAudio.playSixFanfare();
          triggerSeatBubble(actorSeat.color, 'Rolled a SIX!');
          if (source === 'human' && !actorSeat.isBot && actorSeat.uid === myUid) {
            playerSixesRef.current += 1;
            recordGameplayEvent({ rollSixes: 1 });
          }
        }

        const nextSixes = rolled === 6 ? consecutiveSixes + 1 : 0;

        // Triple 6 rule — pause 980ms so the player sees the 6 before turn passes!
        if (nextSixes >= 3) {
          const dryReset = updateSeatDryRolls(baseRollSeats, actorSeat, 0);
          const nextIdx = findNextActiveTurnIndex(dryReset.seats, tokens, turnIndex);
          const holdMsg = `${actorDisplayName} rolled three 6s — turn passes!`;
          setHoldPause(true);
          setHoldDiceOverride(6);
          setHoldStatusOverride(holdMsg);

          scheduleTimer(async () => {
            if (sessionId !== matchSessionRef.current) {
              turnActionLockRef.current = false;
              return;
            }
            const text = `${actorDisplayName} rolled three 6s — ${seats[nextIdx].name}'s turn.`;
            try {
              if (isOnline) {
                const payload = {
                  ...(autoPlaySeatsPatch || dryReset.changed ? { seats: dryReset.seats } : {}),
                  tokens,
                  turnIndex: nextIdx,
                  diceValue: 0,
                  turnPhase: 'roll' as const,
                  consecutiveSixes: 0,
                  status: 'playing' as const,
                  winnerColor: existingWinnerColor,
                  winnerUid: existingWinnerUid,
                  lastActionText: text,
                  turnCount: turnCount + 1,
                };
                localSubmittedSigsRef.current.add(buildTurnSig(payload));
                await withWriteTimeout(submitMultiplayerTurn(payload));
              } else {
                setLocalGame((prev) => ({
                  ...prev,
                  seats: dryReset.seats,
                  turnIndex: nextIdx,
                  diceValue: 0,
                  turnPhase: 'roll',
                  consecutiveSixes: 0,
                  lastActionText: text,
                  turnCount: prev.turnCount + 1,
                }));
              }
            } catch {
              // Network hiccup — snapshot listener will reconcile state cleanly
            } finally {
              if (sessionId === matchSessionRef.current) {
                setHoldPause(false);
                setHoldDiceOverride(null);
                setHoldStatusOverride(null);
              }
              turnActionLockRef.current = false;
            }
          }, 980);
          return;
        }

        const legal = getMovableTokenIndices(tokens, actorSeat.color, rolled);

        // No legal move — pause 950ms showing the rolled number & increment pity counter!
        if (legal.length === 0) {
          const dryInc = updateSeatDryRolls(
            baseRollSeats,
            actorSeat,
            (actorSeat.dryRolls || 0) + 1
          );
          const nextIdx = findNextActiveTurnIndex(dryInc.seats, tokens, turnIndex);
          const holdMsg = `${actorDisplayName} rolled ${rolled} — no legal moves.`;
          setHoldPause(true);
          setHoldDiceOverride(rolled);
          setHoldStatusOverride(holdMsg);

          scheduleTimer(async () => {
            if (sessionId !== matchSessionRef.current) {
              turnActionLockRef.current = false;
              return;
            }
            const nextName =
              !isPassAndPlay && seats[nextIdx].uid === myUid && !seats[nextIdx].isBot
                ? 'Your turn'
                : `${seats[nextIdx].name}'s turn`;
            const text = `${actorDisplayName} rolled ${rolled} (no move). ${nextName}!`;
            try {
              if (isOnline) {
                const payload = {
                  ...(autoPlaySeatsPatch || dryInc.changed ? { seats: dryInc.seats } : {}),
                  tokens,
                  turnIndex: nextIdx,
                  diceValue: 0,
                  turnPhase: 'roll' as const,
                  consecutiveSixes: 0,
                  status: 'playing' as const,
                  winnerColor: existingWinnerColor,
                  winnerUid: existingWinnerUid,
                  lastActionText: text,
                  turnCount: turnCount + 1,
                };
                localSubmittedSigsRef.current.add(buildTurnSig(payload));
                await withWriteTimeout(submitMultiplayerTurn(payload));
              } else {
                setLocalGame((prev) => ({
                  ...prev,
                  seats: dryInc.seats,
                  turnIndex: nextIdx,
                  diceValue: 0,
                  turnPhase: 'roll',
                  consecutiveSixes: 0,
                  lastActionText: text,
                  turnCount: prev.turnCount + 1,
                }));
              }
            } catch {
              // Network hiccup — snapshot listener will reconcile state cleanly
            } finally {
              if (sessionId === matchSessionRef.current) {
                setHoldPause(false);
                setHoldDiceOverride(null);
                setHoldStatusOverride(null);
              }
              turnActionLockRef.current = false;
            }
          }, 950);
          return;
        }

        if (rolled === 6) {
          flashBanner('LUCKY 6!', 'six', `${actorDisplayName} gets a bonus roll!`, 1200);
        }

        const dryReset = updateSeatDryRolls(baseRollSeats, actorSeat, 0);
        const colorTokens = tokens[actorSeat.color];
        const allSameSpot = legal.every((i) => colorTokens[i] === colorTokens[legal[0]]);
        const text =
          legal.length === 1 || allSameSpot
            ? `${actorDisplayName} rolled ${rolled} — moving pawn...`
            : isHumanMe
              ? isPassAndPlay
                ? `${actorSeat.name} rolled ${rolled}! Tap any bouncing pawn.`
                : `You rolled ${rolled}! Tap any bouncing pawn to move.`
              : `${actorDisplayName} rolled ${rolled} — choosing a pawn...`;

        try {
          if (isOnline) {
            const payload = {
              ...(autoPlaySeatsPatch || dryReset.changed ? { seats: dryReset.seats } : {}),
              tokens,
              turnIndex,
              diceValue: rolled,
              turnPhase: 'move' as const,
              consecutiveSixes: nextSixes,
              status: 'playing' as const,
              winnerColor: existingWinnerColor,
              winnerUid: existingWinnerUid,
              lastActionText: text,
              turnCount,
            };
            localSubmittedSigsRef.current.add(buildTurnSig(payload));
            await withWriteTimeout(submitMultiplayerTurn(payload));
          } else {
            setLocalGame((prev) => ({
              ...prev,
              seats: dryReset.seats,
              diceValue: rolled,
              turnPhase: 'move',
              consecutiveSixes: nextSixes,
              lastActionText: text,
            }));
          }
        } catch {
          // Network hiccup — snapshot listener will reconcile state cleanly
        } finally {
          turnActionLockRef.current = false;
        }
      }, 620);
    },
    [
      rollingAnim,
      boardAnimating,
      holdPause,
      remotePlayback.active,
      gameStatus,
      turnPhase,
      networkOnline,
      myUid,
      isPassAndPlay,
      consecutiveSixes,
      turnIndex,
      seats,
      isOnline,
      tokens,
      turnCount,
      existingWinnerColor,
      existingWinnerUid,
      recordGameplayEvent,
      submitMultiplayerTurn,
      triggerSeatBubble,
      flashBanner,
      scheduleTimer,
      showToast,
    ]
  );

  const executeTokenMove = useCallback(
    async (
      actorSeat: RoomSeat | undefined,
      tokenIdx: number,
      source: 'human' | 'bot' | 'autoplay' = 'human'
    ) => {
      if (
        !actorSeat ||
        isSeatFinished(actorSeat, tokens) ||
        turnActionLockRef.current ||
        boardAnimating ||
        holdPause ||
        remotePlayback.active ||
        gameStatus !== 'playing' ||
        turnPhase !== 'move' ||
        rawDiceValue < 1
      ) {
        return;
      }

      if (isOnline && !networkOnline) {
        if (source === 'human') {
          showToast('Network disconnected — waiting to reconnect...', 'error');
        }
        return;
      }

      // Strict human vs bot vs auto-play ownership guard
      if (source === 'human') {
        if (actorSeat.isBot) return;
        if (!isPassAndPlay && actorSeat.uid !== myUid) return;
      } else if (source === 'bot') {
        if (!actorSeat.isBot) return;
      } else {
        if (!isOnline || actorSeat.isBot) return;
      }

      const legal = getMovableTokenIndices(tokens, actorSeat.color, rawDiceValue);
      if (!legal.includes(tokenIdx)) return;

      const actorDisplayName =
        source === 'autoplay' ? `${actorSeat.name} (Auto)` : actorSeat.name;
      const baseSeats: RoomSeat[] =
        isOnline && source === 'autoplay' && !actorSeat.autoPlay && !isSeatFinished(actorSeat, tokens)
          ? seats.map((s) =>
              !s.isBot && s.uid === actorSeat.uid ? { ...s, autoPlay: true, away: true } : s
            )
          : seats;
      const autoSeatsPatched = baseSeats !== seats;

      turnActionLockRef.current = true;
      try {
        const outcome = applyTokenMove(
          tokens,
          actorSeat.color,
          tokenIdx,
          rawDiceValue,
          actorDisplayName,
          activeColors
        );

        const resolved = resolveSeatFinishState({
          seats: baseSeats,
          nextTokens: outcome.nextTokens,
          actorSeat,
          actorDisplayName,
          turnIndex,
          bonusTurn: outcome.bonusTurn,
          baseActionText: outcome.actionText,
          existingWinnerColor,
          existingWinnerUid,
          existingWinnerName,
          actorUsedAutoPlay: source === 'autoplay',
        });

        if (outcome.capturedColors.length > 0) {
          triggerSeatBubble(actorSeat.color, 'CAPTURED! +1 Roll');
          flashBanner('CAPTURED!', 'capture', `${actorDisplayName} earns a bonus roll!`, 1400);
          if (source === 'human' && !actorSeat.isBot && actorSeat.uid === myUid) {
            playerCapturesRef.current += outcome.capturedColors.length;
            recordGameplayEvent({ captures: outcome.capturedColors.length });
          }
        } else if (outcome.reachedHome && !resolved.actorJustFinished) {
          tabletopAudio.playSafeStar();
          triggerSeatBubble(actorSeat.color, 'Home Finish!');
          flashBanner('HOME FINISH!', 'home', `${actorDisplayName} scored a pawn!`, 1350);
        } else if (outcome.landedSafe) {
          tabletopAudio.playSafeStar();
        }

        const nextStatus: 'playing' | 'finished' = resolved.matchCompleted ? 'finished' : 'playing';
        const keepBonusSixes =
          outcome.bonusTurn && !resolved.actorJustFinished && !resolved.matchCompleted;

        if (isOnline) {
          const payload = {
            ...(autoSeatsPatched || resolved.seatsChanged ? { seats: resolved.updatedSeats } : {}),
            tokens: outcome.nextTokens,
            turnIndex: resolved.nextTurnIndex,
            diceValue: 0,
            turnPhase: 'roll' as const,
            consecutiveSixes: keepBonusSixes ? consecutiveSixes : 0,
            status: nextStatus,
            winnerColor: resolved.winnerColor,
            winnerUid: resolved.winnerUid,
            lastActionText: resolved.actionText,
            turnCount: turnCount + 1,
          };
          localSubmittedSigsRef.current.add(buildTurnSig(payload));
          // Update local board display immediately so our own pawn jumps with zero network lag
          setOnlineDisplayTokens(cloneTokenPositions(outcome.nextTokens));
          await withWriteTimeout(submitMultiplayerTurn(payload));
        } else {
          setLocalGame((prev) => ({
            ...prev,
            seats: resolved.updatedSeats,
            tokens: outcome.nextTokens,
            turnIndex: resolved.nextTurnIndex,
            diceValue: 0,
            turnPhase: 'roll',
            consecutiveSixes: keepBonusSixes ? prev.consecutiveSixes : 0,
            status: nextStatus,
            winnerColor: (resolved.winnerColor as PlayerColor | '') || prev.winnerColor,
            winnerName: resolved.winnerName || prev.winnerName,
            lastActionText: resolved.actionText,
            turnCount: prev.turnCount + 1,
          }));
        }
      } catch {
        // Network hiccup — snapshot listener will reconcile cleanly
      } finally {
        turnActionLockRef.current = false;
      }
    },
    [
      boardAnimating,
      holdPause,
      remotePlayback.active,
      gameStatus,
      turnPhase,
      rawDiceValue,
      networkOnline,
      tokens,
      activeColors,
      myUid,
      isPassAndPlay,
      turnIndex,
      seats,
      isOnline,
      consecutiveSixes,
      turnCount,
      existingWinnerColor,
      existingWinnerUid,
      existingWinnerName,
      recordGameplayEvent,
      submitMultiplayerTurn,
      triggerSeatBubble,
      flashBanner,
      showToast,
    ]
  );

  // Bulletproof Bot & Disconnected/Away Auto-Play Driver (Offline + Online with host-disconnect & timeout handover)
  useEffect(() => {
    if (
      gameStatus !== 'playing' ||
      !currentSeat ||
      rollingAnim ||
      boardAnimating ||
      holdPause ||
      remotePlayback.active
    ) {
      return;
    }

    if (isOnline && !networkOnline) {
      return;
    }

    const currentFinished = isSeatFinished(currentSeat, tokens);
    const isBotTurn = currentSeat.isBot;
    const isOnlineHumanTurn = isOnline && !currentSeat.isBot;

    if (!currentFinished && !isBotTurn && !isOnlineHumanTurn) {
      return;
    }

    let source: 'bot' | 'autoplay' = isBotTurn ? 'bot' : 'autoplay';
    let delayMs = currentFinished ? 260 : turnPhase === 'roll' ? 920 : 820;

    if (isOnline && activeRoom) {
      if (!activeRoom.playerUids.includes(myUid)) {
        return;
      }

      const now = Date.now();
      const isSeatPresent = (s: RoomSeat) =>
        !s.isBot &&
        !s.away &&
        !s.autoPlay &&
        (s.lastSeenMs === undefined || now - s.lastSeenMs < SEAT_STALE_MS + 4000);

      // Build deterministic priority list of online human drivers (preferring active present humans, host first)
      const humanCandidates = activeRoom.seats
        .filter((s) => !s.isBot)
        .sort((a, b) => {
          const aPresent = isSeatPresent(a) ? 0 : 1;
          const bPresent = isSeatPresent(b) ? 0 : 1;
          if (aPresent !== bPresent) return aPresent - bPresent;
          if (a.uid === activeRoom.hostUid) return -1;
          if (b.uid === activeRoom.hostUid) return 1;
          return a.uid.localeCompare(b.uid);
        });

      const myDriverRank = Math.max(
        0,
        humanCandidates.findIndex((s) => s.uid === myUid)
      );

      if (currentFinished) {
        delayMs = myDriverRank === 0 ? 300 : 1800 + myDriverRank * 900;
      } else if (isBotTurn) {
        // Active highest-priority present human drives bots immediately; backups step in after 3.2s
        delayMs = myDriverRank === 0 ? (turnPhase === 'roll' ? 920 : 820) : 3200 + myDriverRank * 1100;
      } else {
        // Online human seat: check whether they are in Auto-Play, away, disconnected/stale, or idle past timeout
        source = 'autoplay';
        const seatStale =
          currentSeat.lastSeenMs !== undefined && now - currentSeat.lastSeenMs > SEAT_STALE_MS;

        if (currentSeat.autoPlay) {
          // Player explicitly left or Auto-Play already active -> play smoothly at bot pace!
          delayMs =
            myDriverRank === 0
              ? turnPhase === 'roll'
                ? 1050
                : 880
              : 3400 + myDriverRank * 1200;
        } else if (currentSeat.away) {
          // Player backgrounded app -> brief 5s grace then Auto-Play steps in
          delayMs = 5000 + myDriverRank * 2400;
        } else if (seatStale && currentSeat.uid !== myUid) {
          // Player's mobile network dropped without clean exit -> Auto-Play takes over after 6.5s
          delayMs = 6500 + myDriverRank * 2400;
        } else {
          // Active human just idle/AFK -> Auto-Play steps in after 18s turn timer
          delayMs = ONLINE_TURN_TIMEOUT_SECONDS * 1000 + myDriverRank * 2400;
        }
      }
    }

    const difficulty = offlineMatch?.difficulty || 'tactical';

    const timer = setTimeout(() => {
      if (turnActionLockRef.current) return;
      if (currentFinished) {
        const nextIdx = findNextActiveTurnIndex(seats, tokens, turnIndex);
        const text = `${seats[nextIdx]?.name || 'Next player'}'s turn!`;
        if (isOnline) {
          const payload = {
            tokens,
            turnIndex: nextIdx,
            diceValue: 0,
            turnPhase: 'roll' as const,
            consecutiveSixes: 0,
            status: 'playing' as const,
            winnerColor: existingWinnerColor,
            winnerUid: existingWinnerUid,
            lastActionText: text,
            turnCount: turnCount + 1,
          };
          localSubmittedSigsRef.current.add(buildTurnSig(payload));
          withWriteTimeout(submitMultiplayerTurn(payload)).catch(() => {});
        } else {
          setLocalGame((prev) => ({
            ...prev,
            turnIndex: nextIdx,
            diceValue: 0,
            turnPhase: 'roll',
            consecutiveSixes: 0,
            lastActionText: text,
            turnCount: prev.turnCount + 1,
          }));
        }
        return;
      }
      if (turnPhase === 'roll') {
        executeDiceRoll(currentSeat, source);
      } else if (turnPhase === 'move') {
        const chosen = chooseAiTokenMove(
          tokens,
          currentSeat.color,
          rawDiceValue,
          activeColors,
          difficulty
        );
        if (chosen >= 0) {
          executeTokenMove(currentSeat, chosen, source);
        } else {
          // Safety recovery if bot/auto-play ever enters move phase with no legal moves
          const nextIdx = findNextActiveTurnIndex(seats, tokens, turnIndex);
          const actorLabel =
            source === 'autoplay' ? `${currentSeat.name} (Auto)` : currentSeat.name;
          const text = `${actorLabel} had no legal move — ${seats[nextIdx].name}'s turn.`;
          if (isOnline) {
            const payload = {
              tokens,
              turnIndex: nextIdx,
              diceValue: 0,
              turnPhase: 'roll' as const,
              consecutiveSixes: 0,
              status: 'playing' as const,
              winnerColor: existingWinnerColor,
              winnerUid: existingWinnerUid,
              lastActionText: text,
              turnCount: turnCount + 1,
            };
            localSubmittedSigsRef.current.add(buildTurnSig(payload));
            withWriteTimeout(submitMultiplayerTurn(payload)).catch(() => {});
          } else {
            setLocalGame((prev) => ({
              ...prev,
              turnIndex: nextIdx,
              diceValue: 0,
              turnPhase: 'roll',
              consecutiveSixes: 0,
              lastActionText: text,
              turnCount: prev.turnCount + 1,
            }));
          }
        }
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [
    gameStatus,
    currentSeat,
    rollingAnim,
    boardAnimating,
    holdPause,
    remotePlayback.active,
    networkOnline,
    isOnline,
    activeRoom,
    myUid,
    offlineMatch?.difficulty,
    turnPhase,
    turnIndex,
    seats,
    turnCount,
    tokens,
    rawDiceValue,
    activeColors,
    existingWinnerColor,
    existingWinnerUid,
    executeDiceRoll,
    executeTokenMove,
    submitMultiplayerTurn,
  ]);

  // Comfortable 680ms auto-move when player has only 1 legal move (player can also tap it earlier!)
  useEffect(() => {
    if (!shouldAutoPlayOnlyMove || movableTokenIndices.length === 0) return;
    const onlyTokenIdx = movableTokenIndices[0];
    const timer = setTimeout(() => {
      executeTokenMove(currentSeat, onlyTokenIdx, 'human');
    }, 680);
    return () => clearTimeout(timer);
  }, [shouldAutoPlayOnlyMove, movableTokenIndices, currentSeat, executeTokenMove]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isMyTurn && turnPhase === 'roll' && !rollingAnim && !boardAnimating) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        executeDiceRoll(currentSeat, 'human');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMyTurn, turnPhase, rollingAnim, boardAnimating, currentSeat, executeDiceRoll]);

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.roomCode).catch(() => {});
    setCopiedCode(true);
    showToast(`Copied room code ${activeRoom.roomCode}.`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleNativeShareRoom = async () => {
    if (!activeRoom) return;
    const text = buildRoomInviteShareText({
      roomCode: activeRoom.roomCode,
      hostName: profile.displayName,
      maxPlayers: activeRoom.maxPlayers,
      mode: activeRoom.mode,
    });
    const result = await shareInviteOrResult({
      title: `Join my Ludo Crown Table (${activeRoom.roomCode})`,
      text,
      dialogTitle: 'Invite friends to Ludo Crown',
    });
    if (result === 'copied') {
      showToast('Invite message + Play Store link copied! Paste in WhatsApp or chat.', 'success');
    }
  };

  const handleNativeShareSummary = async () => {
    if (!matchSummary) return;
    const text = buildPostMatchShareText({
      summary: matchSummary,
      playerName: profile.displayName,
      isPassAndPlay,
      roomCode: activeRoom?.roomCode,
    });
    const result = await shareInviteOrResult({
      title: 'Ludo Crown Match Result',
      text,
      dialogTitle: 'Share Ludo Crown Result',
    });
    if (result === 'copied') {
      showToast('Match result + Play Store link copied!', 'success');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    await sendChat(text, 'chat');
  };

  const handleLeaveMatch = async (forceImmediate = false) => {
    const wasFinishedMatch = Boolean(matchSummary) || myFinished || isSpectating;
    if (!forceImmediate && isOnline && gameStatus === 'playing' && !wasFinishedMatch) {
      setExitConfirmOpen(true);
      return;
    }
    setExitConfirmOpen(false);
    if (isOnline) {
      await exitActiveRoom();
    } else {
      closeOfflineMatch();
    }
    if (wasFinishedMatch) {
      maybeShowInterstitialAfterMatch();
    }
  };

  const handlePracticeRestart = () => {
    const wasFinishedMatch = Boolean(matchSummary);
    matchSessionRef.current += 1;
    turnActionLockRef.current = false;
    clearAllTimers();
    setLocalGame(buildInitialOfflineState());
    setMatchSummary(null);
    setPersonalFinishSummary(null);
    setIsSpectating(false);
    setRerollUsedThisMatch(false);
    setRollingAnim(false);
    setBoardAnimating(false);
    setHoldPause(false);
    setHoldDiceOverride(null);
    setHoldStatusOverride(null);
    playerCapturesRef.current = 0;
    playerSixesRef.current = 0;
    summaryRecordedRef.current = false;
    finalSummaryShownRef.current = false;
    doubledRewardRef.current = false;
    prevSeatRanksRef.current = {};
    prevIsMyTurnRef.current = false;
    prevTurnIndexRef.current = 0;
    const firstPlayerName = offlineMatch?.passAndPlay?.playerNames[0]?.trim() || 'Player 1';
    flashBanner(
      isPassAndPlay ? 'PASS & PLAY!' : 'GAME START!',
      'start',
      isPassAndPlay ? `${firstPlayerName} goes first — Roll the Dice!` : 'Your Turn — Roll the Dice!',
      1450
    );
    if (wasFinishedMatch) {
      maybeShowInterstitialAfterMatch();
    }
  };

  const handleOnlineRematch = async () => {
    if (!activeRoom || rematchLoading) return;
    const wasFinishedMatch = Boolean(matchSummary);
    setRematchLoading(true);
    try {
      setMatchSummary(null);
      setPersonalFinishSummary(null);
      setIsSpectating(false);
      summaryRecordedRef.current = false;
      finalSummaryShownRef.current = false;
      doubledRewardRef.current = false;
      prevSeatRanksRef.current = {};
      await rematchOnlineRoom(activeRoom);
      if (wasFinishedMatch) {
        maybeShowInterstitialAfterMatch();
      }
    } finally {
      setRematchLoading(false);
    }
  };

  const handleTacticalAdReroll = () => {
    if (isOnline || offlineMatch?.tournamentContext || rerollUsedThisMatch) return;
    triggerRewardedAd('tactical_reroll', () => {
      setRerollUsedThisMatch(true);
      setLocalGame((prev) => ({
        ...prev,
        diceValue: 0,
        turnPhase: 'roll',
        lastActionText: `${profile.displayName} activated Second Chance Re-Roll!`,
      }));
      showToast('Re-Roll granted! Roll the dice again.', 'success');
    });
  };

  const renderSeatPill = (seat: RoomSeat) => {
    const seatRank = seat.finishRank;
    const seatDone = typeof seatRank === 'number';
    const active = !seatDone && seat.color === displayActiveColor && gameStatus === 'playing';
    const isRemoteSeatRolling =
      !seatDone &&
      remotePlayback.active &&
      remotePlayback.rolling &&
      remotePlayback.actorColor === seat.color;
    const isMe = !isPassAndPlay && !seat.isBot && seat.uid === myUid;
    const meta = PLAYER_COLOR_META[seat.color];
    const seatSteps = boardTokens[seat.color];
    const bubble = seatReaction?.color === seat.color ? seatReaction.text : null;

    const isAutoSeat = !seatDone && isOnline && !seat.isBot && Boolean(seat.autoPlay || seat.away);
    const countdownLeft =
      active && isOnline && !seat.isBot && !isAutoSeat && !isRemoteSeatRolling && turnIdleSeconds >= 8
        ? Math.max(1, ONLINE_TURN_TIMEOUT_SECONDS - turnIdleSeconds)
        : null;

    const rankBadgeStyle =
      seatRank === 1
        ? 'bg-gradient-to-b from-[#FEF08A] to-[#FACC15] border-[#CA8A04] text-[#854D0E]'
        : seatRank === 2
          ? 'bg-gradient-to-b from-[#F1F5F9] to-[#CBD5E1] border-[#64748B] text-[#1E293B]'
          : seatRank === 3
            ? 'bg-gradient-to-b from-[#FED7AA] to-[#FB923C] border-[#C2410C] text-[#7C2D12]'
            : 'bg-[#E2E8F0] border-[#94A3B8] text-[#334155]';

    return (
      <div
        key={seat.uid}
        className={`relative rounded-2xl px-2.5 py-1.5 border-2 flex items-center gap-2 transition-all duration-200 min-w-0 ${
          seatDone
            ? seatRank === 1
              ? 'bg-gradient-to-r from-[#FFFDF0] to-[#FEF9C3] border-[#EAB308] shadow-[0_2px_0_#CA8A04]'
              : 'bg-[#F8FAFC] border-[#94A3B8]'
            : active
              ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827] scale-[1.01]'
              : 'bg-white border-[#CBD5E1] opacity-85'
        }`}
      >
        {bubble && (
          <div className="absolute -top-6 left-2 z-20 px-2.5 py-0.5 rounded-lg bg-[#111827] text-white text-[10px] font-extrabold shadow-lg whitespace-nowrap animate-pop-in">
            {bubble}
          </div>
        )}
        <div className={active ? 'animate-character-idle shrink-0' : 'shrink-0'}>
          <PlayerAvatar
            avatarId={seat.avatarId}
            frameId={seat.avatarFrame}
            size="xs"
            alt={seat.name}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] sm:text-xs font-extrabold text-[#111827] truncate leading-tight">
              {isMe ? 'You' : seat.name.replace(' (Bot)', '')}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {seatDone ? (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9px] font-display font-black leading-none ${rankBadgeStyle}`}
                >
                  {seatRank === 1 && <Crown className="w-2.5 h-2.5" />}
                  #{seatRank}
                </span>
              ) : (
                <>
                  {isAutoSeat && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#FEF3C7] border border-[#D97706] text-[#B45309] text-[8px] font-display font-black leading-none"
                      title="Auto-Play Bot covering turns until player returns"
                    >
                      <Bot className="w-2.5 h-2.5" />
                      AUTO
                    </span>
                  )}
                  {active && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-white text-[9px] font-display font-black shrink-0 leading-none ${
                        isRemoteSeatRolling
                          ? 'bg-[#E11D48] animate-pulse'
                          : countdownLeft !== null
                            ? 'bg-[#D97706] animate-pulse'
                            : 'bg-[#1D4ED8]'
                      }`}
                    >
                      {isRemoteSeatRolling
                        ? 'ROLLING'
                        : countdownLeft !== null
                          ? `${countdownLeft}s`
                          : isMe && !isAutoSeat
                            ? 'YOUR TURN'
                            : 'TURN'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold leading-none text-[#475569] truncate">
              <span
                className="w-2.5 h-2.5 rounded-full border border-[#111827]/40 shrink-0"
                style={{ backgroundColor: meta.fill }}
              />
              {meta.label}
            </span>
            <div className="flex items-center gap-1 shrink-0" aria-label="Pawn progress">
              {seatSteps.map((step, i) => {
                const finished = step === 56;
                const onTrack = step >= 0 && step < 56;
                return (
                  <span
                    key={i}
                    className="w-2.5 h-2.5 rounded-full border-2 transition-all"
                    style={{
                      borderColor: finished
                        ? '#EAB308'
                        : onTrack
                          ? '#111827'
                          : '#CBD5E1',
                      backgroundColor: finished
                        ? '#FACC15'
                        : onTrack
                          ? meta.fill
                          : 'transparent',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderBoardFlashBanner = () => {
    if (!boardBanner) return null;
    const toneStyles: Record<BoardBanner['tone'], string> = {
      start: 'from-[#0D2E8A] via-[#1B57D8] to-[#0D2E8A] border-[#FFE047] text-[#FFE44D]',
      six: 'from-[#B45309] via-[#F59E0B] to-[#B45309] border-[#FFF3B0] text-[#FFFFFF]',
      capture: 'from-[#991B1B] via-[#DC2626] to-[#991B1B] border-[#FFE047] text-[#FFE44D]',
      home: 'from-[#047857] via-[#10B981] to-[#047857] border-[#D1FAE5] text-[#FFFFFF]',
      turn: 'from-[#0D2E8A] via-[#1E5EE6] to-[#0D2E8A] border-[#FFE047] text-[#FFE44D]',
    };

    return (
      <div
        key={boardBanner.id}
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center px-3"
      >
        <div
          className={`animate-banner-splash w-full max-w-[92%] py-2.5 px-4 rounded-2xl bg-gradient-to-r border-y-[3px] shadow-[0_14px_34px_rgba(4,12,48,0.72)] text-center ${toneStyles[boardBanner.tone]}`}
        >
          <div className="font-display text-xl sm:text-2xl font-black tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]">
            {boardBanner.title}
          </div>
          {boardBanner.subtitle && (
            <div className="text-[11px] sm:text-xs font-bold text-white/95 mt-0.5">
              {boardBanner.subtitle}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!activeRoom && !offlineMatch) {
    if (activeRoomId) {
      return (
        <div className="h-full flex flex-col items-center justify-center px-6 text-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#DBEAFE] border-2 border-[#111827] flex items-center justify-center animate-bounce">
            <Dices className="w-5 h-5 text-[#1D4ED8]" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#111827]">
            Connecting to table {activeRoomId}...
          </h1>
          <p className="text-xs font-semibold text-[#475569]">Syncing live seats and board state</p>
        </div>
      );
    }
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-extrabold text-[#111827]">No Active Table</h1>
        <button
          type="button"
          onClick={() => setActiveTab('lobby')}
          className="mt-5 px-6 py-3 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (isOnline && activeRoom && activeRoom.status === 'waiting') {
    const isHost = activeRoom.hostUid === myUid;
    const seatOrderColors: PlayerColor[] =
      activeRoom.maxPlayers === 2 ? ['red', 'yellow'] : ['red', 'green', 'blue', 'yellow'];
    const seatTintMap: Record<
      PlayerColor,
      { bg: string; pillBg: string; pillText: string; readyText: string; badgeBg: string; badgeText: string }
    > = {
      red: {
        bg: 'bg-gradient-to-b from-[#FFF1F5] to-[#FECDD3]',
        pillBg: 'bg-gradient-to-b from-[#FF5E7E] to-[#E11D48]',
        pillText: 'text-white',
        readyText: 'text-[#BE123C]',
        badgeBg: 'bg-gradient-to-b from-[#FF5E7E] to-[#E11D48]',
        badgeText: 'text-white',
      },
      green: {
        bg: 'bg-gradient-to-b from-[#ECFFF6] to-[#A7F3D0]',
        pillBg: 'bg-gradient-to-b from-[#34F59F] to-[#059669]',
        pillText: 'text-white',
        readyText: 'text-[#047857]',
        badgeBg: 'bg-gradient-to-b from-[#34F59F] to-[#059669]',
        badgeText: 'text-white',
      },
      blue: {
        bg: 'bg-gradient-to-b from-[#EFF8FF] to-[#BAE6FD]',
        pillBg: 'bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8]',
        pillText: 'text-white',
        readyText: 'text-[#1D4ED8]',
        badgeBg: 'bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8]',
        badgeText: 'text-white',
      },
      yellow: {
        bg: 'bg-gradient-to-b from-[#FFFCE0] to-[#FDE68A]',
        pillBg: 'bg-gradient-to-b from-[#FFF066] to-[#F59E0B]',
        pillText: 'text-[#111827]',
        readyText: 'text-[#B45309]',
        badgeBg: 'bg-gradient-to-b from-[#FFF066] to-[#F59E0B]',
        badgeText: 'text-[#111827]',
      },
    };

    const acceptedFriends = friendships.filter((f) => f.status === 'accepted');
    const seatedUids = new Set(activeRoom.seats.map((s) => s.uid));
    const availableBoardThemes = BOARD_THEMES.filter(
      (b) => b.priceCoins === 0 || wallet.unlockedCosmetics.includes(b.id)
    );
    const getInitialsLocal = (name: string) => {
      const parts = name.trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase() || 'PL';
    };

    return (
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Top Adaptive Banner Safe Zone — immediately visible above header while friends join */}
        <AdaptiveBannerAd position="top" />

        {/* Compact Studio-Bright Waiting Room Header */}
        <div className="shrink-0 h-11 px-3 sm:px-6 bg-white/95 border-b-2 border-[#E2E8F0] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleLeaveMatch(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border-2 border-[#111827] text-xs font-display font-extrabold text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave
          </button>
          <div className="text-xs font-display font-bold text-[#334155] truncate">
            {activeRoom.visibility === 'public' ? 'Public Table' : 'Private Table'} · Stake{' '}
            <span className="font-mono font-extrabold text-[#1D4ED8]">{activeRoom.entryStake}</span>
          </div>
          <button
            type="button"
            onClick={toggleSoundMuted}
            className="p-1.5 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Main Scrollable Waiting Room Content — Above-the-fold: Top Banner + Compact Code + Start CTA + 4 Seats */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar max-w-[980px] w-full mx-auto px-3.5 sm:px-6 py-3 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 items-start">
            {/* Left / Primary Column */}
            <div className="lg:col-span-3 space-y-3">
              {/* Compact Room Code + One-Tap WhatsApp & Native Share Bar */}
              <div className="studio-card rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[#64748B] shrink-0">
                      Code
                    </span>
                    <span className="font-mono text-xl sm:text-2xl font-black tracking-[0.12em] text-[#111827] leading-none">
                      {activeRoom.roomCode}
                    </span>
                    <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-[10px] font-bold text-[#334155] capitalize shrink-0">
                      <Users className="w-2.5 h-2.5 text-[#1D4ED8]" />
                      {activeRoom.maxPlayers}P · {activeRoom.mode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-3 py-1.5 rounded-xl game-btn-gold font-display font-extrabold text-xs inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* One-Tap WhatsApp + Native Share Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={buildWhatsAppShareUrl(
                      buildRoomInviteShareText({
                        roomCode: activeRoom.roomCode,
                        hostName: profile.displayName,
                        maxPlayers: activeRoom.maxPlayers,
                        mode: activeRoom.mode,
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 rounded-xl game-btn-green font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer text-center"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" />
                    <span>WhatsApp Invite</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleNativeShareRoom}
                    className="py-2 px-3 rounded-xl game-btn-blue font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Share Code</span>
                  </button>
                </div>
              </div>

              {/* Start Match Primary Action — Immediately Visible Above the Fold (No Scrolling!) */}
              <div className="space-y-2">
                {isHost ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        autoFillFiredRef.current = true;
                        hostStartRoom(activeRoom.seats.length < 2);
                      }}
                      className="flex-1 py-3 px-4 rounded-2xl font-display font-extrabold text-sm sm:text-base game-btn-blue btn-gloss-sheen inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {activeRoom.seats.length < 2
                          ? 'Fill bots & start now'
                          : 'Start match'}
                      </span>
                    </button>
                    {activeRoom.seats.length >= 2 &&
                      activeRoom.seats.length < activeRoom.maxPlayers && (
                        <button
                          type="button"
                          onClick={() => {
                            autoFillFiredRef.current = true;
                            hostStartRoom(true);
                          }}
                          className="py-2.5 px-3.5 rounded-2xl font-display font-extrabold text-xs game-btn-white cursor-pointer whitespace-nowrap"
                        >
                          + Fill with bots
                        </button>
                      )}
                  </div>
                ) : (
                  <div className="studio-card-soft rounded-2xl px-3.5 py-2.5 text-center text-xs text-[#475569] space-y-2">
                    <div>
                      Waiting for <strong className="text-[#111827]">{activeRoom.seats[0]?.name}</strong> to start the match...
                    </div>
                    {activeRoom.visibility === 'public' && guestWaitSeconds >= PUBLIC_MATCH_WAIT_SECONDS + 2 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const targetMode = activeRoom.mode;
                          const targetPlayers = activeRoom.maxPlayers;
                          await exitActiveRoom();
                          launchOfflinePractice({
                            mode: targetMode,
                            playerCount: targetPlayers,
                            difficulty: 'tactical',
                          });
                        }}
                        className="w-full py-2 px-3 rounded-xl font-display font-extrabold text-xs game-btn-gold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Host busy? Play Instant Match vs Bot</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Auto-Fill Quick Match Countdown Banner (Public Rooms Only — 30s Wait Window) */}
                {activeRoom.visibility === 'public' && (
                  <div className="rounded-2xl bg-gradient-to-r from-[#EFF8FF] via-[#E0F2FE] to-[#FEF9C3] border-2 border-[#111827] shadow-[0_3px_0_#111827] px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-[#1D4ED8] text-white border-2 border-[#111827] flex items-center justify-center shrink-0">
                          {autoFillPaused ? <Pause className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-xs font-extrabold text-[#111827] truncate">
                            {activeRoom.seats.length >= activeRoom.maxPlayers
                              ? 'Table full! Starting match...'
                              : isHost
                                ? autoFillPaused
                                  ? 'Auto-fill paused · Waiting for players'
                                  : `Finding players · Smart bots join in ${autoFillSeconds}s`
                                : 'Public Match · Starting once full or after 30s'}
                          </div>
                        </div>
                      </div>

                      {isHost && activeRoom.seats.length < activeRoom.maxPlayers && (
                        <button
                          type="button"
                          onClick={() => {
                            setAutoFillPaused((p) => {
                              const next = !p;
                              if (!next && autoFillSeconds === 0) {
                                setAutoFillSeconds(PUBLIC_MATCH_WAIT_SECONDS);
                              }
                              return next;
                            });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white border-2 border-[#111827] text-[11px] font-display font-extrabold text-[#111827] hover:bg-[#FEF9C3] cursor-pointer shrink-0 inline-flex items-center gap-1"
                        >
                          <Clock className="w-3 h-3 text-[#1D4ED8]" />
                          {autoFillPaused ? 'Resume' : 'Wait'}
                        </button>
                      )}
                    </div>

                    {isHost && !autoFillPaused && activeRoom.seats.length < activeRoom.maxPlayers && (
                      <div className="h-1.5 rounded-full bg-white border border-[#93C5FD] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#2563EB] to-[#10B981] transition-all duration-700"
                          style={{
                            width: `${Math.min(
                              100,
                              ((PUBLIC_MATCH_WAIT_SECONDS - autoFillSeconds) / PUBLIC_MATCH_WAIT_SECONDS) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Compact 2x2 Color-Tinted Table Seats Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm sm:text-base font-extrabold text-[#111827]">
                    Table seats
                  </h2>
                  <span className="font-mono text-xs font-bold text-[#475569]">
                    {activeRoom.seats.length} / {activeRoom.maxPlayers} joined
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {seatOrderColors.map((slotColor, idx) => {
                    const seat =
                      activeRoom.seats.find((s) => s.color === slotColor) ||
                      activeRoom.seats[idx];
                    const tint = seatTintMap[seat ? seat.color : slotColor];
                    const colorLabel = PLAYER_COLOR_META[seat ? seat.color : slotColor].label;

                    if (!seat) {
                      return (
                        <button
                          key={`open-${slotColor}-${idx}`}
                          type="button"
                          onClick={() => setInviteModalOpen(true)}
                          className="group rounded-2xl border-2 border-dashed border-[#60A5FA] hover:border-[#111827] bg-white/95 hover:bg-[#EFF8FF] p-2.5 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[84px] shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold ${tint.pillBg} ${tint.pillText} border border-[#111827]/20`}
                            >
                              {colorLabel}
                            </span>
                            <span className="text-[10px] font-bold text-[#2563EB]">Open</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-[#38BDF8] bg-[#EFF8FF] flex items-center justify-center text-[#1D4ED8] shrink-0 group-hover:scale-105 transition-transform">
                              <UserPlus className="w-3.5 h-3.5 animate-badge-bob" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-xs font-extrabold text-[#111827] leading-tight">
                                Invite
                              </div>
                              <div className="text-[10px] font-semibold text-[#64748B]">Tap to add</div>
                            </div>
                          </div>
                        </button>
                      );
                    }

                    const isSeatHost = seat.uid === activeRoom.hostUid;
                    const isSeatMe = seat.uid === myUid;
                    return (
                      <div
                        key={seat.uid}
                        className={`rounded-2xl ${tint.bg} border-2 border-[#111827] shadow-[0_3px_0_#111827] p-2.5 flex flex-col justify-between min-h-[84px]`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-display font-extrabold ${tint.pillBg} ${tint.pillText}`}
                          >
                            {colorLabel}
                          </span>
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${tint.readyText}`}
                          >
                            <Check className="w-3 h-3" />
                            Ready
                          </span>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full border-2 border-[#111827] ${tint.badgeBg} ${tint.badgeText} font-display font-black text-[11px] flex items-center justify-center shrink-0`}
                            >
                              {getInitialsLocal(seat.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-xs font-extrabold text-[#111827] truncate leading-tight">
                                {seat.name}
                              </div>
                              <div className="text-[10px] font-semibold text-[#475569]">
                                {isSeatHost ? 'Host' : isSeatMe ? 'You' : seat.isBot ? 'Bot' : 'Player'}
                              </div>
                            </div>
                          </div>
                          {!isSeatMe && !seat.isBot && (
                            <FriendActionButton
                              target={{
                                uid: seat.uid,
                                displayName: seat.name,
                                avatarId: seat.avatarId,
                              }}
                              compact
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* High-Visibility Opt-In Rewarded Boost while waiting for friends to join */}
              <div className="rounded-2xl bg-gradient-to-r from-[#FFFCE0] via-[#FEF9C3] to-[#ECFDF5] border-2 border-[#111827] shadow-[0_3px_0_#111827] px-3 py-2.5 flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-[#FFF066] to-[#F59E0B] border-2 border-[#111827] flex items-center justify-center text-[#111827] shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-xs font-extrabold text-[#111827] truncate">
                      Earn +250 Free Coins while waiting
                    </div>
                    <div className="text-[11px] font-semibold text-[#475569] truncate">
                      Quick optional video · Instant coin boost
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    triggerRewardedAd('daily_bonus_coins', () => {
                      showToast('+250 Waiting Room Bonus Coins credited!', 'success');
                    })
                  }
                  className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  Watch Ad
                </button>
              </div>

              {/* Board Edition & Arena Backdrop Quick Selectors */}
              <div className="space-y-2.5 pt-0.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-extrabold text-[#111827]">
                      Board edition
                    </h2>
                    <span className="text-[11px] font-semibold text-[#64748B]">
                      Frame, track &amp; stars
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {availableBoardThemes.slice(0, 4).map((theme) => {
                      const selected = profile.boardTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() =>
                            saveCustomization({
                              displayName: profile.displayName,
                              avatarId: profile.avatarId,
                              avatarFrame: profile.avatarFrame,
                              boardTheme: theme.id,
                              diceTheme: profile.diceTheme,
                            })
                          }
                          className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                            selected
                              ? 'bg-white border-2 border-[#111827] shadow-[0_2px_0_#111827]'
                              : 'bg-white/85 border border-[#CBD5E1] hover:border-[#111827]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-6 h-6 rounded-lg p-[2px] border border-[#111827]/40 shrink-0 flex items-center justify-center"
                              style={{ background: theme.outerBezelGradient }}
                            >
                              <span
                                className="w-full h-full rounded-[3px] border"
                                style={{
                                  backgroundColor: theme.tileBg,
                                  borderColor: theme.frameBg,
                                }}
                              />
                            </span>
                            <span className="font-display text-xs font-extrabold text-[#111827] truncate">
                              {theme.name}
                            </span>
                          </div>
                          <span
                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? 'border-[#1D4ED8]' : 'border-[#94A3B8]'
                            }`}
                          >
                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8]" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Ambient Backdrop Variations (All 5 Free) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-extrabold text-[#111827]">
                      Table backdrop
                    </h2>
                    <span className="text-[11px] font-semibold text-[#64748B]">
                      {activeBackdropTheme.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    {BACKDROP_THEMES.map((bg) => {
                      const activeBg = backdropThemeId === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          onClick={() => setBackdropThemeId(bg.id)}
                          className={`px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shrink-0 cursor-pointer transition-all ${
                            activeBg
                              ? 'bg-white border-2 border-[#111827] shadow-[0_2px_0_#111827]'
                              : 'bg-white/85 border border-[#CBD5E1] hover:border-[#111827]'
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-[#111827]/30 shrink-0"
                            style={{
                              background: `linear-gradient(135deg, ${bg.swatchColors[0]} 0%, ${bg.swatchColors[1]} 52%, ${bg.swatchColors[2]} 100%)`,
                            }}
                          />
                          <span className="font-display text-[11px] font-extrabold text-[#111827] whitespace-nowrap">
                            {bg.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Clean Studio-Bright Room Chat */}
            <div className="lg:col-span-2 studio-card rounded-3xl p-4 flex flex-col h-[310px] lg:h-[430px]">
              <div className="flex items-center gap-2 pb-2.5 border-b border-[#E2E8F0]">
                <MessageSquare className="w-4 h-4 text-[#1D4ED8]" />
                <h2 className="font-display text-sm font-extrabold text-[#111827]">Room Chat</h2>
              </div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto no-scrollbar py-2.5 space-y-2">
                {roomMessages.length === 0 ? (
                  <p className="text-xs text-[#64748B] py-6 text-center">
                    Chat while friends join room {activeRoom.roomCode}!
                  </p>
                ) : (
                  roomMessages.map((msg) => (
                    <div key={msg.id} className="text-xs leading-relaxed">
                      <span
                        className="font-extrabold"
                        style={{ color: PLAYER_COLOR_META[msg.senderColor].dark }}
                      >
                        {msg.senderName}
                      </span>
                      <span className="text-[#94A3B8] mx-1">:</span>
                      <span className="text-[#111827]">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChat} className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  maxLength={160}
                  placeholder="Say hi..."
                  className="flex-1 bg-[#F8FAFC] border-2 border-[#CBD5E1] focus:border-[#111827] rounded-xl px-3 py-2 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-2.5 rounded-xl game-btn-blue cursor-pointer"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Inline Friend Invite Selector Modal triggered by tapping an Open Seat */}
        {inviteModalOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[70] bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Invite friends to room"
              onClick={(e) => {
                if (e.target === e.currentTarget) setInviteModalOpen(false);
              }}
            >
              <div className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#1D4ED8]" />
                  <h3 className="font-display text-lg font-extrabold text-[#111827]">
                    Invite a friend
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="p-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] cursor-pointer"
                  aria-label="Close invite modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {acceptedFriends.length === 0 ? (
                <div className="text-center py-3 space-y-2.5">
                  <p className="text-xs text-[#475569]">
                    No friends in your squad yet. Copy room code{' '}
                    <strong className="font-mono text-[#111827]">{activeRoom.roomCode}</strong> and
                    share it directly!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyCode();
                      setInviteModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer"
                  >
                    Copy Room Code
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
                  {acceptedFriends.map((f) => {
                    const isReq = f.requesterUid === profile.uid;
                    const friendUid = isReq ? f.recipientUid : f.requesterUid;
                    const friendName = isReq ? f.recipientName : f.requesterName;
                    const alreadySeated = seatedUids.has(friendUid);
                    return (
                      <div
                        key={f.id}
                        className="p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#1D4ED8] text-white border-2 border-[#111827] font-display font-black text-xs flex items-center justify-center shrink-0">
                            {getInitialsLocal(friendName)}
                          </div>
                          <span className="font-display text-sm font-extrabold text-[#111827] truncate">
                            {friendName}
                          </span>
                        </div>
                        {alreadySeated ? (
                          <span className="text-xs font-bold text-[#10B981] shrink-0">Joined</span>
                        ) : (
                          <button
                            type="button"
                            disabled={invitingUid === friendUid}
                            onClick={async () => {
                              setInvitingUid(friendUid);
                              try {
                                await inviteFriendToPlay(friendUid, friendName);
                              } finally {
                                setInvitingUid(null);
                              }
                            }}
                            className="px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer disabled:opacity-60 shrink-0"
                          >
                            {invitingUid === friendUid ? 'Sent!' : 'Send Invite'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2.5 rounded-2xl font-display font-extrabold text-xs game-btn-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy room code {activeRoom.roomCode}
              </button>
              </div>
            </div>,
            document.body
          )}
      </div>
    );
  }

  const canUseAdReroll =
    !isOnline &&
    !isPassAndPlay &&
    !offlineMatch?.tournamentContext &&
    isMyTurn &&
    turnPhase === 'move' &&
    rawDiceValue < 6 &&
    !rerollUsedThisMatch &&
    !shouldAutoPlayOnlyMove;

  const hasNativeTopBanner = hasCapacitorAdMobPlugin();
  const mobileBoardSizeClass = hasNativeTopBanner
    ? seats.length > 2
      ? 'w-[min(calc(100vw-16px),max(244px,calc(100dvh-328px)))]'
      : 'w-[min(calc(100vw-16px),max(256px,calc(100dvh-272px)))]'
    : seats.length > 2
      ? 'w-[min(calc(100vw-16px),max(272px,calc(100dvh-268px)))]'
      : 'w-[min(calc(100vw-16px),max(272px,calc(100dvh-212px)))]';

  const turnBannerLabel = remotePlayback.active
    ? remotePlayback.statusText
    : boardAnimating
      ? 'Moving pawn...'
      : holdPause
        ? holdStatusOverride || 'Passing turn...'
        : isPassAndPlay && currentSeat && !currentSeat.isBot
          ? turnPhase === 'roll'
            ? `${currentSeat.name.toUpperCase()} (${PLAYER_COLOR_META[currentSeat.color].label}) — ROLL DICE!`
            : `${currentSeat.name.toUpperCase()} — TAP A BOUNCING PAWN!`
          : isMyTurn && turnPhase === 'roll'
            ? 'YOUR TURN — TAP ROLL DICE!'
            : isMyTurn && turnPhase === 'move'
              ? 'YOUR TURN — TAP A BOUNCING PAWN!'
              : `${currentSeat?.name.replace(' (Bot)', '') || 'Opponent'}'s Turn...`;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Dedicated Top Adaptive Banner Safe Zone (isolated above Match Header Bar for zero accidental clicks) */}
      <AdaptiveBannerAd position="top" />

      {/* Crisp Studio-Bright Top Gameplay Bar */}
      <header className="shrink-0 h-11 px-3 sm:px-6 bg-white/95 backdrop-blur-md border-b-2 border-[#E2E8F0] flex items-center justify-between gap-2 z-20">
        <button
          type="button"
          onClick={() => handleLeaveMatch(false)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border-2 border-[#111827] text-xs font-display font-extrabold text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        <div className="min-w-0 text-center">
          <div className="text-[11px] sm:text-xs font-display font-extrabold text-[#111827] truncate">
            {isOnline
              ? `Live Table · ${activeRoom!.roomCode}`
              : isPassAndPlay
                ? `Pass & Play · ${seats.length}P Offline`
                : offlineMatch?.tournamentContext
                  ? `${offlineMatch.tournamentContext.tournamentTitle}`
                  : `VS Computer · ${(offlineMatch?.difficulty || 'tactical').toUpperCase()}`}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono tabular-nums text-[#64748B] hidden sm:inline">
            Turn {turnCount + 1}
          </span>
          <button
            type="button"
            onClick={handleCycleBackdrop}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] text-[11px] font-display font-extrabold cursor-pointer"
            title={`Switch background theme (${activeBackdropTheme.name})`}
            aria-label={`Switch background theme, current: ${activeBackdropTheme.name}`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full border border-[#111827]/40 shrink-0"
              style={{
                background: `linear-gradient(135deg, ${activeBackdropTheme.swatchColors[0]}, ${activeBackdropTheme.swatchColors[1]}, ${activeBackdropTheme.swatchColors[2]})`,
              }}
            />
            <Palette className="w-3.5 h-3.5 text-[#1D4ED8] sm:hidden" />
            <span className="hidden sm:inline">{activeBackdropTheme.name}</span>
          </button>
          <button
            type="button"
            onClick={toggleSoundMuted}
            className="p-1.5 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Graceful Network Disconnect / Reconnecting Status Bar */}
      {isOnline && !networkOnline && (
        <div
          role="status"
          className="shrink-0 z-20 bg-[#FEE2E2] border-b-2 border-[#111827] px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <WifiOff className="w-4 h-4 text-[#DC2626] shrink-0 animate-pulse" />
            <span className="font-display font-extrabold text-[#991B1B] truncate">
              Connection lost · Reconnecting… Auto-Play will cover your turns
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleLeaveMatch(true)}
            className="px-2.5 py-1 rounded-lg bg-white border border-[#111827] text-[11px] font-display font-extrabold text-[#111827] shrink-0 cursor-pointer"
          >
            Home
          </button>
        </div>
      )}

      {isOnline && networkOnline && reconnecting && (
        <div
          role="status"
          className="shrink-0 z-20 bg-[#DCFCE7] border-b-2 border-[#111827] px-3 py-1.5 flex items-center justify-center gap-2 text-xs"
        >
          <Wifi className="w-3.5 h-3.5 text-[#059669] shrink-0" />
          <span className="font-display font-extrabold text-[#065F46]">
            Back online! Syncing live board state…
          </span>
        </div>
      )}

      {/* Auto-Play Active Take-Control Bar (if player timed out or toggled Auto-Play) */}
      {isOnline && networkOnline && gameStatus === 'playing' && !myFinished && mySeat?.autoPlay && (
        <div
          role="status"
          className="shrink-0 z-20 bg-gradient-to-r from-[#FEF9C3] to-[#FDE68A] border-b-2 border-[#111827] px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-4 h-4 text-[#B45309] shrink-0" />
            <span className="font-display font-extrabold text-[#111827] truncate">
              Auto-Play is covering your turns
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMySeatAutoPlay(false)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg game-btn-blue text-[11px] font-display font-extrabold shrink-0 cursor-pointer"
          >
            <Hand className="w-3 h-3" />
            Take Control
          </button>
        </div>
      )}

      {/* Live Spectating Bar (when local player already finished & is watching remaining players complete the match) */}
      {gameStatus === 'playing' && (isSpectating || (myFinished && !matchSummary)) && (
        <div
          role="status"
          className="shrink-0 z-20 bg-gradient-to-r from-[#ECFDF5] via-[#DCFCE7] to-[#FEF9C3] border-b-2 border-[#111827] px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-4 h-4 text-[#047857] shrink-0" />
            <span className="font-display font-extrabold text-[#111827] truncate">
              Spectating · You finished #{myFinishRank || 1} · {remainingActiveSeatsCount} still racing
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {personalFinishSummary && (
              <button
                type="button"
                onClick={() => setMatchSummary(personalFinishSummary)}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#111827] text-[11px] font-display font-extrabold text-[#1D4ED8] cursor-pointer"
              >
                My Result
              </button>
            )}
            <button
              type="button"
              onClick={() => handleLeaveMatch(true)}
              className="px-2.5 py-1 rounded-lg bg-white border border-[#111827] text-[11px] font-display font-extrabold text-[#111827] cursor-pointer"
            >
              Home
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
        {/* MOBILE & TABLET FULL-SCREEN BOARD STAGE (< lg) */}
        <div className="lg:hidden min-h-full w-full flex flex-col items-center justify-between px-2 py-1.5 pb-2.5 gap-1.5">
          {/* Unmistakable Top Turn Status Ribbon */}
          <div
            className={`shrink-0 ${mobileBoardSizeClass} px-3 py-1.5 rounded-xl border-2 text-center font-display text-xs font-extrabold tracking-wide transition-all ${
              isMyTurn
                ? 'bg-[#FACC15] border-[#111827] text-[#111827] shadow-[0_3px_0_#111827]'
                : 'bg-white border-[#CBD5E1] text-[#334155]'
            }`}
          >
            {turnBannerLabel}
          </div>

          <div className={`shrink-0 ${mobileBoardSizeClass} grid grid-cols-2 gap-1.5`}>
            {seats.slice(0, 2).map((seat) => renderSeatPill(seat))}
          </div>

          <div className="w-full flex items-center justify-center my-auto">
            <div className={`relative ${mobileBoardSizeClass} aspect-square`}>
              {!isDesktopViewport && (
                <LudoBoard
                  tokens={boardTokens}
                  activeColors={activeColors}
                  currentTurnColor={displayActiveColor}
                  myColor={isPassAndPlay ? currentSeat?.color || null : mySeat?.color || null}
                  playerNames={playerNamesMap}
                  movableTokenIndices={movableTokenIndices}
                  canInteract={
                    isMyTurn && turnPhase === 'move' && !boardAnimating && !holdPause && !remotePlayback.active
                  }
                  boardThemeId={profile.boardTheme}
                  diceValue={rawDiceValue}
                  onSelectToken={(idx) => executeTokenMove(currentSeat, idx, 'human')}
                  onAnimatingChange={handleBoardAnimatingChange}
                />
              )}
              {renderBoardFlashBanner()}
            </div>
          </div>

          {seats.length > 2 && (
            <div className={`shrink-0 ${mobileBoardSizeClass} grid grid-cols-2 gap-1.5`}>
              {seats.slice(2, 4).map((seat) => renderSeatPill(seat))}
            </div>
          )}

          {/* Ergonomic Bottom Thumb Dock */}
          <div className="shrink-0 w-full max-w-md flex items-center gap-2 pt-0.5 pb-1">
            <button
              type="button"
              onClick={() => {
                setChatSheetOpen(true);
                setUnreadChat(0);
              }}
              className="relative w-14 h-[60px] shrink-0 rounded-2xl bg-white border-2 border-[#111827] shadow-[0_3px_0_#111827] text-[#1D4ED8] flex items-center justify-center active:translate-y-0.5 transition-transform cursor-pointer"
              aria-label="Open emotes and live chat"
            >
              <MessageSquare className="w-5 h-5" />
              {unreadChat > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#E11D48] text-white text-[10px] font-bold flex items-center justify-center border border-[#111827]">
                  {unreadChat}
                </span>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <DiceControl
                value={diceValue}
                rolling={effectiveRollingAnim}
                canRoll={
                  isMyTurn && turnPhase === 'roll' && !boardAnimating && !holdPause && !remotePlayback.active
                }
                diceThemeId={profile.diceTheme}
                activeColor={displayActiveColor}
                onRoll={() => executeDiceRoll(currentSeat, 'human')}
                statusSubtext={
                  remotePlayback.active
                    ? remotePlayback.statusText
                    : boardAnimating
                      ? 'Moving pawn...'
                      : holdPause
                        ? holdStatusOverride || 'Next player...'
                        : shouldAutoPlayOnlyMove
                          ? 'Moving only legal pawn...'
                          : isMyTurn && turnPhase === 'roll'
                            ? isPassAndPlay && currentSeat
                              ? `${currentSeat.name}'s Turn — Tap to Roll!`
                              : 'Your Turn — Tap to Roll!'
                            : isMyTurn && turnPhase === 'move'
                              ? 'Tap a bouncing pawn on the board'
                              : lastActionText
                }
                fullWidth
              />
            </div>

            {canUseAdReroll && !boardAnimating && (
              <button
                type="button"
                onClick={handleTacticalAdReroll}
                className="h-[60px] px-2.5 shrink-0 rounded-2xl game-btn-gold text-[10px] font-extrabold flex flex-col items-center justify-center cursor-pointer"
                title="Watch Ad for 1x Re-Roll"
              >
                <Dices className="w-4 h-4" />
                <span>Re-Roll</span>
              </button>
            )}
          </div>
        </div>

        {/* DESKTOP FULL-SCREEN BOARD STAGE (lg:) */}
        <div className="hidden lg:grid min-h-full max-w-[1220px] w-full mx-auto px-6 py-3 grid-cols-12 gap-6 items-center">
          <div className="col-span-7 flex flex-col items-center justify-center gap-2 min-h-0">
            <div className="w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] grid grid-cols-2 gap-2.5 shrink-0">
              {seats.slice(0, 2).map((seat) => renderSeatPill(seat))}
            </div>

            <div className="relative w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] aspect-square shrink-0">
              {isDesktopViewport && (
                <LudoBoard
                  tokens={boardTokens}
                  activeColors={activeColors}
                  currentTurnColor={displayActiveColor}
                  myColor={isPassAndPlay ? currentSeat?.color || null : mySeat?.color || null}
                  playerNames={playerNamesMap}
                  movableTokenIndices={movableTokenIndices}
                  canInteract={
                    isMyTurn && turnPhase === 'move' && !boardAnimating && !holdPause && !remotePlayback.active
                  }
                  boardThemeId={profile.boardTheme}
                  diceValue={rawDiceValue}
                  onSelectToken={(idx) => executeTokenMove(currentSeat, idx, 'human')}
                  onAnimatingChange={handleBoardAnimatingChange}
                />
              )}
              {renderBoardFlashBanner()}
            </div>

            {seats.length > 2 && (
              <div className="w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] grid grid-cols-2 gap-2.5 shrink-0">
                {seats.slice(2, 4).map((seat) => renderSeatPill(seat))}
              </div>
            )}
          </div>

          <div className="col-span-5 flex flex-col gap-3.5 min-h-[420px] max-h-[640px]">
            {/* Studio-Bright Turn Control Card */}
            <div
              className={`shrink-0 rounded-3xl border-2 p-4 transition-all ${
                isMyTurn
                  ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_4px_0_#111827]'
                  : 'studio-card'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full border border-[#111827] shrink-0"
                    style={{
                      backgroundColor: PLAYER_COLOR_META[displayActiveColor].fill,
                    }}
                  />
                  <span className="font-display text-sm font-extrabold text-[#111827]">
                    {remotePlayback.active
                      ? `${remotePlayback.actorName}'s Turn`
                      : isPassAndPlay && currentSeat && !currentSeat.isBot
                        ? `${currentSeat.name}'s Turn`
                        : isMyTurn
                          ? 'YOUR TURN!'
                          : `${currentSeat?.name.replace(' (Bot)', '')}'s Turn`}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-display font-extrabold ${
                    isMyTurn
                      ? 'bg-[#1D4ED8] text-white'
                      : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  {remotePlayback.rolling
                    ? 'Rolling...'
                    : boardAnimating
                      ? 'Moving...'
                      : holdPause || remotePlayback.active
                        ? 'Next Turn...'
                        : turnPhase === 'roll'
                          ? 'Roll Dice'
                          : 'Move Pawn'}
                </span>
              </div>

              <p className="mt-2 text-xs font-medium text-[#334155] min-h-[28px] leading-relaxed">
                {lastActionText}
              </p>

              <div className="mt-3 flex items-center gap-2.5">
                <div className="flex-1 min-w-0">
                  <DiceControl
                    value={diceValue}
                    rolling={effectiveRollingAnim}
                    canRoll={
                      isMyTurn && turnPhase === 'roll' && !boardAnimating && !holdPause && !remotePlayback.active
                    }
                    diceThemeId={profile.diceTheme}
                    activeColor={displayActiveColor}
                    onRoll={() => executeDiceRoll(currentSeat, 'human')}
                    statusSubtext={
                      remotePlayback.active
                        ? remotePlayback.statusText
                        : boardAnimating
                          ? 'Hopping square by square...'
                          : holdPause
                            ? holdStatusOverride || 'Passing turn...'
                            : shouldAutoPlayOnlyMove
                              ? 'Moving only legal pawn...'
                              : isMyTurn && turnPhase === 'roll'
                                ? 'Tap button or press Space'
                                : isMyTurn && turnPhase === 'move'
                                  ? 'Click any bouncing pawn'
                                  : undefined
                    }
                    fullWidth
                  />
                </div>

                {canUseAdReroll && !boardAnimating && (
                  <button
                    type="button"
                    onClick={handleTacticalAdReroll}
                    className="inline-flex items-center gap-1.5 px-3 py-3 rounded-2xl game-btn-gold text-xs font-extrabold cursor-pointer whitespace-nowrap"
                  >
                    <Dices className="w-4 h-4" />
                    Re-Roll (Ad)
                  </button>
                )}
              </div>
            </div>

            {/* Table Chat & Quick Reactions */}
            <div className="flex-1 min-h-0 studio-card rounded-3xl p-4 flex flex-col">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E8F0] shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#1D4ED8]" />
                  <span className="font-display text-xs font-extrabold text-[#111827]">
                    {isOnline ? 'Live Table Chat & Emotes' : 'Quick Emotes'}
                  </span>
                </div>
                <span className="text-[11px] text-[#64748B]">
                  {isOnline ? 'Live Sync' : 'Tap to react'}
                </span>
              </div>

              {isOnline ? (
                <>
                  <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2.5 space-y-2">
                    {roomMessages.length === 0 ? (
                      <p className="text-xs text-[#64748B] py-6 text-center">
                        Tap a quick emote or type a message to players!
                      </p>
                    ) : (
                      roomMessages.map((msg) => (
                        <div key={msg.id} className="text-xs leading-relaxed">
                          <span
                            className="font-extrabold"
                            style={{ color: PLAYER_COLOR_META[msg.senderColor].dark }}
                          >
                            {msg.senderName}
                          </span>
                          <span className="text-[#94A3B8] mx-1">:</span>
                          <span className={msg.kind === 'emote' ? 'text-[#1D4ED8] font-bold' : 'text-[#111827]'}>
                            {msg.text}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2">
                    {QUICK_CHAT_EMOTES.map((emote) => (
                      <button
                        key={emote}
                        type="button"
                        onClick={() => sendChat(emote, 'emote')}
                        className="px-2.5 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-[11px] font-bold text-[#334155] hover:border-[#111827] whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        {emote}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="shrink-0 flex items-center gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      maxLength={160}
                      placeholder="Send message..."
                      className="flex-1 bg-[#F8FAFC] border-2 border-[#CBD5E1] focus:border-[#111827] rounded-xl px-3 py-2 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="p-2.5 rounded-xl game-btn-blue cursor-pointer"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col justify-between pt-3 min-h-0">
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_CHAT_EMOTES.map((emote) => (
                      <button
                        key={emote}
                        type="button"
                        onClick={() => {
                          tabletopAudio.playTokenMove();
                          triggerSeatBubble(mySeat?.color || currentSeat?.color || 'red', emote);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] hover:border-[#111827] text-xs font-bold text-[#334155] active:scale-95 transition-transform text-left cursor-pointer"
                      >
                        {emote}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] text-[11px] text-[#1E40AF]">
                    Tip: Hover over any bouncing pawn to preview its landing square. Star tiles keep your
                    pawns safe!
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Slide-Up Live Chat & Quick Emotes Sheet */}
      {chatSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-xs flex items-end justify-center lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Table Chat and Emotes"
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-white border-t-2 border-[#111827] p-4 pb-6 shadow-2xl animate-pop-in flex flex-col max-h-[68dvh]">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mb-2.5" />
            <div className="flex items-center justify-between pb-2.5 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1D4ED8]" />
                <span className="font-display text-sm font-extrabold text-[#111827]">
                  {isOnline ? 'Live Table Chat & Emotes' : 'Quick Table Emotes'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatSheetOpen(false)}
                className="p-1.5 rounded-xl bg-[#F1F5F9] text-[#334155] cursor-pointer"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isOnline ? (
              <>
                <div className="flex-1 min-h-[120px] max-h-[220px] overflow-y-auto no-scrollbar py-2.5 space-y-2">
                  {roomMessages.length === 0 ? (
                    <p className="text-xs text-[#64748B] py-4 text-center">
                      No messages yet — send a quick emote below!
                    </p>
                  ) : (
                    roomMessages.map((msg) => (
                      <div key={msg.id} className="text-xs leading-relaxed">
                        <span
                          className="font-extrabold"
                          style={{ color: PLAYER_COLOR_META[msg.senderColor].dark }}
                        >
                          {msg.senderName}
                        </span>
                        <span className="text-[#94A3B8] mx-1">:</span>
                        <span className={msg.kind === 'emote' ? 'text-[#1D4ED8] font-bold' : 'text-[#111827]'}>
                          {msg.text}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2.5">
                  {QUICK_CHAT_EMOTES.map((emote) => (
                    <button
                      key={emote}
                      type="button"
                      onClick={() => {
                        sendChat(emote, 'emote');
                        setChatSheetOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-bold text-[#334155] whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {emote}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendChat} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    maxLength={160}
                    placeholder="Type message..."
                    className="flex-1 bg-[#F8FAFC] border-2 border-[#CBD5E1] focus:border-[#111827] rounded-xl px-3 py-2.5 text-xs text-[#111827] placeholder:text-[#94A3B8] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl game-btn-blue cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="pt-3 grid grid-cols-2 gap-2">
                {QUICK_CHAT_EMOTES.map((emote) => (
                  <button
                    key={emote}
                    type="button"
                    onClick={() => {
                      tabletopAudio.playTokenMove();
                      triggerSeatBubble(mySeat?.color || currentSeat?.color || 'red', emote);
                      setChatSheetOpen(false);
                    }}
                    className="px-3 py-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs font-bold text-[#334155] active:scale-95 transition-transform text-left cursor-pointer"
                  >
                    {emote}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Early Victory / Finish Modal (with Spectate Option) & Final Match Results Screen */}
      {matchSummary && !boardAnimating && !remotePlayback.active && (() => {
        const isFinalScreen = Boolean(matchSummary.isFinalResults || gameStatus === 'finished');
        const myRankNum = matchSummary.finishRank || 1;
        const myOrdinal = formatOrdinalRank(myRankNum);
        const standingsList = matchSummary.standings || buildFinalStandings(seats, tokens);

        return (
          <div
            className="fixed inset-0 z-50 bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={isFinalScreen ? 'Final Match Results' : 'Match Victory'}
          >
            <div className="relative overflow-hidden w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in">
              {(matchSummary.won || myRankNum === 1) && (
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-28 overflow-hidden">
                  {CONFETTI_PIECES.map((c, idx) => (
                    <span
                      key={idx}
                      className="absolute top-0 w-2.5 h-2.5 rounded-sm animate-confetti"
                      style={{
                        left: c.left,
                        backgroundColor: c.color,
                        animationDelay: c.delay,
                      }}
                    />
                  ))}
                </div>
              )}

              <div className="relative text-center">
                {isFinalScreen && seats.length > 2 && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#93C5FD] text-[10px] font-display font-black uppercase tracking-wider text-[#1D4ED8] mb-2">
                    <Trophy className="w-3 h-3" />
                    Final Results
                  </div>
                )}
                {!isFinalScreen && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] border border-[#059669] text-[10px] font-display font-black uppercase tracking-wider text-[#065F46] mb-2">
                    <Eye className="w-3 h-3" />
                    Match Still Live
                  </div>
                )}
                <div className="w-16 h-16 rounded-2xl bg-[#FEF9C3] border-2 border-[#111827] text-[#EAB308] mx-auto flex items-center justify-center shadow-xs">
                  {myRankNum === 1 ? (
                    <Crown className="w-8 h-8" />
                  ) : myRankNum <= 3 ? (
                    <Trophy className="w-8 h-8 text-[#D97706]" />
                  ) : (
                    <Sparkles className="w-8 h-8 text-[#1D4ED8]" />
                  )}
                </div>
                <h2 className="mt-3 font-display text-2xl font-black text-[#111827] tracking-tight">
                  {!isFinalScreen
                    ? isPassAndPlay
                      ? `${matchSummary.winnerName.toUpperCase()} FINISHED ${myOrdinal.toUpperCase()}!`
                      : myRankNum === 1
                        ? 'CROWN VICTORY!'
                        : `FINISHED ${myOrdinal.toUpperCase()}!`
                    : isPassAndPlay
                      ? `${matchSummary.winnerName.toUpperCase()} WINS!`
                      : matchSummary.won
                        ? 'CROWN VICTORY!'
                        : seats.length > 2
                          ? `${myOrdinal.toUpperCase()} PLACE FINISH`
                          : `${matchSummary.winnerName} WINS`}
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#64748B]">
                  {!isFinalScreen
                    ? `${remainingActiveSeatsCount} player${remainingActiveSeatsCount === 1 ? '' : 's'} still racing · Watch live or head Home`
                    : `Completed in ${matchSummary.turnsPlayed} turns`}
                </p>
              </div>

              {/* Ranked Standings Podium List */}
              {standingsList.length > 0 && (isFinalScreen || standingsList.length > 2) && (
                <div className="mt-4 rounded-2xl bg-[#F8FAFC] border-2 border-[#E2E8F0] p-2.5 space-y-1.5">
                  <div className="px-1 flex items-center justify-between">
                    <span className="text-[10px] font-display font-black uppercase tracking-wider text-[#475569]">
                      {isFinalScreen ? 'Final Standings' : 'Current Standings'}
                    </span>
                    <span className="text-[10px] font-bold text-[#64748B]">Pawns Home</span>
                  </div>
                  {standingsList.map((entry) => {
                    const isSelf = !isPassAndPlay && !entry.isBot && entry.uid === myUid;
                    const seatFinishedNow = entry.finishedTokens === 4;
                    const medalCls =
                      entry.rank === 1
                        ? 'bg-gradient-to-b from-[#FEF08A] to-[#FACC15] border-[#CA8A04] text-[#854D0E]'
                        : entry.rank === 2
                          ? 'bg-gradient-to-b from-[#F1F5F9] to-[#CBD5E1] border-[#64748B] text-[#1E293B]'
                          : entry.rank === 3
                            ? 'bg-gradient-to-b from-[#FED7AA] to-[#FB923C] border-[#C2410C] text-[#7C2D12]'
                            : 'bg-[#E2E8F0] border-[#94A3B8] text-[#475569]';
                    return (
                      <div
                        key={`${entry.uid}-${entry.color}`}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                          isSelf
                            ? 'bg-[#EFF6FF] border-[#2563EB]'
                            : entry.rank === 1
                              ? 'bg-[#FFFDF0] border-[#FACC15]'
                              : 'bg-white border-[#E2E8F0]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-7 h-6 rounded-lg border text-[11px] font-display font-black inline-flex items-center justify-center shrink-0 ${medalCls}`}
                          >
                            {entry.rank === 1 ? <Crown className="w-3.5 h-3.5" /> : `#${entry.rank}`}
                          </span>
                          <PlayerAvatar
                            avatarId={entry.avatarId}
                            frameId={entry.avatarFrame}
                            size="xs"
                            alt={entry.name}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full border border-[#111827]/40 shrink-0"
                                style={{ backgroundColor: PLAYER_COLOR_META[entry.color].fill }}
                              />
                              <span className="font-display text-xs font-extrabold text-[#111827] truncate">
                                {entry.name.replace(' (Bot)', '')}
                              </span>
                              {isSelf && (
                                <span className="px-1.5 py-0.5 rounded bg-[#1D4ED8] text-white text-[8px] font-display font-black leading-none shrink-0">
                                  YOU
                                </span>
                              )}
                              {entry.isBot && (
                                <span className="px-1 py-0.5 rounded bg-[#F1F5F9] text-[#64748B] text-[8px] font-bold leading-none shrink-0">
                                  BOT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[11px] font-mono font-extrabold shrink-0 ${
                            seatFinishedNow ? 'text-[#059669]' : 'text-[#64748B]'
                          }`}
                        >
                          {seatFinishedNow ? '4/4 ✓' : isFinalScreen ? `${entry.finishedTokens}/4` : `${entry.finishedTokens}/4 · Live`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {matchSummary.autoPlayForfeitedRewards && (
                <div className="mt-4 rounded-2xl bg-[#FEF3C7] border-2 border-[#D97706] px-3 py-2.5 text-xs font-bold text-[#92400E] flex items-center gap-2">
                  <Bot className="w-4 h-4 shrink-0 text-[#B45309]" />
                  <span>
                    Completed in Auto-Play mode — no Coins, XP, or ELO rewards are awarded.
                  </span>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-2xl bg-[#FEF9C3] border border-[#FACC15]">
                  <div className="text-[11px] font-bold text-[#854D0E]">Coins</div>
                  <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                    +{matchSummary.doubledWithAd ? matchSummary.coinsEarned * 2 : matchSummary.coinsEarned}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#DBEAFE] border border-[#93C5FD]">
                  <div className="text-[11px] font-bold text-[#1E40AF]">
                    {isPassAndPlay ? 'Place' : 'ELO'}
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                    {isPassAndPlay
                      ? myOrdinal
                      : matchSummary.eloDelta >= 0
                        ? `+${matchSummary.eloDelta}`
                        : matchSummary.eloDelta}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC]">
                  <div className="text-[11px] font-bold text-[#047857]">Captures</div>
                  <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                    {matchSummary.capturesByPlayer}
                  </div>
                </div>
              </div>

              {!matchSummary.doubledWithAd &&
                !matchSummary.autoPlayForfeitedRewards &&
                matchSummary.coinsEarned > 0 &&
                !(isPassAndPlay && !isFinalScreen) && (
                  <button
                    type="button"
                    onClick={() =>
                      doubleSummaryCoinsWithAd(matchSummary, () => {
                        doubledRewardRef.current = true;
                        setMatchSummary((prev) => (prev ? { ...prev, doubledWithAd: true } : null));
                        setPersonalFinishSummary((prev) =>
                          prev ? { ...prev, doubledWithAd: true } : null
                        );
                      })
                    }
                    className="mt-4 w-full py-3 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-gold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    Watch Ad for 2x Coins (+{matchSummary.coinsEarned})
                  </button>
                )}

              {/* Add Real Online Opponents as Friends Right After Match */}
              {isOnline &&
                isFinalScreen &&
                seats.some((s) => !s.isBot && s.uid !== myUid) && (
                  <div className="mt-3.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] p-3 space-y-2">
                    <div className="text-[11px] font-display font-extrabold uppercase tracking-wide text-[#475569]">
                      Add Table Opponents
                    </div>
                    <div className="space-y-1.5">
                      {seats
                        .filter((s) => !s.isBot && s.uid !== myUid)
                        .map((opp) => (
                          <div
                            key={opp.uid}
                            className="flex items-center justify-between gap-2 bg-white rounded-xl border border-[#E2E8F0] px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <PlayerAvatar
                                avatarId={opp.avatarId}
                                frameId={opp.avatarFrame}
                                size="xs"
                                alt={opp.name}
                              />
                              <span className="font-display text-xs font-extrabold text-[#111827] truncate">
                                {opp.name}
                              </span>
                            </div>
                            <FriendActionButton
                              target={{
                                uid: opp.uid,
                                displayName: opp.name,
                                avatarId: opp.avatarId,
                              }}
                              compact
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

              {/* One-Tap Post-Match WhatsApp + Native Share Row */}
              {isFinalScreen && (
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <a
                    href={buildWhatsAppShareUrl(
                      buildPostMatchShareText({
                        summary: matchSummary,
                        playerName: profile.displayName,
                        isPassAndPlay,
                        roomCode: activeRoom?.roomCode,
                      })
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-2xl game-btn-green font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleNativeShareSummary}
                    className="py-2.5 px-3 rounded-2xl game-btn-white font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>Share Result</span>
                  </button>
                </div>
              )}

              {/* Action Buttons: Spectate/Continue while match is live, or Play Again/Rematch once final */}
              {!isFinalScreen ? (
                <div className="mt-4 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isPassAndPlay) setIsSpectating(true);
                      setMatchSummary(null);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-blue btn-gloss-sheen cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>{isPassAndPlay ? 'Continue Match' : 'Spectate Rest of Match'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLeaveMatch(true)}
                    className="w-full py-2.5 px-4 rounded-2xl game-btn-white text-sm font-display font-extrabold cursor-pointer"
                  >
                    Home Menu
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-3">
                  {!isOnline && !matchSummary.isTournament && (
                    <button
                      type="button"
                      onClick={handlePracticeRestart}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-blue btn-gloss-sheen cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Play Again
                    </button>
                  )}
                  {isOnline && activeRoom && (
                    <button
                      type="button"
                      disabled={rematchLoading}
                      onClick={handleOnlineRematch}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-blue btn-gloss-sheen cursor-pointer disabled:opacity-60"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {rematchLoading
                        ? 'Creating...'
                        : activeRoom.visibility === 'private'
                          ? 'Rematch Friends'
                          : 'Play Again'}
                    </button>
                  )}
                  {!isOnline && matchSummary.isTournament && (
                    <button
                      type="button"
                      onClick={() => {
                        closeOfflineMatch();
                        setActiveTab('tournaments');
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
                    >
                      <Crown className="w-4 h-4" />
                      Back to Cup
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLeaveMatch(true)}
                    className="flex-1 py-2.5 px-4 rounded-2xl game-btn-white text-sm font-display font-extrabold cursor-pointer"
                  >
                    Home Menu
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Graceful Online Match Exit Modal (Keeps Match Running with Auto-Play + Rejoin Anytime) */}
      {exitConfirmOpen &&
        isOnline &&
        activeRoom &&
        createPortal(
          <div
            className="fixed inset-0 z-[75] bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Leave live table"
            onClick={(e) => {
              if (e.target === e.currentTarget) setExitConfirmOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 space-y-4 animate-pop-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FEF9C3] border-2 border-[#111827] flex items-center justify-center text-[#B45309] shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-[#111827] leading-tight">
                      Step out of table?
                    </h2>
                    <p className="text-[11px] font-mono font-bold text-[#1D4ED8]">
                      Room {activeRoom.roomCode}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(false)}
                  className="p-1.5 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] cursor-pointer"
                  aria-label="Stay in match"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl bg-[#ECFDF5] border border-[#86EFAC] p-3 text-xs text-[#065F46] leading-relaxed">
                <strong>Auto-Play will cover your turns</strong> so the match stays live while you&apos;re
                away, and you can <strong>Rejoin</strong> from Home anytime. Matches completed in
                Auto-Play earn <strong>no rewards</strong>.
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setExitConfirmOpen(false)}
                  className="w-full py-2.5 px-4 rounded-2xl game-btn-blue font-display font-extrabold text-sm cursor-pointer"
                >
                  Stay in Match
                </button>
                <button
                  type="button"
                  onClick={() => handleLeaveMatch(true)}
                  className="w-full py-2.5 px-4 rounded-2xl game-btn-gold font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>Step Out (Auto-Play On)</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setExitConfirmOpen(false);
                    await forfeitActiveRoom(activeRoom.id);
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] border-2 border-[#111827] shadow-[0_3px_0_#111827] font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Exit Match Permanently (No Rewards)</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
