import React, { useState } from "react";
import { useLazyLoad } from "../hooks/useLazyLoad.js";
import clsx from "clsx";

/**
 * ThumbCard
 *
 * A single thumbnail in the carousel strip.
 * Lazy-loads its image via IntersectionObserver.
 * Shows a tooltip with folder name, date, and time on hover.
 */
export function ThumbCard({ item, isActive, onClick }) {
  const { ref, isVisible } = useLazyLoad();
  const [loaded, setLoaded] = useState(false);

  const tooltipParts = [item.folder];
  if (item.date) tooltipParts.push(item.date);
  if (item.time) tooltipParts.push(item.time);
  const tooltipText = tooltipParts.join(" · ");

  return (
    <div
      ref={ref}
      className={clsx("thumb-card", { active: isActive })}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={tooltipText}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    >
      {/* Centered loader icon */}
      {!loaded && (
        <div className="animate-loader-fade absolute inset-0 flex items-center justify-center">
          <svg
            className="h-3 w-3 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            ></circle>
            <path
              className="opacity-100"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        </div>
      )}

      {/* Lazy-loaded thumbnail */}
      {isVisible && (
        <img
          src={item.thumb}
          alt={tooltipText}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
          draggable="false"
        />
      )}

      {/* Video play indicator */}
      {item.type === "video" && (
        <div className="video-badge" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
            <polygon points="2,1 9,5 2,9" />
          </svg>
        </div>
      )}

      {/* Hover tooltip */}
      <div className="tooltip" aria-hidden="true">
        {tooltipText}
      </div>
    </div>
  );
}
