import { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#CBD5E1] hover:border-[#111827] text-xs font-display font-extrabold text-[#1D4ED8] cursor-pointer whitespace-nowrap shrink-0"
        title="Install Ludo Crown App"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-[#0F172A]/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install Ludo Crown Mobile App"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white border-t-2 sm:border-2 border-[#111827] shadow-[0_6px_0_#111827] p-5 pb-7 sm:p-6 animate-pop-in">
            <div className="w-10 h-1 rounded-full bg-[#CBD5E1] mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#1D4ED8]" />
                <h2 className="font-display text-lg font-extrabold text-[#111827]">
                  Install Ludo Crown
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-xl bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0] cursor-pointer"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-xs text-[#475569] leading-relaxed list-decimal list-inside">
                <li>
                  Tap the <strong className="text-[#111827]">Share</strong> button in Safari.
                </li>
                <li>
                  Scroll down and tap <strong className="text-[#111827]">Add to Home Screen</strong>.
                </li>
                <li>
                  Launch <strong className="text-[#1D4ED8]">Ludo Crown</strong> full-screen like a native app.
                </li>
              </ol>
            ) : (
              <div className="mt-4 space-y-2.5 text-xs text-[#475569] leading-relaxed">
                <p>
                  Open this app URL directly in <strong className="text-[#111827]">Chrome on Android</strong> and tap{' '}
                  <strong className="text-[#111827]">Menu → Install App / Add to Home Screen</strong> for full-screen standalone play.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-3 rounded-2xl font-display font-extrabold text-sm game-btn-blue cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#FEF9C3] border-2 border-[#111827] px-3.5 py-1.5 text-xs font-extrabold text-[#111827] shadow-[0_3px_0_#111827] whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0 text-[#E11D48]" />
      <span>Offline Mode — Play VS Computer anytime</span>
    </div>
  );
}
