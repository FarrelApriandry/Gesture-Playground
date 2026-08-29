/**
 * Gesture Interpreter Engine
 *
 * Takes the raw `Hand[]` output from TF.js HandPose detection and
 * returns a discrete `GestureResult` with name + confidence.
 *
 * CONSTRAINTS §2 — Performance:
 *   This module is pure *logic* — it does NOT touch React state.
 *   The consuming component (webcam-feed.tsx) is responsible for
 *   reading `handsRef` in a rAF loop and only writing to `useState`
 *   when the gesture name *changes* (latch pattern).
 *
 * CONSTRAINTS §4 — Coordinate & Mirroring:
 *   Landmark coordinates are raw TF.js values. The visual mirroring
 *   is handled by CSS `scaleX(-1)` on both <video> and <canvas>, so
 *   double-flip = natural position. No X-inversion is needed here.
 *
 * GESTURES.md §3 — Debounce & Smoothing:
 *   • Hysteresis thresholds for PINCH (start < 0.20, end > 0.30).
 *   • Frame Latching: a gesture must be detected for 3 consecutive
 *     frames before it's considered "active".
 */

import type { Hand } from '@tensorflow-models/hand-pose-detection';
import type { GestureName, GestureResult } from './types';
import {
  getDistance,
  getHandSpan,
  getNormalizedDistance,
  getPinchDistance,
  isFingerExtended,
  WRIST,
  THUMB_TIP,
  INDEX_TIP,
  INDEX_PIP,
  INDEX_MCP,
  MIDDLE_TIP,
  MIDDLE_PIP,
  MIDDLE_MCP,
  RING_TIP,
  RING_PIP,
  RING_MCP,
  PINKY_TIP,
  PINKY_PIP,
  PINKY_MCP,
} from './math';

// ─── Hysteresis & Latch Constants ───────────────────────────────────

/** Pinch normalised-distance threshold to START a pinch. */
const PINCH_START_THRESHOLD = 0.2;
/** Pinch normalised-distance threshold to END a pinch (hysteresis). */
const PINCH_END_THRESHOLD = 0.3;

/** Open palm — minimum normalised distance from wrist to each tip. */
const OPEN_PALM_THRESHOLD = 0.8;

/** Victory — minimum spread between index and middle tips (× handSpan). */
const VICTORY_SPREAD_THRESHOLD = 0.35;

/** Number of consecutive frames a gesture must be detected before it latches. */
const LATCH_FRAME_COUNT = 3;

// ─── Internal state for frame latching & pinch hysteresis ───────────

let _candidateGesture: GestureName = 'NONE';
let _candidateFrames = 0;
let _latchedGesture: GestureName = 'NONE';
let _isPinching = false; // Hysteresis state for pinch

/**
 * Reset the interpreter's internal latching/hysteresis state.
 * Useful if the detection pipeline is paused/resumed.
 */
export function resetInterpreter(): void {
  _candidateGesture = 'NONE';
  _candidateFrames = 0;
  _latchedGesture = 'NONE';
  _isPinching = false;
}

// ─── Individual Gesture Detectors ───────────────────────────────────

/**
 * Detect PINCH gesture (GESTURES.md §2.2).
 *
 * Uses hysteresis:
 *   • Start: normalised distance < PINCH_START_THRESHOLD (0.20)
 *   • End:   normalised distance > PINCH_END_THRESHOLD   (0.30)
 */
function detectPinch(hand: Hand): boolean {
  const dist = getPinchDistance(hand);

  if (_isPinching) {
    // Currently pinching — only release above end threshold
    if (dist > PINCH_END_THRESHOLD) {
      _isPinching = false;
    }
  } else {
    // Not pinching — trigger below start threshold
    if (dist < PINCH_START_THRESHOLD) {
      _isPinching = true;
    }
  }

  return _isPinching;
}

/**
 * Detect VICTORY / Peace gesture (GESTURES.md §2.5).
 *
 * Conditions:
 *   • Index finger extended
 *   • Middle finger extended
 *   • Ring finger folded
 *   • Pinky folded
 *   • Spread between index tip and middle tip > 0.35 × handSpan
 */
