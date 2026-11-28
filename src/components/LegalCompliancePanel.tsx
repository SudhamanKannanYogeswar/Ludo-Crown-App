import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ChevronRight,
  FileText,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getAdConsentMode } from '../services/adMobService';

type LegalTab = 'privacy' | 'disclaimer' | 'account';

interface LegalCompliancePanelProps {
  onOpenAdPolicy: () => void;
}

export function LegalCompliancePanel({ onOpenAdPolicy }: LegalCompliancePanelProps) {
  const { isSignedIn, profile, deleteAccountAndData, resetGuestLocalData, signOutUser } = useApp();
  const [modalTab, setModalTab] = useState<LegalTab | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    tone: 'error' | 'info';
    text: string;
    needsReauth?: boolean;
  } | null>(null);

  const consentMode = getAdConsentMode();

  useEffect(() => {
    if (!modalTab) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        setModalTab(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalTab, deleting]);

  const openModal = (tab: LegalTab) => {
    setConfirmStep(false);
    setConfirmInput('');
    setDeleteFeedback(null);
    setModalTab(tab);
  };

  const handleConfirmDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteFeedback(null);
    try {
      const result = await deleteAccountAndData();
      if (result.ok) {
        setModalTab(null);
        setConfirmStep(false);
        setConfirmInput('');
      } else {
        setDeleteFeedback({
          tone: 'error',
          text: result.message,
          needsReauth: result.requiresRecentLogin,
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="space-y-3 pt-2" aria-labelledby="legal-privacy-heading">
      <div>
        <h2
          id="legal-privacy-heading"
          className="font-display text-lg font-extrabold text-[#111827]"
        >
          Legal, Privacy &amp; Fair Play
        </h2>
        <p className="text-xs text-[#64748B]">
          Review our privacy policy, virtual-currency disclaimer, ad preferences, and data controls.
        </p>
      </div>

      <div className="studio-card rounded-3xl overflow-hidden divide-y divide-[#E2E8F0]">
        <button
          type="button"
          onClick={() => openModal('privacy')}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#F8FAFC] transition-colors cursor-pointer min-h-[56px]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-[#1D4ED8] shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold text-[#111827]">
                Privacy Policy
              </div>
              <div className="text-xs text-[#64748B] truncate">
                Google Sign-In, cloud saves, multiplayer presence, ads &amp; notifications
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1D4ED8] whitespace-nowrap shrink-0">
            Read
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => openModal('disclaimer')}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#F8FAFC] transition-colors cursor-pointer min-h-[56px]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <Scale className="w-5 h-5 text-[#0F766E] shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold text-[#111827]">
                Disclaimer &amp; Fair Play
              </div>
              <div className="text-xs text-[#64748B] truncate">
                Virtual coins only (no real-money gambling), dice fairness, Auto-Play &amp; bots
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1D4ED8] whitespace-nowrap shrink-0">
            Read
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenAdPolicy}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#F8FAFC] transition-colors cursor-pointer min-h-[56px]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <SlidersHorizontal className="w-5 h-5 text-[#B45309] shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold text-[#111827]">
                Ad Privacy Preferences
              </div>
              <div className="text-xs text-[#64748B] truncate">
                Current mode:{' '}
                {consentMode === 'personalized'
                  ? 'Personalized Ads'
                  : 'Non-Personalized Ads (default)'}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#1D4ED8] whitespace-nowrap shrink-0">
            Manage
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => openModal('account')}
          className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left hover:bg-[#FEF2F2] transition-colors cursor-pointer min-h-[56px]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <Trash2 className="w-5 h-5 text-[#DC2626] shrink-0" />
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold text-[#111827]">
                {isSignedIn ? 'Delete Account & Cloud Data' : 'Clear Local Guest Data'}
              </div>
              <div className="text-xs text-[#64748B] truncate">
                {isSignedIn
                  ? 'Permanently remove your profile, wallet, friends & sign-in record'
                  : 'Reset saved guest profile, virtual balance, and local preferences'}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-display font-bold text-[#DC2626] whitespace-nowrap shrink-0">
            Manage
            <ChevronRight className="w-4 h-4" />
          </span>
        </button>
      </div>

      <p className="text-[11px] text-[#64748B] leading-relaxed px-1">
        Ludo Crown is a free casual board game for entertainment only. Coins, Gems, and tournament
        prizes are virtual items with zero real-world monetary value. Public policy URL:{' '}
        <a
          href="/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1D4ED8] font-semibold hover:underline"
        >
          /privacy.html
        </a>
      </p>

      {modalTab &&
        createPortal(
          <div
            className="fixed inset-0 z-[75] bg-[#0F172A]/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Ludo Crown Legal and Privacy Information"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleting) {
                setModalTab(null);
              }
            }}
          >
            <div className="w-full max-w-2xl max-h-[88dvh] flex flex-col rounded-3xl bg-white border-2 border-[#111827] shadow-[0_6px_0_#111827] overflow-hidden animate-pop-in">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-5 h-5 text-[#1D4ED8] shrink-0" />
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-extrabold text-[#111827] leading-tight truncate">
                      Ludo Crown · Legal &amp; Privacy
                    </h3>
                    <p className="text-[11px] text-[#64748B]">
                      Last updated November 2026 · Package com.ludocrown.game
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setModalTab(null)}
                  className="p-2 rounded-xl bg-[#F1F5F9] border border-[#CBD5E1] text-[#334155] hover:border-[#111827] cursor-pointer disabled:opacity-50 shrink-0"
                  aria-label="Close legal dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Tabs */}
              <div className="px-5 pt-3 pb-2 bg-[#F8FAFC] border-b border-[#E2E8F0] shrink-0">
                <div
                  role="tablist"
                  aria-label="Legal documents"
                  className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#E2E8F0]"
                >
                  {(
                    [
                      { id: 'privacy', label: 'Privacy Policy' },
                      { id: 'disclaimer', label: 'Disclaimer' },
                      { id: 'account', label: 'Account & Data' },
                    ] as { id: LegalTab; label: string }[]
                  ).map((tab) => {
                    const active = modalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        role="tab"
                        aria-selected={active}
                        type="button"
                        onClick={() => {
                          setModalTab(tab.id);
                          setConfirmStep(false);
                          setDeleteFeedback(null);
                        }}
                        className={`py-2 px-2 rounded-lg text-xs font-display font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-white text-[#111827] shadow-xs'
                            : 'text-[#475569] hover:text-[#111827]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-6 py-5 space-y-5 text-sm text-[#334155] leading-relaxed">
                {modalTab === 'privacy' && (
                  <>
                    <div className="space-y-1.5">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        1. Overview
                      </h4>
                      <p>
                        Ludo Crown respects your privacy and collects only the minimum data needed
                        to provide online multiplayer, cloud profile sync, optional notifications,
                        and free-to-play ad rewards. Offline Practice and Pass &amp; Play can be
                        played completely as a guest without signing in.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        2. Data We Collect &amp; How It Is Used
                      </h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          <strong className="text-[#111827]">Google Sign-In (Optional):</strong>{' '}
                          When you sign in with Google, Firebase Authentication provides your unique
                          user ID (UID), display name, and verified email status. Your email address
                          is <strong>never displayed publicly</strong> or shared with other players.
                        </li>
                        <li>
                          <strong className="text-[#111827]">
                            Gaming Profile, Friends &amp; Live Presence:
                          </strong>{' '}
                          Your chosen display name, avatar, equipped cosmetics, match statistics
                          (games played, wins, captures, ELO rating, league), friend list, and live
                          online/in-match/offline presence are stored in Google Cloud Firestore to
                          power leaderboards and matchmaking.
                        </li>
                        <li>
                          <strong className="text-[#111827]">
                            Multiplayer Tables, Chat &amp; Invites:
                          </strong>{' '}
                          Active room state, in-match chat/emotes, and room invites (which
                          automatically expire after 2 minutes) are stored in Firestore for
                          real-time gameplay.
                        </li>
                        <li>
                          <strong className="text-[#111827]">Push Notifications (Opt-In):</strong>{' '}
                          Only if you turn on notifications, a Firebase Cloud Messaging (FCM) device
                          token and your alert toggles are stored privately for your account.
                        </li>
                        <li>
                          <strong className="text-[#111827]">Local Device Storage:</strong> Guest
                          progress, sound settings, backdrop theme, and ad privacy consent are saved
                          locally on your device.
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        3. Third-Party Services &amp; Advertising
                      </h4>
                      <p>
                        Ludo Crown integrates <strong className="text-[#111827]">Google Firebase</strong>{' '}
                        (Authentication, Cloud Firestore, Cloud Messaging, and Google Analytics for
                        Firebase to measure app stability, screen usage, and game balance) and{' '}
                        <strong className="text-[#111827]">Google AdMob</strong> on mobile builds
                        (top adaptive banner, opt-in rewarded videos, and occasional post-match
                        breaks). AdMob may process device advertising identifiers (such as Android
                        AD_ID) according to Google&apos;s privacy policy.
                      </p>
                      <p>
                        <strong className="text-[#111827]">Non-Personalized Ads</strong> are enabled
                        by default. You can switch your preference anytime under{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setModalTab(null);
                            onOpenAdPolicy();
                          }}
                          className="text-[#1D4ED8] font-bold hover:underline cursor-pointer"
                        >
                          Ad Privacy Preferences
                        </button>
                        .
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        4. Security, Children&apos;s Privacy &amp; Your Rights
                      </h4>
                      <p>
                        All cloud communication is encrypted in transit via HTTPS/TLS, and private
                        records (wallet, push tokens, private room chat) are protected by
                        owner-restricted Firestore Security Rules. Ludo Crown is a general-audience
                        board game not directed to children under 13. You may edit your display name
                        or permanently delete your account and cloud data anytime from the{' '}
                        <button
                          type="button"
                          onClick={() => setModalTab('account')}
                          className="text-[#1D4ED8] font-bold hover:underline cursor-pointer"
                        >
                          Account &amp; Data
                        </button>{' '}
                        tab.
                      </p>
                    </div>
                  </>
                )}

                {modalTab === 'disclaimer' && (
                  <>
                    <div className="p-4 rounded-2xl bg-[#FEF9C3] border border-[#FACC15] text-[#713F12] text-xs leading-relaxed">
                      <strong className="font-extrabold text-[#111827]">
                        Entertainment Only · No Real-Money Gambling:
                      </strong>{' '}
                      All Coins, Gems, Entry Stakes, Tournament Prize Pools, Lucky Spin rewards, and
                      Cosmetics in Ludo Crown are 100% virtual in-game items with zero monetary
                      value. They cannot be cashed out, redeemed, or exchanged for real money or
                      real-world goods.
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        Fair Play &amp; Gameplay Mechanics
                      </h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          <strong className="text-[#111827]">
                            Dice Odds &amp; Smart Pity Timer:
                          </strong>{' '}
                          Standard 1-in-6 dice odds apply to every turn. To prevent frustrating
                          deadlocks when a player has zero legal moves for several consecutive
                          turns, a built-in Smart Pity Timer gently boosts the chance of rolling a 6
                          until a legal move is available.
                        </li>
                        <li>
                          <strong className="text-[#111827]">
                            Auto-Play &amp; Disconnection Policy:
                          </strong>{' '}
                          If you lose internet connection or step away from an online table,
                          Auto-Play keeps the match moving so opponents can finish, and you can
                          rejoin from Home while the table is active. Matches completed under
                          Auto-Play or forfeited early do not grant coins, trophies, or ELO gains.
                        </li>
                        <li>
                          <strong className="text-[#111827]">AI Bot Opponents:</strong> Offline
                          Practice and unfilled online matchmaking seats may use automated AI bots,
                          which are always clearly marked on the board.
                        </li>
                        <li>
                          <strong className="text-[#111827]">One Active Match Rule:</strong> To keep
                          online tables fair for everyone, players may participate in one active
                          online match at a time.
                        </li>
                      </ul>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        Availability &amp; Independence Notice
                      </h4>
                      <p>
                        Ludo Crown is provided &ldquo;as is&rdquo; for casual entertainment. Online
                        multiplayer availability depends on internet connectivity and cloud service
                        uptime. Ludo is a classic public-domain board game inspired by traditional
                        Pachisi; Ludo Crown is an independent game and is not affiliated with or
                        endorsed by any other publisher or trademark holder.
                      </p>
                    </div>
                  </>
                )}

                {modalTab === 'account' && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <h4 className="font-display text-base font-extrabold text-[#111827]">
                        {isSignedIn
                          ? 'Permanent Account & Cloud Data Deletion'
                          : 'Local Guest Data Control'}
                      </h4>
                      <p>
                        {isSignedIn ? (
                          <>
                            Signed in as{' '}
                            <strong className="text-[#111827]">{profile.displayName}</strong>. You
                            can permanently delete your Ludo Crown account at any time. This removes
                            your Firestore profile, virtual wallet, unlocked cosmetics, friend
                            connections, pending invites, push notification subscription, and
                            Firebase Authentication account.
                          </>
                        ) : (
                          <>
                            You are currently playing in Guest Mode. Your profile, virtual coins,
                            and preferences are stored only on this device and are not uploaded to
                            the cloud.
                          </>
                        )}
                      </p>
                    </div>

                    {deleteFeedback && (
                      <div className="p-3.5 rounded-2xl bg-[#FEE2E2] border border-[#FCA5A5] text-xs text-[#991B1B] space-y-2">
                        <p className="font-semibold">{deleteFeedback.text}</p>
                        {deleteFeedback.needsReauth && (
                          <button
                            type="button"
                            onClick={async () => {
                              setModalTab(null);
                              await signOutUser();
                            }}
                            className="px-3.5 py-2 rounded-xl bg-white border border-[#991B1B] text-[#991B1B] font-display font-extrabold text-xs cursor-pointer hover:bg-[#FEF2F2]"
                          >
                            Sign Out Now to Re-Verify
                          </button>
                        )}
                      </div>
                    )}

                    {isSignedIn ? (
                      !confirmStep ? (
                        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="text-xs text-[#475569]">
                            This action is permanent and cannot be undone.
                          </div>
                          <button
                            type="button"
                            onClick={() => setConfirmStep(true)}
                            className="px-4 py-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] border-2 border-[#111827] shadow-[0_2px_0_#111827] font-display font-extrabold text-xs whitespace-nowrap cursor-pointer"
                          >
                            Delete My Account
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-[#FEF2F2] border-2 border-[#DC2626] space-y-3">
                          <div className="flex items-start gap-2.5 text-xs text-[#991B1B]">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-extrabold">Confirm permanent deletion:</strong>{' '}
                              Type <strong>DELETE</strong> below to permanently erase your Ludo
                              Crown account, virtual coins, cosmetics, and stats.
                            </div>
                          </div>
                          <input
                            type="text"
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            placeholder="Type DELETE to confirm"
                            autoComplete="off"
                            className="w-full bg-white border-2 border-[#111827] rounded-xl px-3 py-2 text-sm font-bold text-[#111827] focus:outline-none"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={deleting}
                              onClick={() => {
                                setConfirmStep(false);
                                setConfirmInput('');
                              }}
                              className="px-4 py-2 rounded-xl bg-white border border-[#CBD5E1] text-xs font-bold text-[#334155] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={deleting || confirmInput.trim().toUpperCase() !== 'DELETE'}
                              onClick={handleConfirmDeleteAccount}
                              className="px-4 py-2 rounded-xl bg-[#DC2626] text-white border-2 border-[#111827] shadow-[0_2px_0_#111827] font-display font-extrabold text-xs cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              {deleting ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#CBD5E1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs text-[#475569]">
                          Clears your local guest profile, coins, and saved preferences on this
                          device.
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            resetGuestLocalData();
                            setModalTab(null);
                          }}
                          className="px-4 py-2.5 rounded-xl bg-[#FEE2E2] hover:bg-[#FECACA] text-[#B91C1C] border-2 border-[#111827] shadow-[0_2px_0_#111827] font-display font-extrabold text-xs whitespace-nowrap cursor-pointer"
                        >
                          Clear Local Data
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-3 shrink-0">
                <a
                  href="/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#1D4ED8] hover:underline"
                >
                  Open standalone web policy
                </a>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setModalTab(null)}
                  className="px-5 py-2 rounded-xl font-display font-extrabold text-xs game-btn-blue cursor-pointer disabled:opacity-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
