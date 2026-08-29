/**
 * Type definitions for the Gesture Engine.
 *
 * These types are the shared contract between the math primitives,
 * the interpreter, and any consuming UI component.
 */

/** All recognisable discrete gestures the engine can output. */
export type GestureName =
  | 'OPEN_PALM'
  | 'FIST'
  | 'PINCH'
  | 'POINT'
  | 'VICTORY'
  | 'NONE';

/** Result returned by the gesture interpreter on every evaluation. */
export interface GestureResult {
  /** The detected gesture (or `'NONE'` when no gesture matches). */
  name: GestureName;
  /** Confidence score in the range `[0, 1]`. */
  confidence: number;
}

/**
 * Human-readable display names for each gesture.
 */
export const GESTURE_DISPLAY_NAME: Record<GestureName, string> = {
  OPEN_PALM: 'Open Palm',
  FIST: 'Closed Fist',
  PINCH: 'Pinch',
  POINT: 'Pointing',
  VICTORY: 'Victory',
  NONE: 'None',
};
