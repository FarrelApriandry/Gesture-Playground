'use client';

import { useEffect } from 'react';
import { initTensorFlow } from '@/lib/tfjs/config';
import WebcamFeed from '@/components/webcam-feed';

export default function Home() {
  useEffect(() => {
    initTensorFlow().catch((err) => {
      console.error('TensorFlow initialisation failed:', err);
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-3xl font-bold text-black dark:text-zinc-50">
          Gesture Motion Playground
        </h1>
        <div className="mt-8 w-full">
          <WebcamFeed />
        </div>
      </main>
    </div>
  );
}

