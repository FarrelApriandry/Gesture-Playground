/**
 * Pure math utilities for 2D/3D hand-landmark geometry.
 *
 * Every function here is side-effect-free and depends only on the
 * `Keypoint` / `Hand` types from `@tensorflow-models/hand-pose-detection`.
 *
 * CONSTRAINTS §4 — Coordinate & Mirroring Rules:
 * The video feed is mirrored via CSS `scaleX(-1)`, and the canvas overlay
 * uses the same transform so the two flips cancel out.  This means the
 * raw (x, y) landmark coordinates from TF.js already correspond to the
 * correct on-screen pixel position — **no manual X-inversion is needed
 * inside these math helpers**.  X-inversion is only applied at the very
 * end when mapping to screen-space cursors (Phase 4).
 */

import type { Keypoint } from '@tensorflow-models/hand-pose-detection';
import type { Hand } from '@tensorflow-models/hand-pose-detection';

// ─── Landmark index constants (MediaPipe Hands – 21 points) ─────────
export const WRIST = 0;

// Thumb
export const THUMB_CMC = 1;
export const THUMB_MCP = 2;
export const THUMB_IP = 3;
export const THUMB_TIP = 4;

// Index finger
export const INDEX_MCP = 5;
export const INDEX_PIP = 6;
export const INDEX_DIP = 7;
export const INDEX_TIP = 8;

// Middle finger
export const MIDDLE_MCP = 9;
export const MIDDLE_PIP = 10;
export const MIDDLE_DIP = 11;
export const MIDDLE_TIP = 12;

// Ring finger
export const RING_MCP = 13;
export const RING_PIP = 14;
export const RING_DIP = 15;
export const RING_TIP = 16;

// Pinky
export const PINKY_MCP = 17;
export const PINKY_PIP = 18;
export const PINKY_DIP = 19;
export const PINKY_TIP = 20;

// ─────────────────────────────────────────────────────────────────────
// 1. Euclidean Distance (2D)
// ─────────────────────────────────────────────────────────────────────

/**
 * 2D Euclidean distance between two keypoints.
 *
 *   d = √((x₂ − x₁)² + (y₂ − y₁)²)
 */
export function getDistance(p1: Keypoint, p2: Keypoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─────────────────────────────────────────────────────────────────────
// 2. Angle at vertex (degrees)
// ─────────────────────────────────────────────────────────────────────

/**
 * Angle (in degrees) formed at `vertex` by the segments
 * `vertex → p1` and `vertex → p2`.
 *
 * Uses `atan2` for numerical stability:
 *   θ = atan2(|cross|, dot)   then convert rad → deg
 */
export function getAngle(
  p1: Keypoint,
  vertex: Keypoint,
  p2: Keypoint,
): number {
  const v1x = p1.x - vertex.x;
  const v1y = p1.y - vertex.y;
  const v2x = p2.x - vertex.x;
  const v2y = p2.y - vertex.y;

  const dot = v1x * v2x + v1y * v2y;
  const cross = v1x * v2y - v1y * v2x;

  const rad = Math.atan2(Math.abs(cross), dot);
  return (rad * 180) / Math.PI;
}

// ─────────────────────────────────────────────────────────────────────
// 3. Hand Span (normalisation reference length)
// ─────────────────────────────────────────────────────────────────────

/**
 * "Hand Span" — the reference distance used for scale-invariant
 * normalisation (GESTURES.md §1B).
 *
 * Defined as the Euclidean distance between:
 *   • Landmark 0  (Wrist)
 *   • Landmark 9  (Middle MCP)
 */
export function getHandSpan(hand: Hand): number {
  return getDistance(hand.keypoints[WRIST], hand.keypoints[MIDDLE_MCP]);
}

// ─────────────────────────────────────────────────────────────────────
// 4. Normalised Distance (scale-invariant)
// ─────────────────────────────────────────────────────────────────────

/**
 * Euclidean distance between two keypoints divided by `handSpan`,
 * making it invariant to how close/far the hand is from the camera.
 *
 *   normalised = d(p1, p2) / handSpan
 *
 * Returns `0` when `handSpan` is zero (degenerate case — hand not
 * detected properly).
 */
export function getNormalizedDistance(
  p1: Keypoint,
  p2: Keypoint,
  handSpan: number,
): number {
  if (handSpan === 0) return 0;
  return getDistance(p1, p2) / handSpan;
}

// ─────────────────────────────────────────────────────────────────────
// 5. Finger Extension Detection
// ─────────────────────────────────────────────────────────────────────

/**
 * Determines whether a finger is "extended" (straight / pointing).
 *
 * Rule (GESTURES.md §2):
 *   A finger is extended when its TIP is farther from the WRIST than
 *   its PIP joint (the joint closest to the palm).
 *
 * This is a simple but robust heuristic that works across varying hand
 * sizes and camera distances because we compare raw distances on the
 * same hand — no normalisation needed.
 *
 * @param hand     - The detected hand.
 * @param tipIdx   - Landmark index of the finger tip (e.g. 8 for index).
 * @param pipIdx   - Landmark index of the finger PIP joint (e.g. 6 for index).
 */
export function isFingerExtended(
  hand: Hand,
  tipIdx: number,
  pipIdx: number,
): boolean {
  const wrist = hand.keypoints[WRIST];
  const tip = hand.keypoints[tipIdx];
  const pip = hand.keypoints[pipIdx];

  if (!wrist || !tip || !pip) return false;

  return getDistance(tip, wrist) > getDistance(pip, wrist);
}

// ─────────────────────────────────────────────────────────────────────
// 6. Pinch Distance (Thumb Tip ↔ Index Tip, normalised)
// ─────────────────────────────────────────────────────────────────────

/**
 * Normalised distance between Thumb Tip (landmark 4) and Index Tip
 * (landmark 8).
 *
 * This is the primary metric for the PINCH gesture
 * (GESTURES.md §2.2).
 *
 * Returns a value in approximately `[0, 1+]` where:
 *   < 0.20 → strong pinch  (start threshold)
 *   < 0.25 → pinch (spec threshold)
 *   > 0.30 → not pinching  (end / hysteresis threshold)
 */
export function getPinchDistance(hand: Hand): number {
  const handSpan = getHandSpan(hand);
  return getNormalizedDistance(
    hand.keypoints[THUMB_TIP],
    hand.keypoints[INDEX_TIP],
    handSpan,
  );
}
