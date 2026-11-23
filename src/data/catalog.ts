import {
  AvatarFrameSpec,
  AvatarOption,
  BoardThemeSpec,
  DailyChallengeDef,
  DiceThemeSpec,
  LeagueTier,
  PlayerColor,
} from '../types';

export const HERO_TABLE_IMAGE = '/src/assets/images/ludo_hero_table_1795435453121.jpg';

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'maharaja',
    name: 'Aarav',
    title: 'Royal Strategist',
    imageUrl: '/src/assets/images/avatar_maharaja_1795435453757.jpg',
    accentBg: '#12382B',
    initials: 'AR',
  },
  {
    id: 'voyager',
    name: 'Elena',
    title: 'Sapphire Tactician',
    imageUrl: '/src/assets/images/avatar_voyager_1795435493254.jpg',
    accentBg: '#172C4B',
    initials: 'EL',
  },
  {
    id: 'empress',
    name: 'Meera',
    title: 'Crimson Sovereign',
    imageUrl: '/src/assets/images/avatar_empress_1795435454642.jpg',
    accentBg: '#4A181F',
    initials: 'MR',
  },
  {
    id: 'artisan',
    name: 'Vikram',
    title: 'Dice Artisan',
    imageUrl: '/src/assets/images/avatar_artisan_1795435454675.jpg',
    accentBg: '#3D2E14',
    initials: 'VK',
  },
];

export const BOARD_THEMES: BoardThemeSpec[] = [
  {
    id: 'board_emerald',
    name: 'Royal Emerald Felt',
    description: 'Classic tournament baize with warm ivory tracks and brass trim.',
    priceCoins: 0,
    currency: 'coins',
    frameBg: '#14382A',
    tileBg: '#F7F3E9',
    tileBorder: '#D5CBB8',
    safeBg: '#EAE0C8',
    centerBg: '#1C2E26',
    swatchHex: '#1A533D',
  },
  {
    id: 'board_walnut',
    name: 'Walnut Heritage',
    description: 'Hand-rubbed parlor walnut frame paired with parchment inlays.',
    priceCoins: 600,
    currency: 'coins',
    frameBg: '#3A2518',
    tileBg: '#F4ECDC',
    tileBorder: '#CBB89D',
    safeBg: '#E6D4B5',
    centerBg: '#2C1B12',
    swatchHex: '#5A3A24',
  },
  {
    id: 'board_midnight',
    name: 'Midnight Velvet',
    description: 'Deep navy salon slate with crisp alabaster squares and silver markers.',
    priceCoins: 1100,
    currency: 'coins',
    frameBg: '#101D33',
    tileBg: '#EEF2F7',
    tileBorder: '#CBD5E1',
    safeBg: '#DBE4F0',
    centerBg: '#0E1729',
    swatchHex: '#1E3A5F',
  },
  {
    id: 'board_marble',
    name: 'Ivory Marble Salon',
    description: 'Gallery stone finish with champagne accents for Grandmaster tables.',
    priceCoins: 25,
    currency: 'gems',
    frameBg: '#2A2622',
    tileBg: '#FAF8F5',
    tileBorder: '#DED7CC',
    safeBg: '#EFE7D8',
    centerBg: '#24201C',
    swatchHex: '#D8CFC0',
  },
];

export const DICE_THEMES: DiceThemeSpec[] = [
  {
    id: 'dice_ivory',
    name: 'Carved Ivory',
    description: 'Traditional satin ivory die with deep charcoal pips.',
    priceCoins: 0,
    currency: 'coins',
    faceBg: '#FAF6EE',
    pipColor: '#1C1917',
    borderColor: '#D6CCB8',
  },
  {
    id: 'dice_obsidian',
    name: 'Obsidian Gold',
    description: 'Matte onyx body inlaid with brushed brass pips.',
    priceCoins: 450,
    currency: 'coins',
    faceBg: '#18181B',
    pipColor: '#E5B95C',
    borderColor: '#524733',
  },
  {
    id: 'dice_ruby',
    name: 'Ruby Lacquer',
    description: 'Deep carmine enamel finish with crisp pearl pips.',
    priceCoins: 800,
    currency: 'coins',
    faceBg: '#881337',
    pipColor: '#FFF7ED',
    borderColor: '#BE123C',
  },
  {
    id: 'dice_jade',
    name: 'Imperial Jade',
    description: 'Polished greenstone die reserved for league champions.',
    priceCoins: 18,
    currency: 'gems',
    faceBg: '#0F4C3A',
    pipColor: '#F3D27A',
    borderColor: '#2E7D63',
  },
];

export const AVATAR_FRAMES: AvatarFrameSpec[] = [
  {
    id: 'frame_brass',
    name: 'Classic Brass',
    description: 'Clean hairline brass rim for every club player.',
    priceCoins: 0,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#C9A24D]/70',
    swatchHex: '#C9A24D',
  },
  {
    id: 'frame_emerald',
    name: 'Emerald Enamel',
    description: 'Double-banded jade finish with crisp highlight.',
    priceCoins: 400,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#22C55E] ring-offset-2 ring-offset-[#0E2B21]',
    swatchHex: '#22C55E',
  },
  {
    id: 'frame_crimson',
    name: 'Crimson Crest',
    description: 'Tournament finalist garnet border.',
    priceCoins: 750,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#E11D48] ring-offset-2 ring-offset-[#0E2B21]',
    swatchHex: '#E11D48',
  },
  {
    id: 'frame_imperial',
    name: 'Imperial Crown Gold',
    description: 'Signature Grandmaster gold laurel ring.',
    priceCoins: 20,
    currency: 'gems',
    ringClass: 'ring-[3px] ring-[#F5C95B] ring-offset-2 ring-offset-[#0E2B21]',
    swatchHex: '#F5C95B',
  },
];

