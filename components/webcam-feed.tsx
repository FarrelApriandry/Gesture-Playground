'use client';

import { useEffect, useRef, useState } from 'react';
import { useWebcam } from '@/lib/hooks/use-webcam';
import { useHandPose } from '@/lib/hooks/use-hand-pose';
import SkeletonCanvas from '@/components/skeleton-canvas';
import VirtualCursor from '@/components/playground/virtual-cursor';
import { interpretGesture } from '@/lib/gestures/interpreter';
import type { GestureName } from '@/lib/gestures/types';
import { GESTURE_EMOJI, GESTURE_DISPLAY_NAME } from '@/lib/gestures/types';

/**
 * Renders a mirrored webcam video feed with loading and error states.
 *
 * Uses **declarative stream binding**: the component owns the `<video>`
 * ref and binds the `MediaStream` from `useWebcam()` via a `useEffect`.
 * This cleanly separates the stream lifecycle (hook) from the DOM
 * element lifecycle (component), avoiding async race conditions with
 * React 19 Strict Mode double-mount.
 *
 * The video is horizontally flipped via CSS (`-scale-x-1`) so that
 * the user's movements appear natural — consistent with CONSTRAINTS.md §4.
 */
export default function WebcamFeed() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { stream, isLoading, error } = useWebcam();

  // Hand-pose detection — active only once the webcam stream is live.
  const { handsRef, isDetecting, error: poseError } = useHandPose({
    videoRef,
    isEnabled: !!stream,
  });

  // ─── Gesture Badge (Discrete Event Pipeline — CONSTRAINTS §2 & ARCH §3B) ───
  // The rAF loop reads handsRef and runs interpretGesture() every frame,
  // but only writes to `gestureName` state when the gesture *changes*.
  // This limits React re-renders to discrete transitions only.
  const [gestureName, setGestureName] = useState<GestureName>('NONE');
  const gestureLatchRef = useRef<GestureName>('NONE');

  useEffect(() => {
    if (!isDetecting) return;

    let cancelled = false;
    let frameId = 0;

    function poll() {
      if (cancelled) return;

      const result = interpretGesture(handsRef.current);

      // Only trigger a React re-render when the latched gesture changes
      if (result.name !== gestureLatchRef.current) {
        gestureLatchRef.current = result.name;
        setGestureName(result.name);
      }

      frameId = requestAnimationFrame(poll);
    }

    frameId = requestAnimationFrame(poll);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [isDetecting, handsRef]);

  // Bind stream to the video element whenever it changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch((err) => console.error('Video play error:', err));
  }, [stream]);

  // --- Error state ---
  if (error) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-xl border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-800">
        <div className="text-center px-6">
          <p className="text-lg font-semibold text-red-600 dark:text-red-400">
            🚫 Camera Access Denied
          </p>
          <p className="mt-2 text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Please allow camera permissions and reload the page.
          </p>
        </div>
      </div>
    );
  }

  // --- Loading / permission-request state ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-xl border border-zinc-200 bg-zinc-100 dark:bg-zinc-900 dark:border-zinc-800">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-500 dark:border-zinc-700 dark:border-t-blue-400" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Requesting camera access…
          </p>
        </div>
      </div>
    );
  }

  // --- Live video feed ---
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <video
        ref={videoRef}
        width={1280}
        height={720}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={() => {
          videoRef.current?.play().catch((err) =>
            console.error('Video play error:', err),
          );
        }}
        style={{ transform: 'scaleX(-1)' }} // Mirror the video feed
        className="w-full aspect-video rounded-xl object-cover"
      />
      {/* Skeleton overlay — draws landmarks at video pixel coords;
          container is also scaleX(-1) so double-flip = natural position. */}
      <SkeletonCanvas handsRef={handsRef} videoRef={videoRef} />

      {/* Virtual cursor — follows index finger tip when POINT gesture is active. */}
      <VirtualCursor
        handsRef={handsRef}
        videoRef={videoRef}
        isActive={gestureName === 'POINT'}
      />
      {/* Subtle live indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-600/80 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
        LIVE
      </div>

      {/* Detection status indicator */}
      {isDetecting && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-600/80 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          🤖 Detecting
        </div>
      )}

      {/* Gesture badge — shows detected gesture name in real-time */}
      {isDetecting && gestureName !== 'NONE' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-4 py-1.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all duration-200">
          <span className="text-base">{GESTURE_EMOJI[gestureName]}</span>
          <span>{GESTURE_DISPLAY_NAME[gestureName]}</span>
        </div>
      )}

      {/* Non-blocking pose error banner */}
      {poseError && (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          ⚠️ {poseError}
        </div>
      )}
    </div>
  );
}
