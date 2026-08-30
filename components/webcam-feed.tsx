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
import RasenganCanvas from '@/components/playground/rasengan-canvas';
import type { GestureName } from '@/lib/gestures/types';
import { GESTURE_DISPLAY_NAME } from '@/lib/gestures/types';
import type { JutsuState } from '@/lib/gestures/jutsu-engine';

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
  jutsuState: JutsuState;
  jutsuStateRef: RefObject<JutsuState>;
  comboProgress: number;
  comboProgressRef: RefObject<number>;
  palmCenterRef: RefObject<{ x: number; y: number } | null>;
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
  jutsuState,
  jutsuStateRef,
  comboProgress,
  comboProgressRef,
  palmCenterRef,
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
      <div className="flex items-center justify-center w-full aspect-video rounded-xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl">
        <div className="text-center max-w-xs px-4 sm:max-w-sm sm:px-6">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 sm:mb-4 sm:h-12 sm:w-12">
            <svg className="h-4 w-4 text-zinc-400 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1.5 sm:text-xs sm:mb-2">
            Camera Access Required
          </p>
          <p className="text-xs text-zinc-400 sm:text-sm">
            Allow camera access in your browser to use gesture tracking.
          </p>
        </div>
      </div>
    );
  }

  // -- Loading state --------------------------------------------------------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full aspect-video rounded-xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl">
        <div className="text-center">
          <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-500 sm:mb-4 sm:h-8 sm:w-8" />
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-1 sm:text-xs">
            Initializing Camera
          </p>
          <p className="text-xs text-zinc-400 sm:text-sm">Preparing hand tracking...</p>
        </div>
      </div>
    );
  }

  // -- Live video feed ------------------------------------------------------
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 sm:rounded-2xl">
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

      {/* Rasengan particle canvas */}
      <RasenganCanvas
        handsRef={handsRef}
        videoRef={videoRef}
        palmCenterRef={palmCenterRef}
        isActive={jutsuState === 'RASENGAN_ACTIVE'}
      />

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
      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-zinc-950/70 px-2 py-0.5 backdrop-blur-sm sm:top-3 sm:left-3 sm:gap-2 sm:px-2.5 sm:py-1">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
        {/* Short label on mobile, full label from sm+ */}
        <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-400 sm:text-[10px]">
          <span className="sm:hidden">Live</span>
          <span className="hidden sm:inline">Live Camera</span>
        </span>
      </div>

      {/* Detection status */}
      {isDetecting && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md bg-zinc-950/70 px-2 py-0.5 backdrop-blur-sm sm:top-3 sm:right-3 sm:gap-2 sm:px-2.5 sm:py-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[9px] font-medium uppercase tracking-widest text-zinc-400 sm:text-[10px]">
            <span className="sm:hidden">On</span>
            <span className="hidden sm:inline">Tracking</span>
          </span>
        </div>
      )}

      {/* Gesture badge -- top-center on all sizes, avoids bottom overlay collision */}
      {isDetecting && gestureName !== 'NONE' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md bg-zinc-950/80 px-2 py-0.5 backdrop-blur-sm border border-zinc-700/50 sm:top-3 sm:gap-2 sm:px-2.5 sm:py-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-200 sm:text-[10px]">
            {GESTURE_DISPLAY_NAME[gestureName]}
          </span>
        </div>
      )}

      {/* Jutsu HUD -- bottom-right combo status */}
      {isDetecting && jutsuState !== 'IDLE' && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-zinc-950/80 px-2 py-0.5 backdrop-blur-sm border border-zinc-700/50 sm:bottom-3 sm:right-3 sm:gap-2 sm:px-2.5 sm:py-1">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              jutsuState === 'RASENGAN_ACTIVE'
                ? 'bg-cyan-400 animate-pulse'
                : jutsuState === 'RASENGAN_PRIMED'
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
            }`}
          />
          <span className="text-[9px] font-mono font-medium uppercase tracking-wider text-zinc-300 sm:text-[10px]">
            {jutsuState === 'RASENGAN_ACTIVE'
              ? 'RASENGAN'
              : jutsuState === 'RASENGAN_PRIMED'
                ? 'PRIMED'
                : `SEAL ${comboProgress}/3`}
          </span>
        </div>
      )}

      {/* Pose error banner */}
      {poseError && (
        <div className="absolute bottom-2 left-2 right-2 rounded-md bg-zinc-950/80 border border-zinc-700/50 px-2 py-1 text-[9px] text-zinc-400 backdrop-blur-sm sm:bottom-3 sm:left-3 sm:right-3 sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs">
          {poseError}
        </div>
      )}
    </div>
  );
}