export const DAILY_STREAK_REWARDS = [
  { day: 1, coins: 150, gems: 0, label: '150 Coins' },
  { day: 2, coins: 225, gems: 0, label: '225 Coins' },
  { day: 3, coins: 300, gems: 2, label: '300 Coins + 2 Gems' },
  { day: 4, coins: 400, gems: 0, label: '400 Coins' },
  { day: 5, coins: 500, gems: 3, label: '500 Coins + 3 Gems' },
  { day: 6, coins: 650, gems: 4, label: '650 Coins + 4 Gems' },
  { day: 7, coins: 1000, gems: 10, label: '1,000 Coins + 10 Gems' },
];

export const DAILY_CHALLENGES: DailyChallengeDef[] = [
  {
    id: 'ch_roll_sixes',
    title: 'Lucky Sixes',
    description: 'Roll a 6 three times across any practice or online match.',
    metric: 'rollSixes',
    target: 3,
    rewardCoins: 180,
    rewardGems: 1,
  },
  {
    id: 'ch_captures',
    title: 'Tactical Ambush',
    description: 'Capture 2 opponent tokens and send them back to yard.',
    metric: 'captures',
    target: 2,
    rewardCoins: 260,
    rewardGems: 2,
  },
  {
    id: 'ch_play_match',
    title: 'Table Regular',
    description: 'Complete 1 full match in Practice, Online, or Tournament play.',
    metric: 'matchesPlayed',
    target: 1,
    rewardCoins: 200,
    rewardGems: 1,
  },
  {
    id: 'ch_win_match',
    title: 'Crown Victor',
    description: 'Win 1 match to prove your mastery on the board.',
    metric: 'matchesWon',
    target: 1,
    rewardCoins: 350,
    rewardGems: 3,
  },
];

export const QUICK_CHAT_EMOTES = [
  'Good luck everyone!',
  'Nice capture!',
  'Need a 6 right now',
  'Close call!',
  'Well played!',
  'Rematch after this?',
];

export const PLAYER_COLOR_META: Record<
  PlayerColor,
  {
    label: string;
    fill: string;
    dark: string;
    light: string;
    textOnLight: string;
    ring: string;
  }
> = {
  red: {
    label: 'Crimson',
    fill: '#C93838',
    dark: '#8C1D1D',
    light: '#FDE8E8',
    textOnLight: '#991B1B',
    ring: '#F87171',
  },
  green: {
    label: 'Emerald',
    fill: '#1E824C',
    dark: '#115330',
    light: '#E3F7EC',
    textOnLight: '#166534',
    ring: '#4ADE80',
  },
  yellow: {
    label: 'Amber',
    fill: '#D49A1A',
    dark: '#8F6408',
    light: '#FEF6DC',
    textOnLight: '#92400E',
    ring: '#FACC15',
  },
  blue: {
    label: 'Sapphire',
    fill: '#2364AA',
    dark: '#143F6E',
    light: '#E4F0FC',
    textOnLight: '#1E40AF',
    ring: '#60A5FA',
  },
};

export const LEAGUE_META: Record<
  LeagueTier,
  { name: string; minElo: number; accent: string; entryFee: number; prizePool: number }
> = {
  bronze: {
    name: 'Bronze Club',
    minElo: 0,
    accent: '#CD7F32',
    entryFee: 100,
    prizePool: 400,
  },
  silver: {
    name: 'Silver Parlor',
    minElo: 1150,
    accent: '#CBD5E1',
    entryFee: 250,
    prizePool: 1000,
  },
  gold: {
    name: 'Gold Salon',
    minElo: 1400,
    accent: '#E5B95C',
    entryFee: 500,
    prizePool: 2200,
  },
  grandmaster: {
    name: 'Grandmaster Crown',
    minElo: 1700,
    accent: '#F59E0B',
    entryFee: 1000,
    prizePool: 5000,
  },
};

export const BOT_ROSTER = [
  { uid: 'bot_elena', name: 'Elena (Bot)', avatarId: 'voyager', avatarFrame: 'frame_brass', elo: 1180 },
  { uid: 'bot_meera', name: 'Meera (Bot)', avatarId: 'empress', avatarFrame: 'frame_crimson', elo: 1340 },
  { uid: 'bot_vikram', name: 'Vikram (Bot)', avatarId: 'artisan', avatarFrame: 'frame_emerald', elo: 1260 },
];

export function computeLeagueFromElo(elo: number): LeagueTier {
  if (elo >= 1700) return 'grandmaster';
  if (elo >= 1400) return 'gold';
  if (elo >= 1150) return 'silver';
  return 'bronze';
}

export function getAvatarById(id: string): AvatarOption {
  return AVATAR_OPTIONS.find((a) => a.id === id) || AVATAR_OPTIONS[0];
}

export function getBoardThemeById(id: string): BoardThemeSpec {
  return BOARD_THEMES.find((b) => b.id === id) || BOARD_THEMES[0];
}

export function getDiceThemeById(id: string): DiceThemeSpec {
  return DICE_THEMES.find((d) => d.id === id) || DICE_THEMES[0];
}

export function getAvatarFrameById(id: string): AvatarFrameSpec {
  return AVATAR_FRAMES.find((f) => f.id === id) || AVATAR_FRAMES[0];
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
