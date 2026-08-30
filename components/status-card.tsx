'use client';

/**
 * Status Card -- Compact runtime metrics display below the webcam feed.
 *
 * Renders three metric sections (Tracking, Gesture, Performance) in a
 * dark zinc card. Numeric values are read from refs at ~500ms intervals
 * via a throttled rAF loop and written to DOM via `textContent` -- zero
 * `useState` calls in the hot path, zero React re-renders.
 *
 * The `gestureName` prop is discrete (changes only on gesture transitions)
 * and is safe to read in the rAF loop without causing performance issues.
 *
 * CONSTRAINTS §2: fpsRef, latencyRef, handsRef are read-only in rAF loop.
 * CONSTRAINTS §5: Uses only Tailwind CSS.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import type { GestureName } from '@/lib/gestures/types';
import { GESTURE_DISPLAY_NAME } from '@/lib/gestures/types';

// -- Constants ---------------------------------------------------------------

/** Throttle interval (ms) for DOM updates. */
const UPDATE_INTERVAL_MS = 500;

// -- Props -------------------------------------------------------------------

interface StatusCardsProps {
  /** Ref to the latest detected hands. */
  handsRef: RefObject<Hand[]>;
  /** Current gesture name (discrete pipeline -- re-renders only on change). */
  gestureName: GestureName;
  /** Ref to the current inference FPS. */
  fpsRef: RefObject<number>;
  /** Ref to the latest inference latency (ms). */
  latencyRef: RefObject<number>;
  /** TF.js backend display name. */
  backendName: string;
}

// -- Component ---------------------------------------------------------------

export default function StatusCards({
  handsRef,
  gestureName,
  fpsRef,
  latencyRef,
  backendName,
}: StatusCardsProps) {
  const trackingTextRef = useRef<HTMLSpanElement>(null);
  const gestureTextRef = useRef<HTMLSpanElement>(null);
  const fpsTextRef = useRef<HTMLSpanElement>(null);

  // Throttled rAF loop -- reads refs every frame, writes DOM every 500ms.
  useEffect(() => {
    let cancelled = false;
    let frameId = 0;
    let lastUpdate = 0;

    function update() {
      if (cancelled) return;
      const now = performance.now();

      if (now - lastUpdate >= UPDATE_INTERVAL_MS) {
        lastUpdate = now;

        // Tracking info
        const hands = handsRef.current;
        const trackingEl = trackingTextRef.current;
        if (trackingEl) {
          if (hands.length > 0) {
            const count = hands[0].keypoints.length;
            const handLabel = hands.length === 1 ? 'HAND' : 'HANDS';
            trackingEl.textContent = `${hands.length} ${handLabel}  /  ${count} LANDMARKS`;
          } else {
            trackingEl.textContent = 'NO HAND DETECTED';
          }
        }

        // Gesture info
        const gestureEl = gestureTextRef.current;
        if (gestureEl) {
          gestureEl.textContent =
            gestureName !== 'NONE'
              ? GESTURE_DISPLAY_NAME[gestureName]
              : 'IDLE';
        }

        // FPS
        const fps = Math.round(fpsRef.current);
        const fpsEl = fpsTextRef.current;
        if (fpsEl) {
          fpsEl.textContent = fps > 0 ? `${fps} FPS` : '--';
        }
      }

      frameId = requestAnimationFrame(update);
    }

    frameId = requestAnimationFrame(update);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [handsRef, fpsRef, gestureName]);

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:gap-3 sm:grid-cols-3">
      {/* Tracking */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 sm:rounded-xl sm:px-4 sm:py-3">
        <p className="mb-0.5 text-[9px] font-medium uppercase tracking-widest text-zinc-500 sm:mb-1 sm:text-[10px]">
          HAND TRACKING
        </p>
        <span
          ref={trackingTextRef}
          className="text-xs tabular-nums text-zinc-300 sm:text-sm"
        >
          --
        </span>
      </div>

      {/* Gesture */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 sm:rounded-xl sm:px-4 sm:py-3">
        <p className="mb-0.5 text-[9px] font-medium uppercase tracking-widest text-zinc-500 sm:mb-1 sm:text-[10px]">
          GESTURE
        </p>
        <span
          ref={gestureTextRef}
          className={`text-xs font-medium sm:text-sm ${
            gestureName !== 'NONE' ? 'text-zinc-400' : 'text-zinc-400'
          }`}
        >
          --
        </span>
      </div>

      {/* Performance */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5 sm:rounded-xl sm:px-4 sm:py-3">
        <p className="mb-0.5 text-[9px] font-medium uppercase tracking-widest text-zinc-500 sm:mb-1 sm:text-[10px]">
          PERFORMANCE
        </p>
        <span ref={fpsTextRef} className="text-xs tabular-nums text-zinc-300 sm:text-sm">
          --
        </span>
        <span className="ml-1.5 text-[10px] text-zinc-500 sm:ml-2 sm:text-xs">{backendName}</span>
      </div>
    </div>
  );
}