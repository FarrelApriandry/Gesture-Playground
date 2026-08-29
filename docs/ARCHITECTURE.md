# 🏗️ SYSTEM ARCHITECTURE & DATA FLOW

Dokumen ini menjelaskan arsitektur sistem, hierarki komponen, dan alur pemrosesan data real-time untuk Gesture Motion Playground.

---

## 1. High-Level Pipeline


```

[ Webcam Feed ]
│ (MediaStream)
▼
[  Ref ]
│ (Video Frame Buffer)
▼
[ TF.js WebGL Engine ] ──► (21 Hand Landmarks: x, y, z)
│
▼
[ Gesture Math Interpreter ] ──► (Detected Gestures: PINCH, POINT, OPEN_PALM)
│
├──► [ Canvas Overlay ] (Draw Hand Skeleton @ 60 FPS)
└──► [ Framer Motion Values ] ──► [ Interactive UI Elements ]

```

---

## 2. Directory & Module Structure

```text
app/
 ├── layout.tsx             # Root layout (Tailwind, Fonts)
 └── page.tsx               # Main Playground Dashboard (Client Component)
components/
 ├── webcam-feed.tsx        # Video stream handler & hidden canvas
 ├── skeleton-canvas.tsx    # Canvas 2D overlay untuk render titik landmark
 └── playground/            # Interactive UI widgets (Cards, Canvas, Buttons)
     ├── draggable-card.tsx # Elemen UI yang merespon gestur Pinch
     └── virtual-cursor.tsx # Kursor kustom yang dikontrol gesture Point
lib/
 ├── tfjs/
 │    ├── detector.ts       # Singleton loader untuk HandPose Detector
 │    └── config.ts         # Konfigurasi WebGL backend & model params
 ├── gestures/
 │    ├── types.ts          # Type definitions (Landmarks, Gesture Types)
 │    ├── interpreter.ts    # Main gesture parser logic
 │    └── math.ts           # Euclidean distance & angle calculations
 └── hooks/
      ├── use-webcam.ts     # Hook pengelolaan MediaStream webcam
      └── use-hand-pose.ts  # Hook detection loop (requestAnimationFrame)

```

---

## 3. Data Flow & State Strategy

Untuk menjaga performa **60 FPS** tanpa bottleneck di React Virtual DOM:

### A. High-Frequency Pipeline (Direct Motion)

* **Target:** Koordinat Kursor & Skeleton Canvas.
* **Mechanism:** Data dari `estimateHands()` dikirim langsung ke `useMotionValue` (Framer Motion) dan `CanvasRenderingContext2D`.
* **React Re-render:** **0%** (Sama sekali tidak memicu render ulang komponen React).

### B. Discrete Event Pipeline (State Trigger)

* **Target:** Status Gestur (`isPinching`, `activeGestureType`).
* **Mechanism:** Event pemicu (misal: saat Pinch terdeteksi pertama kali) dikirim via callback atau `useRef` latching mechanism.
* **React Re-render:** Hanya terjadi saat ada perubahan status *discrete* (misal: dari `IDLE` -> `PINCH_START`).

---

## 4. Landmark Index Reference (21 Points)

Setiap deteksi menghasilkan array 21 titik koordinat 3D:

* **0:** Wrist (Pergelangan tangan)
* **1 - 4:** Thumb (Jempol) -> `4` = Thumb Tip
* **5 - 8:** Index Finger (Telunjuk) -> `8` = Index Tip
* **9 - 12:** Middle Finger (Jari Tengah) -> `12` = Middle Tip
* **13 - 16:** Ring Finger (Jari Manis) -> `16` = Ring Tip
* **17 - 20:** Pinky (Kelingking) -> `20` = Pinky Tip