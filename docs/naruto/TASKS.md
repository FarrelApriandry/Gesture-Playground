# Naruto Jutsu Engine -- Implementation Tasks

This task checklist tracks the step-by-step implementation of the Naruto Jutsu Engine.

---

## Phase 1: Multi-Hand Data Pipeline Upgrade
- [ ] **Task 1.1: Update TensorFlow.js Detector Config**
  - Update `maxHands: 2` in `lib/tfjs/detector.ts`.
  - Update `useHandPose` hook to handle multi-hand array results cleanly.
  - *Verification:* `handsRef.current` contains 2 hand objects when both hands are visible in the camera feed.

- [ ] **Task 1.2: Multi-Hand Skeleton Rendering**
  - Update `components/skeleton-canvas.tsx` to iterate over all hands in `handsRef.current`.
  - *Verification:* Skeleton points and bone connections are rendered simultaneously on both hands.

---

## Phase 2: Hand Seal & Stance Classifiers
- [ ] **Task 2.1: Implement Hand Seal Geometry Classifiers**
  - Create `lib/gestures/seals.ts`.
  - Implement `detectTigerSeal(hands: Hand[])`.
  - Implement `detectSnakeSeal(hands: Hand[])`.
  - Implement `detectMonkeySeal(hands: Hand[])`.
  - *Verification:* Console logs accurately report seal recognition when performing hand seals.

- [ ] **Task 2.2: Implement Cupped Palm Stance Classifier**
  - Implement `detectCuppedPalm(hand: Hand)` in `lib/gestures/seals.ts`.
  - Calculate `palmCenter` and check 5-finger concave curvature thresholds.
  - *Verification:* Returns `true` when a single hand forms a cupped/bowl shape facing the camera.

---

## Phase 3: Combo Sequence Engine & FSM
- [ ] **Task 3.1: Implement Jutsu Finite State Machine**
  - Create `lib/gestures/jutsu-engine.ts`.
  - Implement combo sequence tracking (`Tiger -> Snake -> Monkey`).
  - Implement 3000ms combo window timeout and 3-frame latching debounce.
  - *Verification:* Transition state changes from `IDLE` to `RASENGAN_PRIMED` upon completing the 3-seal sequence.

---

## Phase 4: Rasengan Visual Effects & Integration
- [ ] **Task 4.1: Rasengan Particle Canvas Component**
  - Create `components/playground/rasengan-canvas.tsx`.
  - Draw rotating concentric chakra circles and orbiting particle vectors.
  - Lock particle center to `palmCenter` coordinates with X-axis inversion (`x' = videoWidth - x`).
  - *Verification:* Spinning blue chakra sphere renders seamlessly over the palm at 60 FPS without React re-renders.

- [ ] **Task 4.2: UI Integration & Verification**
  - Mount `<RasenganCanvas />` in `components/webcam-feed.tsx`.
  - Add technical HUD status indicators for active combo state.
  - Run `npx tsc --noEmit` and `npm run build`.
  - *Verification:* Zero TypeScript errors and clean build execution.