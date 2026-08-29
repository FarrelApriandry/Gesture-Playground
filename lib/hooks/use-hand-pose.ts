'use client';

import { useEffect, useRef, useState } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import { getDetector } from '@/lib/tfjs/detector';

interface UseHandPoseParams {
  /** Ref to the <video> element whose frames will be analysed. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** When `false` the detection loop is paused and no GPU work is done. */
  isEnabled?: boolean;
}

interface UseHandPoseReturn {
  /** Latest detected hands (up to 1). Updated at ~60 FPS via ref — does NOT trigger React re-renders. */
  handsRef: React.RefObject<Hand[]>;
  /** `true` while the requestAnimationFrame loop is actively running. */
  isDetecting: boolean;
  /** Human-readable error if the detector could not be created. */
  error: string | null;
  /**
   * Current inference FPS (frames per second) calculated from delta time
   * between consecutive `estimateHands()` completions. Updated via ref
   * inside the rAF loop — does NOT trigger React re-renders.
   */
  fpsRef: React.RefObject<number>;
  /**
   * Duration (ms) of the most recent `estimateHands()` call.
   * Measured with `performance.now()` — updated via ref, no re-renders.
   */
  latencyRef: React.RefObject<number>;
}

/**
 * Runs a `requestAnimationFrame` detection loop that feeds video frames to the
 * TensorFlow.js HandPose detector.
 *
 * **CONSTRAINTS §2 — Performance:**
 * - Detection results are written to `handsRef` (a `useRef`), never to `useState`,
 *   so the 60 FPS loop does **not** trigger React re-renders.
 *
 * **CONSTRAINTS §3 — Lifecycle:**
 * - Uses the singleton `getDetector()` so the model is loaded only once.
 * - Cancels the rAF handle on unmount to stop the loop cleanly.
 * - An `isProcessingRef` guard prevents stacking multiple in-flight
 *   `estimateHands()` calls that would overflow the WebGL GPU pipeline.
 *
 * @example
 * ```tsx
 * const videoRef = useRef<HTMLVideoElement>(null);
 * const { handsRef, isDetecting, error, fpsRef, latencyRef } = useHandPose({ videoRef, isEnabled: true });
 * ```
 */
export function useHandPose({
  videoRef,
  isEnabled = true,
}: UseHandPoseParams): UseHandPoseReturn {
  const handsRef = useRef<Hand[]>([]);
  const requestRef = useRef<number>(0);
  const isProcessingRef = useRef(false);

  // ── Performance timing refs (CONSTRAINTS §2 — no re-renders) ───────
  /** Inference FPS calculated from delta time between detection frames. */
  const fpsRef = useRef<number>(0);
  /** Duration (ms) of the most recent estimateHands() call. */
  const latencyRef = useRef<number>(0);
  /** Timestamp of the previous detection completion (for FPS calculation). */
  const lastDetectionTimeRef = useRef<number>(0);

  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      setIsDetecting(false);
      return;
    }

    let cancelled = false;

    async function startDetection() {
      try {
        const detector = await getDetector();
        if (cancelled) return;

        setIsDetecting(true);

        async function detect() {
          if (cancelled) return;

          const video = videoRef.current;

          if (
            video &&
            video.readyState === HTMLMediaElement.HAVE_ENOUGH_DATA &&
            video.videoWidth > 0 &&
            video.videoHeight > 0 &&
            !isProcessingRef.current
          ) {
            isProcessingRef.current = true;

            try {
              const inferStart = performance.now();
              const hands = await detector.estimateHands(video);
              const inferEnd = performance.now();

              if (!cancelled) {
                handsRef.current = hands ?? [];

                // ── Update latency ref (CONSTRAINTS §2 — ref only, no setState) ──
                latencyRef.current = inferEnd - inferStart;

                // ── Update FPS ref from delta time between detections ────────────
                const now = performance.now();
                if (lastDetectionTimeRef.current > 0) {
                  const deltaMs = now - lastDetectionTimeRef.current;
                  if (deltaMs > 0) {
                    // Exponential moving average for smooth display
                    const instantFps = 1000 / deltaMs;
                    fpsRef.current =
                      fpsRef.current === 0
                        ? instantFps
                        : fpsRef.current * 0.8 + instantFps * 0.2;
                  }
                }
                lastDetectionTimeRef.current = now;
              }
            } catch (err) {
              // CRITICAL: on any detection error (e.g. dark/closed frame),
              // always reset to empty so downstream readers see "no hands".
              if (!cancelled) {
                handsRef.current = [];
              }
              console.warn('[useHandPose] Detection skipped frame:', err);
            } finally {
              isProcessingRef.current = false;
            }
          }

          requestRef.current = requestAnimationFrame(detect);
        }

        requestRef.current = requestAnimationFrame(detect);
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof Error
            ? err.message
            : 'Failed to initialise hand-pose detector.';

        setError(message);
        console.error('[useHandPose] Detector init error:', err);
      }
    }

    startDetection();

    return () => {
      cancelled = true;
      cancelAnimationFrame(requestRef.current);
      setIsDetecting(false);
    };
  }, [videoRef, isEnabled]);

  return { handsRef, isDetecting, error, fpsRef, latencyRef };
}
