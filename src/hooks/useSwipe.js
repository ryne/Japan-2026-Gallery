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
  const ref = useRef(null);
  const state = useRef({
    active: false,
    locked: false, // true once direction is committed
    direction: null, // 'horizontal' or 'vertical'
    startX: 0,
    startY: 0,
    startTime: 0,
    pointerId: null,
  });

  const [dragOffset, setDragOffset] = useState(0);
  const [swipePower, setSwipePower] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [direction, setDirection] = useState(null);

  /**
   * Rubber-band clamp: moves freely up to `maxOffset`, then compresses
   * logarithmically beyond that so it always feels like there's resistance.
   */
  const rubberBand = (x) => {
    const sign = x < 0 ? -1 : 1;
    const abs = Math.abs(x);
    if (abs <= maxOffset) return x;
    // Beyond cap: logarithmic decay
    const overflow = abs - maxOffset;
    const compressed = maxOffset + Math.log1p(overflow) * 12;
    return sign * Math.min(compressed, maxOffset * 1.5);
  };

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (state.current.active) return;

    // On mobile, ignore multi-touch for the swipe hook to allow pinch-to-zoom
    if (e.pointerType === "touch" && !e.isPrimary) return;

    // Ignore if clicking on video controls or big play button
    if (e.target.closest(".vjs-control-bar, .vjs-big-play-button, .media-controls")) return;

    state.current = {
      active: true,
      locked: false,
      direction: null,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      pointerId: e.pointerId,
    };

    // We no longer call setPointerCapture here to allow other listeners to coexist.
    setDragOffset(0);
    setSwipePower(0);
    setIsDragging(false);
    setDirection(null);
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!state.current.active || e.pointerId !== state.current.pointerId) return;

      const dx = e.clientX - state.current.startX;
      const dy = e.clientY - state.current.startY;

      if (!state.current.locked) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < 10 && ady < 10) return; // dead zone

        // Locked to the dominant axis
        if (ady > adx) {
          state.current.direction = "vertical";
          setDirection("vertical");
        } else {
          state.current.direction = "horizontal";
          setDirection("horizontal");
        }

        state.current.locked = true;
        setIsDragging(true);
        // Only capture once we are sure it's a swipe
        e.currentTarget.setPointerCapture(e.pointerId);
      }

      if (state.current.direction === "horizontal") {
        setDragOffset(rubberBand(dx));
        setSwipePower(Math.min(Math.abs(dx) / threshold, 1));
      } else if (state.current.direction === "vertical") {
        setDragOffset(dy);
        setSwipePower(Math.min(Math.abs(dy) / threshold, 1));
      }
    },
    [threshold], // rubberBand is pure, maxOffset is closure-stable
  );

  const onPointerUp = useCallback(
    (e) => {
      if (!state.current.active || e.pointerId !== state.current.pointerId) return;

      const dx = e.clientX - state.current.startX;
      const dy = e.clientY - state.current.startY;
      const dt = Math.max(performance.now() - state.current.startTime, 1);

      // Determine if this was a quick tap instead of a swipe/drag
      const isTap = Math.abs(dx) < 30 && Math.abs(dy) < 30 && dt < 250;

      const velocity = Math.abs(dx) / dt;
      const vVelocity = Math.abs(dy) / dt;

      state.current.active = false;
      setDragOffset(0);
      setSwipePower(0);
      setIsDragging(false);
      setDirection(null);

      if (isTap) {
        onTap?.();
      } else if (state.current.direction === "vertical") {
        if (vVelocity >= velocityMin || Math.abs(dy) >= threshold) {
          dy < 0 ? onUp?.() : onDown?.();
        }
      } else if (state.current.direction === "horizontal") {
        if (velocity >= velocityMin || Math.abs(dx) >= threshold) {
          dx < 0 ? onNext?.() : onPrev?.();
        }
      }
    },
    [onNext, onPrev, onUp, onDown, onTap, threshold, velocityMin],
  );

  const onPointerCancel = useCallback(() => {
    state.current.active = false;
    setDragOffset(0);
    setSwipePower(0);
    setIsDragging(false);
    setDirection(null);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reset internal state when attaching to ensure fresh start
    state.current.active = false;
    state.current.locked = false;
    setDragOffset(0);
    setSwipePower(0);
    setIsDragging(false);
    setDirection(null);

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerCancel);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [onPointerDown, onPointerMove, onPointerUp, onPointerCancel]);

  return { ref, dragOffset, isDragging, swipePower, direction };
}
