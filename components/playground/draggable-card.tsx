'use client';

/**
 * Draggable Card — Interactive Pinch-to-Drag UI Element
 *
 * Renders a floating glassmorphism card that can be grabbed and moved
 * using the PINCH gesture. The card tracks the midpoint between
 * Landmark 4 (Thumb Tip) and Landmark 8 (Index Tip).
 *
 * **CONSTRAINTS §2 — Performance:**
 * - All position updates happen via Framer Motion `useMotionValue.set()`
 *   inside a `requestAnimationFrame` loop — zero `useState` calls in the
 *   hot path, zero React re-renders at 60 FPS.
 * - `useSpring` adds physically-based smoothing to absorb TF.js jitter.
 *
 * **CONSTRAINTS §4 — Coordinate & Mirroring:**
 * - The webcam feed is mirrored via CSS `scaleX(-1)`.
 * - This card does NOT carry that transform, so the raw TF.js X
 *   coordinate must be inverted: `x' = videoWidth − landmarkX`.
 * - Coordinates are normalised to percentages of the container.
 *
 * **GESTURES.md §2.2 — Pinch-to-Drag:**
 * - Grabs when PINCH is detected and the pinch midpoint is within
 *   HIT_RADIUS of the card's resting position.
 * - Releases when gesture transitions to OPEN_PALM, NONE, or any
 *   non-PINCH state.
 *
 * **CONSTRAINTS §5 — Dependencies:**
 * - Uses only `framer-motion` (already installed) and Tailwind CSS.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import type { GestureName } from '@/lib/gestures/types';

// ─── Constants ──────────────────────────────────────────────────────

/** MediaPipe landmark indices for the pinch midpoint. */
const THUMB_TIP = 4;
const INDEX_TIP = 8;

/** Default card position (percentage of container). */
const DEFAULT_X = 75;
const DEFAULT_Y = 35;

/**
 * Proximity threshold (percentage of container) for grab detection.
 * The user's pinch midpoint must be within this radius of the card's
 * resting centre to initiate a drag.
 */
const HIT_RADIUS = 15;

/**
 * Spring physics — heavier feel than the cursor for a card-sized element.
 * Higher mass and damping give a "weighty" drag sensation.
 */
const SPRING_CONFIG = { damping: 25, stiffness: 200, mass: 0.6 };

// ─── Props ──────────────────────────────────────────────────────────

interface DraggableCardProps {
  /** Ref to the latest detected hands (updated ~60 FPS by useHandPose). */
  handsRef: RefObject<Hand[]>;
  /** Ref to the video element — used to read videoWidth/videoHeight. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Current gesture name (discrete pipeline — re-renders only on change). */
  gestureName: GestureName;
}

// ─── Component ──────────────────────────────────────────────────────

/**
 * Glassmorphism card that responds to PINCH gesture for drag-and-drop.
 *
 * Position tracking uses the midpoint of Landmarks 4 & 8 with X-inversion
 * (CONSTRAINTS §4) so the card follows the user's pinch naturally.
 *
 * @example
 * ```tsx
 * <DraggableCard
 *   handsRef={handsRef}
 *   videoRef={videoRef}
 *   gestureName={gestureName}
 * />
 * ```
 */
