'use client';

/**
 * WebcamFeed -- Video stream renderer with overlays.
 *
 * Renders a mirrored webcam video feed with skeleton overlay, virtual cursor,
 * draggable card, and performance monitor HUD. Also handles loading, error,
 * and permission-denied states with dark-first styling.
 *
 * This is a presentational component -- all detection logic and gesture
 * recognition have been lifted to the parent via useWebcam, useHandPose,
 * and useGestureDetection hooks.
 *
 * CONSTRAINTS §2: High-frequency data (handsRef, fpsRef, latencyRef) is
 * read via refs -- never causes React re-renders in the rAF loop.
 * CONSTRAINTS §4: Video is mirrored via CSS `scaleX(-1)`.
 */

import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';
import SkeletonCanvas from '@/components/skeleton-canvas';
import VirtualCursor from '@/components/playground/virtual-cursor';
import DraggableCard from '@/components/playground/draggable-card';
import PerformanceMonitor from '@/components/playground/performance-monitor';
import type { GestureName } from '@/lib/gestures/types';
import { GESTURE_DISPLAY_NAME } from '@/lib/gestures/types';

// -- Props -------------------------------------------------------------------

interface WebcamFeedProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isLoading: boolean;
  webcamError: string | null;
  handsRef: RefObject<Hand[]>;
  isDetecting: boolean;
  poseError: string | null;
  fpsRef: RefObject<number>;
  latencyRef: RefObject<number>;
  gestureName: GestureName;
  gestureNameRef: RefObject<GestureName>;
}

// -- Component ---------------------------------------------------------------

export default function WebcamFeed({
  videoRef,
  stream,
  isLoading,
  webcamError,
  handsRef,
  isDetecting,
  poseError,
  fpsRef,
  latencyRef,
  gestureName,
  gestureNameRef,
}: WebcamFeedProps) {
  // Bind stream to the video element whenever it changes.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;
    video.play().catch((err) => console.error('Video play error:', err));
  }, [stream, videoRef]);

  // -- Error state ----------------------------------------------------------
  if (webcamError) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="text-center max-w-sm px-6">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-2">
            Camera Access Required
          </p>
          <p className="text-sm text-zinc-400">
            Allow camera access in your browser to use gesture tracking.
          </p>
        </div>
      </div>
    );
  }

  // -- Loading state --------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500" />
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
            Initializing Camera
          </p>
          <p className="text-sm text-zinc-400">Preparing hand tracking...</p>
        </div>
      </div>
    );
  }

  // -- Live video feed ------------------------------------------------------
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
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
        style={{ transform: 'scaleX(-1)' }}
        className="w-full aspect-video object-cover"
      />

      {/* Skeleton overlay */}
      <SkeletonCanvas handsRef={handsRef} videoRef={videoRef} />

      {/* Virtual cursor */}
      <VirtualCursor
        handsRef={handsRef}
        videoRef={videoRef}
        isActive={gestureName === 'POINT'}
      />

      {/* Draggable card */}
      <DraggableCard
        handsRef={handsRef}
        videoRef={videoRef}
        gestureName={gestureName}
      />

      {/* Performance monitor HUD */}
      <PerformanceMonitor
        fpsRef={fpsRef}
        latencyRef={latencyRef}
        gestureNameRef={gestureNameRef}
        backendName="WebGL"
      />

      {/* LIVE indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md bg-zinc-950/70 px-2.5 py-1 backdrop-blur-sm">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
          Live Camera
        </span>
      </div>

      {/* Detection status */}
      {isDetecting && (
        <div className="absolute top-3 right-3 flex items-center gap-2 rounded-md bg-zinc-950/70 px-2.5 py-1 backdrop-blur-sm">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-400">
            Tracking Active
          </span>
        </div>
      )}

      {/* Gesture badge */}
      {isDetecting && gestureName !== 'NONE' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-zinc-950/80 px-3 py-1.5 backdrop-blur-sm border border-zinc-700/50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            {GESTURE_DISPLAY_NAME[gestureName]}
          </span>
        </div>
      )}

      {/* Pose error banner */}
      {poseError && (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-zinc-950/80 border border-zinc-700/50 px-3 py-2 text-xs text-zinc-400 backdrop-blur-sm">
          {poseError}
        </div>
      )}
    </div>
  );
}
