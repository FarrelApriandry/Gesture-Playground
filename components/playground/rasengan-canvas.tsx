'use client';

/**
 * Rasengan Canvas -- Spinning Chakra Particle System
 *
 * Renders the Rasengan effect (concentric spinning rings + orbiting
 * chakra particles) on a transparent canvas overlay at z-index 20.
 *
 * **Zero-Rerender Architecture (CONSTRAINTS §2):**
 * - All particle physics are computed inside a requestAnimationFrame loop.
 * - Palm center is read from `palmCenterRef` every frame.
 * - Particle positions, angles, and scale are stored in local variables
 *   (not refs or state) since they exist only within the rAF closure.
 * - React `setState` is never invoked during animation.
 *
 * **Coordinate Inversion (CONSTRAINTS §4):**
 * - Canvas is CSS-mirrored with `transform: scaleX(-1)`.
 * - Raw TF.js coordinates map directly to canvas pixels (double-flip).
 *
 * @module
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Hand } from '@tensorflow-models/hand-pose-detection';

// ─── Constants ──────────────────────────────────────────────────────

/** Number of orbiting particles around the core. */
const PARTICLE_COUNT = 14;

/** Base radius of the Rasengan (scaled to hand size at runtime). */
const BASE_RADIUS = 40;

/** Number of concentric spinning rings. */
const RING_COUNT = 3;

/** Color palette -- blue/cyan chakra. */
const CORE_COLOR = 'rgba(100, 180, 255, 0.6)';
const RING_COLORS = [
  'rgba(80, 160, 255, 0.4)',
  'rgba(60, 140, 255, 0.25)',
  'rgba(40, 120, 255, 0.15)',
];
const PARTICLE_COLOR = 'rgba(180, 220, 255, 0.8)';

// ─── Props ──────────────────────────────────────────────────────────

interface RasenganCanvasProps {
  /** Ref to the latest detected hands. */
  handsRef: RefObject<Hand[]>;
  /** Ref to the video element for dimension sync. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Palm center position (from useJutsuEngine). null when inactive. */
  palmCenterRef: RefObject<{ x: number; y: number } | null>;
  /** Whether the Rasengan effect should be visible. */
  isActive: boolean;
}

// ─── Component ──────────────────────────────────────────────────────

export default function RasenganCanvas({
  videoRef,
  palmCenterRef,
  isActive,
}: RasenganCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;
    let frameId = 0;

    // Particle orbital angles (persistent across frames)
    const particleAngles = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => (i / PARTICLE_COUNT) * Math.PI * 2,
    );
    // Particle orbital speeds (vary slightly for visual richness)
    const particleSpeeds = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => 2.5 + (i % 3) * 0.8,
    );

    function draw() {
      if (cancelled) return;

      const video = videoRef.current;

      // Sync canvas resolution with video
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        if (canvas!.width !== video.videoWidth) canvas!.width = video.videoWidth;
        if (canvas!.height !== video.videoHeight) canvas!.height = video.videoHeight;
      } else {
        frameId = requestAnimationFrame(draw);
        return;
      }

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Only render when active and palm center is known
      if (!isActive) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const pc = palmCenterRef.current;
      if (!pc) {
        frameId = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now() / 1000;
      const cx = pc.x;
      const cy = pc.y;

      // --- Outer glow ---
      const glowGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, BASE_RADIUS * 2);
      glowGrad.addColorStop(0, 'rgba(60, 140, 255, 0.15)');
      glowGrad.addColorStop(1, 'rgba(60, 140, 255, 0)');
      ctx!.fillStyle = glowGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, BASE_RADIUS * 2, 0, Math.PI * 2);
      ctx!.fill();

      // --- Concentric spinning rings ---
      for (let i = 0; i < RING_COUNT; i++) {
        const ringRadius = BASE_RADIUS * (0.5 + i * 0.25);
        const rotation = now * (3.0 - i * 0.5) * (i % 2 === 0 ? 1 : -1);

        ctx!.strokeStyle = RING_COLORS[i];
        ctx!.lineWidth = 2 - i * 0.4;
        ctx!.beginPath();

        // Draw arc segments for spinning effect
        const segments = 6;
        for (let s = 0; s < segments; s++) {
          const startAngle = rotation + (s / segments) * Math.PI * 2;
          const endAngle = startAngle + (Math.PI * 2 / segments) * 0.6;
          ctx!.arc(cx, cy, ringRadius, startAngle, endAngle);
        }
        ctx!.stroke();
      }

      // --- Core glow ---
      const coreGrad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, BASE_RADIUS * 0.5);
      coreGrad.addColorStop(0, 'rgba(200, 230, 255, 0.8)');
      coreGrad.addColorStop(0.5, CORE_COLOR);
      coreGrad.addColorStop(1, 'rgba(60, 140, 255, 0)');
      ctx!.fillStyle = coreGrad;
      ctx!.beginPath();
      ctx!.arc(cx, cy, BASE_RADIUS * 0.5, 0, Math.PI * 2);
      ctx!.fill();

      // --- Orbiting particles ---
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particleAngles[i] += particleSpeeds[i] * 0.016;
        const orbitRadius = BASE_RADIUS * (0.7 + (i % 3) * 0.2);
        const px = cx + Math.cos(particleAngles[i]) * orbitRadius;
        const py = cy + Math.sin(particleAngles[i]) * orbitRadius;
        const particleSize = 1.5 + (i % 2);

        ctx!.fillStyle = PARTICLE_COLOR;
        ctx!.beginPath();
        ctx!.arc(px, py, particleSize, 0, Math.PI * 2);
        ctx!.fill();
      }

      frameId = requestAnimationFrame(draw);
    }

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [isActive, videoRef, palmCenterRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ transform: 'scaleX(-1)' }}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
    />
  );
}