export default function DraggableCard({
  handsRef,
  videoRef,
  gestureName,
}: DraggableCardProps) {
  // ── Discrete state (changes only on gesture transitions) ──────────
  // This is NOT inside the rAF loop, so it's safe per CONSTRAINTS §2.
  const [isDragging, setIsDragging] = useState(false);

  // ── Refs for the rAF loop (avoid closure staleness) ──────────────
  const gestureRef = useRef<GestureName>(gestureName);
  const isDraggingRef = useRef(false);
  const cardRestXRef = useRef(DEFAULT_X);
  const cardRestYRef = useRef(DEFAULT_Y);

  // Keep gestureRef in sync with the prop (discrete updates only).
  useEffect(() => {
    gestureRef.current = gestureName;
  }, [gestureName]);

  // ── Motion values (write-only in rAF — no React re-render) ────────
  const rawX = useMotionValue(DEFAULT_X);
  const rawY = useMotionValue(DEFAULT_Y);

  // Springs smooth out TF.js jitter while keeping latency minimal.
  const smoothX = useSpring(rawX, SPRING_CONFIG);
  const smoothY = useSpring(rawY, SPRING_CONFIG);

  // Convert numeric spring values to CSS percentage strings.
  // `useTransform` maps MotionValue<number> → MotionValue<string>
  // so Framer Motion writes e.g. "42.3%" directly to `left` / `top`.
  const left = useTransform(smoothX, (v) => `${v}%`);
  const top = useTransform(smoothY, (v) => `${v}%`);

  // ── rAF tracking loop ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let frameId = 0;

    function track() {
      if (cancelled) return;

      const gesture = gestureRef.current;
      const hands = handsRef.current;
      const video = videoRef.current;

      // Only track position when PINCH gesture is active and hand is detected.
      if (
        gesture === 'PINCH' &&
        hands.length > 0 &&
        video &&
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        const kp4 = hands[0].keypoints[THUMB_TIP];
        const kp8 = hands[0].keypoints[INDEX_TIP];

        if (kp4 && kp8) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;

          // Midpoint between thumb tip and index tip.
          const midX = (kp4.x + kp8.x) / 2;
          const midY = (kp4.y + kp8.y) / 2;

          // CONSTRAINTS §4 — Invert X because the video is mirrored
          // but this card is NOT mirrored (same approach as VirtualCursor).
          const percentX = ((vw - midX) / vw) * 100;
          const percentY = (midY / vh) * 100;

          if (isDraggingRef.current) {
            // Already dragging — update card position to follow pinch.
            rawX.set(percentX);
            rawY.set(percentY);
          } else {
            // Not yet dragging — check if pinch is near the card.
            const dx = percentX - cardRestXRef.current;
            const dy = percentY - cardRestYRef.current;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < HIT_RADIUS) {
              // Grab! Start dragging.
              isDraggingRef.current = true;
              setIsDragging(true);
              rawX.set(percentX);
              rawY.set(percentY);
            }
          }
        }
      } else {
        // Gesture is not PINCH (or no hand/video) — release if dragging.
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragging(false);

          // Remember where the card was released for next grab proximity check.
          cardRestXRef.current = rawX.get();
          cardRestYRef.current = rawY.get();
        }
      }

      frameId = requestAnimationFrame(track);
    }

    frameId = requestAnimationFrame(track);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [handsRef, videoRef, rawX, rawY]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <motion.div
      aria-label="Draggable gesture card"
      className="pointer-events-none absolute z-20 select-none"
      style={{
        left,
        top,
        translateX: '-50%',
        translateY: '-50%',
      }}
      animate={{
        scale: isDragging ? 1.08 : 1,
      }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
      {/* Glow halo -- visible only while dragging */}
      {isDragging && (
        <div className="absolute -inset-3 rounded-xl bg-emerald-400/10 blur-lg sm:-inset-4 sm:rounded-2xl sm:blur-xl" />
      )}

      {/* Card body */}
      <div
        className={`
          relative w-40 rounded-lg p-3 transition-shadow duration-200
          sm:w-48 sm:rounded-xl sm:p-4
          lg:w-52
          ${
            isDragging
              ? 'border border-emerald-500/40 bg-zinc-900 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
              : 'border border-zinc-700 bg-zinc-900/90'
          }
        `}
      >
        {/* Drag handle indicator */}
        <div className="mb-2 flex items-center justify-center sm:mb-3">
          <span
            className={`h-1 w-6 rounded-full transition-colors duration-200 sm:w-8 ${
              isDragging ? 'bg-zinc-500' : 'bg-zinc-600'
            }`}
          />
        </div>

        {/* Card content */}
        <div className="space-y-1 sm:space-y-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300 sm:text-xs">
            Gesture Card
          </h3>
          <p className="text-[10px] text-zinc-500 sm:text-[11px]">
            {isDragging
              ? 'Dragging -- release to drop.'
              : 'Pinch near this card to drag.'}
          </p>
        </div>

        {/* Status dots */}
        <div className="mt-2 flex gap-1 sm:mt-3 sm:gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 w-1 rounded-full transition-colors duration-200 sm:h-1.5 sm:w-1.5 ${
                isDragging ? 'bg-zinc-500' : 'bg-zinc-600'
              }`}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

