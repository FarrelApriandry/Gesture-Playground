'use client';

/**
 * App Header -- Compact application header with brand and system status.
 *
 * Renders a minimal top bar with the product name on the left and a
 * system status indicator on the right. Styled for dark-first UI with
 * restrained typography and a single accent color for the status dot.
 */

export default function AppHeader() {
  return (
    <header className="w-full border-b border-zinc-800/60 bg-zinc-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 sm:py-3">
        {/* Brand */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="inline-block h-2 w-2 rounded-full bg-zinc-500 shadow-[0_0_6px_rgba(161,161,170,0.6)]" />
          <span className="text-xs font-semibold tracking-tight text-zinc-100 sm:text-sm">
            GESTURE MOTION
          </span>
        </div>

        {/* System Status -- hidden label on xs, visible from sm+ */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500 shadow-[0_0_4px_rgba(161,161,170,0.5)]" />
          <span className="hidden text-xs font-medium tracking-wider text-zinc-500 sm:inline">
            SYSTEM ONLINE
          </span>
        </div>
      </div>
    </header>
  );
}