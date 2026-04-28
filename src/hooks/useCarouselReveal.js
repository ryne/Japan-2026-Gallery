import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useCarouselReveal
 *
 * Controls the auto-hide / reveal behavior of the carousel strip.
 * The strip is "revealed" when the user hovers over the bottom
 * trigger zone or over the strip itself.
 */
export function useCarouselReveal(isDisabled = false) {
  const [revealed, setRevealed] = useState(false);
  const hideTimerRef = useRef(null);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const reveal = useCallback(() => {
    if (isDisabled) return;
    clearHideTimer();
    setRevealed(true);
  }, [isDisabled]);

  const hide = useCallback(() => {
    clearHideTimer();
    setRevealed(false);
  }, []);

  const scheduleHide = useCallback((delay = 800) => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => setRevealed(false), delay);
  }, []);

  // Also reveal when the mouse moves near the bottom of the window
  useEffect(() => {
    const TRIGGER_ZONE = 110; // Increased to account for buttons above the peek bar

    const handleMouseMove = (e) => {
      const fromBottom = window.innerHeight - e.clientY;
      if (fromBottom <= TRIGGER_ZONE) {
        reveal();
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [reveal]);

  // Hint animation on mount
  useEffect(() => {
    const showId = setTimeout(() => setRevealed(true), 618);
    const hideId = setTimeout(() => setRevealed(false), 3236);
    return () => {
      clearTimeout(showId);
      clearTimeout(hideId);
    };
  }, []);

  return { revealed, reveal, hide, scheduleHide };
}
