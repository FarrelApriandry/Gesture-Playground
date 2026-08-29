import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';

/**
 * Initialise TensorFlow.js with the WebGL backend.
 * Must be called (and awaited) before any model inference.
 */
export async function initTensorFlow(): Promise<void> {
  try {
    // Ensure TF.js runtime is fully initialised first
    await tf.ready();

    // Attempt to set WebGL as the compute backend
    const success = await tf.setBackend('webgl');
    if (!success) {
      throw new Error(
        'WebGL backend could not be registered. ' +
          'Your browser or device may not support WebGL.',
      );
    }

    console.log('TensorFlow WebGL ready');
  } catch (err) {
    console.error('[TensorFlow] Failed to initialise WebGL backend:', err);
    throw err;
  }
}
