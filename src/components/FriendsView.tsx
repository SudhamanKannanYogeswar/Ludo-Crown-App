import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  RefreshCw,
  Search,
  Send,
  Shuffle,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatPlayerTag, FRIENDS_TABLE_STUDIO_IMAGE } from '../data/catalog';
import {
  formatInviteCountdown,
  getInviteRemainingMs,
  resolvePlayerPresence,
} from '../services/firestoreService';
import { PlayerAvatar } from './PlayerAvatar';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'PL';
}

const BADGE_COLORS = [
  { bg: 'bg-gradient-to-b from-[#FF5E7E] to-[#E11D48]', text: 'text-white' },
  { bg: 'bg-gradient-to-b from-[#34F59F] to-[#059669]', text: 'text-white' },
  { bg: 'bg-gradient-to-b from-[#FFF066] to-[#F59E0B]', text: 'text-[#111827]' },
  { bg: 'bg-gradient-to-b from-[#38BDF8] to-[#1D4ED8]', text: 'text-white' },
];

export function FriendsView() {
  const {
    isSignedIn,
    profile,
    leaderboard,
    refreshLeaderboard,
    friendships,
    incomingInvites,
    sendFriendRequest,
    acceptFriend,
    removeFriend,
    inviteFriendToPlay,
    acceptRoomInvite,
    declineRoomInvite,
    signingIn,
    signInWithGoogle,
    presenceNowMs,
    showToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.floor(Math.random() * 10_000));
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const myTag = formatPlayerTag(profile.uid, profile.displayName);

  useEffect(() => {
    if (isSignedIn) {
      refreshLeaderboard().catch(() => {});
    }
  }, [isSignedIn, refreshLeaderboard]);

  const acceptedFriends = useMemo(
    () => friendships.filter((f) => f.status === 'accepted'),
    [friendships]
  );

  const incomingFriendRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.recipientUid === profile.uid),
    [friendships, profile.uid]
  );

  const outgoingFriendRequests = useMemo(
    () => friendships.filter((f) => f.status === 'pending' && f.requesterUid === profile.uid),
    [friendships, profile.uid]
  );

  const connectedUids = useMemo(() => {
    const set = new Set<string>([profile.uid]);
    friendships.forEach((f) => {
      f.pairUids.forEach((u) => set.add(u));
    });
    return set;
  }, [friendships, profile.uid]);

  const profileLookup = useMemo(() => {
    const map = new Map<string, (typeof leaderboard)[number]>();
    leaderboard.forEach((p) => map.set(p.uid, p));
    return map;
  }, [leaderboard]);

  const acceptedFriendsWithPresence = useMemo(() => {
    return acceptedFriends
      .map((f) => {
        const isRequester = f.requesterUid === profile.uid;
        const friendUid = isRequester ? f.recipientUid : f.requesterUid;
        const friendName = isRequester ? f.recipientName : f.requesterName;
        const friendProfile = profileLookup.get(friendUid);
        const presence = resolvePlayerPresence(friendProfile, presenceNowMs);
        return {
          friendship: f,
          friendUid,
          friendName,
          friendProfile,
          presence,
        };
      })
      .sort((a, b) => {
        const rank = (s: 'online' | 'in_match' | 'offline') =>
          s === 'online' ? 0 : s === 'in_match' ? 1 : 2;
        const diff = rank(a.presence.status) - rank(b.presence.status);
        if (diff !== 0) return diff;
        return (b.friendProfile?.lastActiveMs || 0) - (a.friendProfile?.lastActiveMs || 0);
      });
  }, [acceptedFriends, profile.uid, profileLookup, presenceNowMs]);

  const onlineFriendsCount = useMemo(
    () => acceptedFriendsWithPresence.filter((e) => e.presence.isOnline).length,
    [acceptedFriendsWithPresence]
  );

  const unconnectedPlayers = useMemo(
    () => leaderboard.filter((p) => !connectedUids.has(p.uid)),
    [leaderboard, connectedUids]
  );

  const discoverResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return unconnectedPlayers;
    return unconnectedPlayers.filter((p) => {
      const tag = formatPlayerTag(p.uid, p.displayName).toLowerCase();
      return p.displayName.toLowerCase().includes(q) || tag.includes(q);
    });
  }, [unconnectedPlayers, query]);

  const randomSuggestions = useMemo(() => {
    if (unconnectedPlayers.length === 0) return [];
    const copy = [...unconnectedPlayers];
    let s = shuffleSeed || 1;
    for (let i = copy.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 4);
  }, [unconnectedPlayers, shuffleSeed]);

  const handleCopyTag = async () => {
    try {
      await navigator.clipboard.writeText(myTag);
      showToast(`Player tag ${myTag} copied!`, 'success');
    } catch {
      showToast(`Your player tag is ${myTag}`, 'info');
    }
  };

  const handleRefreshDirectory = async () => {
    if (!isSignedIn) return;
    setRefreshing(true);
    try {
      await refreshLeaderboard();
    } finally {
      setRefreshing(false);
    }
  };

  const handleShuffleRandom = () => {
    setShuffleSeed((prev) => prev + 1 + Math.floor(Math.random() * 997));
  };

  const handleInviteFriend = async (friendUid: string, friendName: string) => {
    setBusyUid(friendUid);
    try {
      await inviteFriendToPlay(friendUid, friendName);
    } finally {
      setBusyUid(null);
    }
  };

  const handleAddPlayer = async (target: (typeof leaderboard)[number]) => {
    setBusyUid(target.uid);
    try {
      await sendFriendRequest(target);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-5 pb-8 space-y-5">
      {/* Header: Friends + Copyable Player Tag */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Friends
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Add players and send instant table invites to join your room.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopyTag}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#CBD5E1] hover:border-[#111827] text-xs font-mono font-bold text-[#334155] cursor-pointer transition-colors shadow-xs"
          title="Copy your Player Tag"
        >
          <span>Tag: {myTag}</span>
          <Copy className="w-3.5 h-3.5 text-[#1D4ED8]" />
        </button>
      </div>

      {/* Search Bar + Always-Visible Browse Signed-In Players CTA */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => setDirectoryOpen(true)}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or #tag"
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white border-2 border-[#111827] text-sm font-medium text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/25"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#111827] cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isSignedIn) {
                signInWithGoogle();
                return;
              }
              setDirectoryOpen((v) => !v);
              handleRefreshDirectory();
            }}
            className="h-[46px] px-4 rounded-2xl game-btn-gold inline-flex items-center justify-center gap-1.5 font-display font-extrabold text-xs cursor-pointer shrink-0"
            aria-label="Browse signed-in players"
            title="Browse all signed-in players"
          >
            <UserPlus className="w-4 h-4" />
            <span>{directoryOpen ? 'Hide Players' : 'Browse Signed-In Players'}</span>
          </button>
        </div>
      </div>

      {/* Sign-in Prompt if Guest */}
      {!isSignedIn && (
        <div className="studio-card rounded-3xl p-5 bg-[#EFF6FF] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <h2 className="font-display text-base font-extrabold text-[#111827]">
              Sign in to build your Ludo squad
            </h2>
            <p className="text-xs text-[#475569] mt-1">
              Add friends by name or #tag, discover random players, and receive live table invites.
            </p>
          </div>
          <button
            type="button"
            disabled={signingIn}
            onClick={signInWithGoogle}
            className="px-5 py-2.5 rounded-2xl font-display font-extrabold text-xs game-btn-blue cursor-pointer shrink-0 disabled:opacity-60"
          >
            {signingIn ? 'Signing in...' : 'Sign In with Google'}
          </button>
        </div>
      )}

      {/* Search / Full Signed-In Player Directory Panel */}
      {isSignedIn && (query.trim().length > 0 || directoryOpen) && (
        <section className="studio-card-sm rounded-3xl p-4 space-y-2.5 animate-pop-in">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-xs font-extrabold uppercase tracking-wide text-[#475569]">
              {query.trim()
                ? `Matching Players (${discoverResults.length})`
                : `Signed-In Players (${discoverResults.length})`}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleRefreshDirectory}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectoryOpen(false);
                  setQuery('');
                }}
                className="p-1 text-[#64748B] hover:text-[#111827] cursor-pointer"
                aria-label="Hide player directory"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {discoverResults.length === 0 ? (
            <p className="text-xs text-[#64748B] py-2 text-center">
              No matching signed-in players found. Share your tag <strong>{myTag}</strong> so friends can add you!
            </p>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
              {discoverResults.map((p) => {
                const pTag = formatPlayerTag(p.uid, p.displayName);
                const pRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
                return (
                  <div
                    key={p.uid}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar
                        avatarId={p.avatarId}
                        frameId={p.avatarFrame}
                        size="xs"
                        alt={p.displayName}
                      />
                      <div className="min-w-0">
                        <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                          {p.displayName}
                        </div>
                        <div className="text-[11px] font-mono text-[#64748B] truncate">
                          {pTag} · {p.elo} pts · {pRate}% win
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busyUid === p.uid}
                      onClick={() => handleAddPlayer(p)}
                      className="px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer disabled:opacity-60 shrink-0"
                    >
                      {busyUid === p.uid ? 'Adding...' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Discover Random Players Card — Always Available (Even After Adding Friends!) */}
      {isSignedIn && randomSuggestions.length > 0 && !directoryOpen && !query.trim() && (
        <section className="studio-card-sm rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm sm:text-base font-extrabold text-[#111827]">
                Discover Random Players
              </h2>
              <p className="text-[11px] text-[#64748B]">
                Add active signed-in players or shuffle for fresh picks.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShuffleRandom}
                className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-white inline-flex items-center gap-1 cursor-pointer"
                title="Shuffle random players"
              >
                <Shuffle className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Shuffle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDirectoryOpen(true);
                  handleRefreshDirectory();
                }}
                className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer"
              >
                All ({unconnectedPlayers.length})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {randomSuggestions.map((p) => {
              const pRate = p.gamesPlayed > 0 ? Math.round((p.wins / p.gamesPlayed) * 100) : 0;
              return (
                <div
                  key={p.uid}
                  className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <PlayerAvatar
                      avatarId={p.avatarId}
                      frameId={p.avatarFrame}
                      size="xs"
                      alt={p.displayName}
                    />
                    <div className="min-w-0">
                      <div className="font-display text-xs sm:text-sm font-extrabold text-[#111827] truncate">
                        {p.displayName}
                      </div>
                      <div className="text-[10px] font-mono text-[#64748B] truncate">
                        {p.elo} pts · {pRate}% win
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busyUid === p.uid}
                    onClick={() => handleAddPlayer(p)}
                    className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer disabled:opacity-60 shrink-0"
                  >
                    {busyUid === p.uid ? '...' : '+ Add'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Vivid Animated Illustrated Party Dice Tray Banner */}
      <div className="studio-card rounded-3xl overflow-hidden bg-gradient-to-br from-[#38BDF8] via-[#60A5FA] to-[#FACC15]">
        <div className="relative h-36 sm:h-44 w-full overflow-hidden">
          <img
            src={FRIENDS_TABLE_STUDIO_IMAGE}
            alt="Four cheering Ludo pawns celebrating around a glowing golden die"
            draggable={false}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover object-center select-none animate-art-breathe"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[45%] opacity-30 mix-blend-soft-light animate-sun-spin"
            style={{
              background:
                'repeating-conic-gradient(from 0deg, rgba(255,255,255,0.9) 0deg 14deg, transparent 14deg 28deg)',
            }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shine-sweep"
          />
          <svg
            aria-hidden="true"
            viewBox="0 0 36 36"
            className="pointer-events-none absolute top-3 right-5 w-6 h-6 animate-sparkle"
          >
            <path
              d="M18 2 L22 14 L34 18 L22 22 L18 34 L14 22 L2 18 L14 14 Z"
              fill="#FFF066"
              stroke="#111827"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          <div className="absolute bottom-2.5 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-b from-[#FFF066] to-[#FACC15] border-2 border-[#111827] text-[11px] font-display font-extrabold text-[#111827] shadow-[0_3px_0_#111827]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            Real-Time Table Invites
          </div>
        </div>
      </div>

      {/* Live Table Invites Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-[#111827]">Table invites</h2>
            {incomingInvites.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-gradient-to-b from-[#FF5E7E] to-[#E11D48] text-white text-xs font-mono font-extrabold border border-[#111827]">
                {incomingInvites.length}
              </span>
            )}
          </div>
          {incomingInvites.length > 0 && (
            <span className="text-xs font-extrabold text-[#059669]">Live now</span>
          )}
        </div>

        {incomingInvites.length === 0 ? (
          <div className="studio-card-soft rounded-2xl px-4 py-3.5 text-xs text-[#475569] flex items-center justify-between gap-2">
            <span>No incoming table invites right now.</span>
            <span className="font-mono text-[11px] text-[#2563EB] font-extrabold">Instant push ready</span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {incomingInvites.map((invite, idx) => {
              const badgeStyle = BADGE_COLORS[idx % BADGE_COLORS.length];
              const remainingMs = getInviteRemainingMs(invite, presenceNowMs);
              return (
                <div
                  key={invite.id}
                  className="rounded-3xl bg-gradient-to-r from-[#FFF066] via-[#FDE047] to-[#FEF08A] border-2 border-[#111827] shadow-[0_5px_0_#111827] px-4 py-3.5 flex items-center justify-between gap-3 animate-pop-in animate-pulse-glow-gold"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-full border-2 border-[#111827] ${badgeStyle.bg} ${badgeStyle.text} font-display font-black text-sm flex items-center justify-center shrink-0 shadow-xs`}
                    >
                      {getInitials(invite.fromName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-sm sm:text-base font-extrabold text-[#111827] truncate">
                          {invite.fromName} invited you
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-white/90 border border-[#111827] font-mono text-[10px] font-extrabold text-[#B45309] leading-none">
                          Expires in {formatInviteCountdown(remainingMs)}
                        </span>
                      </div>
                      <div className="font-mono text-xs text-[#334155] font-bold truncate">
                        {invite.roomCode} · {invite.seatsCount}/{invite.maxPlayers} seats · {invite.mode}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => acceptRoomInvite(invite)}
                      className="px-4 py-2 rounded-2xl font-display font-extrabold text-xs game-btn-blue btn-gloss-sheen cursor-pointer"
                    >
                      Join
                    </button>
                    <button
                      type="button"
                      onClick={() => declineRoomInvite(invite.id)}
                      className="p-2 rounded-xl bg-white border-2 border-[#111827] text-[#475569] hover:text-[#E11D48] cursor-pointer"
                      aria-label="Decline table invite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Incoming Friend Requests */}
      {incomingFriendRequests.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-[#111827]">Friend requests</h2>
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#1D4ED8] text-white text-xs font-mono font-extrabold border border-[#111827]">
              {incomingFriendRequests.length}
            </span>
          </div>

          <div className="space-y-2">
            {incomingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="studio-card-sm rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PlayerAvatar
                    avatarId={req.requesterAvatarId}
                    frameId="frame_brass"
                    size="xs"
                    alt={req.requesterName}
                  />
                  <div className="min-w-0">
                    <div className="font-display text-sm font-extrabold text-[#111827] truncate">
                      {req.requesterName}
                    </div>
                    <div className="text-xs text-[#64748B]">Wants to join your Ludo squad</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => acceptFriend(req.id, req.requesterName)}
                    className="px-3.5 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-green inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFriend(req.id)}
                    className="p-1.5 rounded-xl bg-white border-2 border-[#CBD5E1] text-[#64748B] hover:border-[#111827] hover:text-[#E11D48] cursor-pointer"
                    aria-label="Decline request"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Your Squad (Accepted Friends) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-extrabold text-[#111827]">Your squad</h2>
            <span className="text-xs font-semibold text-[#64748B]">
              {onlineFriendsCount} online · {acceptedFriendsWithPresence.length}{' '}
              {acceptedFriendsWithPresence.length === 1 ? 'friend' : 'friends'}
            </span>
          </div>
          {isSignedIn && (
            <button
              type="button"
              onClick={() => {
                setDirectoryOpen(true);
                handleRefreshDirectory();
              }}
              className="px-3 py-1.5 rounded-xl font-display font-extrabold text-xs game-btn-gold inline-flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Browse Signed-In Players</span>
            </button>
          )}
        </div>

        {acceptedFriendsWithPresence.length === 0 ? (
          <div className="studio-card-soft rounded-3xl p-6 text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-[#EFF6FF] border-2 border-[#111827] mx-auto flex items-center justify-center">
              <Users className="w-5 h-5 text-[#1D4ED8]" />
            </div>
            <div className="font-display text-sm font-extrabold text-[#111827]">
              No friends in your squad yet
            </div>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Tap the search bar or pick random signed-in players above, or share your tag{' '}
              <strong className="text-[#111827] font-mono">{myTag}</strong>.
            </p>
            {isSignedIn && (
              <button
                type="button"
                onClick={() => {
                  setDirectoryOpen(true);
                  handleRefreshDirectory();
                }}
                className="mt-1 px-4 py-2 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer"
              >
                Browse Signed-In Players
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {acceptedFriendsWithPresence.map((entry, idx) => {
              const { friendship, friendUid, friendName, friendProfile, presence } = entry;
              const winRate =
                friendProfile && friendProfile.gamesPlayed > 0
                  ? Math.round((friendProfile.wins / friendProfile.gamesPlayed) * 100)
                  : null;
              const badgeStyle = BADGE_COLORS[(idx + 1) % BADGE_COLORS.length];
              const dotClass =
                presence.status === 'online'
                  ? 'bg-[#10E587] animate-pulse'
                  : presence.status === 'in_match'
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#94A3B8]';

              return (
                <div
                  key={friendship.id}
                  className="studio-card-soft hover:border-[#111827] transition-colors rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className={`w-11 h-11 rounded-full border-2 border-[#111827] ${badgeStyle.bg} ${badgeStyle.text} font-display font-black text-sm flex items-center justify-center ${
                          presence.isOnline ? '' : 'opacity-65 grayscale-[35%]'
                        }`}
                      >
                        {getInitials(friendName)}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ${dotClass} border-2 border-white`}
                        title={presence.label}
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="font-display text-sm sm:text-base font-extrabold text-[#111827] truncate">
                        {friendName}
                      </div>
                      <div className="text-xs text-[#64748B] truncate">
                        <span
                          className={
                            presence.status === 'online'
                              ? 'font-bold text-[#059669]'
                              : presence.status === 'in_match'
                                ? 'font-bold text-[#D97706]'
                                : 'font-semibold text-[#94A3B8]'
                          }
                        >
                          {presence.label}
                        </span>
                        {winRate !== null ? ` · ${winRate}% win` : ''}
                        {friendProfile ? ` · ${friendProfile.elo} pts` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={busyUid === friendUid}
                      onClick={() => handleInviteFriend(friendUid, friendName)}
                      title={
                        presence.isOnline
                          ? `Invite ${friendName} to play`
                          : `${friendName} is offline — invite auto-expires in 2 min`
                      }
                      className={`px-4 py-1.5 rounded-xl font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                        presence.isOnline
                          ? 'game-btn-white'
                          : 'bg-[#F8FAFC] hover:bg-white text-[#64748B] border-2 border-[#CBD5E1]'
                      }`}
                    >
                      <Send
                        className={`w-3 h-3 ${presence.isOnline ? 'text-[#1D4ED8]' : 'text-[#94A3B8]'}`}
                      />
                      {busyUid === friendUid ? 'Sending...' : 'Invite'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFriend(friendship.id)}
                      className="p-2 rounded-xl text-[#94A3B8] hover:text-[#E11D48] hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                      aria-label={`Remove ${friendName}`}
                      title="Remove friend"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Outgoing Pending Requests */}
      {outgoingFriendRequests.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-display text-xs font-extrabold uppercase tracking-wide text-[#64748B]">
            Pending Sent Requests
          </h3>
          <div className="space-y-2">
            {outgoingFriendRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl bg-white/80 border border-[#CBD5E1] px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <UserCheck className="w-4 h-4 text-[#64748B] shrink-0" />
                  <span className="font-bold text-[#334155] truncate">{req.recipientName}</span>
                  <span className="text-[#94A3B8]">· Awaiting accept</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFriend(req.id)}
                  className="text-[#64748B] hover:text-[#E11D48] font-bold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