function detectVictory(hand: Hand): boolean {
  const indexExtended = isFingerExtended(hand, INDEX_TIP, INDEX_PIP);
  const middleExtended = isFingerExtended(hand, MIDDLE_TIP, MIDDLE_PIP);
  const ringFolded = !isFingerExtended(hand, RING_TIP, RING_PIP);
  const pinkyFolded = !isFingerExtended(hand, PINKY_TIP, PINKY_PIP);

  if (!indexExtended || !middleExtended || !ringFolded || !pinkyFolded) {
    return false;
  }

  const handSpan = getHandSpan(hand);
  if (handSpan === 0) return false;

  const spread = getNormalizedDistance(
    hand.keypoints[INDEX_TIP],
    hand.keypoints[MIDDLE_TIP],
    handSpan,
  );

  return spread > VICTORY_SPREAD_THRESHOLD;
}

/**
 * Detect POINT / Pointer gesture (GESTURES.md §2.1).
 *
 * Conditions:
 *   • Index finger extended: d(8, 0) > d(6, 0)
 *   • Middle finger folded:  tip (12) closer to wrist than knuckle (10)
 *   • Ring finger folded:    tip (16) closer to wrist than knuckle (14)
 *   • Pinky folded:          tip (20) closer to wrist than knuckle (18)
 */
function detectPoint(hand: Hand): boolean {
  const wrist = hand.keypoints[WRIST];
  if (!wrist) return false;

  // Index extended: distance(index_tip, wrist) > distance(index_PIP, wrist)
  const indexExtended = isFingerExtended(hand, INDEX_TIP, INDEX_PIP);
  if (!indexExtended) return false;

  // All other fingers folded
  const middleFolded = !isFingerExtended(hand, MIDDLE_TIP, MIDDLE_PIP);
  const ringFolded = !isFingerExtended(hand, RING_TIP, RING_PIP);
  const pinkyFolded = !isFingerExtended(hand, PINKY_TIP, PINKY_PIP);

  return middleFolded && ringFolded && pinkyFolded;
}

/**
 * Detect FIST / Stop gesture (GESTURES.md §2.4).
 *
 * Conditions:
 *   • All four finger tips are closer to the wrist than their MCP
 *     knuckles — meaning every finger is curled/closed.
 *
 * Note: We check index, middle, ring, pinky (not thumb, which can
 * stick out in a fist).
 */
function detectFist(hand: Hand): boolean {
  const wrist = hand.keypoints[WRIST];
  if (!wrist) return false;

  const indexFolded = !isFingerExtended(hand, INDEX_TIP, INDEX_MCP);
  const middleFolded = !isFingerExtended(hand, MIDDLE_TIP, MIDDLE_MCP);
  const ringFolded = !isFingerExtended(hand, RING_TIP, RING_MCP);
  const pinkyFolded = !isFingerExtended(hand, PINKY_TIP, PINKY_MCP);

  return indexFolded && middleFolded && ringFolded && pinkyFolded;
}

/**
 * Detect OPEN PALM / Reset gesture (GESTURES.md §2.3).
 *
 * Conditions:
 *   • All 5 fingertip-to-wrist distances exceed OPEN_PALM_THRESHOLD (0.8)
 *     after normalisation by hand span.
 */
function detectOpenPalm(hand: Hand): boolean {
  const handSpan = getHandSpan(hand);
  if (handSpan === 0) return false;

  const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
  const wrist = hand.keypoints[WRIST];

  for (const tipIdx of tips) {
    const tip = hand.keypoints[tipIdx];
    if (!tip || !wrist) return false;

    const normDist = getNormalizedDistance(tip, wrist, handSpan);
    if (normDist < OPEN_PALM_THRESHOLD) return false;
  }

  return true;
}

// ─── Confidence Scoring ─────────────────────────────────────────────

/**
 * Calculate a confidence score `[0, 1]` for the given gesture.
 *
 * Uses gesture-specific distance metrics to produce a graded value
 * rather than a binary on/off.
 */
