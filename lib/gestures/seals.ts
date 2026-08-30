/**
 * Hand Seal & Stance Geometry Classifiers
 *
 * Pure-math detectors for Naruto hand seals (Tiger, Snake, Monkey) and
 * the Cupped Palm stance. Each function operates on raw `Hand[]` data
 * from TF.js HandPose detection and returns a boolean result.
 *
 * All thresholds are normalised by `handSpan` (Euclidean distance
 * between Landmark 0/Wrist and Landmark 9/Middle MCP) for scale
 * invariance across varying camera distances and hand sizes.
 *
 * JUTSU.md -- Hand Seal Geometric Formulas (non-negotiable thresholds).
 *
 * CONSTRAINTS -- This module is pure logic. It does NOT touch React
 * state, refs, or DOM. Safe to call at 60 FPS inside any rAF loop.
 */

import type { Hand } from '@tensorflow-models/hand-pose-detection';
import {
  getDistance,
  getHandSpan,
  getNormalizedDistance,
  isFingerExtended,
  WRIST,
  THUMB_TIP,
  INDEX_TIP,
  INDEX_MCP,
  MIDDLE_TIP,
  MIDDLE_MCP,
  RING_TIP,
  PINKY_TIP,
} from './math';

// ─── Threshold Constants (from JUTSU.md) ─────────────────────────────

/** Enable debug telemetry logging to console. Set to false for production. */
const DEBUG = true;

/** Tiger Seal -- max normalised distance between left/right index tips. */
const TIGER_INDEX_TIP_THRESHOLD = 0.15;
/** Tiger Seal -- max normalised wrist-to-tip distance for folded/interlocked fingers. */
const TIGER_FOLDED_THRESHOLD = 0.80;

/** Snake Seal -- max normalised wrist-to-wrist distance. */
const SNAKE_WRIST_THRESHOLD = 0.40;
/** Snake Seal -- max normalised MCP9-to-MCP9 distance. */
const SNAKE_MCP9_THRESHOLD = 0.30;
/** Snake Seal -- max normalised index-tip-to-index-tip distance. */
const SNAKE_INDEX_TIP_THRESHOLD = 0.25;

/** Monkey Seal -- max normalised palm-center-to-palm-center distance. */
const MONKEY_PALM_CENTER_THRESHOLD = 0.35;
/** Monkey Seal -- minimum angle (degrees) between wrist-to-MCP9 vectors. */
const MONKEY_ANGLE_MIN = 70;
/** Monkey Seal -- maximum angle (degrees) between wrist-to-MCP9 vectors. */
const MONKEY_ANGLE_MAX = 110;

/** Cupped Palm -- minimum normalised fingertip-to-palm-center distance. */
const CUPPED_MIN_THRESHOLD = 0.45;
/** Cupped Palm -- maximum normalised fingertip-to-palm-center distance. */
const CUPPED_MAX_THRESHOLD = 0.70;

// ─── Helpers ─────────────────────────────────────────────────────────

/** Average hand span across both hands. Returns 0 if < 2 hands. */
function getAverageHandSpan(hands: Hand[]): number {
  if (hands.length < 2) return 0;
  return (getHandSpan(hands[0]) + getHandSpan(hands[1])) / 2;
}

/** Palm center = midpoint(Wrist, Middle MCP). JUTSU.md Cupped Palm condition 2. */
function getPalmCenter(hand: Hand): { x: number; y: number } {
  const wrist = hand.keypoints[WRIST];
  const mcp9 = hand.keypoints[MIDDLE_MCP];
  return { x: (wrist.x + mcp9.x) / 2, y: (wrist.y + mcp9.y) / 2 };
}

/** Check if a fingertip is folded toward the palm (normalised wrist distance < threshold). */
function isFingerFolded(hand: Hand, tipIdx: number, handSpan: number, threshold: number): boolean {
  if (handSpan === 0) return false;
  const tip = hand.keypoints[tipIdx];
  const wrist = hand.keypoints[WRIST];
  if (!tip || !wrist) return false;
  return getDistance(tip, wrist) / handSpan < threshold;
}

// ─── Seal 1: Tiger (Harimau) ─────────────────────────────────────────

