import React, { useState } from 'react';
import { Check, Coins, Gem, Lock, Play, Save } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  AVATAR_FRAMES,
  AVATAR_OPTIONS,
  BACKDROP_THEMES,
  BOARD_THEMES,
  DICE_THEMES,
} from '../data/catalog';
import { PlayerAvatar } from './PlayerAvatar';

export function AtelierView() {
  const {
    profile,
    wallet,
    backdropThemeId,
    setBackdropThemeId,
    saveCustomization,
    purchaseCosmetic,
    triggerRewardedAd,
    showToast,
  } = useApp();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatarId, setAvatarId] = useState(profile.avatarId);
  const [avatarFrame, setAvatarFrame] = useState(profile.avatarFrame);
  const [boardTheme, setBoardTheme] = useState(profile.boardTheme);
  const [diceTheme, setDiceTheme] = useState(profile.diceTheme);
  const [saving, setSaving] = useState(false);

  const isOwned = (id: string, price: number) =>
    price === 0 || wallet.unlockedCosmetics.includes(id);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCustomization({
        displayName,
        avatarId,
        avatarFrame,
        boardTheme,
        diceTheme,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEquipOrBuy = async (
    category: 'frame' | 'board' | 'dice',
    id: string,
    price: number,
    currency: 'coins' | 'gems'
  ) => {
    if (!isOwned(id, price)) {
      const ok = await purchaseCosmetic(id, price, currency);
      if (!ok) return;
    }
    const nextFrame = category === 'frame' ? id : avatarFrame;
    const nextBoard = category === 'board' ? id : boardTheme;
    const nextDice = category === 'dice' ? id : diceTheme;

    if (category === 'frame') setAvatarFrame(id);
    if (category === 'board') setBoardTheme(id);
    if (category === 'dice') setDiceTheme(id);

    await saveCustomization({
      displayName,
      avatarId,
      avatarFrame: nextFrame,
      boardTheme: nextBoard,
      diceTheme: nextDice,
    });
  };

  return (
    <div className="max-w-[1040px] mx-auto px-4 sm:px-6 py-5 pb-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111827] tracking-tight">
            Profile &amp; Board Shop
          </h1>
          <p className="text-xs text-[#475569] mt-0.5">
            Spend Coins &amp; Gems to unlock board editions, dice finishes, and profile frames.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('daily_bonus_coins', () => {
                showToast('+250 Bonus Coins credited!', 'success');
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-extrabold text-xs game-btn-gold cursor-pointer whitespace-nowrap"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>+250 Coins (Ad)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerRewardedAd('bonus_gems', () => {
                showToast('+5 Bonus Gems credited!', 'success');
              })
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-extrabold text-xs game-btn-red cursor-pointer whitespace-nowrap"
          >
            <Gem className="w-3.5 h-3.5" />
            <Play className="w-3 h-3" />
            <span>+5 Gems (Ad)</span>
          </button>
        </div>
      </div>

      {/* Character & Name Selector */}
      <form
        onSubmit={handleSave}
        className="studio-card rounded-3xl p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
      >
        <div className="lg:col-span-4 flex items-center gap-3.5">
          <div className="animate-character-idle">
            <PlayerAvatar avatarId={avatarId} frameId={avatarFrame} size="lg" alt={displayName} />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-extrabold text-[#475569] mb-1" htmlFor="player-name-input">
              PLAYER NAME
            </label>
            <input
              id="player-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={32}
              className="w-full bg-[#F8FAFC] border-2 border-[#111827] rounded-xl px-3 py-2 text-sm font-bold text-[#111827] focus:outline-none"
            />
          </div>
        </div>

        <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {AVATAR_OPTIONS.map((opt) => {
            const selected = avatarId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAvatarId(opt.id)}
                className={`p-2.5 rounded-2xl border-2 text-center cursor-pointer flex flex-col items-center gap-1.5 transition-all ${
                  selected
                    ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                    : 'bg-[#F8FAFC] border-[#CBD5E1] hover:border-[#111827]'
                }`}
              >
                <PlayerAvatar avatarId={opt.id} frameId={avatarFrame} size="sm" alt={opt.name} />
                <div className="font-display text-xs font-extrabold text-[#111827]">{opt.name}</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-display font-extrabold text-xs game-btn-blue whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Look'}
          </button>
        </div>
      </form>

      {/* Board Skins */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#111827]">Board Editions</h2>
          <p className="text-xs text-[#64748B]">
            Transforms your Ludo board&apos;s outer frame, track tile finish, safe stars, and center crown.
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {BOARD_THEMES.map((item) => {
            const owned = isOwned(item.id, item.priceCoins);
            const equipped = boardTheme === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${
                  equipped
                    ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                    : 'bg-white border-[#CBD5E1]'
                }`}
              >
                <div>
                  {/* Mini Ludo Board Visual Preview */}
                  <div
                    className="h-20 rounded-2xl p-1.5 border-2 border-[#111827] mb-3 shadow-xs"
                    style={{ background: item.outerBezelGradient }}
                  >
                    <div
                      className="w-full h-full rounded-xl p-[2px] flex items-center justify-center"
                      style={{ backgroundColor: item.frameBg }}
                    >
                      <div
                        className="w-full h-full rounded-[8px] grid grid-cols-3 grid-rows-3 overflow-hidden border"
                        style={{ backgroundColor: item.tileBg, borderColor: item.tileBorder }}
                      >
                        <div className="bg-[#EC1C24] p-1">
                          <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: item.yardInnerBg }} />
                        </div>
                        <div className="flex items-center justify-center" style={{ backgroundColor: item.safeBg }}>
                          <span className="text-[10px]" style={{ color: item.starFill }}>★</span>
                        </div>
                        <div className="bg-[#00A844] p-1">
                          <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: item.yardInnerBg }} />
                        </div>
                        <div className="border-y" style={{ borderColor: item.tileBorder }} />
                        <div
                          className="flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${item.centerGradientStart}, ${item.centerBg})` }}
                        >
                          <span className="w-2.5 h-2.5 rounded-full bg-[#FFE047]" />
                        </div>
                        <div className="border-y" style={{ borderColor: item.tileBorder }} />
                        <div className="bg-[#0095EB] p-1">
                          <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: item.yardInnerBg }} />
                        </div>
                        <div className="flex items-center justify-center" style={{ backgroundColor: item.tileBg }} />
                        <div className="bg-[#FFD014] p-1">
                          <div className="w-full h-full rounded-[3px]" style={{ backgroundColor: item.yardInnerBg }} />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="font-display text-sm font-extrabold text-[#111827]">{item.name}</div>
                  <p className="mt-0.5 text-[11px] text-[#64748B] leading-snug">{item.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleEquipOrBuy('board', item.id, item.priceCoins, item.currency)}
                  className={`mt-4 w-full py-2 px-3 rounded-xl font-display font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    equipped
                      ? 'bg-[#DCFCE7] text-[#047857] border-2 border-[#10B981]'
                      : owned
                        ? 'game-btn-blue'
                        : 'game-btn-gold'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Equipped
                    </>
                  ) : owned ? (
                    'Equip'
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      {item.priceCoins} {item.currency === 'gems' ? 'Gems' : 'Coins'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Free Ambient Arena Backdrops */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-extrabold text-[#111827]">
            Arena Backdrops (Free)
          </h2>
          <p className="text-xs text-[#64748B]">
            Switch the subtle colorful atmosphere behind the board — animated dice &amp; stars stay active on every theme.
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {BACKDROP_THEMES.map((bg) => {
            const active = backdropThemeId === bg.id;
            return (
              <button
                key={bg.id}
                type="button"
                onClick={() => {
                  setBackdropThemeId(bg.id);
                  showToast(`Backdrop set to ${bg.name}!`, 'success');
                }}
                className={`rounded-2xl p-3 border-2 text-left flex flex-col justify-between cursor-pointer transition-all ${
                  active
                    ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                    : 'bg-white border-[#CBD5E1] hover:border-[#111827]'
                }`}
              >
                <div>
                  <div
                    className="relative h-14 rounded-xl border-2 border-[#111827] overflow-hidden mb-2.5"
                    style={{ background: bg.canvasGradient }}
                  >
                    <span
                      className="absolute -top-3 -left-3 w-10 h-10 rounded-full blur-md opacity-70"
                      style={{ backgroundColor: bg.bloomColors[0] }}
                    />
                    <span
                      className="absolute -top-3 -right-3 w-10 h-10 rounded-full blur-md opacity-70"
                      style={{ backgroundColor: bg.bloomColors[1] }}
                    />
                    <span
                      className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full blur-md opacity-60"
                      style={{ backgroundColor: bg.bloomColors[2] }}
                    />
                    <span
                      className="absolute -bottom-3 -right-3 w-10 h-10 rounded-full blur-md opacity-60"
                      style={{ backgroundColor: bg.bloomColors[3] }}
                    />
                    <span
                      className="absolute top-1.5 right-2 text-xs font-black"
                      style={{ color: bg.starFill }}
                    >
                      ✦
                    </span>
                    <span
                      className="absolute bottom-1.5 left-2 w-4 h-4 rounded border flex items-center justify-center text-[8px] font-black"
                      style={{
                        backgroundColor: bg.diePrimaryFill,
                        borderColor: bg.diePrimaryStroke,
                        color: bg.diePrimaryPip,
                      }}
                    >
                      ⚄
                    </span>
                  </div>
                  <div className="font-display text-xs font-extrabold text-[#111827]">
                    {bg.name}
                  </div>
                </div>
                <div
                  className={`mt-2 text-[11px] font-display font-extrabold ${
                    active ? 'text-[#047857]' : 'text-[#1D4ED8]'
                  }`}
                >
                  {active ? '✓ Active' : 'Use Backdrop'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dice Finishes & Avatar Frames */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-[#111827]">Dice Finishes</h2>
          <div className="grid grid-cols-2 gap-3">
            {DICE_THEMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = diceTheme === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border-2 flex flex-col justify-between ${
                    equipped
                      ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                      : 'bg-white border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl border-2 border-[#111827] shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: item.faceBg }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.pipColor }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs font-extrabold text-[#111827] truncate">
                        {item.name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('dice', item.id, item.priceCoins, item.currency)}
                    className={`mt-3 w-full py-2 rounded-xl font-display font-extrabold text-xs cursor-pointer ${
                      equipped
                        ? 'bg-[#DCFCE7] text-[#047857] border-2 border-[#10B981]'
                        : owned
                          ? 'game-btn-blue'
                          : 'game-btn-gold'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip'
                        : `${item.priceCoins} ${item.currency === 'gems' ? 'Gems' : 'Coins'}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-extrabold text-[#111827]">Avatar Frames</h2>
          <div className="grid grid-cols-2 gap-3">
            {AVATAR_FRAMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = avatarFrame === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border-2 flex flex-col justify-between ${
                    equipped
                      ? 'bg-[#FEF9C3] border-[#111827] shadow-[0_3px_0_#111827]'
                      : 'bg-white border-[#CBD5E1]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar avatarId={avatarId} frameId={item.id} size="xs" alt={item.name} />
                    <div className="font-display text-xs font-extrabold text-[#111827] truncate">
                      {item.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('frame', item.id, item.priceCoins, item.currency)}
                    className={`mt-3 w-full py-2 rounded-xl font-display font-extrabold text-xs cursor-pointer ${
                      equipped
                        ? 'bg-[#DCFCE7] text-[#047857] border-2 border-[#10B981]'
                        : owned
                          ? 'game-btn-blue'
                          : 'game-btn-gold'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip'
                        : `${item.priceCoins} ${item.currency === 'gems' ? 'Gems' : 'Coins'}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
