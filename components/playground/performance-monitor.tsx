'use client';

/**
 * Performance Monitor — Cyberpunk HUD Debug Overlay
 *
 * Renders a compact heads-up display at the bottom-left of the webcam feed
 * showing real-time inference metrics: FPS, TF.js backend, latency (ms),
 * and the currently active gesture.
 *
 * **CONSTRAINTS §2 — Performance:**
 * - Numeric values (FPS, latency) are read from refs at 60 FPS in a
 *   `requestAnimationFrame` loop, but the DOM is only updated every
 *   ~500ms via `textContent` writes — zero `useState` calls, zero
 *   React re-renders in the hot path.
 * - The `gestureName` prop triggers a React re-render only on discrete
 *   gesture transitions (same as the existing gesture badge pattern).
 *
 * **CONSTRAINTS §5 — Dependencies:**
 * - Uses only Tailwind CSS (already installed). No external libraries.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureName } from '@/lib/gestures/types';
import { GESTURE_EMOJI, GESTURE_DISPLAY_NAME } from '@/lib/gestures/types';

// ─── Constants ──────────────────────────────────────────────────────

/** Throttle interval (ms) for updating numeric DOM values. */
const UPDATE_INTERVAL_MS = 500;

/** FPS thresholds for color coding. */
const FPS_GOOD = 24;
const FPS_WARN = 15;

// ─── Props ──────────────────────────────────────────────────────────

interface PerformanceMonitorProps {
  /** Ref to the current inference FPS (updated by useHandPose). */
  fpsRef: RefObject<number>;
  /** Ref to the latest inference latency in ms (updated by useHandPose). */
  latencyRef: RefObject<number>;
  /**
   * Ref to the current gesture name. Synced externally from the
   * discrete event pipeline (latched gesture value).
   */
  gestureNameRef: RefObject<GestureName>;
  /** Display name of the active TF.js backend (e.g. "WebGL"). */
  backendName: string;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Cyberpunk-style HUD overlay for monitoring detection performance.
 *
 * Displays FPS, backend, latency, and active gesture in a compact
 * translucent panel positioned at the bottom-left of the video feed.
 *
 * @example
 * ```tsx
 * <PerformanceMonitor
 *   fpsRef={fpsRef}
 *   latencyRef={latencyRef}
 *   gestureNameRef={gestureNameRef}
 *   backendName="WebGL"
 * />
 * ```
 */
export default function PerformanceMonitor({
  fpsRef,
  latencyRef,
  gestureNameRef,
  backendName,
}: PerformanceMonitorProps) {
  // ── DOM refs for direct textContent updates (no useState) ────────
  const fpsTextRef = useRef<HTMLSpanElement>(null);
  const latencyTextRef = useRef<HTMLSpanElement>(null);
  const gestureTextRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track the last displayed gesture to avoid unnecessary DOM writes.
  const lastGestureRef = useRef<GestureName>('NONE');

  /**
   * Throttled rAF loop — reads refs every frame but only writes to DOM
   * every UPDATE_INTERVAL_MS to keep CPU overhead minimal.
   */
  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let lastUpdate = 0;

    function update() {
      if (cancelled) return;
      const now = performance.now();

      // Throttle DOM writes to ~500ms intervals.
      if (now - lastUpdate >= UPDATE_INTERVAL_MS) {
        lastUpdate = now;

        // ── FPS ────────────────────────────────────────────────────
        const fps = Math.round(fpsRef.current);
        const fpsEl = fpsTextRef.current;
        if (fpsEl) {
          fpsEl.textContent = `${fps}`;
          fpsEl.className =
            fps >= FPS_GOOD
              ? 'text-emerald-400'
              : fps >= FPS_WARN
                ? 'text-amber-400'
                : 'text-red-400';
        }

        // ── Latency ───────────────────────────────────────────────
        const latency = latencyRef.current;
        const latEl = latencyTextRef.current;
        if (latEl) {
          latEl.textContent = latency > 0 ? `${latency.toFixed(1)}ms` : '—';
        }

        // ── Gesture (only write on change) ─────────────────────────
        const gesture = gestureNameRef.current;
        if (gesture !== lastGestureRef.current) {
          lastGestureRef.current = gesture;
          const gestureEl = gestureTextRef.current;
          if (gestureEl) {
            gestureEl.textContent =
              gesture !== 'NONE'
                ? `${GESTURE_EMOJI[gesture]} ${GESTURE_DISPLAY_NAME[gesture]}`
                : '— Idle';
          }
        }
      }

      frameId = requestAnimationFrame(update);
    }

    frameId = requestAnimationFrame(update);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [fpsRef, latencyRef, gestureNameRef]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      aria-label="Performance monitor"
      className="pointer-events-none absolute bottom-3 left-3 z-40 select-none"
    >
      {/* Glassmorphism HUD panel */}
      <div className="rounded-lg border border-cyan-500/30 bg-black/70 px-3 py-2 font-mono text-[11px] leading-tight shadow-[0_0_12px_rgba(34,211,238,0.15)] backdrop-blur-sm">
        {/* Header accent line */}
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">
            Monitor
          </span>
        </div>

        {/* Metrics grid */}
        <div className="space-y-1">
          {/* FPS */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">FPS</span>
            <span ref={fpsTextRef} className="text-emerald-400 tabular-nums">
              —
            </span>
          </div>

          {/* Backend */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Backend</span>
            <span className="text-blue-400">{backendName}</span>
          </div>

          {/* Latency */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Latency</span>
            <span ref={latencyTextRef} className="text-cyan-400 tabular-nums">
              —
            </span>
          </div>

          {/* Gesture */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-zinc-500">Gesture</span>
            <span ref={gestureTextRef} className="text-purple-400">
              — Idle
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}