import React from "react";

const ChevronLeft = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRight = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * NavArrows
 *
 * Left / right navigation arrows positioned at mid-screen.
 * Also sets up keyboard listener for arrow keys.
 */
export function NavArrows({ onPrev, onNext, dragOffset, swipePower }) {
  const intensity = swipePower;

  const getDynamicStyle = (active) => {
    if (!active || intensity === 0) return {};

    return {
      backgroundColor: `rgba(0, 0, 0, ${0.5 + 0.3 * intensity})`,
      borderColor: `rgba(255, 255, 255, ${0.2 + 0.8 * intensity})`,
      transform: `translateY(-50%) scale(${1 + 0.05 * intensity})`,
      transition: "none", // Remove transition during active drag for responsiveness
    };
  };

  return (
    <>
      <button
        className="nav-arrow"
        style={{
          left: "var(--ui-gap-x)",
          ...getDynamicStyle(dragOffset > 0),
        }}
        onClick={onPrev}
        aria-label="Previous"
      >
        <ChevronLeft />
      </button>
      <button
        className="nav-arrow"
        style={{
          right: "var(--ui-gap-x)",
          ...getDynamicStyle(dragOffset < 0),
        }}
        onClick={onNext}
        aria-label="Next"
      >
        <ChevronRight />
      </button>
    </>
  );
}
