import {
  AvatarFrameSpec,
  AvatarOption,
  BackdropThemeSpec,
  BoardThemeSpec,
  DailyChallengeDef,
  DiceThemeSpec,
  LeagueTier,
  PlayerColor,
} from '../types';

export const HERO_TABLE_IMAGE = '/src/assets/images/ludo_hero_table_1795435453121.jpg';
export const HERO_LOGO_IMAGE = '/src/assets/images/ludo_crown_hero_logo_1795686902070.jpg';
export const HERO_STUDIO_BOARD_IMAGE = '/src/assets/images/hero_ludo_arcade_1795691143064.jpg';
export const FRIENDS_TABLE_STUDIO_IMAGE = '/src/assets/images/friends_party_vivid_1795691146610.jpg';
export const MODE_QUICK4P_IMAGE = '/src/assets/images/mode_quick4p_art_1795691143596.jpg';
export const MODE_DUEL1V1_IMAGE = '/src/assets/images/mode_duel1v1_art_1795691145509.jpg';
export const MODE_PASSPLAY_IMAGE = '/src/assets/images/mode_passplay_art_1795777246849.jpg';
export const MODE_VSBOT_IMAGE = '/src/assets/images/mode_vsbot_art_1795691146363.jpg';
export const ICON_ONLINE_IMAGE = '/src/assets/images/icon_play_online_3d_1795687327584.jpg';
export const ICON_BOT_IMAGE = '/src/assets/images/icon_vs_computer_3d_1795687327766.jpg';
export const ICON_FRIENDS_IMAGE = '/src/assets/images/icon_play_friends_3d_1795687327143.jpg';
export const ICON_CUPS_IMAGE = '/src/assets/images/icon_tournaments_3d_1795687330988.jpg';
export const ICON_CHEST_IMAGE = '/src/assets/images/icon_treasure_chest_3d_1795687347573.jpg';
export const ICON_WHEEL_IMAGE = '/src/assets/images/icon_lucky_wheel_3d_1795687329444.jpg';

export function formatPlayerTag(uid: string, name?: string): string {
  const letters = (name || 'LC')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, 'C');
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash * 31 + uid.charCodeAt(i)) % 9000;
  }
  const num = 1000 + Math.abs(hash);
  return `#${letters}-${num}`;
}

export const AVATAR_OPTIONS: AvatarOption[] = [
  {
    id: 'maharaja',
    name: 'Lucky Prince',
    title: 'Golden Crown Ace',
    imageUrl: '/src/assets/images/avatar_lucky_prince_3d_1795686907790.jpg',
    accentBg: '#F5A600',
    initials: 'LP',
  },
  {
    id: 'voyager',
    name: 'Star Ace',
    title: 'Lucky Star Champion',
    imageUrl: '/src/assets/images/avatar_lucky_ace_3d_1795686912243.jpg',
    accentBg: '#2588FF',
    initials: 'SA',
  },
  {
    id: 'empress',
    name: 'Ruby Queen',
    title: 'Royal Burgundy Sovereign',
    imageUrl: '/src/assets/images/avatar_lucky_queen_3d_1795686904956.jpg',
    accentBg: '#D61F48',
    initials: 'RQ',
  },
  {
    id: 'artisan',
    name: 'Lucky Lion',
    title: 'Golden Luck Mascot',
    imageUrl: '/src/assets/images/avatar_lucky_lion_3d_1795686905730.jpg',
    accentBg: '#E68A00',
    initials: 'LL',
  },
];

