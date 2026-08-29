# 📋 PROJECT ROADMAP & AI AGENT TASKS

Dokumen ini berisi daftar tugas bertahap (incremental tasks). AI Agent WAJIB mengerjakan tugas secara berurutan, menyelesaikan satu task hingga terverifikasi sebelum lanjut ke task berikutnya.

---

## Phase 1: Foundation & Camera Feed
- [x] **Task 1.1: WebGL & TF.js Singleton Initialization**
  - Buat `lib/tfjs/config.ts` untuk setup `tf.ready()` dan set backend ke `'webgl'`.
  - Buat `lib/tfjs/detector.ts` dengan pola singleton untuk `handPoseDetection.createDetector()`.
  - *Verification:* Panggil loader di `useEffect` awal dan pastikan console me-log `TensorFlow WebGL ready`.

- [x] **Task 1.2: Custom Webcam Hook & Video Component**
  - Buat `lib/hooks/use-webcam.ts` untuk menangani `navigator.mediaDevices.getUserMedia()`.
  - Buat `components/webcam-feed.tsx` yang me-render elemen `<video>` bermirror (`scaleX(-1)`).
  - Sertakan fungsi cleanup untuk menghentikan media track saat unmount.
  - *Verification:* Stream webcam tampil di browser tanpa memory leak saat tab ditutup/refresh.

---

## Phase 2: Detection Loop & Skeleton Overlay
- [x] **Task 2.1: RequestAnimationFrame Detection Hook**
  - Buat `lib/hooks/use-hand-pose.ts` untuk menjalankan loop `requestAnimationFrame`.
  - Alirkan frame dari `<video>` ke `detector.estimateHands()` secara kontinu.
  - Simpan hasil 21 landmark dalam `useRef` (bukan `useState`).
  - *Verification:* Detection loop berjalan tanpa menurunkan FPS browser di bawah 45 FPS.

- [x] **Task 2.2: Skeleton Canvas Rendering**
  - Buat `components/skeleton-canvas.tsx` dengan elemen `<canvas>` transparan melayang di atas video.
  - Gambar 21 titik landmark dan garis penghubung antar-sendi di Canvas 2D context.
  - *Verification:* Titik dan garis skeleton tangan menempel pas dengan tangan asli di feed webcam.

---

## Phase 3: Gesture Engine & Mathematics Parser
- [x] **Task 3.1: Math Primitives Module**
  - Buat `lib/gestures/math.ts` berisi fungsi `getEuclideanDistance()`, `getHandSpan()`, dan `getNormalizedDistance()`.
  - Implemen kalkulasi pembalikan sumbu X ($\text{Width} - x$) untuk koreksi video mirror.
  - *Verification:* Unit test atau console output kalkulasi jarak antara Landmark 4 dan 8 secara akurat.

- [x] **Task 3.2: Gesture Interpreter Engine**
  - Buat `lib/gestures/interpreter.ts` untuk mendeteksi gestur discrete (`PINCH`, `POINT`, `OPEN_PALM`, `FIST`, `VICTORY`).
  - Terapkan debouncing/latching 3 frame agar status gestur tidak *flickering*.
  - *Verification:* Log status gestur berganti dengan mulus saat kamu mengubah posisi tangan di depan kamera.

---

## Phase 4: Motion UI Integration & Playground
- [x] **Task 4.1: High-Speed Virtual Cursor**
  - Buat `components/playground/virtual-cursor.tsx`.
  - Hubungkan posisi Landmark 8 (Index Tip) saat gestur `POINT` ke Framer Motion `useMotionValue()`.
  - Render kursor kustom bergaya neon/glow yang mengikuti pergerakan telunjuk.
  - *Verification:* Kursor bergerak mulus tanpa delay berat dan tanpa memicu React re-render.

- [x] **Task 4.2: Interactive Pinch-to-Drag Card**
  - Buat `components/playground/draggable-card.tsx`.
  - Saat gestur `PINCH` aktif di atas area kartu, kunci posisi kartu ke koordinat kursor (Pinch-and-Hold).
  - Lepaskan kartu saat tangan berubah menjadi `OPEN_PALM`.
  - *Verification:* Kamu bisa memindahkan kartu UI di layar murni menggunakan gestur jepitan jari.

---

## Phase 5: Debug Tools & Polish
- [ ] **Task 5.1: Performance & FPS Monitor Overlay**
  - Buat komponen overlay simpel di pojok layar untuk menampilkan real-time FPS, aktif backend (`webgl`), dan nama gestur yang sedang terdeteksi.
  - *Verification:* Widget debug membantu memantau performa selama sesi eksplorasi.