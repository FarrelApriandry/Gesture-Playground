import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack: alias @mediapipe/hands → our ESM-compatible shim.
  // The real package is a Google Closure blob with no standard exports,
  // which Turbopack cannot analyse. We only use the TFJS runtime, so
  // the Hands class is never actually instantiated.
  turbopack: {
    resolveAlias: {
      "@mediapipe/hands": "./lib/shims/mediapipe-hands-shim.ts",
    },
  },
};

export default nextConfig;

