'use client';

/**
 * Virtual Cursor — High-Speed Gesture-Controlled Pointer
 *
 * Renders a neon-glow cursor that follows the user's index finger tip
 * (Landmark 8) when the `POINT` gesture is active.
 *
 * **CONSTRAINTS §2 — Performance:**
 * - All position updates happen via Framer Motion `useMotionValue.set()`
 *   inside a `requestAnimationFrame` loop — zero `useState` calls, zero
 *   React re-renders at 60 FPS.
 * - `useSpring` adds physically-based smoothing (damping/stiffness) to
 *   absorb jitter from the TF.js detection pipeline.
 *
 * **CONSTRAINTS §4 — Coordinate & Mirroring:**
 * - The webcam feed is mirrored via CSS `scaleX(-1)`.
 * - This cursor does NOT carry that transform, so the raw TF.js X
 *   coordinate must be inverted: `x' = videoWidth − landmarkX`.
 * - Coordinates are normalised to percentages of the container so the
 *   cursor tracks correctly regardless of viewport / video resolution.
 *
 * **CONSTRAINTS §5 — Dependencies:**
 * - Uses only `framer-motion` (already installed) and Tailwind CSS.
 */

import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';

// ─── Constants ──────────────────────────────────────────────────────

/** MediaPipe landmark index for the index-finger tip. */
const INDEX_TIP = 8;

/** Spring physics — tweak for feel. */
const SPRING_CONFIG = { damping: 22, stiffness: 280, mass: 0.4 };

// ─── Props ──────────────────────────────────────────────────────────

interface VirtualCursorProps {
  /** Ref to the latest detected hands (updated ~60 FPS by useHandPose). */
  handsRef: RefObject<Hand[]>;
  /** Ref to the video element — used to read videoWidth/videoHeight. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** When `true` the cursor is visible and tracks the index finger. */
  isActive: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Neon virtual cursor that follows Landmark 8 (Index Tip) at 60 FPS.
 *
 * @example
 * ```tsx
 * <VirtualCursor handsRef={handsRef} videoRef={videoRef} isActive={gestureName === 'POINT'} />
 * ```
 */
export default function VirtualCursor({
  handsRef,
  videoRef,
  isActive,
}: VirtualCursorProps) {
  // ── Motion values (write-only in rAF — no React re-render) ──────
  const rawX = useMotionValue(50); // percentage 0–100
  const rawY = useMotionValue(50);
  const cursorOpacity = useMotionValue(0);

  // Springs smooth out TF.js jitter while keeping latency minimal.
  const smoothX = useSpring(rawX, SPRING_CONFIG);
  const smoothY = useSpring(rawY, SPRING_CONFIG);
  const smoothOpacity = useSpring(cursorOpacity, { damping: 20, stiffness: 200 });

  // Convert numeric spring values to CSS percentage strings.
  // `useTransform` maps MotionValue<number> → MotionValue<string>
  // so Framer Motion writes e.g. "42.3%" directly to the `left` / `top` CSS props.
  const left = useTransform(smoothX, (v) => `${v}%`);
  const top = useTransform(smoothY, (v) => `${v}%`);

  // ── rAF tracking loop ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let frameId = 0;

    function track() {
      if (cancelled) return;

      // Toggle visibility via motion value (no useState).
      cursorOpacity.set(isActive ? 1 : 0);

      if (isActive) {
        const video = videoRef.current;
        const hands = handsRef.current;

        if (
          video &&
          video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0 &&
          hands.length > 0
        ) {
          const kp = hands[0].keypoints[INDEX_TIP];
          if (kp) {
            const vw = video.videoWidth;
            const vh = video.videoHeight;

            // CONSTRAINTS §4 — Invert X because the video is mirrored
            // but this cursor is NOT mirrored.
            const percentX = ((vw - kp.x) / vw) * 100;
            const percentY = (kp.y / vh) * 100;

            rawX.set(percentX);
            rawY.set(percentY);
          }
        }
      }

      frameId = requestAnimationFrame(track);
    }

    frameId = requestAnimationFrame(track);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [isActive, handsRef, videoRef, rawX, rawY, cursorOpacity]);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-30"
      style={{
        left,
        top,
        opacity: smoothOpacity,
        // Shift origin so the cursor is centred on the tracked point.
        translateX: '-50%',
        translateY: '-50%',
      }}
    >
      {/* Outer glow ring */}
      <div className="absolute -inset-3 rounded-full bg-zinc-400/15 blur-md" />

      {/* Mid glow ring */}
      <div className="absolute -inset-1.5 rounded-full bg-zinc-400/25 blur-sm" />

      {/* Core cursor dot */}
      <div className="relative h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_8px_rgba(161,161,170,0.6)]" />
    </motion.div>
  );
}
