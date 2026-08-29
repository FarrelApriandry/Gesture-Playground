/**
 * Minimal shim for `@mediapipe/hands`.
 *
 * The `@tensorflow-models/hand-pose-detection` ESM bundle has a top-level
 * `import { Hands } from "@mediapipe/hands"` even when the TFJS runtime is
 * used. The real `@mediapipe/hands` package is a Google Closure-compiled blob
 * without standard ESM exports, which causes Turbopack (Next.js) build errors.
 *
 * This shim satisfies the static import so the bundle compiles. The `Hands`
 * class is never instantiated because the detector is configured with
 * `runtime: 'tfjs'`.
 */
export class Hands {
  /** No-op constructor — this class is never used at runtime. */
  constructor() {
    // intentionally empty
  }
}
