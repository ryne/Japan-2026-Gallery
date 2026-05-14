import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useSwipe
 *
 * Pointer-based swipe/flick for both mouse and touch.
 * Drag offset is capped with a rubber-band curve so it never
 * runs away on desktop — feels intentional rather than unlimited.
 *
 * @param {object} opts
 * @param {() => void} opts.onNext
 * @param {() => void} opts.onPrev
 * @param {() => void} [opts.onUp]
 * @param {() => void} [opts.onDown]
 * @param {number} [opts.threshold=60]     min px to count as a swipe
 * @param {number} [opts.velocityMin=0.3]  min px/ms to count as a flick
 * @param {number} [opts.maxOffset=80]     hard cap on visible drag distance (px)
 */
export function useSwipe({
  onNext,
  onPrev,
  onUp,
  onDown,
  onTap,
  threshold = 60,
  velocityMin = 0.3,
  maxOffset = 80,
} = {}) {
  const [targetEl, setTargetEl] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [swipePower, setSwipePower] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [direction, setDirection] = useState(null);

  const ref = useCallback((node) => {
    if (node !== null) setTargetEl(node);
  }, []);

  // Keep callbacks fresh without triggering effect re-runs
  const callbacks = useRef({ onNext, onPrev, onUp, onDown, onTap });
  useEffect(() => {
    callbacks.current = { onNext, onPrev, onUp, onDown, onTap };
  }, [onNext, onPrev, onUp, onDown, onTap]);

  /**
   * Rubber-band clamp: moves freely up to `maxOffset`, then compresses
   * logarithmically beyond that so it always feels like there's resistance.
   */
  const rubberBand = useCallback(
    (x) => {
      const sign = x < 0 ? -1 : 1;
      const abs = Math.abs(x);
      if (abs <= maxOffset) return x;
      // Beyond cap: logarithmic decay
      const overflow = abs - maxOffset;
      const compressed = maxOffset + Math.log1p(overflow) * 12;
      return sign * Math.min(compressed, maxOffset * 1.5);
    },
    [maxOffset],
  );

  const state = useRef({
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false,
    isLocked: false,
    currentDirection: null,
  });

  const onPointerDown = useCallback((e) => {
    // Only left click
    if (e.button !== 0 && e.pointerType === "mouse") return;
    // Ignore multi-touch to allow pinch-to-zoom in PresentationView
    if (e.pointerType === "touch" && !e.isPrimary) return;
    // CRITICAL: Ignore anything inside the carousel strip
    if (e.target.closest(".carousel-inner, .vjs-control-bar, .media-controls")) {
      return;
    }

    state.current.startX = e.clientX;
    state.current.startY = e.clientY;
    state.current.startTime = performance.now();
    state.current.isTracking = true;
    state.current.isLocked = false;
    state.current.currentDirection = null;

    // Start capturing the pointer immediately
    e.currentTarget.setPointerCapture(e.pointerId);

    setDragOffset(0);
    setSwipePower(0);
    setIsDragging(false);
    setDirection(null);
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!state.current.isTracking) return;

      const dx = e.clientX - state.current.startX;
      const dy = e.clientY - state.current.startY;

      if (!state.current.isLocked) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < 5 && ady < 5) return; // Dead zone

        state.current.isLocked = true;
        state.current.currentDirection = ady > adx ? "vertical" : "horizontal";
        setDirection(state.current.currentDirection);
        setIsDragging(true);
      }

      if (state.current.currentDirection === "horizontal") {
        // Block browser-native horizontal gestures (like 'back') if we are swiping
        if (e.cancelable) e.preventDefault();
        // Apply rubber-band for a high-end "weighted" feel
        setDragOffset(rubberBand(dx));
        setSwipePower(Math.min(Math.abs(dx) / threshold, 1));
      } else if (state.current.currentDirection === "vertical") {
        if (e.cancelable) e.preventDefault();
        setDragOffset(dy);
        setSwipePower(Math.min(Math.abs(dy) / threshold, 1));
      }
    },
    [threshold, rubberBand],
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!state.current.isTracking) return;

      const dx = e.clientX - state.current.startX;
      const dy = e.clientY - state.current.startY;
      const dt = performance.now() - state.current.startTime;
      const dir = state.current.currentDirection;

      const velocity = Math.abs(dx) / dt;
      const vVelocity = Math.abs(dy) / dt;
      const isTap = Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 200;

      // Reset state first
      state.current.isTracking = false;
      setDragOffset(0);
      setSwipePower(0);
      setIsDragging(false);
      setDirection(null);

      if (isTap) {
        callbacks.current.onTap?.();
        return;
      }

      if (dir === "horizontal") {
        if (velocity > velocityMin || Math.abs(dx) >= threshold) {
          if (dx < 0) callbacks.current.onNext?.();
          else callbacks.current.onPrev?.();
        }
      } else if (dir === "vertical") {
        if (vVelocity > velocityMin || Math.abs(dy) >= threshold) {
          if (dy < 0) callbacks.current.onUp?.();
          else callbacks.current.onDown?.();
        }
      }
    },
    [threshold, velocityMin],
  );

  const onPointerCancel = useCallback(() => {
    state.current.isTracking = false;
    setDragOffset(0);
    setSwipePower(0);
    setIsDragging(false);
    setDirection(null);
  }, []);

  useEffect(() => {
    if (!targetEl) return;
    targetEl.addEventListener("pointerdown", onPointerDown);
    targetEl.addEventListener("pointermove", onPointerMove);
    targetEl.addEventListener("pointerup", onPointerUp);
    targetEl.addEventListener("pointercancel", onPointerCancel);
    return () => {
      targetEl.removeEventListener("pointerdown", onPointerDown);
      targetEl.removeEventListener("pointermove", onPointerMove);
      targetEl.removeEventListener("pointerup", onPointerUp);
      targetEl.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [targetEl, onPointerDown, onPointerMove, onPointerUp, onPointerCancel]);

  return { ref, dragOffset, isDragging, swipePower, direction };
}
