import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  Dices,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BOARD_THEMES, BOT_ROSTER, PLAYER_COLOR_META, QUICK_CHAT_EMOTES } from '../data/catalog';
import {
  applyTokenMove,
  chooseAiTokenMove,
  createInitialTokens,
  getMovableTokenIndices,
} from '../game/ludoEngine';
import { tabletopAudio } from '../game/sound';
import { MatchSummary, PlayerColor, RoomSeat, TokenPositions } from '../types';
import { AdaptiveBannerAd } from './AdMobOverlays';
import { DiceControl } from './DiceControl';
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
    activeRoom,
    roomMessages,
    offlineMatch,
    soundMuted,
    toggleSoundMuted,
    hostStartRoom,
    submitMultiplayerTurn,
    sendChat,
    exitActiveRoom,
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

  const buildInitialOfflineState = useCallback((): LocalGameState => {
    const count = offlineMatch?.playerCount || 4;
    const mode = offlineMatch?.mode || 'classic';
    const colors: PlayerColor[] = count === 2 ? ['red', 'yellow'] : ['red', 'green', 'yellow', 'blue'];

    const seats: RoomSeat[] = [
      {
        uid: profile.uid,
        name: profile.displayName,
        avatarId: profile.avatarId,
        avatarFrame: profile.avatarFrame,
        color: colors[0],
        isBot: false,
        elo: profile.elo,
      },
    ];

    for (let i = 1; i < colors.length; i++) {
      const bot = BOT_ROSTER[(i - 1) % BOT_ROSTER.length];
      const overrideName =
        i === 1 && offlineMatch?.tournamentContext?.opponentName
          ? offlineMatch.tournamentContext.opponentName
          : bot.name;
      seats.push({
        uid: `${bot.uid}_${i}`,
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
  }, [offlineMatch, profile]);

  const [localGame, setLocalGame] = useState<LocalGameState>(() => buildInitialOfflineState());
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
  const [seatReaction, setSeatReaction] = useState<{ color: PlayerColor; text: string } | null>(null);

  const playerCapturesRef = useRef(0);
  const playerSixesRef = useRef(0);
  const summaryRecordedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastMsgCountRef = useRef(0);
  const prevIsMyTurnRef = useRef(false);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, []);

  const triggerSeatBubble = useCallback((color: PlayerColor, text: string) => {
    setSeatReaction({ color, text });
    setTimeout(() => {
      setSeatReaction((prev) => (prev && prev.text === text ? null : prev));
    }, 2200);
  }, []);

  useEffect(() => {
    if (!isOnline && offlineMatch) {
      setLocalGame(buildInitialOfflineState());
      setMatchSummary(null);
      setRerollUsedThisMatch(false);
      setHoldPause(false);
      setHoldDiceOverride(null);
      setHoldStatusOverride(null);
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
      prevIsMyTurnRef.current = false;
      flashBanner('GAME START!', 'start', 'Your Turn — Roll the Dice!', 1450);
    }
  }, [isOnline, offlineMatch, buildInitialOfflineState, flashBanner]);

  useEffect(() => {
    if (activeRoom?.id) {
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
      setMatchSummary(null);
      setUnreadChat(0);
      setHoldPause(false);
      setHoldDiceOverride(null);
      setHoldStatusOverride(null);
      lastMsgCountRef.current = 0;
      prevIsMyTurnRef.current = false;
      if (activeRoom.status === 'playing') {
        flashBanner('GAME START!', 'start', 'Live Multiplayer Table', 1450);
      }
    }
  }, [activeRoom?.id, activeRoom?.status, flashBanner]);

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
  const turnIndex = isOnline ? activeRoom!.turnIndex : localGame.turnIndex;
  const rawDiceValue = isOnline ? activeRoom!.diceValue : localGame.diceValue;
  const diceValue = holdDiceOverride ?? rawDiceValue;
  const turnPhase = isOnline ? activeRoom!.turnPhase : localGame.turnPhase;
  const consecutiveSixes = isOnline ? activeRoom!.consecutiveSixes : localGame.consecutiveSixes;
  const gameStatus = isOnline ? activeRoom!.status : localGame.status;
  const rawActionText = isOnline ? activeRoom!.lastActionText : localGame.lastActionText;
  const lastActionText = holdStatusOverride ?? rawActionText;
  const turnCount = isOnline ? activeRoom!.turnCount : localGame.turnCount;

  const activeColors = useMemo(() => seats.map((s) => s.color), [seats]);
  const currentSeat = seats[turnIndex] || seats[0];
  const myUid = user?.uid || profile.uid;
  const mySeat = useMemo(
    () => seats.find((s) => !s.isBot && s.uid === myUid) || null,
    [seats, myUid]
  );

  const playerNamesMap = useMemo(() => {
    const map: Partial<Record<PlayerColor, string>> = {};
    for (const seat of seats) {
      map[seat.color] = seat.uid === myUid && !seat.isBot ? 'YOU' : seat.name.replace(' (Bot)', '');
    }
    return map;
  }, [seats, myUid]);

  const isMyTurn =
    gameStatus === 'playing' &&
    !holdPause &&
    Boolean(currentSeat) &&
    !currentSeat.isBot &&
    currentSeat.uid === myUid;

  // Play crisp turn-ready chime & flash subtle "YOUR TURN!" banner whenever turn returns to the player
  useEffect(() => {
    if (isMyTurn && turnPhase === 'roll' && !boardAnimating && !rollingAnim) {
      if (!prevIsMyTurnRef.current && turnCount > 0) {
        tabletopAudio.playTurnReady();
        flashBanner('YOUR TURN!', 'turn', 'Tap ROLL DICE to play', 1100);
      }
      prevIsMyTurnRef.current = true;
    } else if (!isMyTurn) {
      prevIsMyTurnRef.current = false;
    }
  }, [isMyTurn, turnPhase, boardAnimating, rollingAnim, turnCount, flashBanner]);

  const movableTokenIndices = useMemo(() => {
    if (gameStatus !== 'playing' || turnPhase !== 'move' || rawDiceValue < 1 || !currentSeat || holdPause) {
      return [];
    }
    return getMovableTokenIndices(tokens, currentSeat.color, rawDiceValue);
  }, [gameStatus, turnPhase, rawDiceValue, currentSeat, tokens, holdPause]);

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

  useEffect(() => {
    if (!isOnline || !activeRoom || activeRoom.status !== 'finished' || summaryRecordedRef.current) {
      return;
    }
    summaryRecordedRef.current = true;
    const won = activeRoom.winnerUid === myUid;
    const winnerSeat = activeRoom.seats.find((s) => s.color === activeRoom.winnerColor);
    const coinsEarned = won ? Math.max(200, activeRoom.entryStake * 2 + 120) : 60;
    const summary: MatchSummary = {
      won,
      winnerName: winnerSeat?.name || activeRoom.winnerColor.toUpperCase(),
      winnerColor: (activeRoom.winnerColor as PlayerColor) || 'red',
      isOnline: true,
      isTournament: false,
      capturesByPlayer: playerCapturesRef.current,
      sixesByPlayer: playerSixesRef.current,
      coinsEarned,
      xpEarned: won ? 140 : 55,
      eloDelta: won ? 28 : -14,
      turnsPlayed: activeRoom.turnCount,
      doubledWithAd: false,
    };
    setMatchSummary(summary);
    if (won) tabletopAudio.playVictory();
    recordMatchCompletion(summary);
  }, [isOnline, activeRoom, myUid, recordMatchCompletion]);

  const executeDiceRoll = useCallback(
    async (actorSeat: RoomSeat, overrideRoll?: number) => {
      if (rollingAnim || boardAnimating || holdPause || gameStatus !== 'playing' || turnPhase !== 'roll') return;
      setRollingAnim(true);
      tabletopAudio.playDiceRoll();

      const rolled = overrideRoll ?? Math.floor(Math.random() * 6) + 1;

      // Comfortable 620ms dice tumble so players clearly feel and watch every roll
      setTimeout(async () => {
        setRollingAnim(false);
        const isHumanMe = !actorSeat.isBot && actorSeat.uid === myUid;
        if (rolled === 6) {
          tabletopAudio.playSixFanfare();
          triggerSeatBubble(actorSeat.color, 'Rolled a SIX!');
          if (isHumanMe) {
            playerSixesRef.current += 1;
            recordGameplayEvent({ rollSixes: 1 });
          }
        }

        const nextSixes = rolled === 6 ? consecutiveSixes + 1 : 0;

        // Triple 6 rule — pause 980ms so the player sees the 6 before turn passes!
        if (nextSixes >= 3) {
          const nextIdx = (turnIndex + 1) % seats.length;
          const holdMsg = `${actorSeat.name} rolled three 6s — turn passes!`;
          setHoldPause(true);
          setHoldDiceOverride(6);
          setHoldStatusOverride(holdMsg);

          setTimeout(async () => {
            setHoldPause(false);
            setHoldDiceOverride(null);
            setHoldStatusOverride(null);
            const text = `${actorSeat.name} rolled three 6s — ${seats[nextIdx].name}'s turn.`;
            if (isOnline) {
              await submitMultiplayerTurn({
                tokens,
                turnIndex: nextIdx,
                diceValue: 0,
                turnPhase: 'roll',
                consecutiveSixes: 0,
                status: 'playing',
                winnerColor: '',
                winnerUid: '',
                lastActionText: text,
                turnCount: turnCount + 1,
              });
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
          }, 980);
          return;
        }

        const legal = getMovableTokenIndices(tokens, actorSeat.color, rolled);

        // No legal move — pause 950ms showing the rolled number so players clearly see what was rolled!
        if (legal.length === 0) {
          const nextIdx = (turnIndex + 1) % seats.length;
          const holdMsg = `${actorSeat.name} rolled ${rolled} — no legal moves.`;
          setHoldPause(true);
          setHoldDiceOverride(rolled);
          setHoldStatusOverride(holdMsg);

          setTimeout(async () => {
            setHoldPause(false);
            setHoldDiceOverride(null);
            setHoldStatusOverride(null);
            const nextName = seats[nextIdx].uid === myUid && !seats[nextIdx].isBot ? 'Your turn' : `${seats[nextIdx].name}'s turn`;
            const text = `${actorSeat.name} rolled ${rolled} (no move). ${nextName}!`;
            if (isOnline) {
              await submitMultiplayerTurn({
                tokens,
                turnIndex: nextIdx,
                diceValue: 0,
                turnPhase: 'roll',
                consecutiveSixes: 0,
                status: 'playing',
                winnerColor: '',
                winnerUid: '',
                lastActionText: text,
                turnCount: turnCount + 1,
              });
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
          }, 950);
          return;
        }

        if (rolled === 6) {
          flashBanner('LUCKY 6!', 'six', `${actorSeat.name} gets a bonus roll!`, 1200);
        }

        const colorTokens = tokens[actorSeat.color];
        const allSameSpot = legal.every((i) => colorTokens[i] === colorTokens[legal[0]]);
        const text =
          legal.length === 1 || allSameSpot
            ? `${actorSeat.name} rolled ${rolled} — moving pawn...`
            : isHumanMe
              ? `You rolled ${rolled}! Tap any bouncing pawn to move.`
              : `${actorSeat.name} rolled ${rolled} — choosing a pawn...`;

        if (isOnline) {
          await submitMultiplayerTurn({
            tokens,
            turnIndex,
            diceValue: rolled,
            turnPhase: 'move',
            consecutiveSixes: nextSixes,
            status: 'playing',
            winnerColor: '',
            winnerUid: '',
            lastActionText: text,
            turnCount,
          });
        } else {
          setLocalGame((prev) => ({
            ...prev,
            diceValue: rolled,
            turnPhase: 'move',
            consecutiveSixes: nextSixes,
            lastActionText: text,
          }));
        }
      }, 620);
    },
    [
      rollingAnim,
      boardAnimating,
      holdPause,
      gameStatus,
      turnPhase,
      myUid,
      consecutiveSixes,
      turnIndex,
      seats,
      isOnline,
      tokens,
      turnCount,
      recordGameplayEvent,
      submitMultiplayerTurn,
      triggerSeatBubble,
      flashBanner,
    ]
  );

  const executeTokenMove = useCallback(
    async (actorSeat: RoomSeat, tokenIdx: number) => {
      if (boardAnimating || holdPause || gameStatus !== 'playing' || turnPhase !== 'move' || rawDiceValue < 1) return;
      const legal = getMovableTokenIndices(tokens, actorSeat.color, rawDiceValue);
      if (!legal.includes(tokenIdx)) return;

      const outcome = applyTokenMove(
        tokens,
        actorSeat.color,
        tokenIdx,
        rawDiceValue,
        actorSeat.name,
        activeColors
      );

      if (outcome.capturedColors.length > 0) {
        triggerSeatBubble(actorSeat.color, 'CAPTURED! +1 Roll');
        flashBanner('CAPTURED!', 'capture', `${actorSeat.name} earns a bonus roll!`, 1400);
        if (!actorSeat.isBot && actorSeat.uid === myUid) {
          playerCapturesRef.current += outcome.capturedColors.length;
          recordGameplayEvent({ captures: outcome.capturedColors.length });
        }
      } else if (outcome.reachedHome) {
        tabletopAudio.playSafeStar();
        triggerSeatBubble(actorSeat.color, 'Home Finish!');
        flashBanner('HOME FINISH!', 'home', `${actorSeat.name} scored a pawn!`, 1350);
      } else if (outcome.landedSafe) {
        tabletopAudio.playSafeStar();
      }

      const nextTurnIndex = outcome.bonusTurn ? turnIndex : (turnIndex + 1) % seats.length;
      const nextStatus: 'playing' | 'finished' = outcome.wonGame ? 'finished' : 'playing';

      if (isOnline) {
        await submitMultiplayerTurn({
          tokens: outcome.nextTokens,
          turnIndex: nextTurnIndex,
          diceValue: 0,
          turnPhase: 'roll',
          consecutiveSixes: outcome.bonusTurn ? consecutiveSixes : 0,
          status: nextStatus,
          winnerColor: outcome.wonGame ? actorSeat.color : '',
          winnerUid: outcome.wonGame ? actorSeat.uid : '',
          lastActionText: outcome.actionText,
          turnCount: turnCount + 1,
        });
      } else {
        setLocalGame((prev) => ({
          ...prev,
          tokens: outcome.nextTokens,
          turnIndex: nextTurnIndex,
          diceValue: 0,
          turnPhase: 'roll',
          consecutiveSixes: outcome.bonusTurn ? prev.consecutiveSixes : 0,
          status: nextStatus,
          winnerColor: outcome.wonGame ? actorSeat.color : '',
          winnerName: outcome.wonGame ? actorSeat.name : '',
          lastActionText: outcome.actionText,
          turnCount: prev.turnCount + 1,
        }));

        if (outcome.wonGame && !summaryRecordedRef.current) {
          summaryRecordedRef.current = true;
          const won = !actorSeat.isBot && actorSeat.uid === myUid;
          const isTournament = Boolean(offlineMatch?.tournamentContext);
          const coinsEarned = won
            ? isTournament
              ? offlineMatch!.tournamentContext!.round === 'final'
                ? offlineMatch!.tournamentContext!.prizePool
                : 300
              : 160
            : 45;

          const summary: MatchSummary = {
            won,
            winnerName: actorSeat.name,
            winnerColor: actorSeat.color,
            isOnline: false,
            isTournament,
            tournamentId: offlineMatch?.tournamentContext?.tournamentId,
            tournamentRound: offlineMatch?.tournamentContext?.round,
            capturesByPlayer: playerCapturesRef.current,
            sixesByPlayer: playerSixesRef.current,
            coinsEarned,
            xpEarned: won ? 110 : 40,
            eloDelta: isTournament ? (won ? 35 : -10) : won ? 12 : -4,
            turnsPlayed: turnCount + 1,
            doubledWithAd: false,
          };
          setMatchSummary(summary);
          if (won) tabletopAudio.playVictory();
          recordMatchCompletion(summary);
        }
      }
    },
    [
      boardAnimating,
      holdPause,
      gameStatus,
      turnPhase,
      rawDiceValue,
      tokens,
      activeColors,
      myUid,
      turnIndex,
      seats.length,
      isOnline,
      consecutiveSixes,
      turnCount,
      offlineMatch,
      recordGameplayEvent,
      submitMultiplayerTurn,
      recordMatchCompletion,
      triggerSeatBubble,
      flashBanner,
    ]
  );

  // Comfortable, readable Bot pacing (920ms before rolling, 820ms after rolling before moving)
  useEffect(() => {
    if (gameStatus !== 'playing' || !currentSeat || !currentSeat.isBot || rollingAnim || boardAnimating || holdPause) return;
    if (isOnline && activeRoom?.hostUid !== myUid) return;

    const difficulty = offlineMatch?.difficulty || 'tactical';
    const delayMs = turnPhase === 'roll' ? 920 : 820;

    const timer = setTimeout(() => {
      if (turnPhase === 'roll') {
        executeDiceRoll(currentSeat);
      } else if (turnPhase === 'move') {
        const chosen = chooseAiTokenMove(
          tokens,
          currentSeat.color,
          rawDiceValue,
          activeColors,
          difficulty
        );
        if (chosen >= 0) {
          executeTokenMove(currentSeat, chosen);
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
    isOnline,
    activeRoom?.hostUid,
    myUid,
    offlineMatch?.difficulty,
    turnPhase,
    tokens,
    rawDiceValue,
    activeColors,
    executeDiceRoll,
    executeTokenMove,
  ]);

  // Comfortable 680ms auto-move when player has only 1 legal move (player can also tap it earlier!)
  useEffect(() => {
    if (!shouldAutoPlayOnlyMove || movableTokenIndices.length === 0) return;
    const onlyTokenIdx = movableTokenIndices[0];
    const timer = setTimeout(() => {
      executeTokenMove(currentSeat, onlyTokenIdx);
    }, 680);
    return () => clearTimeout(timer);
  }, [shouldAutoPlayOnlyMove, movableTokenIndices, currentSeat, executeTokenMove]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isMyTurn && turnPhase === 'roll' && !rollingAnim && !boardAnimating) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        executeDiceRoll(currentSeat);
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

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    await sendChat(text, 'chat');
  };

  const handleLeaveMatch = async () => {
    if (isOnline) {
      await exitActiveRoom();
    } else {
      closeOfflineMatch();
    }
    maybeShowInterstitialAfterMatch();
  };

  const handlePracticeRestart = () => {
    setLocalGame(buildInitialOfflineState());
    setMatchSummary(null);
    setRerollUsedThisMatch(false);
    setHoldPause(false);
    setHoldDiceOverride(null);
    setHoldStatusOverride(null);
    playerCapturesRef.current = 0;
    playerSixesRef.current = 0;
    summaryRecordedRef.current = false;
    prevIsMyTurnRef.current = false;
    flashBanner('GAME START!', 'start', 'Your Turn — Roll the Dice!', 1450);
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
    const active = seat.color === currentSeat?.color && gameStatus === 'playing';
    const isMe = !seat.isBot && seat.uid === myUid;
    const meta = PLAYER_COLOR_META[seat.color];
    const seatSteps = tokens[seat.color];
    const bubble = seatReaction?.color === seat.color ? seatReaction.text : null;

    return (
      <div
        key={seat.uid}
        className={`relative rounded-2xl px-2.5 py-1.5 border-2 flex items-center gap-2 transition-all duration-200 min-w-0 ${
          active
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
            {active && (
              <span className="px-1.5 py-0.5 rounded-md bg-[#1D4ED8] text-white text-[9px] font-display font-black shrink-0 leading-none">
                {isMe ? 'YOUR TURN' : 'TURN'}
              </span>
            )}
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
        {/* Crisp Studio-Bright Waiting Room Header */}
        <div className="shrink-0 h-12 px-3 sm:px-6 bg-white/95 border-b-2 border-[#E2E8F0] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLeaveMatch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-[#111827] text-xs font-display font-extrabold text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
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
            className="p-2 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Main Scrollable Waiting Room Content (Matches Reference Image 1 Right) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar max-w-[980px] w-full mx-auto px-4 sm:px-6 py-4 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
            {/* Left / Primary Column: Room Code Card + 2x2 Table Seats + Board Edition + Start Match */}
            <div className="lg:col-span-3 space-y-5">
              {/* Top Room Code Card */}
              <div className="studio-card rounded-3xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#64748B]">Room code</div>
                    <div className="font-mono text-2xl sm:text-3xl font-black tracking-[0.12em] text-[#111827] mt-0.5">
                      {activeRoom.roomCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="px-4 py-2.5 rounded-2xl game-btn-gold font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-bold text-[#334155]">
                    <Users className="w-3 h-3 text-[#1D4ED8]" />
                    {activeRoom.maxPlayers} Players
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-bold text-[#334155] capitalize">
                    {activeRoom.mode} rules
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F1F5F9] border border-[#CBD5E1] text-[11px] font-bold text-[#334155] capitalize">
                    {activeRoom.visibility}
                  </span>
                </div>
              </div>

              {/* 2x2 Color-Tinted Table Seats Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-extrabold text-[#111827]">Table seats</h2>
                  <span className="font-mono text-xs font-bold text-[#475569]">
                    {activeRoom.seats.length} / {activeRoom.maxPlayers} joined
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
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
                          className="group rounded-3xl border-2 border-dashed border-[#60A5FA] hover:border-[#111827] bg-white/95 hover:bg-[#EFF8FF] p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[116px] shadow-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[11px] font-display font-extrabold ${tint.pillBg} ${tint.pillText} border border-[#111827]/20`}
                            >
                              {colorLabel}
                            </span>
                            <span className="text-[11px] font-bold text-[#2563EB]">Open</span>
                          </div>
                          <div className="mt-3 flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-full border-2 border-dashed border-[#38BDF8] bg-[#EFF8FF] flex items-center justify-center text-[#1D4ED8] shrink-0 group-hover:scale-105 transition-transform">
                              <UserPlus className="w-4 h-4 animate-badge-bob" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-display text-sm font-extrabold text-[#111827]">
                                Invite
                              </div>
                              <div className="text-[11px] font-semibold text-[#64748B]">Tap to add</div>
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
                        className={`rounded-3xl ${tint.bg} border-2 border-[#111827] shadow-[0_3px_0_#111827] p-3.5 flex flex-col justify-between min-h-[116px]`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-display font-extrabold ${tint.pillBg} ${tint.pillText}`}
                          >
                            {colorLabel}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${tint.readyText}`}
                          >
                            <Check className="w-3 h-3" />
                            Ready
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-full border-2 border-[#111827] ${tint.badgeBg} ${tint.badgeText} font-display font-black text-xs flex items-center justify-center shrink-0`}
                          >
                            {getInitialsLocal(seat.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                              {seat.name}
                            </div>
                            <div className="text-[11px] font-semibold text-[#475569]">
                              {isSeatHost ? 'Host' : isSeatMe ? 'You' : 'Friend'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Board Edition Quick Selector */}
              <div className="space-y-2.5">
                <h2 className="font-display text-base font-extrabold text-[#111827]">
                  Board edition
                </h2>
                <div className="grid grid-cols-2 gap-2.5">
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
                        className={`px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                          selected
                            ? 'bg-white border-2 border-[#111827] shadow-[0_2px_0_#111827]'
                            : 'bg-white/80 border border-[#CBD5E1] hover:border-[#111827]'
                        }`}
                      >
                        <span className="font-display text-xs font-extrabold text-[#111827] truncate">
                          {theme.name}
                        </span>
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selected ? 'border-[#1D4ED8]' : 'border-[#94A3B8]'
                          }`}
                        >
                          {selected && <span className="w-2 h-2 rounded-full bg-[#1D4ED8]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Match Primary Action */}
              <div className="pt-1 space-y-2.5">
                {isHost ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        hostStartRoom(activeRoom.seats.length < 2)
                      }
                      className="w-full py-3.5 px-5 rounded-2xl font-display font-extrabold text-base game-btn-blue btn-gloss-sheen inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {activeRoom.seats.length < 2
                          ? 'Fill bots & start match'
                          : 'Start match'}
                      </span>
                    </button>
                    {activeRoom.seats.length >= 2 &&
                      activeRoom.seats.length < activeRoom.maxPlayers && (
                        <button
                          type="button"
                          onClick={() => hostStartRoom(true)}
                          className="w-full py-2.5 px-4 rounded-2xl font-display font-extrabold text-xs game-btn-white cursor-pointer"
                        >
                          Fill remaining seats with bots &amp; start
                        </button>
                      )}
                  </>
                ) : (
                  <div className="studio-card-soft rounded-2xl px-4 py-3 text-center text-xs text-[#475569]">
                    Waiting for <strong className="text-[#111827]">{activeRoom.seats[0]?.name}</strong> to start the match...
                  </div>
                )}
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

        <div className="shrink-0 z-20">
          <AdaptiveBannerAd />
        </div>
      </div>
    );
  }

  const canUseAdReroll =
    !isOnline &&
    !offlineMatch?.tournamentContext &&
    isMyTurn &&
    turnPhase === 'move' &&
    rawDiceValue < 6 &&
    !rerollUsedThisMatch &&
    !shouldAutoPlayOnlyMove;

  const mobileBoardSizeClass =
    seats.length > 2
      ? 'w-[min(calc(100vw-16px),max(272px,calc(100dvh-268px)))]'
      : 'w-[min(calc(100vw-16px),max(272px,calc(100dvh-212px)))]';

  const turnBannerLabel = boardAnimating
    ? 'Moving pawn...'
    : holdPause
      ? holdStatusOverride || 'Passing turn...'
      : isMyTurn && turnPhase === 'roll'
        ? 'YOUR TURN — TAP ROLL DICE!'
        : isMyTurn && turnPhase === 'move'
          ? 'YOUR TURN — TAP A BOUNCING PAWN!'
          : `${currentSeat?.name.replace(' (Bot)', '') || 'Opponent'}'s Turn...`;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Crisp Studio-Bright Top Gameplay Bar */}
      <header className="shrink-0 h-11 px-3 sm:px-6 bg-white/95 backdrop-blur-md border-b-2 border-[#E2E8F0] flex items-center justify-between gap-2 z-20">
        <button
          type="button"
          onClick={handleLeaveMatch}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white border-2 border-[#111827] text-xs font-display font-extrabold text-[#111827] hover:bg-[#F1F5F9] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        <div className="min-w-0 text-center">
          <div className="text-[11px] sm:text-xs font-display font-extrabold text-[#111827] truncate">
            {isOnline
              ? `Live Table · ${activeRoom!.roomCode}`
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
            onClick={toggleSoundMuted}
            className="p-1.5 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-[#111827] cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

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
              <LudoBoard
                tokens={tokens}
                activeColors={activeColors}
                currentTurnColor={currentSeat?.color || 'red'}
                myColor={mySeat?.color || null}
                playerNames={playerNamesMap}
                movableTokenIndices={movableTokenIndices}
                canInteract={isMyTurn && turnPhase === 'move' && !boardAnimating && !holdPause}
                boardThemeId={profile.boardTheme}
                diceValue={rawDiceValue}
                onSelectToken={(idx) => executeTokenMove(currentSeat, idx)}
                onAnimatingChange={setBoardAnimating}
              />
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
                rolling={rollingAnim}
                canRoll={isMyTurn && turnPhase === 'roll' && !boardAnimating && !holdPause}
                diceThemeId={profile.diceTheme}
                activeColor={currentSeat?.color}
                onRoll={() => executeDiceRoll(currentSeat)}
                statusSubtext={
                  boardAnimating
                    ? 'Moving pawn...'
                    : holdPause
                      ? holdStatusOverride || 'Next player...'
                      : shouldAutoPlayOnlyMove
                        ? 'Moving only legal pawn...'
                        : isMyTurn && turnPhase === 'roll'
                          ? 'Your Turn — Tap to Roll!'
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
              <LudoBoard
                tokens={tokens}
                activeColors={activeColors}
                currentTurnColor={currentSeat?.color || 'red'}
                myColor={mySeat?.color || null}
                playerNames={playerNamesMap}
                movableTokenIndices={movableTokenIndices}
                canInteract={isMyTurn && turnPhase === 'move' && !boardAnimating && !holdPause}
                boardThemeId={profile.boardTheme}
                diceValue={rawDiceValue}
                onSelectToken={(idx) => executeTokenMove(currentSeat, idx)}
                onAnimatingChange={setBoardAnimating}
              />
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
                      backgroundColor: currentSeat
                        ? PLAYER_COLOR_META[currentSeat.color].fill
                        : '#FACC15',
                    }}
                  />
                  <span className="font-display text-sm font-extrabold text-[#111827]">
                    {isMyTurn ? 'YOUR TURN!' : `${currentSeat?.name.replace(' (Bot)', '')}'s Turn`}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-display font-extrabold ${
                    isMyTurn
                      ? 'bg-[#1D4ED8] text-white'
                      : 'bg-[#F1F5F9] text-[#475569]'
                  }`}
                >
                  {boardAnimating
                    ? 'Moving...'
                    : holdPause
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
                    rolling={rollingAnim}
                    canRoll={isMyTurn && turnPhase === 'roll' && !boardAnimating && !holdPause}
                    diceThemeId={profile.diceTheme}
                    activeColor={currentSeat?.color}
                    onRoll={() => executeDiceRoll(currentSeat)}
                    statusSubtext={
                      boardAnimating
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
                          triggerSeatBubble('red', emote);
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
                      triggerSeatBubble('red', emote);
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

      {/* Victory / Match Summary Modal with Celebration Confetti */}
      {matchSummary && !boardAnimating && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Match Summary"
        >
          <div className="relative overflow-hidden w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 sm:p-6 animate-pop-in">
            {matchSummary.won && (
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
              <div className="w-16 h-16 rounded-2xl bg-[#FEF9C3] border-2 border-[#111827] text-[#EAB308] mx-auto flex items-center justify-center shadow-xs">
                {matchSummary.won ? <Crown className="w-8 h-8" /> : <Sparkles className="w-8 h-8 text-[#1D4ED8]" />}
              </div>
              <h2 className="mt-3 font-display text-2xl font-black text-[#111827] tracking-tight">
                {matchSummary.won ? 'CROWN VICTORY!' : `${matchSummary.winnerName} WINS`}
              </h2>
              <p className="mt-1 text-xs font-semibold text-[#64748B]">
                Completed in {matchSummary.turnsPlayed} turns
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-[#FEF9C3] border border-[#FACC15]">
                <div className="text-[11px] font-bold text-[#854D0E]">Coins</div>
                <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                  +{matchSummary.doubledWithAd ? matchSummary.coinsEarned * 2 : matchSummary.coinsEarned}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#DBEAFE] border border-[#93C5FD]">
                <div className="text-[11px] font-bold text-[#1E40AF]">ELO</div>
                <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                  {matchSummary.eloDelta >= 0 ? `+${matchSummary.eloDelta}` : matchSummary.eloDelta}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#DCFCE7] border border-[#86EFAC]">
                <div className="text-[11px] font-bold text-[#047857]">Captures</div>
                <div className="mt-1 font-mono tabular-nums text-base font-extrabold text-[#111827]">
                  {matchSummary.capturesByPlayer}
                </div>
              </div>
            </div>

            {!matchSummary.doubledWithAd && (
              <button
                type="button"
                onClick={() =>
                  doubleSummaryCoinsWithAd(matchSummary, () => {
                    setMatchSummary((prev) => (prev ? { ...prev, doubledWithAd: true } : null));
                  })
                }
                className="mt-5 w-full py-3 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-gold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Watch Ad for 2x Coins (+{matchSummary.coinsEarned})
              </button>
            )}

            <div className="mt-3 flex items-center gap-3">
              {!isOnline && !matchSummary.isTournament && (
                <button
                  type="button"
                  onClick={handlePracticeRestart}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
              )}
              <button
                type="button"
                onClick={handleLeaveMatch}
                className="flex-1 py-2.5 px-4 rounded-2xl game-btn-white text-sm font-display font-extrabold cursor-pointer"
              >
                Home Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
