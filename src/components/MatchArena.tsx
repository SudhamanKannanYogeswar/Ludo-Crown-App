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
      lastActionText: `${profile.displayName} rolls first. Tap Roll Dice or press Space.`,
      turnCount: 0,
    };
  }, [offlineMatch, profile]);

  const [localGame, setLocalGame] = useState<LocalGameState>(() => buildInitialOfflineState());
  const [rollingAnim, setRollingAnim] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [rerollUsedThisMatch, setRerollUsedThisMatch] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);

  const playerCapturesRef = useRef(0);
  const playerSixesRef = useRef(0);
  const summaryRecordedRef = useRef(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Reset local game whenever offlineMatch config changes
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

  // Reset refs when switching rooms
  useEffect(() => {
    if (activeRoom?.id) {
      playerCapturesRef.current = 0;
      playerSixesRef.current = 0;
      summaryRecordedRef.current = false;
      setMatchSummary(null);
    }
  }, [activeRoom?.id]);

  // Auto-scroll chat feed
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [roomMessages.length]);

  // Unified board state projection
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

  // Detect online match finish & trigger summary recording once
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

  // Core Dice Roll handler (shared between online human, offline human, and bots)
  const executeDiceRoll = useCallback(
    async (actorSeat: RoomSeat, overrideRoll?: number) => {
      if (rollingAnim || gameStatus !== 'playing' || turnPhase !== 'roll') return;
      setRollingAnim(true);
      tabletopAudio.playDiceRoll();

      const rolled = overrideRoll ?? Math.floor(Math.random() * 6) + 1;

      setTimeout(async () => {
        setRollingAnim(false);
        const isHumanMe = !actorSeat.isBot && actorSeat.uid === myUid;
        if (isHumanMe && rolled === 6) {
          playerSixesRef.current += 1;
          recordGameplayEvent({ rollSixes: 1 });
        }

        const nextSixes = rolled === 6 ? consecutiveSixes + 1 : 0;

        // Three consecutive 6s forfeits turn per classic rules
        if (nextSixes >= 3) {
          const nextIdx = (turnIndex + 1) % seats.length;
          const text = `${actorSeat.name} rolled three 6s in a row — turn passes to ${seats[nextIdx].name}.`;
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
          const text = `${actorSeat.name} rolled ${rolled} with no legal moves. ${seats[nextIdx].name}'s turn.`;
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

        // Legal moves exist -> enter 'move' phase
        const text = `${actorSeat.name} rolled ${rolled}. Select a highlighted token to move.`;
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
      }, 320);
    },
    [
      rollingAnim,
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
    ]
  );

  // Core Token Move handler
  const executeTokenMove = useCallback(
    async (actorSeat: RoomSeat, tokenIdx: number) => {
      if (gameStatus !== 'playing' || turnPhase !== 'move' || diceValue < 1) return;
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
        tabletopAudio.playCapture();
        if (!actorSeat.isBot && actorSeat.uid === myUid) {
          playerCapturesRef.current += outcome.capturedColors.length;
          recordGameplayEvent({ captures: outcome.capturedColors.length });
        }
      } else if (outcome.landedSafe) {
        tabletopAudio.playSafeStar();
      } else {
        tabletopAudio.playTokenMove();
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
    ]
  );

  // Automated Bot Turn Driver (for Offline Practice & Online Host-managed Fill Bots)
  useEffect(() => {
    if (gameStatus !== 'playing' || !currentSeat || !currentSeat.isBot || rollingAnim) return;
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
    }, 620);

    return () => clearTimeout(timer);
  }, [
    gameStatus,
    currentSeat,
    rollingAnim,
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

  // Keyboard shortcut: Spacebar to roll dice when it's your turn
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isMyTurn && turnPhase === 'roll' && !rollingAnim) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        executeDiceRoll(currentSeat);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMyTurn, turnPhase, rollingAnim, currentSeat, executeDiceRoll]);

  const handleCopyCode = () => {
    if (!activeRoom) return;
    navigator.clipboard?.writeText(activeRoom.roomCode).catch(() => {});
    setCopiedCode(true);
    showToast(`Copied table code ${activeRoom.roomCode}.`, 'success');
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

  // Fallback if navigated directly to Play without an active match
  if (!activeRoom && !offlineMatch) {
    return (
      <div className="max-w-[960px] mx-auto px-6 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold text-[#F5F2EB]">
          No Active Table Selected
        </h1>
        <p className="mt-3 text-sm text-[#A5BDB2] max-w-md mx-auto">
          Jump into a live multiplayer room from the lobby or start an instant offline practice
          table against strategic bots.
        </p>
        <button
          type="button"
          onClick={() => setActiveTab('lobby')}
          className="mt-6 px-6 py-2.5 rounded-lg bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] transition-colors cursor-pointer"
        >
          Go to Matchmaking Lobby
        </button>
      </div>
    );
  }

  // Online Waiting Room View
  if (isOnline && activeRoom && activeRoom.status === 'waiting') {
    const isHost = activeRoom.hostUid === myUid;
    return (
      <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <button
            type="button"
            onClick={handleLeaveMatch}
            className="inline-flex items-center gap-2 text-sm text-[#B8C9C1] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Leave Table
          </button>
          <div className="text-xs text-[#9EB5AA]">
            {activeRoom.visibility === 'public' ? 'Public Matchmaking' : 'Private Table'} ·{' '}
            {activeRoom.mode === 'quick' ? 'Quick Mode' : 'Classic Mode'} · Stake{' '}
            <span className="font-mono tabular-nums text-[#E5B95C]">{activeRoom.entryStake}</span>{' '}
            Coins
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Seated Players & Controls */}
          <div className="lg:col-span-3 rounded-2xl bg-[#102B22] border border-[#234739] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#1E3E31]">
              <div>
                <div className="text-xs text-[#9EB5AA]">Share this code for cross-device join</div>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-3xl font-semibold tracking-[0.18em] text-[#E5B95C]">
                    {activeRoom.roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#183C2F] border border-[#2B5646] text-xs font-medium text-[#F5F2EB] hover:bg-[#204B3B] transition-colors cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-[#4ADE80]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#9EB5AA]">Players Seated</div>
                <div className="font-mono tabular-nums text-xl font-semibold text-[#F5F2EB] mt-0.5">
                  {activeRoom.seats.length} / {activeRoom.maxPlayers}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {Array.from({ length: activeRoom.maxPlayers }).map((_, idx) => {
                const seat = activeRoom.seats[idx];
                if (!seat) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="rounded-xl border border-dashed border-[#2A4E3F] bg-[#0C211A] p-4 flex items-center gap-3.5"
                    >
                      <div className="w-10 h-10 rounded-full bg-[#133227] flex items-center justify-center text-[#5F8072]">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#88A598]">Open Seat {idx + 1}</div>
                        <div className="text-xs text-[#617E71]">Waiting for player...</div>
                      </div>
                    </div>
                  );
                }
                const meta = PLAYER_COLOR_META[seat.color];
                return (
                  <div
                    key={seat.uid}
                    className="rounded-xl border border-[#264C3D] bg-[#0D251D] p-4 flex items-center gap-3.5"
                  >
                    <PlayerAvatar avatarId={seat.avatarId} frameId={seat.avatarFrame} size="sm" alt={seat.name} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#F5F2EB] truncate">{seat.name}</div>
                      <div className="text-xs text-[#9EB5AA] mt-0.5 flex items-center gap-2">
                        <span style={{ color: meta.ring }}>{meta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">ELO {seat.elo}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-[#1E3E31] flex flex-wrap items-center justify-between gap-3">
              {isHost ? (
                <>
                  <p className="text-xs text-[#9EB5AA]">
                    Start immediately with seated players or fill remaining seats with AI opponents.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    {activeRoom.seats.length >= 2 && (
                      <button
                        type="button"
                        onClick={() => hostStartRoom(false)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        Start Match
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => hostStartRoom(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A3E30] border border-[#2E5D4B] text-sm font-medium text-[#F5F2EB] hover:bg-[#224E3D] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-[#D4A446]" />
                      {activeRoom.seats.length < 2 ? 'Fill Bots & Start' : 'Fill Remaining with Bots'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[#B8C9C1]">
                  Waiting for host <span className="font-semibold text-white">{activeRoom.seats[0]?.name}</span> to start the match...
                </p>
              )}
            </div>
          </div>

          {/* Waiting Room Live Chat */}
          <div className="lg:col-span-2 rounded-2xl bg-[#102B22] border border-[#234739] p-5 flex flex-col h-[390px]">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1E3E31]">
              <MessageSquare className="w-4 h-4 text-[#D4A446]" />
              <h2 className="text-sm font-semibold text-[#F5F2EB]">Table Chat</h2>
            </div>
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {roomMessages.length === 0 ? (
                <p className="text-xs text-[#7D998C] py-6 text-center">
                  Say hello while players join table {activeRoom.roomCode}.
                </p>
              ) : (
                roomMessages.map((msg) => (
                  <div key={msg.id} className="text-xs leading-relaxed">
                    <span
                      className="font-semibold"
                      style={{ color: PLAYER_COLOR_META[msg.senderColor].ring }}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-[#9EB5AA] mx-1.5">:</span>
                    <span className="text-[#F5F2EB]">{msg.text}</span>
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
                placeholder="Type a message..."
                className="flex-1 bg-[#0B1E17] border border-[#254A3B] rounded-lg px-3 py-2 text-xs text-[#F5F2EB] placeholder:text-[#6D8B7E] focus:outline-none focus:border-[#D4A446]"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B] cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Active Gameplay Arena (Online or Offline Practice / Tournament)
  return (
    <div className="max-w-[1260px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
      {/* Compact Unobtrusive Match Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleLeaveMatch}
            className="inline-flex items-center gap-1.5 text-sm text-[#B8C9C1] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Match
          </button>
          <span className="text-xs text-[#8FA99C] hidden sm:inline">
            {isOnline
              ? `Live Table ${activeRoom!.roomCode} · ${activeRoom!.mode === 'quick' ? 'Quick' : 'Classic'}`
              : offlineMatch?.tournamentContext
                ? `${offlineMatch.tournamentContext.tournamentTitle} · ${offlineMatch.tournamentContext.round === 'final' ? 'Grand Final' : 'Semifinal'}`
                : `Offline Practice · ${offlineMatch?.difficulty || 'Tactical'} AI`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-[#9EB5AA]">
            Turn {turnCount + 1}
          </span>
          <button
            type="button"
            onClick={toggleSoundMuted}
            className="p-2 rounded-lg bg-[#123026] border border-[#24493A] text-[#C8D8D0] hover:text-white cursor-pointer"
            aria-label={soundMuted ? 'Unmute sound effects' : 'Mute sound effects'}
          >
            {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Arena Split: Board (Left/Center) + Turn HUD & Chat (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Center: 15x15 Ludo Board */}
        <div className="lg:col-span-7 xl:col-span-7">
          <LudoBoard
            tokens={tokens}
            activeColors={activeColors}
            currentTurnColor={currentSeat?.color || 'red'}
            movableTokenIndices={movableTokenIndices}
            canInteract={isMyTurn && turnPhase === 'move'}
            boardThemeId={profile.boardTheme}
            onSelectToken={(idx) => executeTokenMove(currentSeat, idx)}
          />
        </div>

        {/* Right: Active Turn HUD, Players Roster, Dice Control & Live Chat */}
        <div className="lg:col-span-5 xl:col-span-5 space-y-4">
          {/* Active Turn & Dice Dock */}
          <div className="rounded-2xl bg-[#102B22] border border-[#254A3B] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {currentSeat && (
                  <PlayerAvatar
                    avatarId={currentSeat.avatarId}
                    frameId={currentSeat.avatarFrame}
                    size="sm"
                    alt={currentSeat.name}
                  />
                )}
                <div className="min-w-0">
                  <div className="text-xs text-[#9EB5AA]">Active Turn</div>
                  <div className="text-base font-semibold text-[#F5F2EB] truncate">
                    {currentSeat?.name}{' '}
                    <span
                      className="text-xs font-medium ml-1"
                      style={{ color: PLAYER_COLOR_META[currentSeat?.color || 'red'].ring }}
                    >
                      ({PLAYER_COLOR_META[currentSeat?.color || 'red'].label})
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#E5B95C] shrink-0">
                {turnPhase === 'roll' ? 'ROLL' : 'MOVE'}
              </span>
            </div>

            <p className="mt-3 text-xs text-[#B8C9C1] min-h-[32px] leading-relaxed">
              {lastActionText}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <DiceControl
                value={diceValue}
                rolling={rollingAnim}
                canRoll={isMyTurn && turnPhase === 'roll'}
                diceThemeId={profile.diceTheme}
                onRoll={() => executeDiceRoll(currentSeat)}
              />

              {/* Optional Practice-Only Rewarded Ad Lifeline (strictly 1 per match) */}
              {!isOnline &&
                !offlineMatch?.tournamentContext &&
                isMyTurn &&
                turnPhase === 'move' &&
                diceValue < 6 &&
                !rerollUsedThisMatch && (
                  <button
                    type="button"
                    onClick={handleTacticalAdReroll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#183C2F] border border-[#2F5E4D] text-xs font-medium text-[#E5B95C] hover:bg-[#1F4A3A] transition-colors cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                    Re-Roll (Ad · 1 left)
                  </button>
                )}
            </div>
          </div>

          {/* Seated Players Progress */}
          <div className="rounded-2xl bg-[#102B22] border border-[#234739] p-4">
            <div className="text-xs font-medium text-[#9EB5AA] mb-3">Players at Table</div>
            <div className="grid grid-cols-2 gap-2.5">
              {seats.map((seat, idx) => {
                const finishedCount = tokens[seat.color].filter((s) => s === 56).length;
                const active = idx === turnIndex && gameStatus === 'playing';
                const meta = PLAYER_COLOR_META[seat.color];
                return (
                  <div
                    key={seat.uid}
                    className={`rounded-xl p-3 border transition-colors ${
                      active
                        ? 'bg-[#173B2E] border-[#D4A446]'
                        : 'bg-[#0C211A] border-[#1D3C30]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <PlayerAvatar
                        avatarId={seat.avatarId}
                        frameId={seat.avatarFrame}
                        size="xs"
                        alt={seat.name}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-[#F5F2EB] truncate">
                          {seat.name}
                        </div>
                        <div className="text-[11px] text-[#9EB5AA] flex items-center justify-between mt-0.5">
                          <span style={{ color: meta.ring }}>{meta.label}</span>
                          <span className="font-mono tabular-nums">{finishedCount}/4 Home</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Multiplayer Chat (Online) OR Quick Rules & Emote Feed (Offline) */}
          {isOnline ? (
            <div className="rounded-2xl bg-[#102B22] border border-[#234739] p-4 flex flex-col h-[270px]">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#1E3E31]">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#D4A446]" />
                  <span className="text-xs font-semibold text-[#F5F2EB]">Live Table Chat</span>
                </div>
                <span className="text-[11px] text-[#88A598]">Synced across devices</span>
              </div>

              <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1">
                {roomMessages.length === 0 ? (
                  <p className="text-xs text-[#7D998C] py-4 text-center">
                    Send a quick emote or chat with players at this table.
                  </p>
                ) : (
                  roomMessages.map((msg) => (
                    <div key={msg.id} className="text-xs leading-relaxed">
                      <span
                        className="font-semibold"
                        style={{ color: PLAYER_COLOR_META[msg.senderColor].ring }}
                      >
                        {msg.senderName}
                      </span>
                      <span className="text-[#8FA99C] mx-1">:</span>
                      <span className={msg.kind === 'emote' ? 'text-[#E5B95C]' : 'text-[#F5F2EB]'}>
                        {msg.text}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* One-Tap Quick Emotes */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                {QUICK_CHAT_EMOTES.slice(0, 4).map((emote) => (
                  <button
                    key={emote}
                    type="button"
                    onClick={() => sendChat(emote, 'emote')}
                    className="px-2.5 py-1 rounded-md bg-[#16382B] border border-[#285141] text-[11px] text-[#D7E4DE] hover:border-[#D4A446] whitespace-nowrap shrink-0 cursor-pointer"
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
                  placeholder="Write to table..."
                  className="flex-1 bg-[#0B1E17] border border-[#254A3B] rounded-lg px-3 py-2 text-xs text-[#F5F2EB] placeholder:text-[#6D8B7E] focus:outline-none focus:border-[#D4A446]"
                />
                <button
                  type="submit"
                  className="p-2 rounded-lg bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B] cursor-pointer"
                  aria-label="Send chat message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl bg-[#102B22] border border-[#234739] p-4">
              <div className="text-xs font-semibold text-[#F5F2EB] mb-2">Classic Rules Reminder</div>
              <ul className="space-y-1.5 text-xs text-[#A5BDB2] leading-relaxed">
                <li>Roll a 6 to deploy a token from your yard and earn a bonus roll.</li>
                <li>Star tiles are safe sanctuaries where tokens cannot be captured.</li>
                <li>Capture an opponent on a regular tile to send them back and roll again.</li>
                <li>Exact roll enters the central Crown Finish. First to bring all 4 home wins.</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Post-Match Victory / Summary Modal with 2x Rewarded Video Option */}
      {matchSummary && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Match Summary"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#112B22] border border-[#2F5B49] p-6 shadow-2xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-[#D4A446]/15 border border-[#D4A446]/45 text-[#E5B95C] mx-auto flex items-center justify-center">
                <Crown className="w-6 h-6" />
              </div>
              <h2 className="mt-3 font-display text-2xl font-semibold text-[#F5F2EB]">
                {matchSummary.won ? 'Victory Claimed' : `${matchSummary.winnerName} Wins`}
              </h2>
              <p className="mt-1 text-xs text-[#A5BDB2]">
                {matchSummary.isTournament
                  ? matchSummary.won && matchSummary.tournamentRound === 'final'
                    ? 'You won the Championship Trophy and Prize Pool!'
                    : matchSummary.won
                      ? 'You advanced to the Championship Final!'
                      : 'Eliminated from the bracket. Enter another league tournament anytime.'
                  : `Completed in ${matchSummary.turnsPlayed} turns`}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-[#0B1E17] border border-[#1E3F32]">
                <div className="text-[11px] text-[#8FA99C]">Coins</div>
                <div className="mt-1 font-mono tabular-nums text-base font-semibold text-[#E5B95C]">
                  +{matchSummary.doubledWithAd ? matchSummary.coinsEarned * 2 : matchSummary.coinsEarned}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0B1E17] border border-[#1E3F32]">
                <div className="text-[11px] text-[#8FA99C]">Rating</div>
                <div className="mt-1 font-mono tabular-nums text-base font-semibold text-[#F5F2EB]">
                  {matchSummary.eloDelta >= 0 ? `+${matchSummary.eloDelta}` : matchSummary.eloDelta}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#0B1E17] border border-[#1E3F32]">
                <div className="text-[11px] text-[#8FA99C]">Captures</div>
                <div className="mt-1 font-mono tabular-nums text-base font-semibold text-[#F5F2EB]">
                  {matchSummary.capturesByPlayer}
                </div>
              </div>
            </div>

            {/* Smooth High-Retention Rewarded Video 2x Payout Placement */}
            {!matchSummary.doubledWithAd && (
              <button
                type="button"
                onClick={() =>
                  doubleSummaryCoinsWithAd(matchSummary, () => {
                    setMatchSummary((prev) => (prev ? { ...prev, doubledWithAd: true } : null));
                  })
                }
                className="mt-5 w-full py-3 px-4 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4" />
                Watch Short Video for 2x Coins (+{matchSummary.coinsEarned})
              </button>
            )}

            <div className="mt-3 flex items-center gap-3">
              {!isOnline && !matchSummary.isTournament && (
                <button
                  type="button"
                  onClick={handlePracticeRestart}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#1A3E30] border border-[#2E5D4B] text-sm font-medium text-[#F5F2EB] hover:bg-[#224E3D] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
              )}
              <button
                type="button"
                onClick={handleLeaveMatch}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#0D231B] border border-[#24493A] text-sm font-medium text-[#C8D8D0] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Back to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
