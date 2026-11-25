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
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#1A2F26] border border-[#2F4E42] hover:border-[#34D399] text-xs font-display font-bold text-[#34D399] cursor-pointer whitespace-nowrap shrink-0"
        title="Install Ludo Crown App"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Install</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Install Ludo Crown Mobile App"
        >
          <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[#14251E] border-t-2 sm:border-2 border-[#3D6153] p-5 pb-7 sm:p-6 shadow-2xl animate-pop-in">
            <div className="w-10 h-1 rounded-full bg-[#3D6153] mx-auto mb-3 sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#EAB957]" />
                <h2 className="font-display text-lg font-bold text-white">Install Ludo Crown</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-xl bg-[#1C3229] text-[#C5D5CC] hover:text-white cursor-pointer"
                aria-label="Close install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-xs text-[#CBD5E1] leading-relaxed list-decimal list-inside">
                <li>
                  Tap the <strong className="text-white">Share</strong> button in Safari.
                </li>
                <li>
                  Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.
                </li>
                <li>
                  Launch <strong className="text-[#EAB957]">Ludo Crown</strong> full-screen like a native app.
                </li>
              </ol>
            ) : (
              <div className="mt-4 space-y-2.5 text-xs text-[#CBD5E1] leading-relaxed">
                <p>
                  Open this app URL directly in <strong className="text-white">Chrome on Android</strong> and tap{' '}
                  <strong className="text-white">Menu → Install App / Add to Home Screen</strong> for full-screen standalone play.
                </p>
                <p className="text-[#A6BBB0]">
                  To publish on Google Play Store with native AdMob SDK, package this PWA with{' '}
                  <strong className="text-white">Capacitor</strong> or{' '}
                  <strong className="text-white">Bubblewrap (TWA)</strong>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-3 rounded-2xl font-display font-bold text-sm game-btn-gold cursor-pointer"
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
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#92400E] border border-[#F59E0B] px-3.5 py-1.5 text-xs font-semibold text-[#FEF3C7] shadow-xl whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Play Vs Computer anytime</span>
    </div>
  );
}