/**
 * Detect the Tiger Hand Seal (JUTSU.md -- Seal 1).
 *
 * Both hands pressed together vertically with index fingers and thumbs
 * extended straight up; middle, ring, and pinky interlocked or folded.
 *
 *  1. Both hands detected (hands.length == 2).
 *  2. Index tip normalised distance < 0.15.
 *  3. Both index fingers extended.
 *  4. Middle, ring, pinky tips folded (normalised < 0.80).
 */
export function detectTigerSeal(hands: Hand[]): boolean {
  if (hands.length < 2) return false;

  const [handA, handB] = hands;
  const avgSpan = getAverageHandSpan(hands);
  if (avgSpan === 0) return false;

  // Condition 2
  const indexTipDist = getNormalizedDistance(
    handA.keypoints[INDEX_TIP], handB.keypoints[INDEX_TIP], avgSpan,
  );
  if (indexTipDist >= TIGER_INDEX_TIP_THRESHOLD) {
    if (DEBUG) console.log(`[TIGER] FAIL C2 indexTipDist=${indexTipDist.toFixed(3)} > ${TIGER_INDEX_TIP_THRESHOLD}`);
    return false;
  }

  // Condition 3
  const extA = isFingerExtended(handA, INDEX_TIP, INDEX_MCP);
  const extB = isFingerExtended(handB, INDEX_TIP, INDEX_MCP);
  if (!extA || !extB) {
    if (DEBUG) console.log(`[TIGER] FAIL C3 extended=[${extA},${extB}]`);
    return false;
  }

  // Condition 4
  const handSpanA = getHandSpan(handA);
  const handSpanB = getHandSpan(handB);
  for (const tipIdx of [MIDDLE_TIP, RING_TIP, PINKY_TIP]) {
    const foldA = getDistance(handA.keypoints[tipIdx], handA.keypoints[WRIST]) / handSpanA;
    const foldB = getDistance(handB.keypoints[tipIdx], handB.keypoints[WRIST]) / handSpanB;
    if (foldA >= TIGER_FOLDED_THRESHOLD || foldB >= TIGER_FOLDED_THRESHOLD) {
      if (DEBUG) console.log(`[TIGER] FAIL C4 tip=${tipIdx} foldA=${foldA.toFixed(3)} foldB=${foldB.toFixed(3)} > ${TIGER_FOLDED_THRESHOLD}`);
      return false;
    }
  }

  if (DEBUG) console.log(`[TIGER] PASS indexTipDist=${indexTipDist.toFixed(3)} avgSpan=${avgSpan.toFixed(1)}`);
  return true;
}

// ─── Seal 2: Snake (Ular) ────────────────────────────────────────────

/**
 * Detect the Snake Hand Seal (JUTSU.md -- Seal 2).
 *
 * Both hands clasped together with all fingers tightly interlocked.
 *
 *  1. Both hands detected (hands.length == 2).
 *  2. Wrist-to-wrist normalised distance < 0.40.
 *  3. MCP9-to-MCP9 normalised distance < 0.30.
 *  4. Index tip-to-index tip normalised distance < 0.25.
 */
export function detectSnakeSeal(hands: Hand[]): boolean {
  if (hands.length < 2) return false;

  const [handA, handB] = hands;
  const avgSpan = getAverageHandSpan(hands);
  if (avgSpan === 0) return false;

  // Condition 2
  const wristDist = getNormalizedDistance(handA.keypoints[WRIST], handB.keypoints[WRIST], avgSpan);
  if (wristDist >= SNAKE_WRIST_THRESHOLD) {
    if (DEBUG) console.log(`[SNAKE] FAIL C2 wristDist=${wristDist.toFixed(3)} > ${SNAKE_WRIST_THRESHOLD}`);
    return false;
  }

  // Condition 3
  const mcp9Dist = getNormalizedDistance(handA.keypoints[MIDDLE_MCP], handB.keypoints[MIDDLE_MCP], avgSpan);
  if (mcp9Dist >= SNAKE_MCP9_THRESHOLD) {
    if (DEBUG) console.log(`[SNAKE] FAIL C3 mcp9Dist=${mcp9Dist.toFixed(3)} > ${SNAKE_MCP9_THRESHOLD}`);
    return false;
  }

  // Condition 4
  const indexTipDist = getNormalizedDistance(handA.keypoints[INDEX_TIP], handB.keypoints[INDEX_TIP], avgSpan);
  if (indexTipDist >= SNAKE_INDEX_TIP_THRESHOLD) {
    if (DEBUG) console.log(`[SNAKE] FAIL C4 indexTipDist=${indexTipDist.toFixed(3)} > ${SNAKE_INDEX_TIP_THRESHOLD}`);
    return false;
  }

  if (DEBUG) console.log(`[SNAKE] PASS wrist=${wristDist.toFixed(3)} mcp9=${mcp9Dist.toFixed(3)} indexTip=${indexTipDist.toFixed(3)} avgSpan=${avgSpan.toFixed(1)}`);
  return true;
}

