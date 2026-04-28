import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useDragScroll
 *
 * Click-and-drag momentum scrolling for a horizontal scroll container.
 *
 * Key behaviours:
 * - Tracks pointer movement to distinguish a drag from a click
 * - Suppresses child click events that were actually drag releases
 * - Returns `isDragging` so children can disable pointer-events during drag
 * - Applies momentum with friction on release so flicks feel weighted
 *
 * @returns {{ ref: React.RefObject, isDragging: boolean }}
 */
export function useDragScroll() {
  const ref = useRef(null);
  const drag = useRef({
    active: false,
    didMove: false, // true once we've moved past the dead zone
    startX: 0,
    scrollLeft: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0, // px per rAF frame (~16ms)
    rafId: null,
  });

  const [isDragging, setIsDragging] = useState(false);

  // ── Momentum ────────────────────────────────────────────────────────────────

  const stopMomentum = useCallback(() => {
    if (drag.current.rafId) {
      cancelAnimationFrame(drag.current.rafId);
      drag.current.rafId = null;
    }
  }, []);

  const applyMomentum = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Exponential friction — feels like a light surface
    drag.current.velocity *= 0.95;

    if (Math.abs(drag.current.velocity) < 0.4) {
      stopMomentum();
      setIsDragging(false);
      return;
    }

    el.scrollLeft -= drag.current.velocity;
    drag.current.rafId = requestAnimationFrame(applyMomentum);
  }, [stopMomentum]);

  // ── Pointer events ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      const el = ref.current;
      if (!el) return;

      stopMomentum();

      drag.current = {
        active: true,
        didMove: false,
        startX: e.clientX,
        scrollLeft: el.scrollLeft,
        lastX: e.clientX,
        lastTime: performance.now(),
        velocity: 0,
        rafId: null,
      };

      el.style.cursor = "grabbing";
    },
    [stopMomentum],
  );

  const onMouseMove = useCallback((e) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;

    const now = performance.now();
    const dt = now - drag.current.lastTime;
    const rawDx = e.clientX - drag.current.lastX;

    // Dead zone — don't start drag until pointer has clearly moved
    const totalDx = e.clientX - drag.current.startX;
    if (!drag.current.didMove && Math.abs(totalDx) < 6) return;

    if (!drag.current.didMove) {
      drag.current.didMove = true;
      setIsDragging(true);
    }

    // Velocity in px per ~16ms frame
    if (dt > 0) drag.current.velocity = (rawDx / dt) * 16;

    drag.current.lastX = e.clientX;
    drag.current.lastTime = now;

    el.scrollLeft = drag.current.scrollLeft - (e.clientX - drag.current.startX);
  }, []);

  const onMouseUp = useCallback(() => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;

    drag.current.active = false;
    el.style.cursor = "";

    if (drag.current.didMove && Math.abs(drag.current.velocity) > 0.8) {
      // Hand off to momentum rAF loop; setIsDragging(false) happens inside it
      drag.current.rafId = requestAnimationFrame(applyMomentum);
    } else {
      setIsDragging(false);
    }
  }, [applyMomentum]);

  /**
   * Suppress the click event that fires after a drag-release on a child element.
   * We capture it in the bubble phase BEFORE the child's onClick fires.
   */
  const onClickCapture = useCallback((e) => {
    if (drag.current.didMove) {
      e.stopPropagation();
      // Reset so the next genuine click isn't blocked
      drag.current.didMove = false;
    }
  }, []);

  // ── Effect ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("click", onClickCapture, true); // capture phase
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      stopMomentum();
    };
  }, [onMouseDown, onMouseMove, onMouseUp, onClickCapture, stopMomentum]);

  return { ref, isDragging };
}
