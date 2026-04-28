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
      {/* Shimmer placeholder */}
      {!loaded && <div className="shimmer absolute inset-0" />}

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
