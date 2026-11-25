import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BOT_ROSTER, PLAYER_COLOR_META, QUICK_CHAT_EMOTES } from '../data/catalog';
import {
  applyTokenMove,
  chooseAiTokenMove,
  createInitialTokens,
  getMovableTokenIndices,
} from '../game/ludoEngine';
import { tabletopAudio } from '../game/sound';
import { MatchSummary, PlayerColor, RoomSeat, TokenPositions } from '../types';
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
      lastActionText: `${profile.displayName} rolls first! Tap ROLL DICE.`,
      turnCount: 0,
    };
  }, [offlineMatch, profile]);

  const [localGame, setLocalGame] = useState<LocalGameState>(() => buildInitialOfflineState());
  const [rollingAnim, setRollingAnim] = useState(false);
  const [boardAnimating, setBoardAnimating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);
  const [rerollUsedThisMatch, setRerollUsedThisMatch] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [seatReaction, setSeatReaction] = useState<{ color: PlayerColor; text: string } | null>(null);

  const playerCapturesRef = useRef(0);
  const playerSixesRef = useRef(0);
  const summaryRecordedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const lastMsgCountRef = useRef(0);

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
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
    }
  }, [isOnline, offlineMatch, buildInitialOfflineState]);

  useEffect(() => {
    if (activeRoom?.id) {
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
      setMatchSummary(null);
      setUnreadChat(0);
      lastMsgCountRef.current = 0;
    }
  }, [activeRoom?.id]);

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
  const diceValue = isOnline ? activeRoom!.diceValue : localGame.diceValue;
  const turnPhase = isOnline ? activeRoom!.turnPhase : localGame.turnPhase;
  const consecutiveSixes = isOnline ? activeRoom!.consecutiveSixes : localGame.consecutiveSixes;
  const gameStatus = isOnline ? activeRoom!.status : localGame.status;
  const lastActionText = isOnline ? activeRoom!.lastActionText : localGame.lastActionText;
  const turnCount = isOnline ? activeRoom!.turnCount : localGame.turnCount;

  const activeColors = useMemo(() => seats.map((s) => s.color), [seats]);
  const currentSeat = seats[turnIndex] || seats[0];
  const myUid = user?.uid || profile.uid;
  const isMyTurn =
    gameStatus === 'playing' &&
    Boolean(currentSeat) &&
    !currentSeat.isBot &&
    currentSeat.uid === myUid;

  const movableTokenIndices = useMemo(() => {
    if (gameStatus !== 'playing' || turnPhase !== 'move' || diceValue < 1 || !currentSeat) {
      return [];
    }
    return getMovableTokenIndices(tokens, currentSeat.color, diceValue);
  }, [gameStatus, turnPhase, diceValue, currentSeat, tokens]);

  // Auto-play when human player has only 1 legal move (or all movable pawns share the exact same tile/yard)
  const shouldAutoPlayOnlyMove = useMemo(() => {
    if (!isMyTurn || gameStatus !== 'playing' || turnPhase !== 'move' || rollingAnim || boardAnimating) {
      return false;
    }
    if (movableTokenIndices.length === 1) return true;
    if (movableTokenIndices.length > 1 && currentSeat) {
      const colorTokens = tokens[currentSeat.color];
      const firstStep = colorTokens[movableTokenIndices[0]];
      return movableTokenIndices.every((idx) => colorTokens[idx] === firstStep);
    }
    return false;
  }, [isMyTurn, gameStatus, turnPhase, rollingAnim, boardAnimating, movableTokenIndices, currentSeat, tokens]);

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
      if (rollingAnim || boardAnimating || gameStatus !== 'playing' || turnPhase !== 'roll') return;
      setRollingAnim(true);
      tabletopAudio.playDiceRoll();

      const rolled = overrideRoll ?? Math.floor(Math.random() * 6) + 1;

      setTimeout(async () => {
        setRollingAnim(false);
        const isHumanMe = !actorSeat.isBot && actorSeat.uid === myUid;
        if (rolled === 6) {
          triggerSeatBubble(actorSeat.color, 'Rolled a SIX!');
          if (isHumanMe) {
            playerSixesRef.current += 1;
            recordGameplayEvent({ rollSixes: 1 });
          }
        }

        const nextSixes = rolled === 6 ? consecutiveSixes + 1 : 0;

        if (nextSixes >= 3) {
          const nextIdx = (turnIndex + 1) % seats.length;
          const text = `${actorSeat.name} rolled three 6s — turn passes to ${seats[nextIdx].name}.`;
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
          return;
        }

        const legal = getMovableTokenIndices(tokens, actorSeat.color, rolled);

        if (legal.length === 0) {
          const nextIdx = (turnIndex + 1) % seats.length;
          const text = `${actorSeat.name} rolled ${rolled} — no move. ${seats[nextIdx].name} next.`;
          if (isOnline) {
            await submitMultiplayerTurn({
              tokens,
              turnIndex: nextIdx,
              diceValue: rolled,
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
              diceValue: rolled,
              turnPhase: 'roll',
              consecutiveSixes: 0,
              lastActionText: text,
              turnCount: prev.turnCount + 1,
            }));
          }
          return;
        }

        const colorTokens = tokens[actorSeat.color];
        const allSameSpot = legal.every((i) => colorTokens[i] === colorTokens[legal[0]]);
        const text =
          legal.length === 1 || allSameSpot
            ? `${actorSeat.name} rolled ${rolled} — auto-moving...`
            : `${actorSeat.name} rolled ${rolled}! Tap a glowing pawn.`;

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
      }, 280);
    },
    [
      rollingAnim,
      boardAnimating,
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
    ]
  );

  const executeTokenMove = useCallback(
    async (actorSeat: RoomSeat, tokenIdx: number) => {
      if (boardAnimating || gameStatus !== 'playing' || turnPhase !== 'move' || diceValue < 1) return;
      const legal = getMovableTokenIndices(tokens, actorSeat.color, diceValue);
      if (!legal.includes(tokenIdx)) return;

      const outcome = applyTokenMove(
        tokens,
        actorSeat.color,
        tokenIdx,
        diceValue,
        actorSeat.name,
        activeColors
      );

      if (outcome.capturedColors.length > 0) {
        triggerSeatBubble(actorSeat.color, 'CAPTURED! +1 Roll');
        if (!actorSeat.isBot && actorSeat.uid === myUid) {
          playerCapturesRef.current += outcome.capturedColors.length;
          recordGameplayEvent({ captures: outcome.capturedColors.length });
        }
      } else if (outcome.reachedHome) {
        tabletopAudio.playSafeStar();
        triggerSeatBubble(actorSeat.color, 'Home Finish!');
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
      gameStatus,
      turnPhase,
      diceValue,
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
    ]
  );

  useEffect(() => {
    if (gameStatus !== 'playing' || !currentSeat || !currentSeat.isBot || rollingAnim || boardAnimating) return;
    if (isOnline && activeRoom?.hostUid !== myUid) return;

    const difficulty = offlineMatch?.difficulty || 'tactical';
    const timer = setTimeout(() => {
      if (turnPhase === 'roll') {
        executeDiceRoll(currentSeat);
      } else if (turnPhase === 'move') {
        const chosen = chooseAiTokenMove(
          tokens,
          currentSeat.color,
          diceValue,
          activeColors,
          difficulty
        );
        if (chosen >= 0) {
          executeTokenMove(currentSeat, chosen);
        }
      }
    }, 460);

    return () => clearTimeout(timer);
  }, [
    gameStatus,
    currentSeat,
    rollingAnim,
    boardAnimating,
    isOnline,
    activeRoom?.hostUid,
    myUid,
    offlineMatch?.difficulty,
    turnPhase,
    tokens,
    diceValue,
    activeColors,
    executeDiceRoll,
    executeTokenMove,
  ]);

  // Automatic move when the player has only 1 legal move (or all legal pawns share the exact same tile/yard)
  useEffect(() => {
    if (!shouldAutoPlayOnlyMove || movableTokenIndices.length === 0) return;
    const onlyTokenIdx = movableTokenIndices[0];
    const timer = setTimeout(() => {
      executeTokenMove(currentSeat, onlyTokenIdx);
    }, 240);
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
    playerCapturesRef.current = 0;
    playerSixesRef.current = 0;
    summaryRecordedRef.current = false;
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
    const meta = PLAYER_COLOR_META[seat.color];
    const seatSteps = tokens[seat.color];
    const bubble = seatReaction?.color === seat.color ? seatReaction.text : null;

    return (
      <div
        key={seat.uid}
        className={`relative rounded-xl px-2.5 py-1.5 border flex items-center gap-2 transition-all min-w-0 ${
          active
            ? 'bg-[#1D352B] border-[#E5B852] shadow-[0_6px_18px_rgba(0,0,0,0.38)]'
            : 'bg-[#11201A]/92 border-[#263F35]'
        }`}
      >
        {bubble && (
          <div className="absolute -top-6 left-2 z-20 px-2 py-0.5 rounded-lg bg-[#E5B852] text-[#1A1000] text-[10px] font-bold shadow-lg whitespace-nowrap animate-pop-in">
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
            <span className="text-[11px] sm:text-xs font-bold text-[#F5F0E6] truncate leading-tight">
              {seat.name}
            </span>
            {active && (
              <span className="text-[9px] font-mono font-bold text-[#EBC46A] shrink-0">
                TURN
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-1.5 mt-1">
            <span
              className="text-[10px] font-semibold leading-none truncate"
              style={{ color: meta.ring }}
            >
              {meta.label}
            </span>
            {/* 4 mini pawn status pips: solid = home, half-ring = on board, hollow = in yard */}
            <div className="flex items-center gap-1 shrink-0" aria-label="Pawn progress">
              {seatSteps.map((step, i) => {
                const finished = step === 56;
                const onTrack = step >= 0 && step < 56;
                return (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full border transition-all"
                    style={{
                      borderColor: finished || onTrack ? meta.ring : 'rgba(155,176,165,0.4)',
                      backgroundColor: finished
                        ? '#EBC46A'
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

  if (!activeRoom && !offlineMatch) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-bold text-white">No Active Table</h1>
        <button
          type="button"
          onClick={() => setActiveTab('lobby')}
          className="mt-5 px-6 py-3 rounded-2xl font-display font-bold text-sm game-btn-gold cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    );
  }

  if (isOnline && activeRoom && activeRoom.status === 'waiting') {
    const isHost = activeRoom.hostUid === myUid;
    return (
      <div className="h-full w-full flex flex-col overflow-hidden">
        <div className="shrink-0 h-12 px-3 sm:px-6 bg-[#0C1814]/95 border-b border-[#274136] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleLeaveMatch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1A2F26] border border-[#2E4C40] text-xs font-semibold text-[#C5D5CC] hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Leave
          </button>
          <div className="text-xs font-medium text-[#9BB0A5] truncate">
            {activeRoom.visibility === 'public' ? 'Public' : 'Private'} · {activeRoom.mode} ·{' '}
            <span className="font-mono font-bold text-[#EAB957]">{activeRoom.entryStake}</span>
          </div>
          <button
            type="button"
            onClick={toggleSoundMuted}
            className="p-2 rounded-xl bg-[#1A2F26] border border-[#2F4E42] text-[#CBD5E1] cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar max-w-[1060px] w-full mx-auto px-3 sm:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#274136]">
                <div>
                  <div className="text-[11px] text-[#A6BBB0]">Share Code Across Devices</div>
                  <div className="mt-1 flex items-center gap-2.5">
                    <span className="font-mono text-2xl sm:text-3xl font-bold tracking-[0.2em] text-[#EAB957]">
                      {activeRoom.roomCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1F382E] border border-[#3D6153] text-xs font-semibold text-white cursor-pointer"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-[#34D399]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#A6BBB0]">Seated</div>
                  <div className="font-mono tabular-nums text-xl font-bold text-white">
                    {activeRoom.seats.length}/{activeRoom.maxPlayers}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {Array.from({ length: activeRoom.maxPlayers }).map((_, idx) => {
                  const seat = activeRoom.seats[idx];
                  if (!seat) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="rounded-2xl border-2 border-dashed border-[#2E4C40] bg-[#0C1814]/80 p-3 flex items-center gap-2.5"
                      >
                        <div className="w-9 h-9 rounded-full bg-[#1A2F26] flex items-center justify-center text-[#64748B] shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#94A3B8]">Seat {idx + 1}</div>
                          <div className="text-[11px] text-[#64748B] truncate">Waiting...</div>
                        </div>
                      </div>
                    );
                  }
                  const meta = PLAYER_COLOR_META[seat.color];
                  return (
                    <div
                      key={seat.uid}
                      className="rounded-2xl border-2 border-[#3B5E50] bg-[#10201A] p-3 flex items-center gap-2.5"
                    >
                      <PlayerAvatar
                        avatarId={seat.avatarId}
                        frameId={seat.avatarFrame}
                        size="sm"
                        alt={seat.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{seat.name}</div>
                        <div className="text-[11px] text-[#9BB0A5] flex items-center gap-1.5 mt-0.5">
                          <span style={{ color: meta.ring }}>{meta.label}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">{seat.elo}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-4 border-t border-[#274136] flex flex-wrap items-center justify-end gap-2.5">
                {isHost ? (
                  <>
                    {activeRoom.seats.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => hostStartRoom(false)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-display font-bold text-xs game-btn-green cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        START MATCH
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => hostStartRoom(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl font-display font-bold text-xs game-btn-gold cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      {activeRoom.seats.length < 2 ? 'FILL BOTS & START' : 'FILL WITH BOTS'}
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-[#C5D5CC]">
                    Waiting for <strong className="text-white">{activeRoom.seats[0]?.name}</strong> to start...
                  </p>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-4 flex flex-col h-[320px] lg:h-[380px]">
              <div className="flex items-center gap-2 pb-2.5 border-b border-[#274136]">
                <MessageSquare className="w-4 h-4 text-[#EAB957]" />
                <h2 className="font-display text-sm font-bold text-white">Room Chat</h2>
              </div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto no-scrollbar py-2.5 space-y-2">
                {roomMessages.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] py-6 text-center">
                    Chat while friends join code {activeRoom.roomCode}!
                  </p>
                ) : (
                  roomMessages.map((msg) => (
                    <div key={msg.id} className="text-xs leading-relaxed">
                      <span
                        className="font-bold"
                        style={{ color: PLAYER_COLOR_META[msg.senderColor].ring }}
                      >
                        {msg.senderName}
                      </span>
                      <span className="text-[#94A3B8] mx-1">:</span>
                      <span className="text-white">{msg.text}</span>
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
                  className="flex-1 bg-[#0C1814] border border-[#2F4E42] rounded-xl px-3 py-2 text-xs text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#EAB957]"
                />
                <button
                  type="submit"
                  className="p-2.5 rounded-xl game-btn-gold cursor-pointer"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const canUseAdReroll =
    !isOnline &&
    !offlineMatch?.tournamentContext &&
    isMyTurn &&
    turnPhase === 'move' &&
    diceValue < 6 &&
    !rerollUsedThisMatch &&
    !shouldAutoPlayOnlyMove;

  const mobileBoardSizeClass =
    seats.length > 2
      ? 'w-[min(calc(100vw-16px),max(276px,calc(100dvh-244px)))]'
      : 'w-[min(calc(100vw-16px),max(276px,calc(100dvh-188px)))]';

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Slim In-Game Top Bar */}
      <header className="shrink-0 h-11 px-3 sm:px-6 bg-[#0C1713]/95 backdrop-blur-md border-b border-[#D6BC84]/18 flex items-center justify-between gap-2 z-20">
        <button
          type="button"
          onClick={handleLeaveMatch}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#162821] border border-[#2B463B] text-xs font-semibold text-[#C8D6CE] hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>

        <div className="min-w-0 text-center">
          <div className="text-[11px] sm:text-xs font-display font-bold text-[#EBC46A] truncate">
            {isOnline
              ? `Live Table · ${activeRoom!.roomCode}`
              : offlineMatch?.tournamentContext
                ? `${offlineMatch.tournamentContext.tournamentTitle}`
                : `Parlor Match · ${(offlineMatch?.difficulty || 'tactical').toUpperCase()} AI`}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono tabular-nums text-[#9BB0A5] hidden sm:inline">
            Turn {turnCount + 1}
          </span>
          <button
            type="button"
            onClick={toggleSoundMuted}
            className="p-1.5 rounded-xl bg-[#162821] border border-[#2B463B] text-[#C8D6CE] hover:text-white cursor-pointer"
            aria-label={soundMuted ? 'Unmute' : 'Mute'}
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar">
      {/* MOBILE & TABLET FULL-SCREEN BOARD STAGE (< lg): Fits 1-screen on phones, safely scrollable if short/landscape */}
      <div className="lg:hidden min-h-full w-full flex flex-col items-center justify-between px-2 py-2 pb-3 gap-2">
        <div className={`shrink-0 ${mobileBoardSizeClass} grid grid-cols-2 gap-1.5`}>
          {seats.slice(0, 2).map((seat) => renderSeatPill(seat))}
        </div>

        <div className="w-full flex items-center justify-center my-auto">
          <div className={`${mobileBoardSizeClass} aspect-square`}>
            <LudoBoard
              tokens={tokens}
              activeColors={activeColors}
              currentTurnColor={currentSeat?.color || 'red'}
              movableTokenIndices={movableTokenIndices}
              canInteract={isMyTurn && turnPhase === 'move' && !shouldAutoPlayOnlyMove && !boardAnimating}
              boardThemeId={profile.boardTheme}
              diceValue={diceValue}
              onSelectToken={(idx) => executeTokenMove(currentSeat, idx)}
              onAnimatingChange={setBoardAnimating}
            />
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
            className="relative w-14 h-14 shrink-0 rounded-2xl bg-[#14251E] border border-[#2C473C] text-[#EBC46A] flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
            aria-label="Open emotes and live chat"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadChat > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C93838] text-white text-[10px] font-bold flex items-center justify-center">
                {unreadChat}
              </span>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <DiceControl
              value={diceValue}
              rolling={rollingAnim}
              canRoll={isMyTurn && turnPhase === 'roll' && !boardAnimating}
              diceThemeId={profile.diceTheme}
              onRoll={() => executeDiceRoll(currentSeat)}
              statusSubtext={
                boardAnimating
                  ? 'Moving piece...'
                  : shouldAutoPlayOnlyMove
                    ? 'Auto-moving only pawn...'
                    : isMyTurn && turnPhase === 'roll'
                      ? 'Your turn · Tap to roll'
                      : isMyTurn && turnPhase === 'move'
                        ? 'Tap a highlighted pawn'
                        : lastActionText
              }
              fullWidth
            />
          </div>

          {canUseAdReroll && !boardAnimating && (
            <button
              type="button"
              onClick={handleTacticalAdReroll}
              className="h-14 px-2.5 shrink-0 rounded-2xl bg-[#182C24] border border-[#D6BC84]/40 text-[10px] font-bold text-[#EBC46A] flex flex-col items-center justify-center cursor-pointer active:scale-95"
              title="Watch Ad for 1x Re-Roll"
            >
              <Dices className="w-4 h-4" />
              <span>Re-Roll</span>
            </button>
          )}
        </div>
      </div>

      {/* DESKTOP FULL-SCREEN BOARD STAGE (lg:): 12-Col Side-by-Side, Safely Scrollable on Short Windows */}
      <div className="hidden lg:grid min-h-full max-w-[1220px] w-full mx-auto px-6 py-3 grid-cols-12 gap-6 items-center">
        <div className="col-span-7 flex flex-col items-center justify-center gap-2 min-h-0">
          <div className="w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] grid grid-cols-2 gap-2.5 shrink-0">
            {seats.slice(0, 2).map((seat) => renderSeatPill(seat))}
          </div>

          <div className="w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] aspect-square shrink-0">
            <LudoBoard
              tokens={tokens}
              activeColors={activeColors}
              currentTurnColor={currentSeat?.color || 'red'}
              movableTokenIndices={movableTokenIndices}
              canInteract={isMyTurn && turnPhase === 'move' && !shouldAutoPlayOnlyMove && !boardAnimating}
              boardThemeId={profile.boardTheme}
              diceValue={diceValue}
              onSelectToken={(idx) => executeTokenMove(currentSeat, idx)}
              onAnimatingChange={setBoardAnimating}
            />
          </div>

          {seats.length > 2 && (
            <div className="w-[min(100%,max(320px,calc(100dvh-204px)))] max-w-[540px] grid grid-cols-2 gap-2.5 shrink-0">
              {seats.slice(2, 4).map((seat) => renderSeatPill(seat))}
            </div>
          )}
        </div>

        <div className="col-span-5 flex flex-col gap-3.5 min-h-[420px] max-h-[640px]">
          <div className="shrink-0 rounded-2xl bg-[#13231D]/95 border border-[#D6BC84]/25 p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#9BB0A5]">
                {isMyTurn ? 'Your Turn' : `${currentSeat?.name}'s Turn`}
              </div>
              <span className="text-xs font-mono font-bold text-[#EBC46A]">
                {boardAnimating
                  ? 'Moving...'
                  : shouldAutoPlayOnlyMove
                    ? 'Auto-moving'
                    : turnPhase === 'roll'
                      ? 'Roll Dice'
                      : 'Choose Pawn'}
              </span>
            </div>

            <p className="mt-1.5 text-xs text-[#E5DFD3] min-h-[28px] leading-relaxed">
              {lastActionText}
            </p>

            <div className="mt-3 flex items-center gap-2.5">
              <div className="flex-1 min-w-0">
                <DiceControl
                  value={diceValue}
                  rolling={rollingAnim}
                  canRoll={isMyTurn && turnPhase === 'roll' && !boardAnimating}
                  diceThemeId={profile.diceTheme}
                  onRoll={() => executeDiceRoll(currentSeat)}
                  statusSubtext={
                    boardAnimating
                      ? 'Hopping along the track...'
                      : shouldAutoPlayOnlyMove
                        ? 'Auto-moving only pawn...'
                        : isMyTurn && turnPhase === 'roll'
                          ? 'Tap or press Space'
                          : isMyTurn && turnPhase === 'move'
                            ? 'Hover a pawn to preview landing'
                            : undefined
                  }
                  fullWidth
                />
              </div>

              {canUseAdReroll && !boardAnimating && (
                <button
                  type="button"
                  onClick={handleTacticalAdReroll}
                  className="inline-flex items-center gap-1.5 px-3 py-3 rounded-2xl bg-[#1A2F26] border border-[#D6BC84]/40 text-xs font-bold text-[#EBC46A] hover:bg-[#223C31] cursor-pointer whitespace-nowrap"
                >
                  <Dices className="w-4 h-4" />
                  Re-Roll (Ad)
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 rounded-2xl bg-[#13231D]/95 border border-[#284237] p-4 flex flex-col">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#22382F] shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#EBC46A]" />
                <span className="font-display text-xs font-bold text-[#F5F0E6]">
                  {isOnline ? 'Live Table Chat & Emotes' : 'Table Reactions'}
                </span>
              </div>
              <span className="text-[11px] text-[#9BB0A5]">
                {isOnline ? 'Real-Time Sync' : 'Tap to react'}
              </span>
            </div>

            {isOnline ? (
              <>
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto no-scrollbar py-2.5 space-y-2">
                  {roomMessages.length === 0 ? (
                    <p className="text-xs text-[#8FA59A] py-6 text-center">
                      Tap a quick emote or type a message to players!
                    </p>
                  ) : (
                    roomMessages.map((msg) => (
                      <div key={msg.id} className="text-xs leading-relaxed">
                        <span
                          className="font-bold"
                          style={{ color: PLAYER_COLOR_META[msg.senderColor].ring }}
                        >
                          {msg.senderName}
                        </span>
                        <span className="text-[#8FA59A] mx-1">:</span>
                        <span className={msg.kind === 'emote' ? 'text-[#EBC46A] font-medium' : 'text-[#F5F0E6]'}>
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
                      className="px-2.5 py-1.5 rounded-xl bg-[#192E25] border border-[#2E4B3F] text-[11px] font-semibold text-[#E5DFD3] hover:border-[#E5B852] whitespace-nowrap shrink-0 cursor-pointer"
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
                    className="flex-1 bg-[#0C1713] border border-[#2C473C] rounded-xl px-3 py-2 text-xs text-[#F5F0E6] placeholder:text-[#6E867B] focus:outline-none focus:border-[#E5B852]"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl game-btn-gold cursor-pointer"
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
                      className="px-3 py-2.5 rounded-xl bg-[#192E25] border border-[#2E4B3F] text-xs font-semibold text-[#F5F0E6] hover:border-[#E5B852] active:scale-95 transition-transform text-left cursor-pointer"
                    >
                      {emote}
                    </button>
                  ))}
                </div>
                <div className="mt-2 p-3 rounded-xl bg-[#0D1A15] border border-[#253D33] text-[11px] text-[#A8BCB1]">
                  Hover any highlighted pawn to preview its landing square. Capturing an opponent
                  traces them all the way back to their yard.
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
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Table Chat and Emotes"
        >
          <div className="w-full max-w-lg rounded-t-3xl bg-[#13231D] border-t-2 border-[#D6BC84]/35 p-4 pb-6 shadow-2xl animate-pop-in flex flex-col max-h-[68dvh]">
            <div className="w-10 h-1 rounded-full bg-[#365448] mx-auto mb-2.5" />
            <div className="flex items-center justify-between pb-2.5 border-b border-[#243B32]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#EBC46A]" />
                <span className="font-display text-sm font-bold text-[#F5F0E6]">
                  {isOnline ? 'Live Table Chat & Emotes' : 'Quick Table Emotes'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatSheetOpen(false)}
                className="p-1.5 rounded-xl bg-[#1B3128] text-[#C8D6CE] cursor-pointer"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isOnline ? (
              <>
                <div className="flex-1 min-h-[120px] max-h-[220px] overflow-y-auto no-scrollbar py-2.5 space-y-2">
                  {roomMessages.length === 0 ? (
                    <p className="text-xs text-[#8FA59A] py-4 text-center">
                      No messages yet — send a quick emote below!
                    </p>
                  ) : (
                    roomMessages.map((msg) => (
                      <div key={msg.id} className="text-xs leading-relaxed">
                        <span
                          className="font-bold"
                          style={{ color: PLAYER_COLOR_META[msg.senderColor].ring }}
                        >
                          {msg.senderName}
                        </span>
                        <span className="text-[#8FA59A] mx-1">:</span>
                        <span className={msg.kind === 'emote' ? 'text-[#EBC46A] font-medium' : 'text-[#F5F0E6]'}>
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
                      className="px-3 py-1.5 rounded-xl bg-[#192E25] border border-[#2E4B3F] text-xs font-semibold text-[#F5F0E6] whitespace-nowrap shrink-0 cursor-pointer"
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
                    className="flex-1 bg-[#0C1713] border border-[#2C473C] rounded-xl px-3 py-2.5 text-xs text-[#F5F0E6] placeholder:text-[#6E867B] focus:outline-none focus:border-[#E5B852]"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl game-btn-gold cursor-pointer"
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
                    className="px-3 py-3 rounded-xl bg-[#192E25] border border-[#2E4B3F] text-xs font-semibold text-[#F5F0E6] active:scale-95 transition-transform text-left cursor-pointer"
                  >
                    {emote}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Victory / Match Summary Modal (waits until final winning hop finishes!) */}
      {matchSummary && !boardAnimating && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Match Summary"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto no-scrollbar rounded-3xl bg-[#13231D] border-2 border-[#E5B852] p-5 sm:p-6 shadow-2xl animate-pop-in">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#EAB957]/15 border-2 border-[#EAB957] text-[#EAB957] mx-auto flex items-center justify-center">
                <Crown className="w-7 h-7" />
              </div>
              <h2 className="mt-3 font-display text-2xl font-extrabold text-white">
                {matchSummary.won ? 'CROWN VICTORY!' : `${matchSummary.winnerName} WINS`}
              </h2>
              <p className="mt-1 text-xs text-[#9BB0A5]">
                Completed in {matchSummary.turnsPlayed} turns
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136]">
                <div className="text-[11px] text-[#94A3B8]">Coins</div>
                <div className="mt-1 font-mono tabular-nums text-base font-bold text-[#EAB957]">
                  +{matchSummary.doubledWithAd ? matchSummary.coinsEarned * 2 : matchSummary.coinsEarned}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136]">
                <div className="text-[11px] text-[#94A3B8]">ELO</div>
                <div className="mt-1 font-mono tabular-nums text-base font-bold text-white">
                  {matchSummary.eloDelta >= 0 ? `+${matchSummary.eloDelta}` : matchSummary.eloDelta}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-[#0C1814] border border-[#274136]">
                <div className="text-[11px] text-[#94A3B8]">Captures</div>
                <div className="mt-1 font-mono tabular-nums text-base font-bold text-[#34D399]">
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
                className="mt-5 w-full py-3 px-4 rounded-2xl font-display font-bold text-sm game-btn-gold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                WATCH AD FOR 2X COINS (+{matchSummary.coinsEarned})
              </button>
            )}

            <div className="mt-3 flex items-center gap-3">
              {!isOnline && !matchSummary.isTournament && (
                <button
                  type="button"
                  onClick={handlePracticeRestart}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl font-display font-bold text-sm game-btn-green cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  PLAY AGAIN
                </button>
              )}
              <button
                type="button"
                onClick={handleLeaveMatch}
                className="flex-1 py-2.5 px-4 rounded-2xl bg-[#0C1814] border border-[#2F4E42] text-sm font-semibold text-[#C5D5CC] hover:text-white cursor-pointer"
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
