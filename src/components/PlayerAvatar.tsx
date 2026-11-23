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
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
};

export function PlayerAvatar({
  avatarId,
  frameId = 'frame_brass',
  size = 'md',
  alt,
  className = '',
}: PlayerAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const avatar = getAvatarById(avatarId);
  const frame = getAvatarFrameById(frameId);

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center font-display font-semibold text-[#F5F2EB] ${SIZE_CLASSES[size]} ${frame.ringClass} ${className}`}
      style={{ backgroundColor: avatar.accentBg }}
    >
      {avatar.imageUrl && !imgFailed ? (
        <img
          src={avatar.imageUrl}
          alt={alt || avatar.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span aria-label={alt || avatar.name}>{avatar.initials}</span>
      )}
    </div>
  );
}
