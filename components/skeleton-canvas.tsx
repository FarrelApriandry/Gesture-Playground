'use client';

import { useEffect, useRef } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';

interface SkeletonCanvasProps {
  /** Ref to the latest detected hands (updated ~60 FPS by useHandPose). */
  handsRef: React.RefObject<Hand[]>;
  /** Ref to the video element — used to read videoWidth/videoHeight each frame. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * MediaPipe Hands landmark connections (20 bones).
 * Each pair is a [from, to] index into the 21-keypoint array.
 *
 * 0=wrist, 1–4=thumb, 5–8=index, 9–12=middle, 13–16=ring, 17–20=pinky
 */
const CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm base
  [0, 17],
];

/** Base sizes (scaled dynamically relative to video width). */
const BASE_VIDEO_WIDTH = 640;
const DOT_RADIUS_BASE = 5;
const LINE_WIDTH_BASE = 2;

/** Blue accent -- cohesive with the dark UI. */
const DOT_COLOR = '#a1a1aa';
const LINE_COLOR = '#a1a1aa';

/**
 * Transparent canvas overlay that draws hand skeleton landmarks on top of the
 * mirrored webcam feed.
 *
 * **Direct Match Overlay approach:**
 * - Canvas pixel resolution is synced 1:1 with `video.videoWidth` ×
 *   `video.videoHeight` inside the rAF draw loop. This means TF.js landmark
 *   coordinates can be drawn directly without any manual scaling math.
 * - Both `<video>` and `<canvas>` carry `transform: scaleX(-1)` via CSS,
 *   so the double-flip cancels out — raw (x, y) coordinates paint at the
 *   correct position (CONSTRAINTS §4).
 *
 * Uses its own `requestAnimationFrame` loop that reads `handsRef.current`
 * (never triggers React re-renders — CONSTRAINTS §2).
 */
export default function SkeletonCanvas({
  handsRef,
  videoRef,
}: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing loop — reads handsRef at ~60 FPS.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let frameId = 0;

    function draw() {
      if (cancelled) return;

      const video = videoRef.current;
      const hands = handsRef.current;

      // --- Fail-safe: sync canvas resolution with video native size ---
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas!.width !== video.videoWidth) {
          canvas!.width = video.videoWidth;
        }
        if (canvas!.height !== video.videoHeight) {
          canvas!.height = video.videoHeight;
        }
      } else {
        // Video not ready yet — skip this frame entirely.
        frameId = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (hands.length > 0) {
        // Scale drawing sizes proportionally to video width
        // so skeleton looks correct on both desktop (1280px) and mobile (320px).
        const scale = canvas!.width / BASE_VIDEO_WIDTH;
        const dotRadius = DOT_RADIUS_BASE * scale;
        const lineWidth = LINE_WIDTH_BASE * scale;

        // Coordinates are 1:1 with canvas pixels — no scaling needed.
        for (const hand of hands) {
          const kp = hand.keypoints;

          // Draw connections (bones).
          ctx!.strokeStyle = LINE_COLOR;
          ctx!.lineWidth = lineWidth;
          ctx!.beginPath();
          for (const [from, to] of CONNECTIONS) {
            const a = kp[from];
            const b = kp[to];
            if (!a || !b) continue;
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
          }
          ctx!.stroke();

          // Draw landmark dots.
          ctx!.fillStyle = DOT_COLOR;
          for (const point of kp) {
            ctx!.beginPath();
            ctx!.arc(point.x, point.y, dotRadius, 0, Math.PI * 2);
            ctx!.fill();
          }
        }
      }

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [handsRef, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ transform: 'scaleX(-1)' }}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
    />
  );
}
