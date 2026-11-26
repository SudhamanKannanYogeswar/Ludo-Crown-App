import { useState } from 'react';
import { getAvatarById, getAvatarFrameById } from '../data/catalog';

interface PlayerAvatarProps {
  avatarId: string;
  frameId?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  alt?: string;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export function PlayerAvatar({
  avatarId,
  frameId = 'frame_brass',
  size = 'md',
  alt,
  className = '',
}: PlayerAvatarProps) {
  const avatar = getAvatarById(avatarId);
  const frame = getAvatarFrameById(frameId);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center shadow-lg ${SIZE_CLASSES[size]} ${frame.ringClass} ${className}`}
      style={{ backgroundColor: avatar.accentBg }}
    >
      {!imgFailed && avatar.imageUrl ? (
        <img
          src={avatar.imageUrl}
          alt={alt || avatar.name}
          onError={() => setImgFailed(true)}
          draggable={false}
          className="w-full h-full object-cover scale-[1.06] select-none"
        />
      ) : (
        <span className="font-display font-black text-white text-xs tracking-wide">
          {avatar.initials}
        </span>
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/40"
      />
    </div>
  );
}
