# 🤌 GESTURE MATHEMATICS & SPECIFICATIONS

Dokumen ini mendefinisikan rumus matematika, threshold, dan logika deteksi untuk memetakan 21 koordinat landmark tangan dari TensorFlow.js menjadi gesture discrete/continuous.

---

## 1. Core Mathematical Primitives

Semua kalkulasi gestur menggunakan fungsi matematika dasar berikut:

### A. 2D Euclidean Distance
Mengukur jarak piksel antara dua titik landmark:
$$d(p_1, p_2) = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$$

### B. Normalized Distance (Scale Invariant)
Jarak piksel murni akan berubah ketika tangan maju/mundur dari kamera. Untuk mengatasinya, bagi jarak dengan **Hand Span** (jarak antara Wrist `0` dan Middle MCP `9`):
$$\text{Hand Span} = d(\text{Landmark } 0, \text{Landmark } 9)$$
$$\text{Normalized Distance}(p_1, p_2) = \frac{d(p_1, p_2)}{\text{Hand Span}}$$

---

## 2. Gesture Catalogue & Logic Rules

### 📍 1. Point / Pointer Move (`POINT`)
* **Penggunaan:** Menggerakkan kursor kustom atau mengarahkan pointer di layar.
* **Landmark Utama:** Index Tip (`8`).
* **Aturan Deteksi:**
  * Telunjuk terentang: $d(8, 0) > d(6, 0)$
  * Jari Tengah, Manis, Kelingking terlipat: Tips (`12`, `16`, `20`) lebih dekat ke Wrist (`0`) dibanding Knuckles (`10`, `14`, `18`).
* **Output Coordinates:**
  $$\text{Cursor X} = (\text{Width} - \text{Landmark } 8.x) \times \text{Scale Factor}$$
  $$\text{Cursor Y} = \text{Landmark } 8.y \times \text{Scale Factor}$$

---

### 🤏 2. Pinch / Click / Grab (`PINCH`)
* **Penggunaan:** Memicu aksi klik, *drag-and-drop*, atau *grab* objek 3D/UI.
* **Landmark Utama:** Thumb Tip (`4`) & Index Tip (`8`).
* **Aturan Deteksi:**
  $$\text{Normalized Distance}(4, 8) < 0.25$$
  *(Atau jarak piksel mentah $< 35\text{px}$ pada resolusi 640x480).*
* **State Transition:**
  * `PINCH_START`: Saat nilai jarak masuk di bawah threshold.
  * `PINCH_HOLD`: Saat nilai tetap di bawah threshold.
  * `PINCH_END`: Saat nilai melebihi threshold kembali.

---

### 🖐️ 3. Open Palm / Reset (`OPEN_PALM`)
* **Penggunaan:** *Hover state*, melepaskan *dragged object*, atau menetralkan interaksi.
* **Landmark Utama:** Semua Finger Tips (`4`, `8`, `12`, `16`, `20`).
* **Aturan Deteksi:**
  * Semua 5 ujung jari terentang jauh dari pergelangan tangan (Wrist `0`).
  * $\text{Normalized Distance}(t, 0) > 0.8$ untuk semua $t \in \{4, 8, 12, 16, 20\}$.

---

### ✊ 4. Fist / Stop (`FIST`)
* **Penggunaan:** Aksi *pause*, membersihkan canvas, atau memicu modal/menu.
* **Landmark Utama:** Finger Tips (`8`, `12`, `16`, `20`).
* **Aturan Deteksi:**
  * Semua 4 ujung jari terlipat rapat ke telapak tangan.
  * Distance $d(t, 0) < d(k, 0)$ di mana $t$ adalah Tip dan $k$ adalah MCP Knuckle.

---

### ✌️ 5. Victory / Zoom Toggle (`VICTORY`)
* **Penggunaan:** Mengubah mode perkakas (misal: dari Pen ke Eraser) atau memicu mode foto/snapshot.
* **Landmark Utama:** Index Tip (`8`) & Middle Tip (`12`).
* **Aturan Deteksi:**
  * Telunjuk (`8`) dan Jari Tengah (`12`) terentang.
  * Jari Manis (`16`) dan Kelingking (`20`) terlipat.
  * Jarak antara Index Tip (`8`) dan Middle Tip (`12`) $> 0.35 \times \text{Hand Span}$.

---

## 3. Debounce & Smoothing Strategies

Untuk mencegah status gestur "flickering" (berganti-ganti secara liar akibat noise kamera):

1. **Hysteresis Thresholding:** Gunakan threshold berbeda untuk pemicu *Start* dan *End*.
   * Contoh Pinch: *Trigger Start* jika $d < 0.20$, tetapi baru *Trigger End* jika $d > 0.30$.
2. **Frame Latching:** Gestur baru dianggap sah jika terdeteksi stabil minimal selama **3 frame berturut-turut**.