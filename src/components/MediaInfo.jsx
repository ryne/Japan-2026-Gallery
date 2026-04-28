import React from "react";

/**
 * MediaInfo
 *
 * Displays folder name, date, and time for the currently active item
 * in the top-left corner of the presentation area.
 */
export function MediaInfo({ item, total, activeIndex }) {
  if (!item) return null;

  return (
    <div className="media-info">
      <div className="media-info-left">
        {/* Location / folder */}
        <h1
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            fontSize: "clamp(1.2rem, 2vw, 1.6rem)",
            fontWeight: 300,
            fontStyle: "italic",
            color: "#FFF",
            margin: 0,
            lineHeight: 1.2,
            textShadow: "0 2px 16px rgba(0,0,0,0.8)",
          }}
        >
          {item.folder}
        </h1>
      </div>

      <div className="media-info-right">
        {/* Date · Time */}
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "clamp(0.6rem, 0.9vw, 0.7rem)",
            letterSpacing: "0.08em",
            color: "#FFF",
            margin: 0,
            textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            opacity: "0.7",
          }}
        >
          {item.date || item.time
            ? [item.date, item.time].filter(Boolean).join("  ·  ")
            : "Unknown Date"}
        </p>

        {/* Counter */}
        <p
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "clamp(0.5rem, 0.75vw, 0.6rem)",
            letterSpacing: "0.12em",
            color: "#FFF",
            margin: "2px 0 0",
            textShadow: "0 1px 8px rgba(0,0,0,0.9)",
            opacity: "0.4",
          }}
        >
          {String(activeIndex + 1).padStart(3, "0")} / {String(total).padStart(3, "0")}
        </p>
      </div>
    </div>
  );
}
