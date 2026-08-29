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
      <main className="flex flex-1 w-full flex-col items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl space-y-8">
          {/* Hero / Intro */}
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              Gesture Motion Playground
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
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
          <footer className="border-t border-zinc-800/60 pt-6 pb-8">
            <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
              Gesture Motion Playground -- Computer Vision Experiment
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}

