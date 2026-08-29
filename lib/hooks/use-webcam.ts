import { useEffect, useRef, useState } from 'react';

interface UseWebcamReturn {
  /// The active MediaStream, or null before/after streaming.
  stream: MediaStream | null;
  /// True while the camera permission is being requested / stream is starting.
  isLoading: boolean;
  /// Human-readable error message when webcam access fails.
  error: string | null;
}

/**
 * Custom hook that acquires and releases a webcam MediaStream.
 *
 * This hook is intentionally **video-element agnostic** — it only manages
 * the `MediaStream` lifecycle. The consuming component is responsible for
 * binding the stream to a `<video>` element (declarative stream binding).
 *
 * - Requests camera access via `getUserMedia` at an ideal 1280×720 resolution.
 * - Cleans up all media tracks on unmount to prevent memory leaks.
 *
 * @example
 * ```tsx
 * const { stream, isLoading, error } = useWebcam();
 * ```
 */
export function useWebcam(): UseWebcamReturn {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        setIsLoading(true);
        setError(null);

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
        });

        // Guard against state updates after unmount (Strict Mode cleanup)
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof DOMException
            ? err.message
          : 'An unknown error occurred while accessing the webcam.';

        setError(message);
        console.error('[useWebcam] Failed to access webcam:', err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    startCamera();

    // Cleanup: stop tracks to release camera hardware.
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  return { stream, isLoading, error };
}
