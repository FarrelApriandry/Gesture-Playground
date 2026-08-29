'use client';

/**
 * Gesture Detection Hook
 *
 * Runs a requestAnimationFrame loop that reads `handsRef` and evaluates
 * the gesture interpreter, but only triggers a React re-render when the
 * detected gesture *changes* (latch pattern). This limits React renders
 * to discrete transitions only.
 *
 * CONSTRAINTS §2: The rAF loop reads handsRef (a ref) -- never writes
 * to any useState on every frame. Only the latched gesture change triggers
 * a state update.
 */

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import { interpretGesture } from '@/lib/gestures/interpreter';
import type { GestureName } from '@/lib/gestures/types';

// -- Params & Return ---------------------------------------------------------

interface UseGestureDetectionParams {
  /** Ref to the latest detected hands (updated ~60 FPS by useHandPose). */
  handsRef: RefObject<Hand[]>;
  /** Whether detection is currently active. */
  isDetecting: boolean;
}

interface UseGestureDetectionReturn {
  /** Current latched gesture name. Only changes on discrete transitions. */
  gestureName: GestureName;
  /**
   * Ref mirror of `gestureName`. Written at the same time as the state
   * update so it's always in sync. Read by components via ref -- no
   * extra re-renders.
   */
  gestureNameRef: RefObject<GestureName>;
}

// -- Hook --------------------------------------------------------------------

export function useGestureDetection({
  handsRef,
  isDetecting,
}: UseGestureDetectionParams): UseGestureDetectionReturn {
  const [gestureName, setGestureName] = useState<GestureName>('NONE');
  const gestureLatchRef = useRef<GestureName>('NONE');
  const gestureNameRef = useRef<GestureName>('NONE');

  useEffect(() => {
    if (!isDetecting) return;

    let cancelled = false;
    let frameId = 0;

    function poll() {
      if (cancelled) return;

      const result = interpretGesture(handsRef.current);

      // Only trigger a React re-render when the latched gesture changes
      if (result.name !== gestureLatchRef.current) {
        gestureLatchRef.current = result.name;
        gestureNameRef.current = result.name;
        setGestureName(result.name);
      }

      frameId = requestAnimationFrame(poll);
    }

    frameId = requestAnimationFrame(poll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [isDetecting, handsRef]);

  return { gestureName, gestureNameRef };
}