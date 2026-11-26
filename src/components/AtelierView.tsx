import React, { useState } from 'react';
import { Check, Coins, Gem, Lock, Play, Save } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  AVATAR_FRAMES,
  AVATAR_OPTIONS,
  BOARD_THEMES,
  DICE_THEMES,
} from '../data/catalog';
import { PlayerAvatar } from './PlayerAvatar';

export function AtelierView() {
  const { profile, wallet, saveCustomization, purchaseCosmetic, triggerRewardedAd, showToast } =
    useApp();

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
    <div className="max-w-[1260px] mx-auto px-3 sm:px-6 py-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            CHARACTER &amp; COSMETIC SHOP
          </h1>
          <p className="text-xs text-[#A6BBB0] mt-0.5">
            Customize your character portrait, board skins, dice finishes, and royal frames.
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-xs game-btn-gold cursor-pointer whitespace-nowrap"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-display font-bold text-xs game-btn-purple cursor-pointer whitespace-nowrap"
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
        className="rounded-3xl bg-[#14251E]/95 border-2 border-[#2E4C40] p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
      >
        <div className="lg:col-span-4 flex items-center gap-3.5">
          <div className="animate-character-idle">
            <PlayerAvatar avatarId={avatarId} frameId={avatarFrame} size="lg" alt={displayName} />
          </div>
          <div className="min-w-0 flex-1">
            <label className="block text-xs font-bold text-[#A6BBB0] mb-1" htmlFor="player-name-input">
              PLAYER NAME
            </label>
            <input
              id="player-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={32}
              className="w-full bg-[#0C1814] border-2 border-[#2F4E42] rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#EAB957]"
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
                    ? 'bg-[#1D3580] border-[#EAB957]'
                    : 'bg-[#0C1814] border-[#274136] hover:border-[#456C5C]'
                }`}
              >
                <PlayerAvatar avatarId={opt.id} frameId={avatarFrame} size="sm" alt={opt.name} />
                <div className="font-display text-xs font-bold text-white">{opt.name}</div>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-display font-bold text-xs game-btn-gold whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'SAVING...' : 'SAVE LOOK'}
          </button>
        </div>
      </form>

      {/* Board Skins */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold text-white">Board Skins</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {BOARD_THEMES.map((item) => {
            const owned = isOwned(item.id, item.priceCoins);
            const equipped = boardTheme === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 border-2 flex flex-col justify-between ${
                  equipped
                    ? 'bg-[#1A2F75] border-[#EAB957]'
                    : 'bg-[#14251E]/95 border-[#2A463B]'
                }`}
              >
                <div>
                  <div
                    className="h-14 rounded-xl border border-white/15 mb-3 flex items-center justify-center"
                    style={{ backgroundColor: item.frameBg }}
                  >
                    <div
                      className="w-14 h-7 rounded border"
                      style={{ backgroundColor: item.tileBg, borderColor: item.tileBorder }}
                    />
                  </div>
                  <div className="font-display text-sm font-bold text-white">{item.name}</div>
                  <p className="mt-0.5 text-[11px] text-[#9BB0A5] leading-snug">{item.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleEquipOrBuy('board', item.id, item.priceCoins, item.currency)}
                  className={`mt-4 w-full py-2 px-3 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                    equipped
                      ? 'bg-[#0C1814] text-[#34D399] border border-[#1E4D40]'
                      : owned
                        ? 'game-btn-blue'
                        : 'game-btn-gold'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      EQUIPPED
                    </>
                  ) : owned ? (
                    'EQUIP'
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      {item.priceCoins} {item.currency === 'gems' ? 'GEMS' : 'COINS'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dice Finishes & Avatar Frames */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-white">Dice Finishes</h2>
          <div className="grid grid-cols-2 gap-3">
            {DICE_THEMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = diceTheme === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border-2 flex flex-col justify-between ${
                    equipped ? 'bg-[#1A2F75] border-[#EAB957]' : 'bg-[#14251E]/95 border-[#2A463B]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl border-2 shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: item.faceBg, borderColor: item.borderColor }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.pipColor }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-xs font-bold text-white truncate">{item.name}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('dice', item.id, item.priceCoins, item.currency)}
                    className={`mt-3 w-full py-2 rounded-xl font-display font-bold text-xs cursor-pointer ${
                      equipped
                        ? 'bg-[#0C1814] text-[#34D399] border border-[#1E4D40]'
                        : owned
                          ? 'game-btn-blue'
                          : 'game-btn-gold'
                    }`}
                  >
                    {equipped
                      ? 'EQUIPPED'
                      : owned
                        ? 'EQUIP'
                        : `${item.priceCoins} ${item.currency === 'gems' ? 'GEMS' : 'COINS'}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-white">Avatar Frames</h2>
          <div className="grid grid-cols-2 gap-3">
            {AVATAR_FRAMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = avatarFrame === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-3.5 border-2 flex flex-col justify-between ${
                    equipped ? 'bg-[#1A2F75] border-[#EAB957]' : 'bg-[#14251E]/95 border-[#2A463B]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar avatarId={avatarId} frameId={item.id} size="xs" alt={item.name} />
                    <div className="font-display text-xs font-bold text-white truncate">{item.name}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('frame', item.id, item.priceCoins, item.currency)}
                    className={`mt-3 w-full py-2 rounded-xl font-display font-bold text-xs cursor-pointer ${
                      equipped
                        ? 'bg-[#0C1814] text-[#34D399] border border-[#1E4D40]'
                        : owned
                          ? 'game-btn-blue'
                          : 'game-btn-gold'
                    }`}
                  >
                    {equipped
                      ? 'EQUIPPED'
                      : owned
                        ? 'EQUIP'
                        : `${item.priceCoins} ${item.currency === 'gems' ? 'GEMS' : 'COINS'}`}
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
