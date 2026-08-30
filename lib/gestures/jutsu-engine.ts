/**
 * Jutsu Combo Engine -- Finite State Machine
 *
 * Implements the Naruto Jutsu combo sequence: Tiger -> Snake -> Monkey
 * with a Cupped Palm activation trigger.
 *
 * FSM States (JUTSU.md):
 *   IDLE -> RECORDING_SEQUENCE -> RASENGAN_PRIMED -> RASENGAN_ACTIVE -> IDLE
 *
 * Timing Rules (JUTSU.md):
 *   - 3000ms combo window timeout between consecutive seals.
 *   - 3-frame latching per seal detection (debounce).
 *   - 200ms lockout after registering a seal (prevents duplicates).
 *
 * CONSTRAINTS: Pure logic module. Does NOT touch React state directly.
 */

import type { Hand } from '@tensorflow-models/hand-pose-detection';
import {
  detectTigerSeal,
  detectSnakeSeal,
  detectMonkeySeal,
  detectCuppedPalm,
  getPalmCenter,
} from './seals';

// ─── Types ───────────────────────────────────────────────────────────

export type JutsuState = 'IDLE' | 'RECORDING_SEQUENCE' | 'RASENGAN_PRIMED' | 'RASENGAN_ACTIVE';

type SealStep = 'TIGER' | 'SNAKE' | 'MONKEY';

export interface JutsuTickResult {
  state: JutsuState;
  comboProgress: number;
  palmCenter: { x: number; y: number } | null;
}

// ─── Constants ───────────────────────────────────────────────────────

const COMBO_WINDOW_MS = 3000;
const LATCH_FRAME_COUNT = 3;
const DEBOUNCE_LOCKOUT_MS = 200;

/** Maximum consecutive null frames before the latch candidate is discarded. */
const NULL_TOLERANCE = 2;

/** Enable debug telemetry logging to console. Set to false for production. */
const DEBUG = true;

// ─── Engine State ────────────────────────────────────────────────────

let _state: JutsuState = 'IDLE';
let _currentStep: SealStep = 'TIGER';
let _comboProgress = 0;
let _lastSealTime = 0;
let _lastRegisterTime = 0;
let _candidateSeal: SealStep | null = null;
let _candidateFrames = 0;
let _nullFrameCount = 0;
let _palmCenter: { x: number; y: number } | null = null;

function resetEngine(): void {
  _state = 'IDLE';
  _currentStep = 'TIGER';
  _comboProgress = 0;
  _lastSealTime = 0;
  _lastRegisterTime = 0;
  _candidateSeal = null;
  _candidateFrames = 0;
  _nullFrameCount = 0;
  _palmCenter = null;
}

// ─── Internal Helpers ────────────────────────────────────────────────

/**
 * Decay-tolerant frame latch.
 *
 * Instead of hard-resetting on a single null frame, tolerates up to
 * NULL_TOLERANCE consecutive null frames before discarding the candidate.
 * This prevents transient detection noise from resetting the accumulation.
 */
function applySealLatch(detected: SealStep | null): SealStep | null {
  if (detected === null) {
    _nullFrameCount++;
    if (_nullFrameCount > NULL_TOLERANCE) {
      // Exceeded tolerance -- discard candidate entirely
      if (DEBUG && _candidateSeal !== null) {
        console.log(`[LATCH] DISCARD candidate=${_candidateSeal} frames=${_candidateFrames} nullFrames=${_nullFrameCount}`);
      }
      _candidateSeal = null;
      _candidateFrames = 0;
      _nullFrameCount = 0;
    }
    return null;
  }

  // A seal was detected -- reset null counter
  _nullFrameCount = 0;

  if (detected === _candidateSeal) {
    _candidateFrames++;
  } else {
    if (DEBUG && _candidateSeal !== null) {
      console.log(`[LATCH] SWITCH ${_candidateSeal}(${_candidateFrames}f) -> ${detected}`);
    }
    _candidateSeal = detected;
    _candidateFrames = 1;
  }

  if (_candidateFrames >= LATCH_FRAME_COUNT) {
    if (DEBUG) console.log(`[LATCH] FIRED seal=${_candidateSeal} frames=${_candidateFrames}`);
    return _candidateSeal;
  }
  return null;
}

function detectCurrentSeal(hands: Hand[]): SealStep | null {
  if (hands.length < 2) {
    if (DEBUG) console.log(`[SEAL] hands=${hands.length} -> SKIP (need 2)`);
    return null;
  }
  if (detectTigerSeal(hands)) return 'TIGER';
  if (detectSnakeSeal(hands)) return 'SNAKE';
  if (detectMonkeySeal(hands)) return 'MONKEY';
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────

/** Reset the Jutsu engine to its initial state. */
export function resetJutsuEngine(): void {
  resetEngine();
}

/**
 * Evaluate one frame of the Jutsu combo system.
 * Call inside requestAnimationFrame, passing handsRef.current.
 */
export function tickJutsuEngine(hands: Hand[], now: number): JutsuTickResult {
  // RASENGAN_ACTIVE -- check if cupped palm is still held
  if (_state === 'RASENGAN_ACTIVE') {
    let cuppedHand: Hand | null = null;
    for (const hand of hands) {
      if (detectCuppedPalm(hand)) { cuppedHand = hand; break; }
    }
    if (cuppedHand) {
      _palmCenter = getPalmCenter(cuppedHand);
      return { state: 'RASENGAN_ACTIVE', comboProgress: 3, palmCenter: _palmCenter };
    }
    resetEngine();
    return { state: 'IDLE', comboProgress: 0, palmCenter: null };
  }

  // Combo window timeout
  if (_state === 'RECORDING_SEQUENCE' && _lastSealTime > 0) {
    if (now - _lastSealTime > COMBO_WINDOW_MS) {
      resetEngine();
      return { state: 'IDLE', comboProgress: 0, palmCenter: null };
    }
  }

  // Debounce lockout
  if (now - _lastRegisterTime < DEBOUNCE_LOCKOUT_MS) {
    return { state: _state, comboProgress: _comboProgress, palmCenter: null };
  }

  // Detect and latch seal
  const detected = detectCurrentSeal(hands);
  const latched = applySealLatch(detected);

  if (latched !== null && latched === _currentStep) {
    _lastRegisterTime = now;
    _lastSealTime = now;
    _candidateSeal = null;
    _candidateFrames = 0;

    switch (_currentStep) {
      case 'TIGER':
        _state = 'RECORDING_SEQUENCE';
        _comboProgress = 1;
        _currentStep = 'SNAKE';
        break;
      case 'SNAKE':
        _comboProgress = 2;
        _currentStep = 'MONKEY';
        break;
      case 'MONKEY':
        _comboProgress = 3;
        _state = 'RASENGAN_PRIMED';
        _currentStep = 'TIGER';
        break;
    }
  }

  // RASENGAN_PRIMED -- check for cupped palm activation
  if (_state === 'RASENGAN_PRIMED') {
    for (const hand of hands) {
      if (detectCuppedPalm(hand)) {
        _state = 'RASENGAN_ACTIVE';
        _palmCenter = getPalmCenter(hand);
        return { state: 'RASENGAN_ACTIVE', comboProgress: 3, palmCenter: _palmCenter };
      }
    }
  }

  return { state: _state, comboProgress: _comboProgress, palmCenter: null };
}