export const BOARD_THEMES: BoardThemeSpec[] = [
  {
    id: 'board_emerald',
    name: 'Classic Royal',
    description: 'Sunburst gold frame, pure snow-white tracks, and bright royal sapphire trim.',
    priceCoins: 0,
    currency: 'coins',
    outerBezelGradient: 'linear-gradient(145deg, #FFE46B 0%, #D9950B 48%, #FFE266 100%)',
    frameBg: '#1949B8',
    tileBg: '#FFFFFF',
    tileBorder: '#B9C8DF',
    safeBg: '#E0F2FE',
    yardInnerBg: '#FFFFFF',
    yardStroke: '#1E293B',
    centerGradientStart: '#2663E6',
    centerBg: '#12338C',
    starFill: '#FFCA28',
    starStroke: '#B46B00',
    swatchHex: '#1D63D8',
    patternStyle: 'classic',
  },
  {
    id: 'board_walnut',
    name: 'Golden Palace',
    description: 'Carved mahogany wood bezel, warm ivory parchment lanes, and gilded amber safe stars.',
    priceCoins: 600,
    currency: 'coins',
    outerBezelGradient: 'linear-gradient(145deg, #9A4A18 0%, #5C2409 48%, #C47A2C 100%)',
    frameBg: '#D97706',
    tileBg: '#FFF6DE',
    tileBorder: '#D9B675',
    safeBg: '#FDE68A',
    yardInnerBg: '#FFFDF2',
    yardStroke: '#5C2409',
    centerGradientStart: '#D97706',
    centerBg: '#78350F',
    starFill: '#F59E0B',
    starStroke: '#78350F',
    swatchHex: '#D97706',
    patternStyle: 'palace',
  },
  {
    id: 'board_midnight',
    name: 'Midnight Sapphire',
    description: 'Sleek dark-slate tournament lanes, silver-navy bezel, and glowing starlight safe zones.',
    priceCoins: 1100,
    currency: 'coins',
    outerBezelGradient: 'linear-gradient(145deg, #CBD5E1 0%, #334155 48%, #94A3B8 100%)',
    frameBg: '#0B1636',
    tileBg: '#1E293B',
    tileBorder: '#475569',
    safeBg: '#1D3B7A',
    yardInnerBg: '#E0F2FE',
    yardStroke: '#0F172A',
    centerGradientStart: '#38BDF8',
    centerBg: '#0F172A',
    starFill: '#38BDF8',
    starStroke: '#E0F2FE',
    swatchHex: '#0F172A',
    patternStyle: 'midnight',
  },
  {
    id: 'board_marble',
    name: 'Crystal Pearl',
    description: 'Rose-gold & amethyst bezel, pearlescent lilac tracks, and faceted diamond accents.',
    priceCoins: 25,
    currency: 'gems',
    outerBezelGradient: 'linear-gradient(145deg, #F9A8D4 0%, #7C3AED 50%, #FDE68A 100%)',
    frameBg: '#5B21B6',
    tileBg: '#FAF5FF',
    tileBorder: '#D8B4FE',
    safeBg: '#EDE9FE',
    yardInnerBg: '#FDF4FF',
    yardStroke: '#4C1D95',
    centerGradientStart: '#A855F7',
    centerBg: '#4C1D95',
    starFill: '#F472B6',
    starStroke: '#6B21A8',
    swatchHex: '#8B5CF6',
    patternStyle: 'crystal',
  },
];

