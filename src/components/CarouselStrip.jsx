import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ThumbCard } from "./ThumbCard.jsx";
import { useDragScroll } from "../hooks/useDragScroll.js";
import { useSwipe } from "../hooks/useSwipe.js";

/**
 * CarouselStrip
 *
 * The auto-hiding bottom filmstrip.
 * - Mouse: click-and-drag with momentum; clicks suppressed if drag occurred
 * - Touch: native momentum scroll
 * - Thumbnails disable pointer-events while dragging so they can't intercept
 */

export function CarouselStrip({
  manifest,
  flatItems,
  activeIndex,
  onSelect,
  revealed,
  isZoomed,
  dragOffset: globalDragOffset,
  isDragging: isGlobalDragging,
  swipePower: globalSwipePower,
  direction: globalDirection,
  onMouseEnter,
  onMouseLeave,
  onHide,
}) {
  // Add at the top of the component, alongside the existing refs
  const activeCardRef = useRef(null);
  const { ref: stripRef, isDragging } = useDragScroll();
  const {
    ref: peekRef,
    dragOffset: localDragOffset,
    isDragging: isPeekDragging,
    swipePower: localSwipePower,
    direction: localDirection,
  } = useSwipe({
    onUp: onMouseEnter, // mapped to reveal
    onDown: onHide,
    onTap: onMouseEnter,
    threshold: 40,
  });

  // Use local dragging state (on peek bar) if active, otherwise fallback to global (on screen)
  const activeDragging = isPeekDragging || isGlobalDragging;
  const activeOffset = isPeekDragging ? localDragOffset : globalDragOffset;
  const activePower = isPeekDragging ? localSwipePower : globalSwipePower;
  const activeDir = isPeekDragging ? localDirection : globalDirection;

  // Dynamic handle styles based on gesture weight
  let handleScale = revealed ? 1.25 : 1;
  let handleOpacity = 0.7;

  if (activeDragging && activeDir === "vertical") {
    if (activeOffset < 0) {
      // Swiping Up: opacity targets 1.0 regardless of current state
      handleOpacity = Math.round((0.7 + 0.3 * activePower) * 10) / 10;
      if (!revealed) {
        handleScale = 1 + 0.25 * activePower;
      }
    } else if (revealed && activeOffset > 0) {
      // Swiping Down: 1.25x -> 1x, 0.7 -> 0.4 opacity
      handleScale = 1.25 - 0.25 * activePower;
      handleOpacity = Math.round((0.7 - 0.3 * activePower) * 10) / 10;
    }
  }

  // Destructure the new manifest shape — guard with fallback for safety
  const folders = manifest?.folders ?? [];

  // Scroll active card into view on selection change
  useEffect(() => {
    if (activeCardRef.current) {
      activeCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeIndex]);

  let globalIndex = 0;

  return (
    <div
      className={clsx("carousel-strip", { revealed, "is-zoomed": isZoomed })}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Peek bar */}
      <div ref={peekRef} className="carousel-peek-bar" aria-label="Show gallery">
        <div
          className={clsx("carousel-peek-handle", { "is-dragging": activeDragging })}
          style={{
            transform: `scale(${handleScale})`,
            opacity: handleOpacity,
          }}
        />
      </div>

      {/* Scrollable thumbnail row */}
      <div
        ref={stripRef}
        className={clsx("carousel-inner", { dragging: isDragging })}
        role="listbox"
        aria-label="Media gallery"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {folders.map((folder, fi) => {
          const divider = (
            <div key={`div-${fi}`} className="section-divider" aria-hidden="true">
              <div className="section-divider-line" />
              <span className="section-divider-label">{folder.label}</span>
              <div className="section-divider-line" />
            </div>
          );

          const cards = folder.items.map((item) => {
            const idx = globalIndex;
            globalIndex++;
            const isActive = idx === activeIndex;

            return (
              <div
                key={`${folder.folder}-${item.filename}`}
                ref={isActive ? activeCardRef : null}
                role="option"
                aria-selected={isActive}
                style={{ pointerEvents: isDragging ? "none" : "auto" }}
              >
                <ThumbCard item={item} isActive={isActive} onClick={() => onSelect(idx)} />
              </div>
            );
          });

          return [divider, ...cards];
        })}
      </div>
    </div>
  );
}
