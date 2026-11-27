import { useMemo, useState } from 'react';
import { Check, Clock, UserPlus } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export interface FriendActionTarget {
  uid: string;
  displayName: string;
  avatarId: string;
}

interface FriendActionButtonProps {
  target: FriendActionTarget;
  compact?: boolean;
  className?: string;
}

export function FriendActionButton({
  target,
  compact = false,
  className = '',
}: FriendActionButtonProps) {
  const {
    isSignedIn,
    profile,
    friendships,
    sendFriendRequest,
    acceptFriend,
    signInWithGoogle,
  } = useApp();
  const [busy, setBusy] = useState(false);

  const isInvalidTarget =
    !target.uid ||
    target.uid === profile.uid ||
    target.uid.startsWith('bot_') ||
    target.uid.startsWith('local_') ||
    target.uid === 'guest_local';

  const relation = useMemo(() => {
    if (isInvalidTarget) return null;
    return (
      friendships.find(
        (f) => f.pairUids.includes(target.uid) && f.pairUids.includes(profile.uid)
      ) || null
    );
  }, [friendships, target.uid, profile.uid, isInvalidTarget]);

  if (isInvalidTarget) return null;

  const sizeClass = compact ? 'px-2 py-1 text-[10px] rounded-lg' : 'px-3 py-1.5 text-xs rounded-xl';
  const iconClass = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  if (relation?.status === 'accepted') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-display font-extrabold bg-[#DCFCE7] text-[#047857] border border-[#86EFAC] shrink-0 select-none ${sizeClass} ${className}`}
        title={`${target.displayName} is in your squad`}
      >
        <Check className={iconClass} />
        <span>Friend</span>
      </span>
    );
  }

  if (relation?.status === 'pending' && relation.recipientUid === profile.uid) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async (e) => {
          e.stopPropagation();
          setBusy(true);
          try {
            await acceptFriend(relation.id, target.displayName);
          } finally {
            setBusy(false);
          }
        }}
        className={`inline-flex items-center gap-1 font-display font-extrabold game-btn-green cursor-pointer disabled:opacity-60 shrink-0 ${sizeClass} ${className}`}
        title={`Accept ${target.displayName}'s friend request`}
      >
        <Check className={iconClass} />
        <span>{busy ? '...' : 'Accept'}</span>
      </button>
    );
  }

  if (relation?.status === 'pending' && relation.requesterUid === profile.uid) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-display font-extrabold bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1] shrink-0 select-none ${sizeClass} ${className}`}
        title={`Friend request pending for ${target.displayName}`}
      >
        <Clock className={iconClass} />
        <span>Sent</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        if (!isSignedIn) {
          await signInWithGoogle();
          return;
        }
        setBusy(true);
        try {
          await sendFriendRequest({
            uid: target.uid,
            displayName: target.displayName,
            avatarId: target.avatarId || 'maharaja',
          });
        } finally {
          setBusy(false);
        }
      }}
      className={`inline-flex items-center gap-1 font-display font-extrabold game-btn-blue cursor-pointer disabled:opacity-60 shrink-0 ${sizeClass} ${className}`}
      title={`Add ${target.displayName} as friend`}
    >
      <UserPlus className={iconClass} />
      <span>{busy ? '...' : 'Add'}</span>
    </button>
  );
}
