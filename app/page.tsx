'use client';

/**
 * Main Application Page -- Gesture Motion Playground
 *
 * Orchestrates the full application layout:
 * - AppHeader: Brand + system status
 * - Hero/Intro: Title and description
 * - WebcamFeed: Core webcam + overlays
 * - StatusCards: Tracking, gesture, and performance metrics
 *
 * Detection and gesture hooks are managed here and data is passed down
 * to both WebcamFeed (for overlays) and StatusCards (for metrics).
 *
 * CONSTRAINTS §2: All high-frequency data flows through refs.
 * The only useState in the detection pipeline is `gestureName`, which
 * changes only on discrete gesture transitions.
 */

import { useEffect, useRef } from 'react';
import { initTensorFlow } from '@/lib/tfjs/config';
import { useWebcam } from '@/lib/hooks/use-webcam';
import { useHandPose } from '@/lib/hooks/use-hand-pose';
import { useGestureDetection } from '@/lib/hooks/use-gesture-detection';
import { useJutsuEngine } from '@/lib/hooks/use-jutsu-engine';
import AppHeader from '@/components/app-header';
import WebcamFeed from '@/components/webcam-feed';
import StatusCards from '@/components/status-card';

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Webcam stream lifecycle
  const { stream, isLoading, error: webcamError } = useWebcam();

  // Hand-pose detection -- active once webcam stream is live
  const { handsRef, isDetecting, error: poseError, fpsRef, latencyRef } =
    useHandPose({
      videoRef,
      isEnabled: !!stream,
    });

  // Gesture recognition -- discrete event pipeline
  const { gestureName, gestureNameRef } = useGestureDetection({
    handsRef,
    isDetecting,
  });

  // Jutsu combo engine -- Naruto seal sequence FSM
  const {
    jutsuState,
    jutsuStateRef,
    comboProgress,
    comboProgressRef,
    palmCenterRef,
  } = useJutsuEngine({
    handsRef,
    isDetecting,
  });

  // TensorFlow initialization
  useEffect(() => {
    initTensorFlow().catch((err) => {
      console.error('TensorFlow initialisation failed:', err);
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 bg-zinc-950">
      {/* Header */}
      <AppHeader />

      {/* Main content */}
      <main className="flex flex-1 w-full flex-col items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-10">
        <div className="w-full max-w-7xl space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Hero / Intro */}
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl lg:text-3xl">
              Gesture Motion Playground
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400 sm:mt-2 sm:text-sm">
              A real-time hand tracking interface built for experimentation
              with computer vision and interaction.
            </p>
          </div>

          {/* Playground container */}
          <WebcamFeed
            videoRef={videoRef}
            stream={stream}
            isLoading={isLoading}
            webcamError={webcamError}
            handsRef={handsRef}
            isDetecting={isDetecting}
            poseError={poseError}
            fpsRef={fpsRef}
            latencyRef={latencyRef}
            gestureName={gestureName}
            gestureNameRef={gestureNameRef}
            jutsuState={jutsuState}
            jutsuStateRef={jutsuStateRef}
            comboProgress={comboProgress}
            comboProgressRef={comboProgressRef}
            palmCenterRef={palmCenterRef}
          />

          {/* Metrics section */}
          <StatusCards
            handsRef={handsRef}
            gestureName={gestureName}
            fpsRef={fpsRef}
            latencyRef={latencyRef}
            backendName="WebGL"
          />

          {/* Footer */}
          <footer className="border-t border-zinc-800/60 pt-4 pb-6 sm:pt-6 sm:pb-8">
            <p className="text-[9px] font-medium uppercase tracking-widest text-zinc-600 sm:text-[10px]">
              Gesture Motion Playground -- Computer Vision Experiment
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

