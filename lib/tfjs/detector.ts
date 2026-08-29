import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import type { HandDetector } from '@tensorflow-models/hand-pose-detection';

let detectorInstance: HandDetector | null = null;

/**
 * Return the singleton HandDetector instance.
 * Creates it on first call; subsequent calls return the cached instance.
 * Call `initTensorFlow()` first to ensure the WebGL backend is ready.
 */
export async function getDetector(): Promise<HandDetector> {
  if (detectorInstance) {
    return detectorInstance;
  }

  detectorInstance = await handPoseDetection.createDetector(
    handPoseDetection.SupportedModels.MediaPipeHands,
    {
      runtime: 'tfjs',
      modelType: 'full',
      maxHands: 1,
    },
  );

  return detectorInstance;
}

/**
 * Dispose the singleton detector and release GPU memory.
 * Safe to call even if no detector was created.
 */
export function disposeDetector(): void {
  if (detectorInstance) {
    detectorInstance.dispose();
    detectorInstance = null;
  }
}
