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
 * const { handsRef, isDetecting, error } = useHandPose({ videoRef, isEnabled: true });
 * ```
 */
export function useHandPose({
  videoRef,
  isEnabled = true,
}: UseHandPoseParams): UseHandPoseReturn {
  const handsRef = useRef<Hand[]>([]);
  const requestRef = useRef<number>(0);
  const isProcessingRef = useRef(false);

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
              const hands = await detector.estimateHands(video);
              if (hands && hands.length > 0) {
                console.log('[useHandPose] Raw hand detected:', hands);
              }
              if (!cancelled) {
                handsRef.current = hands ?? [];
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

  return { handsRef, isDetecting, error };
}
