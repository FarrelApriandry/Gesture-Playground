# 🛡️ PROJECT CONSTRAINTS & DEVELOPMENT RULES

Dokumen ini berisi aturan mutlak (non-negotiable constraints) untuk pembuatan kode dalam project Gesture Motion Playground. Semua AI Agent WAJIB mematuhi aturan ini untuk mencegah memory leak, lag frame rate, dan error pada Next.js App Router.

---

## 1. Next.js & Client-Side Boundaries
* **Directive `'use client'` Wajib:** Semua komponen yang mengimpor TensorFlow.js, mengolah Webcam (`navigator.mediaDevices`), atau memakai browser API WAJIB diawali dengan `'use client'`.
* **No Server-Side Import:** Dilarang mengimpor `@tensorflow/*` di Server Components atau Route Handlers.

---

## 2. Performance & 60 FPS Detection Loop (CRITICAL)
* **Dilarang Menggunakan `useState` di Detection Loop:**
  * ❌ **JANGAN** update `useState` di dalam `requestAnimationFrame` atau `estimateHands()` loop. Ini akan memicu *re-render* 60x per detik dan membuat UI hancur/lag.
  * ✅ **GUNAKAN** `useRef` untuk menyimpan koordinat/state yang dibaca kontinu oleh JavaScript loop.
  * ✅ **GUNAKAN** Framer Motion `useMotionValue()` / `useTransform()` jika koordinat perlu menggerakkan elemen visual UI secara langsung tanpa memicu React re-render.

---

## 3. TensorFlow.js Lifecycle & Memory Management
* **Singleton Model Initialization:** Model `handPoseDetection` HANYA boleh di-load 1 kali saat komponen *mount*. Dilarang memanggil `createDetector()` di setiap render.
* **Async & WebGL Initialization:** Always await `tf.ready()` dan pastikan backend `webgl` diset sebelum memanggil `estimateHands()`.
* **Clean-Up Lifecycle:**
  * Wajib membatalkan `requestAnimationFrame` (`cancelAnimationFrame(requestRef.current)`) saat komponen *unmount*.
  * Wajib menghentikan semua *video track* dari webcam stream (`stream.getTracks().forEach(track => track.stop())`) pada cleanup `useEffect`.

---

## 4. Coordinate & Mirroring Rules
* **Horizontal Mirroring:** Video feed webcam di-mirror secara visual menggunakan CSS (`transform: scaleX(-1)`).
* **Coordinate Inversion:** Karena video di-mirror, perhitungan koordinat X untuk gesture/kursor harus dibalik:
  $$\text{Target X} = \text{Screen Width} - \text{Hand Landmark X}$$
  Semua fungsi kalkulasi matematika gestur wajib memperhitungkan pembalikan sumbu X ini secara konsisten.

---

## 5. Coding & Dependency Standards
* Utamakan *lightweight modular imports* (`@tensorflow/tfjs-core`, `@tensorflow/tfjs-backend-webgl`) dibanding mengimpor bundel monolithic `@tensorflow/tfjs`.
* Jangan menambahkan library UI eksternal baru tanpa instruksi spesifik. Gunakan Tailwind CSS dan Framer Motion yang sudah terpasang.