function getConfidence(hand: Hand, gesture: GestureName): number {
  switch (gesture) {
    case 'PINCH': {
      // Closer to 0 distance → higher confidence
      const dist = getPinchDistance(hand);
      return Math.max(0, Math.min(1, 1 - dist / PINCH_END_THRESHOLD));
    }
    case 'OPEN_PALM': {
      const handSpan = getHandSpan(hand);
      if (handSpan === 0) return 0;
      const tips = [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP];
      const wrist = hand.keypoints[WRIST];
      let sum = 0;
      for (const tipIdx of tips) {
        sum += getNormalizedDistance(
          hand.keypoints[tipIdx],
          wrist,
          handSpan,
        );
      }
      const avg = sum / tips.length;
      return Math.min(1, avg / (OPEN_PALM_THRESHOLD * 1.3));
    }
    case 'FIST': {
      const wrist = hand.keypoints[WRIST];
      if (!wrist) return 0;
      let totalRatio = 0;
      const fingers = [
        [INDEX_TIP, INDEX_MCP],
        [MIDDLE_TIP, MIDDLE_MCP],
        [RING_TIP, RING_MCP],
        [PINKY_TIP, PINKY_MCP],
      ] as const;
      for (const [tipIdx, mcpIdx] of fingers) {
        const tipDist = getDistance(hand.keypoints[tipIdx], wrist);
        const mcpDist = getDistance(hand.keypoints[mcpIdx], wrist);
        if (mcpDist > 0) {
          totalRatio += tipDist / mcpDist;
        }
      }
      const avgRatio = totalRatio / fingers.length;
      return Math.max(0, Math.min(1, 1 - avgRatio));
    }
    case 'POINT': {
      const wrist = hand.keypoints[WRIST];
      if (!wrist) return 0;
      const indexTipDist = getDistance(hand.keypoints[INDEX_TIP], wrist);
      const indexPipDist = getDistance(hand.keypoints[INDEX_PIP], wrist);
      if (indexPipDist === 0) return 0.5;
      const ratio = indexTipDist / indexPipDist;
      return Math.min(1, (ratio - 1) * 2 + 0.5);
    }
    case 'VICTORY': {
      const handSpan = getHandSpan(hand);
      if (handSpan === 0) return 0;
      const spread = getNormalizedDistance(
        hand.keypoints[INDEX_TIP],
        hand.keypoints[MIDDLE_TIP],
        handSpan,
      );
      return Math.min(1, spread / (VICTORY_SPREAD_THRESHOLD * 1.5));
    }
    case 'NONE':
    default:
      return 0;
  }
}

// ─── Frame Latch Logic ──────────────────────────────────────────────

/**
 * Apply the 3-frame latch (GESTURES.md §3).
 *
 * A new gesture candidate must be detected for `LATCH_FRAME_COUNT`
 * consecutive frames before it replaces the currently latched gesture.
 * This prevents single-frame noise from causing UI flicker.
 */
function applyLatch(detected: GestureName): GestureName {
  if (detected === _candidateGesture) {
    _candidateFrames++;
  } else {
    _candidateGesture = detected;
    _candidateFrames = 1;
  }

  if (_candidateFrames >= LATCH_FRAME_COUNT) {
    _latchedGesture = _candidateGesture;
  }

  return _latchedGesture;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Main entry point — interpret the current hand detection results and
 * return the active gesture.
 *
 * **Usage from the detection loop:**
 * ```ts
 * const gesture = interpretGesture(handsRef.current);
 * // Only update React state if gesture.name changed (latch pattern).
 * ```
 *
 * @param hands - Array of detected hands from `estimateHands()`.
 *                Only the first hand (index 0) is used.
 * @returns A `GestureResult` with the gesture name and confidence.
 */
export function interpretGesture(hands: Hand[]): GestureResult {
  // No hands detected → reset to NONE
  if (hands.length === 0) {
    _isPinching = false;
    return { name: applyLatch('NONE'), confidence: 0 };
  }

  const hand = hands[0];

  // Detection priority (highest → lowest).
  // Pinch is checked first because it's the most intentional gesture
  // and should take precedence over open-palm or point.
  if (detectPinch(hand)) {
    return { name: applyLatch('PINCH'), confidence: getConfidence(hand, 'PINCH') };
  }

  if (detectVictory(hand)) {
    return { name: applyLatch('VICTORY'), confidence: getConfidence(hand, 'VICTORY') };
  }

  if (detectPoint(hand)) {
    return { name: applyLatch('POINT'), confidence: getConfidence(hand, 'POINT') };
  }

  if (detectFist(hand)) {
    return { name: applyLatch('FIST'), confidence: getConfidence(hand, 'FIST') };
  }

  if (detectOpenPalm(hand)) {
    return { name: applyLatch('OPEN_PALM'), confidence: getConfidence(hand, 'OPEN_PALM') };
  }

  return { name: applyLatch('NONE'), confidence: 0 };
}
