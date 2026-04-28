import { useEffect, useRef, useState } from "react";

/**
 * useLazyLoad
 *
 * Returns a ref to attach to a DOM element and a boolean `isVisible`.
 * Once the element enters the viewport the observer disconnects.
 *
 * @param {IntersectionObserverInit} options
 */
export function useLazyLoad(options = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || isVisible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0, ...options },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible, options]);

  return { ref, isVisible };
}
