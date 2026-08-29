# Naruto Jutsu Engine -- Gesture Geometry & State Machine Specification

This document specifies the geometric formulas, classification thresholds, and Finite State Machine (FSM) rules for the Naruto Jutsu Engine.

---

## 1. Hand Seal Geometric Formulas

All hand seal calculations require scale-invariant normalization using the hand span metric:

```text
handSpan = EuclideanDistance(Landmark 0, Landmark 9)

```

For dual-hand seals, `averageHandSpan` is computed as the arithmetic mean of both hands' spans:

```text
averageHandSpan = (handSpan_left + handSpan_right) / 2

```

---

### Seal 1: Tiger (Harimau)

Both hands are pressed together vertically in front of the chest with index fingers and thumbs extended straight up, while all other fingers are interlocked or folded.

Geometric Conditions:

1. Both hands are detected (`hands.length == 2`).
2. Distance between left index tip (Landmark 8) and right index tip (Landmark 8) is minimal:
`EuclideanDistance(Tip8_Left, Tip8_Right) / averageHandSpan < 0.15`
3. Both index fingers are extended:
`isFingerExtended(Index_Left) == true AND isFingerExtended(Index_Right) == true`
4. Middle, Ring, and Pinky finger tips of both hands are folded toward the palm:
`EuclideanDistance(Tip_i, Wrist) / handSpan < 0.60` for `i` in `{12, 16, 20}`.

---

### Seal 2: Snake (Ular)

Both hands are clasped together with all fingers tightly interlocked.

Geometric Conditions:

1. Both hands are detected (`hands.length == 2`).
2. Wrist-to-wrist proximity is low:
`EuclideanDistance(Wrist_Left, Wrist_Right) / averageHandSpan < 0.40`
3. Left and right knuckle centroids are tightly clustered:
`EuclideanDistance(MCP9_Left, MCP9_Right) / averageHandSpan < 0.30`
4. All fingertip distances between left and right hands are within interlocking threshold:
`EuclideanDistance(Tip8_Left, Tip8_Right) / averageHandSpan < 0.25`

---

### Seal 3: Monkey (Monyet)

One hand rests horizontally flat over the back of the other hand with elbows flared horizontally.

Geometric Conditions:

1. Both hands are detected (`hands.length == 2`).
2. The palm plane of Hand A overlaps the dorsal/back plane of Hand B:
`EuclideanDistance(PalmCenter_A, PalmCenter_B) / averageHandSpan < 0.35`
3. Hand A orientation vector is perpendicular to Hand B orientation vector:
`AngleBetweenVectors(WristToMCP9_A, WristToMCP9_B) > 70 degrees AND < 110 degrees`
4. All fingers on Hand A are fully extended horizontally:
`isFingerExtended(i) == true` for `i` in `{4, 8, 12, 16, 20}`.

---

### Stance: Cupped Palm (Menadah)

A single hand (or dual hands) formed into a bowl/cupped shape facing forward, ready to contain and propel the spinning Rasengan chakra ball.

Geometric Conditions:

1. At least one hand is detected.
2. Palm Center coordinate is defined as the midpoint between Wrist (0) and Middle MCP (9):
`PalmCenter = (Landmark0 + Landmark9) / 2`
3. All five fingertips are curved inward toward the Palm Center, maintaining a concave bound:
`0.45 < EuclideanDistance(Tip_i, PalmCenter) / handSpan < 0.70` for `i` in `{4, 8, 12, 16, 20}`.
4. Fingertips are spread evenly around the center, avoiding a closed fist or flat open palm.

---

## 2. Finite State Machine (FSM)

The Jutsu Combo Engine operates as a deterministic Finite State Machine to prevent false triggers and validate sequential input.

```text
[ IDLE ]
   │
   │  Tiger Seal Detected
   ▼
[ RECORDING_SEQUENCE ]
   │
   │  Snake Seal Detected (within 3000ms)
   ▼
[ RECORDING_SEQUENCE ]
   │
   │  Monkey Seal Detected (within 3000ms)
   ▼
[ RASENGAN_PRIMED ]
   │
   │  Cupped Palm Stance Detected
   ▼
[ RASENGAN_ACTIVE ]
   │
   │  Hand Lowered / Fist / Timeout
   ▼
[ IDLE ]

```

---

## 3. Timing, Window, and Latching Rules

1. Combo Window Timeout: The total time allowed between consecutive hand seals is 3000 milliseconds. If no valid seal is detected within this window, the FSM resets to `IDLE`.
2. Frame Latching: A hand seal must be continuously recognized for 3 consecutive execution frames before the FSM registers the seal transition.
3. Debounce Delay: After registering a seal, a 200 millisecond lockout period prevents duplicate registrations of the same seal.