export const BACKDROP_THEMES: BackdropThemeSpec[] = [
  {
    id: 'backdrop_sky',
    name: 'Sky Carnival',
    description: 'Sunlit sky-blue to warm cream with subtle rainbow corner glows.',
    canvasGradient: 'linear-gradient(180deg, #CFEBFF 0%, #EAF7FF 36%, #FFFDF0 74%, #E6F6FF 100%)',
    dotColor: '#93C5FD',
    rayColor: 'rgba(255, 255, 255, 0.85)',
    bloomColors: ['#7DD3FC', '#FDE047', '#FDA4AF', '#6EE7B7'],
    diePrimaryFill: '#FFFFFF',
    diePrimaryStroke: '#1D4ED8',
    diePrimaryPip: '#2563EB',
    dieSecondaryFill: '#FFE84D',
    dieSecondaryStroke: '#B45309',
    starFill: '#FFE033',
    starStroke: '#D97706',
    starAltFill: '#38BDF8',
    starAltStroke: '#1D4ED8',
    swatchColors: ['#7DD3FC', '#FDE047', '#FDA4AF'],
  },
  {
    id: 'backdrop_sunset',
    name: 'Sunset Sherbet',
    description: 'Soft golden-peach & blush vanilla canvas with warm coral and amber glows.',
    canvasGradient: 'linear-gradient(180deg, #FFE4D1 0%, #FFF4E8 42%, #FFF0F5 76%, #FFE8D6 100%)',
    dotColor: '#FDBA74',
    rayColor: 'rgba(255, 251, 235, 0.88)',
    bloomColors: ['#FDBA74', '#FDE047', '#F9A8D4', '#FCA5A5'],
    diePrimaryFill: '#FFFDF7',
    diePrimaryStroke: '#C2410C',
    diePrimaryPip: '#EA580C',
    dieSecondaryFill: '#FDE047',
    dieSecondaryStroke: '#B45309',
    starFill: '#FACC15',
    starStroke: '#C2410C',
    starAltFill: '#FB7185',
    starAltStroke: '#BE123C',
    swatchColors: ['#FDBA74', '#F9A8D4', '#FDE047'],
  },
  {
    id: 'backdrop_mint',
    name: 'Mint Aurora',
    description: 'Breezy glacial mint & soft aqua mist with emerald and sky blooms.',
    canvasGradient: 'linear-gradient(180deg, #CCFBF1 0%, #ECFDF5 40%, #F0F9FF 76%, #D1FAE5 100%)',
    dotColor: '#6EE7B7',
    rayColor: 'rgba(255, 255, 255, 0.85)',
    bloomColors: ['#5EEAD4', '#A7F3D0', '#7DD3FC', '#FDE68A'],
    diePrimaryFill: '#FFFFFF',
    diePrimaryStroke: '#047857',
    diePrimaryPip: '#059669',
    dieSecondaryFill: '#A7F3D0',
    dieSecondaryStroke: '#065F46',
    starFill: '#FDE047',
    starStroke: '#047857',
    starAltFill: '#2DD4BF',
    starAltStroke: '#0F766E',
    swatchColors: ['#5EEAD4', '#6EE7B7', '#7DD3FC'],
  },
  {
    id: 'backdrop_berry',
    name: 'Berry Blossom',
    description: 'Airy lavender-mist & rose-cream with pastel orchid and sky blooms.',
    canvasGradient: 'linear-gradient(180deg, #EDE9FE 0%, #FAF5FF 38%, #FFF1F2 74%, #E0E7FF 100%)',
    dotColor: '#C4B5FD',
    rayColor: 'rgba(255, 255, 255, 0.85)',
    bloomColors: ['#C4B5FD', '#F9A8D4', '#93C5FD', '#FDE68A'],
    diePrimaryFill: '#FFFFFF',
    diePrimaryStroke: '#6D28D9',
    diePrimaryPip: '#7C3AED',
    dieSecondaryFill: '#FBCFE8',
    dieSecondaryStroke: '#BE185D',
    starFill: '#FDE047',
    starStroke: '#7C3AED',
    starAltFill: '#F472B6',
    starAltStroke: '#9D174D',
    swatchColors: ['#C4B5FD', '#F9A8D4', '#93C5FD'],
  },
  {
    id: 'backdrop_twilight',
    name: 'Sapphire Mist',
    description: 'Cool twilight periwinkle & ice-blue canvas with luminous indigo, cyan, and gold glows.',
    canvasGradient: 'linear-gradient(180deg, #C7D2FE 0%, #DBEAFE 44%, #EEF2FF 78%, #CFFAFE 100%)',
    dotColor: '#818CF8',
    rayColor: 'rgba(255, 255, 255, 0.82)',
    bloomColors: ['#818CF8', '#38BDF8', '#F472B6', '#FACC15'],
    diePrimaryFill: '#FFFFFF',
    diePrimaryStroke: '#3730A3',
    diePrimaryPip: '#4338CA',
    dieSecondaryFill: '#FDE047',
    dieSecondaryStroke: '#B45309',
    starFill: '#FFE033',
    starStroke: '#4338CA',
    starAltFill: '#38BDF8',
    starAltStroke: '#1D4ED8',
    swatchColors: ['#818CF8', '#38BDF8', '#FACC15'],
  },
];

export const DICE_THEMES: DiceThemeSpec[] = [
  {
    id: 'dice_ivory',
    name: 'Classic Snow',
    description: 'Bright glossy white die with crisp royal-navy pips.',
    priceCoins: 0,
    currency: 'coins',
    faceBg: '#FFFFFF',
    pipColor: '#132757',
    borderColor: '#93C5FD',
  },
  {
    id: 'dice_obsidian',
    name: 'Cobalt Star',
    description: 'Vibrant royal-blue die inlaid with bright snow-white pips.',
    priceCoins: 450,
    currency: 'coins',
    faceBg: '#1D4ED8',
    pipColor: '#FFFFFF',
    borderColor: '#60A5FA',
  },
  {
    id: 'dice_ruby',
    name: 'Ruby Arcade',
    description: 'Glossy crimson die with crisp white pips.',
    priceCoins: 800,
    currency: 'coins',
    faceBg: '#E11D48',
    pipColor: '#FFFFFF',
    borderColor: '#FDA4AF',
  },
  {
    id: 'dice_jade',
    name: 'Golden Crown',
    description: 'Sunlit golden die reserved for league champions.',
    priceCoins: 18,
    currency: 'gems',
    faceBg: '#FFCA28',
    pipColor: '#2B1600',
    borderColor: '#FEF08A',
  },
];

