/**
 * Handcrafted Parlor Baize Tabletop Backdrop
 * Replaces generic neon-blue gradients with a calm, rich tournament felt & warm overhead brass table light.
 */
export function AnimatedGameBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
    >
      {/* Rich tournament baize felt base with warm tabletop overhead lamp */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 32%, #19352A 0%, #10231C 52%, #091310 100%)',
        }}
      />

      {/* Subtle woven cloth / fine baize crosshatch grain */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #E5C88B 0px, #E5C88B 1px, transparent 1px, transparent 18px), repeating-linear-gradient(-45deg, #E5C88B 0px, #E5C88B 1px, transparent 1px, transparent 18px)',
        }}
      />

      {/* Soft warm overhead brass-lamp spotlight on the center arena */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(232, 190, 103, 0.085) 0%, rgba(232, 190, 103, 0.02) 38%, transparent 68%)',
        }}
      />

      {/* Calm peripheral tabletop vignette so the Ludo board & pieces command 100% focus */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 55%, rgba(4, 10, 8, 0.58) 100%)',
        }}
      />
    </div>
  );
}
