'use client';

/**
 * Jutsu Engine Hook
 *
 * Runs a requestAnimationFrame loop that evaluates the Jutsu FSM
 * (Tiger -> Snake -> Monkey -> Cupped Palm) on every frame.
 *
 * Only triggers a React re-render on discrete FSM state transitions
 * (IDLE -> RECORDING_SEQUENCE -> RASENGAN_PRIMED -> RASENGAN_ACTIVE).
 *
 * CONSTRAINTS §2: The rAF loop reads handsRef (a ref) -- never writes
 * to any useState on every frame. Only the latched state change triggers
 * a state update.
 */

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import {
  tickJutsuEngine,
  resetJutsuEngine,
  type JutsuState,
} from '@/lib/gestures/jutsu-engine';

// -- Types -------------------------------------------------------------------

interface UseJutsuEngineParams {
  handsRef: RefObject<Hand[]>;
  isDetecting: boolean;
}

interface UseJutsuEngineReturn {
  /** Current FSM state. Only changes on discrete transitions. */
  jutsuState: JutsuState;
  /** Ref mirror of jutsuState for reading inside rAF loops without re-renders. */
  jutsuStateRef: RefObject<JutsuState>;
  /** Combo progress 0-3 seals completed. */
  comboProgress: number;
  /** Ref mirror of comboProgress. */
  comboProgressRef: RefObject<number>;
  /** Palm center when RASENGAN_ACTIVE, otherwise null. */
  palmCenterRef: RefObject<{ x: number; y: number } | null>;
}

// -- Hook --------------------------------------------------------------------

export function useJutsuEngine({
  handsRef,
  isDetecting,
}: UseJutsuEngineParams): UseJutsuEngineReturn {
  const [jutsuState, setJutsuState] = useState<JutsuState>('IDLE');
  const [comboProgress, setComboProgress] = useState(0);

  const jutsuStateRef = useRef<JutsuState>('IDLE');
  const comboProgressRef = useRef(0);
  const palmCenterRef = useRef<{ x: number; y: number } | null>(null);
  const latchRef = useRef<JutsuState>('IDLE');

  useEffect(() => {
    if (!isDetecting) {
      resetJutsuEngine();
      setJutsuState('IDLE');
      setComboProgress(0);
      jutsuStateRef.current = 'IDLE';
      comboProgressRef.current = 0;
      palmCenterRef.current = null;
      latchRef.current = 'IDLE';
      return;
    }

    let cancelled = false;
    let frameId = 0;

    function poll() {
      if (cancelled) return;

      const result = tickJutsuEngine(handsRef.current, performance.now());

      // Update refs every frame (zero re-render cost)
      jutsuStateRef.current = result.state;
      comboProgressRef.current = result.comboProgress;
      palmCenterRef.current = result.palmCenter;

      // Only trigger React re-render on discrete state transition
      if (result.state !== latchRef.current) {
        latchRef.current = result.state;
        setJutsuState(result.state);
        setComboProgress(result.comboProgress);
      }

      frameId = requestAnimationFrame(poll);
    }

    frameId = requestAnimationFrame(poll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      resetJutsuEngine();
    };
  }, [isDetecting, handsRef]);

  return { jutsuState, jutsuStateRef, comboProgress, comboProgressRef, palmCenterRef };
}
