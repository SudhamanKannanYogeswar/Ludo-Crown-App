import React, { useState } from 'react';
import { Check, Lock, Save } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  AVATAR_FRAMES,
  AVATAR_OPTIONS,
  BOARD_THEMES,
  DICE_THEMES,
} from '../data/catalog';
import { PlayerAvatar } from './PlayerAvatar';

export function AtelierView() {
  const { profile, wallet, saveCustomization, purchaseCosmetic } = useApp();

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
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#F5F2EB]">
            Avatar &amp; Cosmetic Atelier
          </h1>
          <p className="mt-2 text-sm text-[#A5BDB2]">
            Personalize your table identity, unlock handcrafted board materials, and collect luxury
            dice finishes.
          </p>
        </div>
        <div className="text-right font-mono tabular-nums">
          <div className="text-xs text-[#8FA99C]">Available Balance</div>
          <div className="text-xl font-semibold text-[#E5B95C]">
            {wallet.coins.toLocaleString()} Coins · {wallet.gems} Gems
          </div>
        </div>
      </div>

      {/* Player Identity & Avatar Selection */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl bg-[#102B22] border border-[#234739] p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-4 flex items-center gap-4">
          <PlayerAvatar avatarId={avatarId} frameId={avatarFrame} size="lg" alt={displayName} />
          <div className="min-w-0 flex-1">
            <label className="block text-xs text-[#9EB5AA] mb-1.5" htmlFor="player-name-input">
              Table Display Name
            </label>
            <input
              id="player-name-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              minLength={2}
              maxLength={32}
              className="w-full bg-[#0A1D16] border border-[#254A3B] rounded-xl px-3.5 py-2 text-sm text-[#F5F2EB] focus:outline-none focus:border-[#D4A446]"
            />
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="text-xs text-[#9EB5AA] mb-2.5">Select Hand-Painted Portrait</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AVATAR_OPTIONS.map((opt) => {
              const selected = avatarId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAvatarId(opt.id)}
                  className={`p-3 rounded-xl border text-center transition-colors cursor-pointer flex flex-col items-center gap-2 ${
                    selected
                      ? 'bg-[#173D2F] border-[#D4A446]'
                      : 'bg-[#0B1F18] border-[#1E3E31] hover:border-[#2F5E4D]'
                  }`}
                >
                  <PlayerAvatar avatarId={opt.id} frameId={avatarFrame} size="sm" alt={opt.name} />
                  <div>
                    <div className="text-xs font-semibold text-[#F5F2EB]">{opt.name}</div>
                    <div className="text-[11px] text-[#8FA99C]">{opt.title}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#D4A446] text-[#0B231B] text-sm font-semibold hover:bg-[#E1B45B] whitespace-nowrap cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Identity'}
          </button>
        </div>
      </form>

      {/* Unlockable Board Themes */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">Board Materials</h2>
          <p className="text-xs text-[#9EB5AA] mt-1">
            Restyles the active 15×15 game board immediately across all game modes.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {BOARD_THEMES.map((item) => {
            const owned = isOwned(item.id, item.priceCoins);
            const equipped = boardTheme === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between ${
                  equipped
                    ? 'bg-[#15392C] border-[#D4A446]'
                    : 'bg-[#102B22] border-[#234739]'
                }`}
              >
                <div>
                  <div
                    className="h-16 rounded-xl border border-white/10 mb-4 flex items-center justify-center"
                    style={{ backgroundColor: item.frameBg }}
                  >
                    <div
                      className="w-16 h-8 rounded border"
                      style={{ backgroundColor: item.tileBg, borderColor: item.tileBorder }}
                    />
                  </div>
                  <div className="text-sm font-semibold text-[#F5F2EB]">{item.name}</div>
                  <p className="mt-1 text-xs text-[#9EB5AA] leading-relaxed">{item.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleEquipOrBuy('board', item.id, item.priceCoins, item.currency)}
                  className={`mt-5 w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                    equipped
                      ? 'bg-[#0C211A] text-[#4ADE80] border border-[#1F4234]'
                      : owned
                        ? 'bg-[#1B4435] text-[#F5F2EB] hover:bg-[#235643]'
                        : 'bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B]'
                  }`}
                >
                  {equipped ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Equipped
                    </>
                  ) : owned ? (
                    'Equip Board'
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      Unlock · {item.priceCoins} {item.currency === 'gems' ? 'Gems' : 'Coins'}
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Unlockable Dice Finishes & Avatar Frames */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">Dice Finishes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DICE_THEMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = diceTheme === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between ${
                    equipped ? 'bg-[#15392C] border-[#D4A446]' : 'bg-[#102B22] border-[#234739]'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className="w-11 h-11 rounded-lg border-2 shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: item.faceBg, borderColor: item.borderColor }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.pipColor }}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#F5F2EB]">{item.name}</div>
                      <p className="text-xs text-[#9EB5AA] mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('dice', item.id, item.priceCoins, item.currency)}
                    className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                      equipped
                        ? 'bg-[#0C211A] text-[#4ADE80] border border-[#1F4234]'
                        : owned
                          ? 'bg-[#1B4435] text-[#F5F2EB] hover:bg-[#235643]'
                          : 'bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B]'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip Die'
                        : `Unlock · ${item.priceCoins} ${item.currency === 'gems' ? 'Gems' : 'Coins'}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl font-semibold text-[#F5F2EB]">Avatar Frames</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AVATAR_FRAMES.map((item) => {
              const owned = isOwned(item.id, item.priceCoins);
              const equipped = avatarFrame === item.id;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl p-4 border flex flex-col justify-between ${
                    equipped ? 'bg-[#15392C] border-[#D4A446]' : 'bg-[#102B22] border-[#234739]'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <PlayerAvatar avatarId={avatarId} frameId={item.id} size="sm" alt={item.name} />
                    <div>
                      <div className="text-sm font-semibold text-[#F5F2EB]">{item.name}</div>
                      <p className="text-xs text-[#9EB5AA] mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEquipOrBuy('frame', item.id, item.priceCoins, item.currency)}
                    className={`mt-4 w-full py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                      equipped
                        ? 'bg-[#0C211A] text-[#4ADE80] border border-[#1F4234]'
                        : owned
                          ? 'bg-[#1B4435] text-[#F5F2EB] hover:bg-[#235643]'
                          : 'bg-[#D4A446] text-[#0B231B] hover:bg-[#E1B45B]'
                    }`}
                  >
                    {equipped
                      ? 'Equipped'
                      : owned
                        ? 'Equip Frame'
                        : `Unlock · ${item.priceCoins} ${item.currency === 'gems' ? 'Gems' : 'Coins'}`}
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