export const AVATAR_FRAMES: AvatarFrameSpec[] = [
  {
    id: 'frame_brass',
    name: 'Sunny Gold',
    description: 'Bright golden rim for every club player.',
    priceCoins: 0,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#111827]',
    swatchHex: '#FACC15',
  },
  {
    id: 'frame_emerald',
    name: 'Emerald Glow',
    description: 'Vivid green tournament rim with crisp highlight.',
    priceCoins: 400,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#10B981] ring-offset-2 ring-offset-white',
    swatchHex: '#10B981',
  },
  {
    id: 'frame_crimson',
    name: 'Ruby Crest',
    description: 'Tournament finalist bright crimson border.',
    priceCoins: 750,
    currency: 'coins',
    ringClass: 'ring-2 ring-[#E11D48] ring-offset-2 ring-offset-white',
    swatchHex: '#E11D48',
  },
  {
    id: 'frame_imperial',
    name: 'Imperial Crown Gold',
    description: 'Signature Grandmaster gold laurel ring.',
    priceCoins: 20,
    currency: 'gems',
    ringClass: 'ring-[3px] ring-[#FACC15] ring-offset-2 ring-offset-white',
    swatchHex: '#FACC15',
  },
];

export const DAILY_STREAK_REWARDS: {
  day: number;
  coins: number;
  gems: number;
  label: string;
  cosmeticId?: string;
  fallbackCosmeticId?: string;
  cosmeticLabel?: string;
}[] = [
  { day: 1, coins: 150, gems: 0, label: '150 Coins' },
  { day: 2, coins: 225, gems: 0, label: '225 Coins' },
  { day: 3, coins: 300, gems: 2, label: '300 Coins + 2 Gems' },
  { day: 4, coins: 400, gems: 0, label: '400 Coins' },
  { day: 5, coins: 500, gems: 3, label: '500 Coins + 3 Gems' },
  { day: 6, coins: 650, gems: 4, label: '650 Coins + 4 Gems' },
  {
    day: 7,
    coins: 1000,
    gems: 10,
    cosmeticId: 'dice_jade',
    fallbackCosmeticId: 'board_marble',
    cosmeticLabel: 'Golden Crown Dice',
    label: '1,000 Coins + 10 Gems + Golden Crown Dice',
  },
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
    label: 'Red',
    fill: '#EC1C24',
    dark: '#B50D15',
    light: '#FFE4E6',
    textOnLight: '#B91C1C',
    ring: '#FF6B74',
  },
  green: {
    label: 'Green',
    fill: '#00A844',
    dark: '#00732C',
    light: '#DCFCE7',
    textOnLight: '#15803D',
    ring: '#4ADE80',
  },
  yellow: {
    label: 'Yellow',
    fill: '#FFD014',
    dark: '#C99200',
    light: '#FEF9C3',
    textOnLight: '#A16207',
    ring: '#FFE866',
  },
  blue: {
    label: 'Blue',
    fill: '#0095EB',
    dark: '#0062A8',
    light: '#E0F2FE',
    textOnLight: '#0369A1',
    ring: '#60C5FF',
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

export function getBackdropThemeById(id: string): BackdropThemeSpec {
  return BACKDROP_THEMES.find((b) => b.id === id) || BACKDROP_THEMES[0];
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

export interface WeekendCupSchedule {
  isLive: boolean;
  weekNumber: number;
  cupTitle: string;
  countdownLabel: string;
  prizeCoins: number;
  prizeGems: number;
  entryFee: number;
}

/**
 * Timed Weekend Crown Mini-Cup schedule (Friday 18:00 -> Sunday 23:59 local time).
 */
export function getWeekendCupSchedule(now: Date = new Date()): WeekendCupSchedule {
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = now.getHours();
  const isLive = day === 6 || day === 0 || (day === 5 && hour >= 18);

  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  const weekNumber = Math.max(1, Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7));

  let targetMs: number;
  if (isLive) {
    // End of Sunday 23:59:59
    const daysUntilSunday = day === 0 ? 0 : 7 - day;
    const end = new Date(now);
    end.setDate(now.getDate() + daysUntilSunday);
    end.setHours(23, 59, 59, 999);
    targetMs = end.getTime();
  } else {
    // Next Friday 18:00:00
    const daysUntilFriday = (5 - day + 7) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() + daysUntilFriday);
    start.setHours(18, 0, 0, 0);
    targetMs = start.getTime();
  }

  const diffMs = Math.max(0, targetMs - now.getTime());
  const totalMins = Math.floor(diffMs / 60_000);
  const d = Math.floor(totalMins / (60 * 24));
  const h = Math.floor((totalMins % (60 * 24)) / 60);
  const m = totalMins % 60;

  const countdownLabel = isLive
    ? d > 0
      ? `Ends in ${d}d ${h}h ${m}m`
      : `Ends in ${h}h ${m}m`
    : d > 0
      ? `Starts in ${d}d ${h}h`
      : `Starts in ${h}h ${m}m`;

  return {
    isLive,
    weekNumber,
    cupTitle: `Weekend Crown Mini-Cup #${weekNumber}`,
    countdownLabel,
    prizeCoins: 1500,
    prizeGems: 8,
    entryFee: 150,
  };
}