// ─── Seal 3: Monkey (Monyet) ─────────────────────────────────────────

/**
 * Detect the Monkey Hand Seal (JUTSU.md -- Seal 3).
 *
 * One hand rests horizontally flat over the back of the other hand
 * with elbows flared horizontally.
 *
 *  1. Both hands detected (hands.length == 2).
 *  2. Palm center normalised distance < 0.35.
 *  3. Wrist-to-MCP9 vectors perpendicular (70--110 degrees).
 *  4. All five fingertips of Hand A are extended.
 */
export function detectMonkeySeal(hands: Hand[]): boolean {
  if (hands.length < 2) return false;

  const [handA, handB] = hands;
  const avgSpan = getAverageHandSpan(hands);
  if (avgSpan === 0) return false;

  // Condition 2 -- palm centers are close
  const palmA = getPalmCenter(handA);
  const palmB = getPalmCenter(handB);
  const palmDist = Math.sqrt((palmA.x - palmB.x) ** 2 + (palmA.y - palmB.y) ** 2) / avgSpan;
  if (palmDist >= MONKEY_PALM_CENTER_THRESHOLD) return false;

  // Condition 3 -- perpendicular orientation vectors
  const vecA = {
    x: handA.keypoints[MIDDLE_MCP].x - handA.keypoints[WRIST].x,
    y: handA.keypoints[MIDDLE_MCP].y - handA.keypoints[WRIST].y,
  };
  const vecB = {
    x: handB.keypoints[MIDDLE_MCP].x - handB.keypoints[WRIST].x,
    y: handB.keypoints[MIDDLE_MCP].y - handB.keypoints[WRIST].y,
  };
  const dot = vecA.x * vecB.x + vecA.y * vecB.y;
  const magA = Math.sqrt(vecA.x ** 2 + vecA.y ** 2);
  const magB = Math.sqrt(vecB.x ** 2 + vecB.y ** 2);
  if (magA === 0 || magB === 0) return false;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)));
  const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
  if (angleDeg < MONKEY_ANGLE_MIN || angleDeg > MONKEY_ANGLE_MAX) return false;

  // Condition 4 -- all five fingertips of Hand A extended
  for (const [tipIdx, mcpIdx] of [
    [INDEX_TIP, INDEX_MCP],
    [MIDDLE_TIP, MIDDLE_MCP],
    [RING_TIP, MIDDLE_MCP],
    [PINKY_TIP, MIDDLE_MCP],
  ] as const) {
    if (!isFingerExtended(handA, tipIdx, mcpIdx)) return false;
  }

  return true;
}

// ─── Stance: Cupped Palm (Menadah) ───────────────────────────────────

/**
 * Detect the Cupped Palm stance (JUTSU.md -- Stance).
 *
 * A single hand formed into a bowl/cupped shape facing forward,
 * ready to contain and propel the spinning Rasengan chakra ball.
 *
 *  1. Hand is detected.
 *  2. PalmCenter = midpoint(LM0, LM9).
 *  3. All five fingertips in concave range:
 *     0.45 < normalisedDistance(Tip_i, PalmCenter) < 0.70
 */
export function detectCuppedPalm(hand: Hand): boolean {
  const handSpan = getHandSpan(hand);
  if (handSpan === 0) return false;

  const palmCenter = getPalmCenter(hand);

  for (const tipIdx of [THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]) {
    const tip = hand.keypoints[tipIdx];
    if (!tip) return false;

    const dist = Math.sqrt(
      (tip.x - palmCenter.x) ** 2 + (tip.y - palmCenter.y) ** 2,
    ) / handSpan;

    if (dist < CUPPED_MIN_THRESHOLD || dist > CUPPED_MAX_THRESHOLD) return false;
  }

  return true;
}

// ─── Palm Center Export ───────────────────────────────────────────────

/**
 * Get the palm center coordinates for a hand.
 * Used by the Rasengan particle system to lock the chakra ball position.
 */
export { getPalmCenter };

